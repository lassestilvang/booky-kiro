import { searchClient, BOOKMARKS_INDEX } from '../db/search.config.js';
import type { Index, SearchParams } from 'meilisearch';

/**
 * Document structure for bookmark search index
 */
export interface BookmarkSearchDocument {
  id: string;
  owner_id: string;
  collection_id: string | null;
  title: string;
  url: string;
  domain: string;
  excerpt: string | null;
  content: string | null; // Full-text content (Pro feature)
  tags: string[];
  type: 'article' | 'video' | 'image' | 'file' | 'document';
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  has_snapshot: boolean;
  highlights_text: string | null; // Concatenated highlight text
}

/**
 * Search query parameters
 */
export interface SearchQuery {
  q?: string; // Search query text
  tags?: string[]; // Filter by tags
  type?: string[]; // Filter by type
  domain?: string[]; // Filter by domain
  collection?: string; // Filter by collection
  dateFrom?: Date; // Date range start
  dateTo?: Date; // Date range end
  fulltext?: boolean; // Enable content search (Pro)
  page?: number; // Pagination page (1-based)
  limit?: number; // Results per page
  sort?:
    | 'relevance'
    | 'created_at:desc'
    | 'created_at:asc'
    | 'updated_at:desc'
    | 'updated_at:asc'
    | 'title:asc'
    | 'title:desc';
}

/**
 * Search result with highlighting
 */
export interface SearchResult {
  id: string;
  title: string;
  url: string;
  excerpt: string | null;
  domain: string;
  tags: string[];
  type: string;
  created_at: number;
  updated_at: number;
  has_snapshot: boolean;
  highlights: string[]; // Matched snippets
  score: number; // Relevance score
}

/**
 * Search response
 */
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  took: number; // milliseconds
}

/**
 * Search service for managing bookmark search operations
 */
export class SearchService {
  private index: Index;

  constructor() {
    this.index = searchClient.index(BOOKMARKS_INDEX);
  }

  /**
   * Index a bookmark document
   */
  async indexBookmark(document: BookmarkSearchDocument): Promise<void> {
    try {
      await this.index.addDocuments([document], { primaryKey: 'id' });
    } catch (error) {
      console.error('Failed to index bookmark:', error);
      throw new Error('Failed to index bookmark');
    }
  }

  /**
   * Update a bookmark document
   */
  async updateBookmark(
    document: Partial<BookmarkSearchDocument> & { id: string }
  ): Promise<void> {
    try {
      await this.index.updateDocuments([document], { primaryKey: 'id' });
    } catch (error) {
      console.error('Failed to update bookmark:', error);
      throw new Error('Failed to update bookmark');
    }
  }

  /**
   * Delete a bookmark document
   */
  async deleteBookmark(bookmarkId: string): Promise<void> {
    try {
      await this.index.deleteDocument(bookmarkId);
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
      throw new Error('Failed to delete bookmark');
    }
  }

  /**
   * Delete multiple bookmark documents
   */
  async deleteBookmarks(bookmarkIds: string[]): Promise<void> {
    try {
      await this.index.deleteDocuments(bookmarkIds);
    } catch (error) {
      console.error('Failed to delete bookmarks:', error);
      throw new Error('Failed to delete bookmarks');
    }
  }

  /**
   * Delete all bookmarks for a user
   */
  async deleteUserBookmarks(userId: string): Promise<void> {
    try {
      await this.index.deleteDocuments({
        filter: `owner_id = "${userId}"`,
      });
    } catch (error) {
      console.error('Failed to delete user bookmarks:', error);
      throw new Error('Failed to delete user bookmarks');
    }
  }

  /**
   * Build filter string from query parameters
   */
  private buildFilter(query: SearchQuery, userId: string): string {
    const filters: string[] = [];

    // Always filter by owner
    filters.push(`owner_id = "${userId}"`);

    // Filter by collection
    if (query.collection) {
      filters.push(`collection_id = "${query.collection}"`);
    }

    // Filter by tags (all tags must match)
    if (query.tags && query.tags.length > 0) {
      const tagFilters = query.tags.map((tag) => `tags = "${tag}"`);
      filters.push(`(${tagFilters.join(' AND ')})`);
    }

    // Filter by type
    if (query.type && query.type.length > 0) {
      const typeFilters = query.type.map((t) => `type = "${t}"`);
      filters.push(`(${typeFilters.join(' OR ')})`);
    }

    // Filter by domain
    if (query.domain && query.domain.length > 0) {
      const domainFilters = query.domain.map((d) => `domain = "${d}"`);
      filters.push(`(${domainFilters.join(' OR ')})`);
    }

    // Filter by date range
    if (query.dateFrom || query.dateTo) {
      const from = query.dateFrom
        ? Math.floor(query.dateFrom.getTime() / 1000)
        : 0;
      const to = query.dateTo
        ? Math.floor(query.dateTo.getTime() / 1000)
        : Math.floor(Date.now() / 1000);
      filters.push(`created_at >= ${from} AND created_at <= ${to}`);
    }

    return filters.join(' AND ');
  }

