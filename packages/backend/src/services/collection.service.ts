import { Collection, CreateCollectionRequest, UpdateCollectionRequest } from '@bookmark-manager/shared';
import { CollectionRepository } from '../repositories/collection.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';

/**
 * Collection service for managing collections
 */
export class CollectionService {
  constructor(
    private collectionRepository: CollectionRepository,
    private bookmarkRepository: BookmarkRepository
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

    // Verify ownership
    if (collection.ownerId !== userId) {
      throw new Error('Access denied');
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
    // Verify ownership
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    if (collection.ownerId !== userId) {
      throw new Error('Access denied');
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
}
