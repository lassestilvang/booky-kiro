import {
  Collection,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  CollectionPermission,
  CollectionRole,
} from '@bookmark-manager/shared';
import { CollectionRepository } from '../repositories/collection.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { CollectionPermissionRepository } from '../repositories/permission.repository.js';

/**
 * Collection service for managing collections
 */
export class CollectionService {
  constructor(
    private collectionRepository: CollectionRepository,
    private bookmarkRepository: BookmarkRepository,
    private permissionRepository: CollectionPermissionRepository
  ) {}

  /**
   * Get all collections for a user
   */
  async getUserCollections(userId: string): Promise<Collection[]> {
    return this.collectionRepository.findByOwner(userId);
  }

  /**
   * Get a single collection by ID
   */
  async getCollectionById(collectionId: string, userId: string): Promise<Collection | null> {
    const collection = await this.collectionRepository.findById(collectionId);
    
    if (!collection) {
      return null;
    }

    // Check if user is owner or has shared access
    if (collection.ownerId !== userId) {
      const hasAccess = await this.permissionRepository.hasAccess(collectionId, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }
    }

    return collection;
  }

  /**
   * Create a new collection
   */
  async createCollection(userId: string, data: CreateCollectionRequest): Promise<Collection> {
    const collectionData: Partial<Collection> = {
      ownerId: userId,
      title: data.title,
      icon: data.icon || '📁',
      isPublic: data.isPublic || false,
      parentId: data.parentId,
      sortOrder: 0,
    };

    return this.collectionRepository.create(collectionData);
  }

  /**
   * Update a collection
   */
  async updateCollection(
    collectionId: string,
    userId: string,
    data: UpdateCollectionRequest
  ): Promise<Collection> {
    // Verify ownership or editor permission
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    // Check if user is owner or has editor permission
    if (collection.ownerId !== userId) {
      const role = await this.permissionRepository.getUserRole(collectionId, userId);
      if (role !== 'editor' && role !== 'owner') {
        throw new Error('Access denied');
      }
    }

    // Handle null parentId (move to root level)
    const updateData: Partial<Collection> = {
      title: data.title,
      icon: data.icon,
      parentId: data.parentId === null ? undefined : data.parentId,
      isPublic: data.isPublic,
      sortOrder: data.sortOrder,
    };
    
    const updated = await this.collectionRepository.update(collectionId, updateData);
    if (!updated) {
      throw new Error('Failed to update collection');
    }

    return updated;
  }

  /**
   * Delete a collection
   * Moves bookmarks to default collection or deletes them based on preference
   */
  async deleteCollection(
    collectionId: string,
    userId: string,
    moveToDefault: boolean = true
  ): Promise<void> {
    // Verify ownership
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.ownerId !== userId) {
      throw new Error('Access denied');
    }

    if (moveToDefault) {
      // Move bookmarks to null collection (uncategorized)
      const bookmarks = await this.bookmarkRepository.findByCollection(collectionId);
      for (const bookmark of bookmarks) {
        await this.bookmarkRepository.update(bookmark.id, { collectionId: undefined });
      }
    } else {
      // Delete all bookmarks in the collection
      const bookmarks = await this.bookmarkRepository.findByCollection(collectionId);
      for (const bookmark of bookmarks) {
        await this.bookmarkRepository.delete(bookmark.id);
      }
    }

