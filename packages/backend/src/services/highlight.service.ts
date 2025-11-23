import {
  Highlight,
  CreateHighlightRequest,
  UpdateHighlightRequest,
  PaginatedResponse,
} from '@bookmark-manager/shared';
import { HighlightRepository } from '../repositories/highlight.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { SearchService, BookmarkSearchDocument } from './search.service.js';

/**
 * Highlight service for managing highlights (Pro feature)
 */
export class HighlightService {
  constructor(
    private highlightRepository: HighlightRepository,
    private bookmarkRepository: BookmarkRepository,
    private searchService: SearchService
  ) {}

  /**
   * Get all highlights for a user with pagination
   */
  async getUserHighlights(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<Highlight>> {
    const { highlights, total } = await this.highlightRepository.findByOwnerPaginated(
      userId,
      page,
      limit
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: highlights,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get a single highlight by ID
   */
  async getHighlightById(highlightId: string, userId: string): Promise<Highlight | null> {
    const highlight = await this.highlightRepository.findById(highlightId);

    if (!highlight) {
      return null;
    }

    // Verify ownership
    if (highlight.ownerId !== userId) {
      throw new Error('Access denied');
    }

    return highlight;
  }

  /**
   * Create a new highlight
   */
  async createHighlight(
    userId: string,
    data: CreateHighlightRequest
  ): Promise<Highlight> {
    // Verify bookmark exists and user owns it
    const bookmark = await this.bookmarkRepository.findById(data.bookmarkId);
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }

    if (bookmark.ownerId !== userId) {
      throw new Error('Access denied');
    }

    // Create highlight
    const highlightData: Partial<Highlight> = {
      bookmarkId: data.bookmarkId,
      ownerId: userId,
      textSelected: data.textSelected,
      color: data.color || '#FFFF00',
      annotationMd: data.annotationMd,
      positionContext: data.positionContext,
      snapshotId: data.snapshotId,
    };

    const highlight = await this.highlightRepository.create(highlightData);

    // Re-index bookmark to include new highlight text
    await this.reindexBookmark(data.bookmarkId);

    return highlight;
  }

  /**
   * Update a highlight
   */
  async updateHighlight(
    highlightId: string,
    userId: string,
    data: UpdateHighlightRequest
  ): Promise<Highlight> {
    // Verify ownership
    const highlight = await this.highlightRepository.findById(highlightId);
    if (!highlight) {
      throw new Error('Highlight not found');
    }

    if (highlight.ownerId !== userId) {
      throw new Error('Access denied');
    }

    // Update highlight
    const updateData: Partial<Highlight> = {};
    if (data.color !== undefined) {
      updateData.color = data.color;
    }
    if (data.annotationMd !== undefined) {
      updateData.annotationMd = data.annotationMd;
    }

    const updated = await this.highlightRepository.update(highlightId, updateData);
    if (!updated) {
      throw new Error('Failed to update highlight');
    }

    // Re-index bookmark to update highlight text (especially if annotation changed)
    if (data.annotationMd !== undefined) {
      await this.reindexBookmark(highlight.bookmarkId);
    }

    return updated;
  }

  /**
   * Delete a highlight
   */
  async deleteHighlight(highlightId: string, userId: string): Promise<void> {
    // Verify ownership
    const highlight = await this.highlightRepository.findById(highlightId);
    if (!highlight) {
      throw new Error('Highlight not found');
    }

    if (highlight.ownerId !== userId) {
      throw new Error('Access denied');
    }

    const bookmarkId = highlight.bookmarkId;

    // Delete highlight
    await this.highlightRepository.delete(highlightId);

    // Re-index bookmark to remove highlight text
    await this.reindexBookmark(bookmarkId);
  }

  /**
   * Get highlights for a specific bookmark
   */
  async getBookmarkHighlights(
    bookmarkId: string,
    userId: string
  ): Promise<Highlight[]> {
    // Verify bookmark exists and user owns it
    const bookmark = await this.bookmarkRepository.findById(bookmarkId);
    if (!bookmark) {
      throw new Error('Bookmark not found');
    }

    if (bookmark.ownerId !== userId) {
      throw new Error('Access denied');
    }

    return this.highlightRepository.findByBookmark(bookmarkId);
  }

  /**
   * Re-index a bookmark to update highlight text in search
   */
  private async reindexBookmark(bookmarkId: string): Promise<void> {
    try {
      // Get bookmark with all highlights
      const bookmark = await this.bookmarkRepository.findByIdWithRelations(bookmarkId);
      if (!bookmark) {
        return;
      }

      // Update highlights_text in search index
      const highlightsText = bookmark.highlights
        .map((h) => `${h.textSelected} ${h.annotationMd || ''}`)
        .join(' ')
        .trim() || null;

      await this.searchService.updateBookmark({
        id: bookmarkId,
        highlights_text: highlightsText,
      });
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to re-index bookmark after highlight change:', error);
    }
  }
}
