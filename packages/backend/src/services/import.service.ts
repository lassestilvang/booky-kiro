import {
  Bookmark,
  Collection,
  Tag,
  ImportResponse,
} from '@bookmark-manager/shared';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { CollectionRepository } from '../repositories/collection.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { JSDOM } from 'jsdom';

/**
 * Import service for importing bookmarks from various formats
 */
export class ImportService {
  constructor(
    private bookmarkRepository: BookmarkRepository,
    private collectionRepository: CollectionRepository,
    private tagRepository: TagRepository
  ) {}

  /**
   * Import bookmarks from HTML file (Netscape Bookmark Format)
   * Preserves folder structure as collections
   */
  async importFromHtml(userId: string, html: string): Promise<ImportResponse> {
    const errors: string[] = [];
    let importedBookmarks = 0;
    let importedCollections = 0;
    let importedTags = 0;

    try {
      // Parse HTML
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Find the main DL element (bookmark list)
      const mainDL = document.querySelector('DL');
      if (!mainDL) {
        throw new Error('Invalid HTML bookmark file: No DL element found');
      }

      // Process the bookmark tree
      const result = await this.processBookmarkNode(
        userId,
        mainDL,
        null, // No parent collection for root
        errors
      );

      importedBookmarks = result.bookmarkCount;
      importedCollections = result.collectionCount;
      importedTags = result.tagCount;

      return {
        success: errors.length === 0,
        importedBookmarks,
        importedCollections,
        importedTags,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Unknown error during import'
      );
      return {
        success: false,
        importedBookmarks,
        importedCollections,
        importedTags,
        errors,
      };
    }
  }

