import { MeiliSearch } from 'meilisearch';

// MeiliSearch client configuration
const MEILISEARCH_HOST =
  process.env.MEILISEARCH_HOST || 'http://localhost:7700';
const MEILISEARCH_API_KEY = process.env.MEILISEARCH_API_KEY || 'masterKey123';

// Create MeiliSearch client instance
export const searchClient = new MeiliSearch({
  host: MEILISEARCH_HOST,
  apiKey: MEILISEARCH_API_KEY,
});

// Index name for bookmarks
export const BOOKMARKS_INDEX = 'bookmarks';

/**
 * Initialize MeiliSearch index with proper settings and mappings
 */
export async function initializeSearchIndex(): Promise<void> {
  try {
    // Create or get the bookmarks index
    const index = searchClient.index(BOOKMARKS_INDEX);

    // Configure searchable attributes (fields to search in)
    await index.updateSearchableAttributes([
      'title',
      'excerpt',
      'content', // Full-text content (Pro feature)
      'domain',
      'tags',
      'highlights_text',
    ]);

    // Configure filterable attributes (fields to filter by)
    await index.updateFilterableAttributes([
      'owner_id',
      'collection_id',
      'type',
      'domain',
      'tags',
      'created_at',
      'updated_at',
      'has_snapshot',
    ]);

    // Configure sortable attributes
    await index.updateSortableAttributes(['created_at', 'updated_at', 'title']);

    // Configure ranking rules for relevance
    await index.updateRankingRules([
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
    ]);

    // Configure typo tolerance for fuzzy matching
    await index.updateTypoTolerance({
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 5,
        twoTypos: 9,
      },
    });

    console.log('MeiliSearch index initialized successfully');
  } catch (error) {
    console.error('Failed to initialize MeiliSearch index:', error);
    throw error;
  }
}

/**
 * Health check for MeiliSearch connection
 */
export async function checkSearchHealth(): Promise<boolean> {
  try {
    const health = await searchClient.health();
    return health.status === 'available';
  } catch (error) {
    console.error('MeiliSearch health check failed:', error);
    return false;
  }
}

/**
 * Get index statistics
 */
export async function getIndexStats() {
  try {
    const index = searchClient.index(BOOKMARKS_INDEX);
    const stats = await index.getStats();
    return stats;
  } catch (error) {
    console.error('Failed to get index stats:', error);
    return null;
  }
}
