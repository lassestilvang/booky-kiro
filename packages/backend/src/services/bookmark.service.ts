import {
  Bookmark,
  BookmarkWithRelations,
  CreateBookmarkRequest,
  UpdateBookmarkRequest,
  PaginationParams,
  PaginatedResponse,
} from '@bookmark-manager/shared';
import {
  BookmarkRepository,
  BookmarkFilters,
} from '../repositories/bookmark.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { StorageClient } from '../utils/storage.js';

/**
 * Bookmark service for managing bookmarks
 */
export class BookmarkService {
  constructor(
    private bookmarkRepository: BookmarkRepository,
    private tagRepository: TagRepository,
    private storageClient?: StorageClient
  ) {}

  /**
   * Get all bookmarks for a user with optional filters and pagination
   */
  async getUserBookmarks(
    userId: string,
    filters?: Partial<BookmarkFilters>,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Bookmark>> {
    const bookmarkFilters: BookmarkFilters = {
      ownerId: userId,
      ...filters,
    };

    const { bookmarks, total } = await this.bookmarkRepository.findWithFilters(
      bookmarkFilters,
      pagination
    );

    const limit = pagination?.limit || 50;
    const page = pagination?.page || 1;
    const totalPages = Math.ceil(total / limit);

    return {
      data: bookmarks,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get a single bookmark by ID with tags and highlights
   */
  async getBookmarkById(
    bookmarkId: string,
    userId: string
  ): Promise<BookmarkWithRelations | null> {
    const bookmark =
      await this.bookmarkRepository.findByIdWithRelations(bookmarkId);

    if (!bookmark) {
      return null;
    }

    // Verify ownership
    if (bookmark.ownerId !== userId) {
      throw new Error('Access denied');
    }

    return bookmark;
  }

  /**
   * Create a new bookmark
   */
  async createBookmark(
    userId: string,
    data: CreateBookmarkRequest
  ): Promise<BookmarkWithRelations> {
    // Extract domain from URL
    const domain = this.extractDomain(data.url);

    // Check for duplicates
    const duplicates = await this.bookmarkRepository.findDuplicatesByUrl(
      userId,
      data.url
    );
    const isDuplicate = duplicates.length > 0;

    // Create bookmark
    const bookmarkData: Partial<Bookmark> = {
      ownerId: userId,
      url: data.url,
      title: data.title || data.url,
      excerpt: data.excerpt,
      collectionId: data.collectionId,
      type: data.type || 'article',
      domain,
      coverUrl: data.coverUrl,
      isDuplicate,
      isBroken: false,
      contentIndexed: false,
    };

    const bookmark = await this.bookmarkRepository.create(bookmarkData);

    // Handle tags if provided
    let tags: any[] = [];
    if (data.tags && data.tags.length > 0) {
      tags = await this.createOrGetTags(userId, data.tags);
      const tagIds = tags.map((tag) => tag.id);
      await this.bookmarkRepository.addTags(bookmark.id, tagIds);
    }

    return {
      ...bookmark,
      tags,
      highlights: [],
    };
  }

  /**
   * Update a bookmark
   */
  async updateBookmark(
    bookmarkId: string,
    userId: string,
    data: UpdateBookmarkRequest
  ): Promise<BookmarkWithRelations> {
    // Verify ownership
    const bookmark = await this.bookmarkRepository.findById(bookmarkId);
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }

    if (bookmark.ownerId !== userId) {
      throw new Error('Access denied');
    }

    // Update bookmark - only include fields that are actually provided
    const updateData: Partial<Bookmark> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.collectionId !== undefined) {
      updateData.collectionId =
        data.collectionId === null ? undefined : data.collectionId;
    }
    if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl;
    if (data.customOrder !== undefined)
      updateData.customOrder = data.customOrder;

    const updated = await this.bookmarkRepository.update(
      bookmarkId,
      updateData
    );
    if (!updated) {
      throw new Error('Failed to update bookmark');
    }

    // Handle tags if provided
    if (data.tags !== undefined) {
      // Get current tags
      const currentTags =
        await this.bookmarkRepository.getBookmarkTags(bookmarkId);
      const currentTagIds = currentTags.map((tag) => tag.id);

      // Create or get new tags
      const newTags = await this.createOrGetTags(userId, data.tags);
      const newTagIds = newTags.map((tag) => tag.id);

      // Remove old tags
      const tagsToRemove = currentTagIds.filter(
        (id) => !newTagIds.includes(id)
      );
      if (tagsToRemove.length > 0) {
        await this.bookmarkRepository.removeTags(bookmarkId, tagsToRemove);
      }

      // Add new tags
      const tagsToAdd = newTagIds.filter((id) => !currentTagIds.includes(id));
      if (tagsToAdd.length > 0) {
        await this.bookmarkRepository.addTags(bookmarkId, tagsToAdd);
      }
    }

    // Return updated bookmark with relations
    const result =
      await this.bookmarkRepository.findByIdWithRelations(bookmarkId);
    if (!result) {
      throw new Error('Failed to retrieve updated bookmark');
    }

    return result;
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(bookmarkId: string, userId: string): Promise<void> {
    // Verify ownership
    const bookmark = await this.bookmarkRepository.findById(bookmarkId);
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }

    if (bookmark.ownerId !== userId) {
      throw new Error('Access denied');
    }

    // Delete bookmark (cascade will handle highlights and tags)
    await this.bookmarkRepository.delete(bookmarkId);
  }

  /**
   * Move bookmark to a different collection
   */
  async moveBookmark(
    bookmarkId: string,
    userId: string,
    collectionId: string | null
  ): Promise<Bookmark> {
    // Verify ownership
    const bookmark = await this.bookmarkRepository.findById(bookmarkId);
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }

    if (bookmark.ownerId !== userId) {
      throw new Error('Access denied');
    }

    const updated = await this.bookmarkRepository.moveToCollection(
      bookmarkId,
      collectionId
    );
    if (!updated) {
      throw new Error('Failed to move bookmark');
    }

    return updated;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  /**
   * Bulk add tags to multiple bookmarks
   */
  async bulkAddTags(
    userId: string,
    bookmarkIds: string[],
    tagNames: string[]
  ): Promise<{
    processedCount: number;
    failedCount: number;
    errors: Array<{ bookmarkId: string; error: string }>;
  }> {
    const errors: Array<{ bookmarkId: string; error: string }> = [];
    let processedCount = 0;

    // Create or get tags
    const tags = await this.createOrGetTags(userId, tagNames);
    const tagIds = tags.map((tag) => tag.id);

    // Process each bookmark
    for (const bookmarkId of bookmarkIds) {
      try {
        // Verify ownership
        const bookmark = await this.bookmarkRepository.findById(bookmarkId);
        if (!bookmark) {
          errors.push({ bookmarkId, error: 'Bookmark not found' });
          continue;
        }

        if (bookmark.ownerId !== userId) {
          errors.push({ bookmarkId, error: 'Access denied' });
          continue;
        }

        // Add tags
        await this.bookmarkRepository.addTags(bookmarkId, tagIds);
        processedCount++;
      } catch (error) {
        errors.push({
          bookmarkId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      processedCount,
      failedCount: errors.length,
      errors,
    };
  }

  /**
   * Bulk remove tags from multiple bookmarks
   */
  async bulkRemoveTags(
    userId: string,
    bookmarkIds: string[],
    tagNames: string[]
  ): Promise<{
    processedCount: number;
    failedCount: number;
    errors: Array<{ bookmarkId: string; error: string }>;
  }> {
    const errors: Array<{ bookmarkId: string; error: string }> = [];
    let processedCount = 0;

    // Get tag IDs
    const tagIds: string[] = [];
    for (const name of tagNames) {
      const normalizedName = name.toLowerCase().trim();
      const tag = await this.tagRepository.findByNormalizedName(
        userId,
        normalizedName
      );
      if (tag) {
        tagIds.push(tag.id);
      }
    }

    // Process each bookmark
    for (const bookmarkId of bookmarkIds) {
      try {
        // Verify ownership
        const bookmark = await this.bookmarkRepository.findById(bookmarkId);
        if (!bookmark) {
          errors.push({ bookmarkId, error: 'Bookmark not found' });
          continue;
        }

        if (bookmark.ownerId !== userId) {
          errors.push({ bookmarkId, error: 'Access denied' });
          continue;
        }

        // Remove tags
        await this.bookmarkRepository.removeTags(bookmarkId, tagIds);
        processedCount++;
      } catch (error) {
        errors.push({
          bookmarkId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      processedCount,
      failedCount: errors.length,
      errors,
    };
  }

  /**
   * Bulk move bookmarks to a collection
   */
  async bulkMoveToCollection(
    userId: string,
    bookmarkIds: string[],
    collectionId: string | null
  ): Promise<{
    processedCount: number;
    failedCount: number;
    errors: Array<{ bookmarkId: string; error: string }>;
  }> {
    const errors: Array<{ bookmarkId: string; error: string }> = [];

    // Verify ownership of all bookmarks
    for (const bookmarkId of bookmarkIds) {
      const bookmark = await this.bookmarkRepository.findById(bookmarkId);
      if (!bookmark) {
        errors.push({ bookmarkId, error: 'Bookmark not found' });
      } else if (bookmark.ownerId !== userId) {
        errors.push({ bookmarkId, error: 'Access denied' });
      }
    }

    // If any errors, don't proceed (atomicity)
    if (errors.length > 0) {
      return {
        processedCount: 0,
        failedCount: errors.length,
        errors,
      };
    }

    // Perform bulk move
    const processedCount = await this.bookmarkRepository.bulkMoveToCollection(
      bookmarkIds,
      collectionId
    );

    return {
      processedCount,
      failedCount: 0,
      errors: [],
    };
  }

  /**
   * Bulk delete bookmarks
   */
  async bulkDeleteBookmarks(
    userId: string,
    bookmarkIds: string[]
  ): Promise<{
    processedCount: number;
    failedCount: number;
    errors: Array<{ bookmarkId: string; error: string }>;
  }> {
    const errors: Array<{ bookmarkId: string; error: string }> = [];

    // Verify ownership of all bookmarks
    for (const bookmarkId of bookmarkIds) {
      const bookmark = await this.bookmarkRepository.findById(bookmarkId);
      if (!bookmark) {
        errors.push({ bookmarkId, error: 'Bookmark not found' });
      } else if (bookmark.ownerId !== userId) {
        errors.push({ bookmarkId, error: 'Access denied' });
      }
    }

    // If any errors, don't proceed (atomicity)
    if (errors.length > 0) {
      return {
        processedCount: 0,
        failedCount: errors.length,
        errors,
      };
    }

    // Perform bulk delete
    const processedCount =
      await this.bookmarkRepository.bulkDelete(bookmarkIds);

    return {
      processedCount,
      failedCount: 0,
      errors: [],
    };
  }

  /**
   * Update custom order for bookmarks
   */
  async updateCustomOrder(
    userId: string,
    updates: Array<{ id: string; order: number }>
  ): Promise<void> {
    // Verify ownership of all bookmarks
    for (const update of updates) {
      const bookmark = await this.bookmarkRepository.findById(update.id);
      if (!bookmark) {
        throw new Error(`Bookmark ${update.id} not found`);
      }
      if (bookmark.ownerId !== userId) {
        throw new Error(`Access denied for bookmark ${update.id}`);
      }
    }

    // Update custom order
    await this.bookmarkRepository.updateCustomOrder(updates);
  }

  /**
   * Get archived snapshot content for a bookmark
   */
  async getBookmarkSnapshot(
    bookmarkId: string,
    userId: string
  ): Promise<string | null> {
    // Verify ownership
    const bookmark = await this.bookmarkRepository.findById(bookmarkId);
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }

    if (bookmark.ownerId !== userId) {
      throw new Error('Access denied');
    }

    // Check if snapshot exists
    if (!bookmark.contentSnapshotPath) {
      return null;
    }

    // If no storage client, return null
    if (!this.storageClient) {
      return null;
    }

    try {
      // Get snapshot from storage
      const stream = await this.storageClient.getFile(
        bookmark.contentSnapshotPath
      );

      // Convert stream to string
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const content = Buffer.concat(chunks).toString('utf-8');

      return content;
    } catch (error) {
      console.error('Failed to retrieve snapshot:', error);
      return null;
    }
  }

  /**
   * Create or get existing tags
   */
  private async createOrGetTags(
    userId: string,
    tagNames: string[]
  ): Promise<any[]> {
    const tags: unknown[] = [];

    for (const name of tagNames) {
      const normalizedName = name.toLowerCase().trim();

      // Try to find existing tag
      let tag = await this.tagRepository.findByNormalizedName(
        userId,
        normalizedName
      );

      // Create if doesn't exist
      if (!tag) {
        tag = await this.tagRepository.create({
          ownerId: userId,
          name: name.trim(),
          normalizedName,
        });
      }

      tags.push(tag);
    }

    return tags;
  }
}