  /**
   * Import bookmarks from JSON format
   * Supports full data import with metadata
   */
  async importFromJson(
    userId: string,
    data: {
      bookmarks: Partial<Bookmark>[];
      collections: Partial<Collection>[];
      tags: Partial<Tag>[];
    }
  ): Promise<ImportResponse> {
    const errors: string[] = [];
    let importedBookmarks = 0;
    let importedCollections = 0;
    let importedTags = 0;

    try {
      // Map old collection IDs to new ones
      const collectionIdMap = new Map<string, string>();

      // Import collections first
      for (const collectionData of data.collections) {
        try {
          const oldId = collectionData.id;

          // Create collection
          const collection = await this.collectionRepository.create({
            ownerId: userId,
            title: collectionData.title || 'Untitled Collection',
            icon: collectionData.icon || '📁',
            isPublic: false,
            sortOrder: collectionData.sortOrder || 0,
          });

          if (oldId) {
            collectionIdMap.set(oldId, collection.id);
          }
          importedCollections++;
        } catch (error) {
          errors.push(
            `Failed to import collection "${collectionData.title}": ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Update parent references for collections
      for (const collectionData of data.collections) {
        if (collectionData.id && collectionData.parentId) {
          const newId = collectionIdMap.get(collectionData.id);
          const newParentId = collectionIdMap.get(collectionData.parentId);

          if (newId && newParentId) {
            try {
              await this.collectionRepository.update(newId, {
                parentId: newParentId,
              });
            } catch (error) {
              errors.push(
                `Failed to update parent for collection: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          }
        }
      }

      // Map old tag IDs to new ones
      const tagIdMap = new Map<string, string>();

      // Import tags
      for (const tagData of data.tags) {
        try {
          const oldId = tagData.id;
          const normalizedName = (tagData.name || '').toLowerCase().trim();

          // Check if tag already exists
          let tag = await this.tagRepository.findByNormalizedName(
            userId,
            normalizedName
          );

          if (!tag) {
            // Create new tag
            tag = await this.tagRepository.create({
              ownerId: userId,
              name: tagData.name || 'Untitled Tag',
              normalizedName,
              color: tagData.color,
            });
            importedTags++;
          }

          if (oldId) {
            tagIdMap.set(oldId, tag.id);
          }
        } catch (error) {
          errors.push(
            `Failed to import tag "${tagData.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Import bookmarks
      for (const bookmarkData of data.bookmarks) {
        try {
          if (!bookmarkData.url) {
            errors.push('Skipped bookmark without URL');
            continue;
          }

          // Map collection ID
          let collectionId: string | undefined;
          if (bookmarkData.collectionId) {
            collectionId = collectionIdMap.get(bookmarkData.collectionId);
          }

          // Extract domain from URL
          const domain = this.extractDomain(bookmarkData.url);

          // Check for duplicates
          const duplicates = await this.bookmarkRepository.findDuplicatesByUrl(
            userId,
            bookmarkData.url
          );
          const isDuplicate = duplicates.length > 0;

          // Create bookmark
          await this.bookmarkRepository.create({
            ownerId: userId,
            url: bookmarkData.url,
            title: bookmarkData.title || bookmarkData.url,
            excerpt: bookmarkData.excerpt,
            collectionId,
            type: bookmarkData.type || 'article',
            domain,
            coverUrl: bookmarkData.coverUrl,
            isDuplicate,
            isBroken: false,
            contentIndexed: false,
            customOrder: bookmarkData.customOrder,
          });

          importedBookmarks++;

          // Handle tags if provided (stored as tag IDs in the bookmark data)
          // Note: In a real export, we'd need to handle tag associations separately
        } catch (error) {
          errors.push(
            `Failed to import bookmark "${bookmarkData.title || bookmarkData.url}": ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      return {
        success: errors.length === 0,
        importedBookmarks,
        importedCollections,
        importedTags,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Unknown error during import'
      );
      return {
        success: false,
        importedBookmarks,
        importedCollections,
        importedTags,
        errors,
      };
    }
  }

  /**
   * Process a bookmark node (DL element) recursively
   */
  private async processBookmarkNode(
    userId: string,
    dlElement: Element,
    parentCollectionId: string | null,
    errors: string[]
  ): Promise<{
    bookmarkCount: number;
    collectionCount: number;
    tagCount: number;
  }> {
    let bookmarkCount = 0;
    let collectionCount = 0;
    let tagCount = 0;

    // Process each child element
    const children = Array.from(dlElement.children);

    for (const child of children) {
      if (child.tagName === 'DT') {
        // DT can contain either a folder (H3 + DL) or a bookmark (A)
        const h3 = child.querySelector('H3');
        const a = child.querySelector('A');

        if (h3) {
          // This is a folder (collection)
          const folderName = h3.textContent?.trim() || 'Untitled Folder';

          try {
            // Create collection
            const collection = await this.collectionRepository.create({
              ownerId: userId,
              title: folderName,
              icon: '📁',
              isPublic: false,
              parentId: parentCollectionId || undefined,
              sortOrder: 0,
            });

            collectionCount++;

            // Process nested bookmarks
            const nestedDL = child.querySelector('DL');
            if (nestedDL) {
              const result = await this.processBookmarkNode(
                userId,
                nestedDL,
                collection.id,
                errors
              );
              bookmarkCount += result.bookmarkCount;
              collectionCount += result.collectionCount;
              tagCount += result.tagCount;
            }
          } catch (error) {
            errors.push(
              `Failed to create collection "${folderName}": ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        } else if (a) {
          // This is a bookmark
          const url = a.getAttribute('HREF');
          const title = a.textContent?.trim();
          const tags = a.getAttribute('TAGS');

          if (!url) {
            errors.push('Skipped bookmark without URL');
            continue;
          }

          try {
            // Extract domain
            const domain = this.extractDomain(url);

            // Check for duplicates
            const duplicates =
              await this.bookmarkRepository.findDuplicatesByUrl(userId, url);
            const isDuplicate = duplicates.length > 0;

            // Create bookmark
            const bookmark = await this.bookmarkRepository.create({
              ownerId: userId,
              url,
              title: title || url,
              collectionId: parentCollectionId || undefined,
              type: 'article',
              domain,
              isDuplicate,
              isBroken: false,
              contentIndexed: false,
            });

            bookmarkCount++;

            // Handle tags if present
            if (tags) {
              const tagNames = tags
                .split(',')
                .map((t) => t.trim())
                .filter((t) => t.length > 0);
              const tagIds: string[] = [];

              for (const tagName of tagNames) {
                const normalizedName = tagName.toLowerCase();

                // Try to find existing tag
                let tag = await this.tagRepository.findByNormalizedName(
                  userId,
                  normalizedName
                );

                // Create if doesn't exist
                if (!tag) {
                  tag = await this.tagRepository.create({
                    ownerId: userId,
                    name: tagName,
                    normalizedName,
                  });
                  tagCount++;
                }

                tagIds.push(tag.id);
              }

              // Add tags to bookmark
              if (tagIds.length > 0) {
                await this.bookmarkRepository.addTags(bookmark.id, tagIds);
              }
            }
          } catch (error) {
            errors.push(
              `Failed to import bookmark "${title || url}": ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      }
    }

    return { bookmarkCount, collectionCount, tagCount };
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
}