    // Delete the collection
    await this.collectionRepository.delete(collectionId);
  }

  /**
   * Get collection hierarchy (parent chain)
   */
  async getCollectionHierarchy(collectionId: string, userId: string): Promise<Collection[]> {
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.ownerId !== userId) {
      throw new Error('Access denied');
    }

    return this.collectionRepository.getHierarchy(collectionId);
  }

  /**
   * Get child collections
   */
  async getChildCollections(collectionId: string, userId: string): Promise<Collection[]> {
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.ownerId !== userId) {
      throw new Error('Access denied');
    }

    return this.collectionRepository.findChildren(collectionId);
  }

  /**
   * Count bookmarks in a collection
   */
  async countBookmarks(collectionId: string, userId: string): Promise<number> {
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.ownerId !== userId) {
      throw new Error('Access denied');
    }

    return this.collectionRepository.countBookmarks(collectionId);
  }

  /**
   * Share collection with a user
   */
  async shareCollection(
    collectionId: string,
    ownerId: string,
    targetUserId: string,
    role: CollectionRole
  ): Promise<CollectionPermission> {
    // Verify ownership
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.ownerId !== ownerId) {
      throw new Error('Access denied');
    }

    // Cannot share with yourself
    if (targetUserId === ownerId) {
      throw new Error('Cannot share collection with yourself');
    }

    // Create or update permission
    const permission = await this.permissionRepository.upsert({
      collectionId,
      userId: targetUserId,
      role,
    });

    return permission;
  }

  /**
   * Revoke collection access from a user
   */
  async revokeAccess(
    collectionId: string,
    ownerId: string,
    targetUserId: string
  ): Promise<void> {
    // Verify ownership
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.ownerId !== ownerId) {
      throw new Error('Access denied');
    }

    // Delete permission
    const deleted = await this.permissionRepository.deleteByCollectionAndUser(
      collectionId,
      targetUserId
    );

    if (!deleted) {
      throw new Error('Permission not found');
    }
  }

  /**
   * Get all permissions for a collection
   */
  async getCollectionPermissions(
    collectionId: string,
    userId: string
  ): Promise<CollectionPermission[]> {
    // Verify ownership
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.ownerId !== userId) {
      throw new Error('Access denied');
    }

    return this.permissionRepository.findByCollection(collectionId);
  }

  /**
   * Get collections shared with a user
   */
  async getSharedCollections(userId: string): Promise<Collection[]> {
    const permissions = await this.permissionRepository.findByUser(userId);
    const collections: Collection[] = [];

    for (const permission of permissions) {
      const collection = await this.collectionRepository.findById(permission.collectionId);
      if (collection) {
        collections.push(collection);
      }
    }

    return collections;
  }

  /**
   * Check if user has access to collection (owner or shared)
   */
  async hasAccess(collectionId: string, userId: string): Promise<boolean> {
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      return false;
    }

    // Owner has access
    if (collection.ownerId === userId) {
      return true;
    }

    // Check shared access
    return this.permissionRepository.hasAccess(collectionId, userId);
  }

  /**
   * Get user's role for a collection
   */
  async getUserRole(
    collectionId: string,
    userId: string
  ): Promise<CollectionRole | null> {
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      return null;
    }

    // Owner has owner role
    if (collection.ownerId === userId) {
      return 'owner';
    }

    // Check shared role
    return this.permissionRepository.getUserRole(collectionId, userId);
  }

  /**
   * Make collection public and generate share slug
   */
  async makePublic(collectionId: string, userId: string): Promise<string> {
    // Verify ownership
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.ownerId !== userId) {
      throw new Error('Access denied');
    }

    // Generate share slug if not exists
    if (collection.shareSlug) {
      return collection.shareSlug;
    }

    const shareSlug = await this.collectionRepository.generateShareSlug(collectionId);
    
    // Update isPublic flag
    await this.collectionRepository.update(collectionId, { isPublic: true });

    return shareSlug;
  }

  /**
   * Make collection private
   */
  async makePrivate(collectionId: string, userId: string): Promise<void> {
    // Verify ownership
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.ownerId !== userId) {
      throw new Error('Access denied');
    }

    // Update isPublic flag
    await this.collectionRepository.update(collectionId, { isPublic: false });
  }

  /**
   * Get public collection by share slug (no auth required)
   */
  async getPublicCollection(shareSlug: string): Promise<Collection | null> {
    const collection = await this.collectionRepository.findByShareSlug(shareSlug);
    
    if (!collection || !collection.isPublic) {
      return null;
    }

    return collection;
  }
}