  /**
   * Build search attributes based on query
   */
  private buildSearchAttributes(query: SearchQuery, isPro: boolean): string[] {
    const attributes = [
      'title',
      'excerpt',
      'domain',
      'tags',
      'highlights_text',
    ];

    // Pro users can search in full content
    if (isPro && query.fulltext) {
      attributes.push('content');
    }

    return attributes;
  }

  /**
   * Search bookmarks
   */
  async search(
    query: SearchQuery,
    userId: string,
    isPro: boolean
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100); // Max 100 results per page
      const offset = (page - 1) * limit;

      // Build search parameters
      const searchParams: SearchParams = {
        filter: this.buildFilter(query, userId),
        attributesToSearchOn: this.buildSearchAttributes(query, isPro),
        attributesToHighlight: ['title', 'excerpt', 'content'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
        limit,
        offset,
        showMatchesPosition: true,
      };

      // Add sorting if specified
      if (query.sort && query.sort !== 'relevance') {
        searchParams.sort = [query.sort];
      }

      // Perform search
      const searchQuery = query.q || '';
      const response = await this.index.search(searchQuery, searchParams);

      // Transform results
      const results: SearchResult[] = response.hits.map((hit: any) => {
        // Extract highlights from formatted fields
        const highlights: string[] = [];
        if (hit._formatted) {
          if (hit._formatted.title && hit._formatted.title !== hit.title) {
            highlights.push(hit._formatted.title);
          }
          if (
            hit._formatted.excerpt &&
            hit._formatted.excerpt !== hit.excerpt
          ) {
            highlights.push(hit._formatted.excerpt);
          }
          if (
            hit._formatted.content &&
            hit._formatted.content !== hit.content
          ) {
            // Extract snippet from content
            const contentSnippet = this.extractSnippet(hit._formatted.content);
            if (contentSnippet) {
              highlights.push(contentSnippet);
            }
          }
        }

        return {
          id: hit.id,
          title: hit.title,
          url: hit.url,
          excerpt: hit.excerpt,
          domain: hit.domain,
          tags: hit.tags || [],
          type: hit.type,
          created_at: hit.created_at,
          updated_at: hit.updated_at,
          has_snapshot: hit.has_snapshot,
          highlights,
          score: hit._rankingScore || 0,
        };
      });

      const took = Date.now() - startTime;

      return {
        results,
        total: response.estimatedTotalHits || 0,
        page,
        limit,
        took,
      };
    } catch (error) {
      console.error('Search failed:', error);
      throw new Error('Search failed');
    }
  }

  /**
   * Extract a snippet from highlighted content
   */
  private extractSnippet(
    content: string,
    maxLength: number = 200
  ): string | null {
    // Find the first <mark> tag
    const markIndex = content.indexOf('<mark>');
    if (markIndex === -1) return null;

    // Extract context around the mark
    const start = Math.max(0, markIndex - 50);
    const end = Math.min(content.length, markIndex + maxLength);
    let snippet = content.substring(start, end);

    // Add ellipsis if truncated
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async getSuggestions(
    query: string,
    userId: string,
    limit: number = 5
  ): Promise<string[]> {
    try {
      const response = await this.index.search(query, {
        filter: `owner_id = "${userId}"`,
        attributesToRetrieve: ['title'],
        limit,
      });

      return response.hits.map((hit: any) => hit.title);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Get popular tags for a user
   */
  async getPopularTags(
    userId: string,
    limit: number = 20
  ): Promise<Array<{ tag: string; count: number }>> {
    try {
      // MeiliSearch doesn't support aggregations, so we'll need to fetch and aggregate manually
      // This is a simplified implementation - in production, consider caching this
      const response = await this.index.search('', {
        filter: `owner_id = "${userId}"`,
        attributesToRetrieve: ['tags'],
        limit: 1000, // Fetch up to 1000 bookmarks
      });

      // Count tag occurrences
      const tagCounts = new Map<string, number>();
      response.hits.forEach((hit: any) => {
        if (hit.tags) {
          hit.tags.forEach((tag: string) => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          });
        }
      });

      // Sort by count and return top N
      return Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get popular tags:', error);
      return [];
    }
  }
}
