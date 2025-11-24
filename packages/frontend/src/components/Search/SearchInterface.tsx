import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../lib/api';
import { SearchResult, BookmarkType } from '@bookmark-manager/shared';
import { useCollectionStore } from '../../stores/collectionStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';

interface SearchInterfaceProps {
  onResultClick?: (result: SearchResult) => void;
}

export function SearchInterface({ onResultClick }: SearchInterfaceProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fulltextEnabled, setFulltextEnabled] = useState(false);

  // Filters
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<BookmarkType[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [took, setTook] = useState(0);

  const user = useAuthStore((state) => state.user);
  const isPro = user?.plan === 'pro';
  const selectedCollectionId = useCollectionStore(
    (state) => state.selectedCollectionId
  );
  const fetchTags = useBookmarkStore((state) => state.fetchTags);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Fetch available tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await fetchTags();
        setAvailableTags(tags.map((t) => t.name));
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
    };
    loadTags();
  }, [fetchTags]);

  // Fetch suggestions as user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await apiClient.get('/v1/search/suggestions', {
          params: { q: query, limit: 5 },
        });
        setSuggestions(response.data.suggestions);
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  // Perform search
  const performSearch = useCallback(
    async (searchQuery: string, pageNum: number = 1) => {
      if (
        !searchQuery.trim() &&
        selectedTags.length === 0 &&
        selectedTypes.length === 0
      ) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params: Record<string, string | string[] | number | boolean> = {
          page: pageNum,
          limit: 20,
        };

        if (searchQuery.trim()) {
          params.q = searchQuery;
        }

        if (selectedTags.length > 0) {
          params.tags = selectedTags;
        }

        if (selectedTypes.length > 0) {
          params.type = selectedTypes;
        }

        if (selectedDomains.length > 0) {
          params.domain = selectedDomains;
        }

        if (selectedCollectionId) {
          params.collection = selectedCollectionId;
        }

        if (dateFrom) {
          params.dateFrom = new Date(dateFrom).toISOString();
        }

        if (dateTo) {
          params.dateTo = new Date(dateTo).toISOString();
        }

        if (fulltextEnabled && isPro) {
          params.fulltext = true;
        }

        const response = await apiClient.get('/v1/search', { params });
        setResults(response.data.results);
        setTotal(response.data.total);
        setTook(response.data.took);
        setPage(pageNum);
      } catch (err: unknown) {
        const error = err as {
          response?: { data?: { error?: { message?: string } } };
        };
        setError(
          error.response?.data?.error?.message || 'Failed to perform search'
        );
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [
      selectedTags,
      selectedTypes,
      selectedDomains,
      selectedCollectionId,
      dateFrom,
      dateTo,
      fulltextEnabled,
      isPro,
    ]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    performSearch(query, 1);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion, 1);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleTypeToggle = (type: BookmarkType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleClearFilters = () => {
    setSelectedTags([]);
    setSelectedTypes([]);
    setSelectedDomains([]);
    setDateFrom('');
    setDateTo('');
    setFulltextEnabled(false);
  };

  const handleNextPage = () => {
    if (page * 20 < total) {
      performSearch(query, page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      performSearch(query, page - 1);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <form onSubmit={handleSearch} className="relative">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search bookmarks..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-md last:rounded-b-md"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Search
            </button>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
            </button>
          </div>
        </form>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            {/* Pro Full-Text Search Toggle */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="fulltext-toggle"
                    className="text-sm font-medium text-gray-700"
                  >
                    Full-Text Search
                  </label>
                  {!isPro && (
                    <span className="px-2 py-0.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-full">
                      PRO
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isPro ? (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="fulltext-toggle"
                        type="checkbox"
                        checked={fulltextEnabled}
                        onChange={(e) => setFulltextEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        // Show upgrade prompt
                        alert(
                          'Full-text search is a Pro feature. Upgrade your plan to search within the complete content of your saved pages.'
                        );
                      }}
                      className="px-3 py-1 text-sm text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-md hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      Upgrade to Pro
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {isPro
                  ? 'Search within the complete content of your saved pages, not just titles and excerpts'
                  : 'Upgrade to Pro to search within the complete content of your saved pages'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Tags Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.slice(0, 10).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className={`px-3 py-1 text-sm rounded-full ${
                        selectedTags.includes(tag)
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      'article',
                      'video',
                      'image',
                      'file',
                      'document',
                    ] as BookmarkType[]
                  ).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleTypeToggle(type)}
                      className={`px-3 py-1 text-sm rounded-full capitalize ${
                        selectedTypes.includes(type)
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md"
                    placeholder="From"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md"
                    placeholder="To"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Clear all filters
              </button>

              <button
                type="button"
                onClick={() => performSearch(query, 1)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-4">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Searching...</p>
            </div>
          </div>
        ) : results.length > 0 ? (
          <>
            {/* Results Info */}
            <div className="mb-4 text-sm text-gray-600">
              Found {total} result{total !== 1 ? 's' : ''} in {took}ms
            </div>

            {/* Results List */}
            <div className="space-y-4">
              {results.map((result) => (
                <div
                  key={result.id}
                  onClick={() => onResultClick?.(result)}
                  className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {result.title}
                  </h3>
                  <p className="text-sm text-blue-600 mb-2 truncate">
                    {result.url}
                  </p>
                  {result.excerpt && (
                    <p className="text-sm text-gray-600 mb-2">
                      {result.excerpt}
                    </p>
                  )}
                  {result.highlights.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {result.highlights.map((highlight, index) => (
                        <div
                          key={index}
                          className="text-sm text-gray-700 bg-yellow-50 p-2 rounded"
                          dangerouslySetInnerHTML={{ __html: highlight }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <span className="px-2 py-1 bg-gray-100 rounded capitalize">
                      {result.bookmark.type}
                    </span>
                    <span>{result.bookmark.domain}</span>
                    {result.bookmark.tags.length > 0 && (
                      <div className="flex gap-1">
                        {result.bookmark.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {total > 20 && (
              <div className="mt-6 flex justify-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-700">
                  Page {page} of {Math.ceil(total / 20)}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={page * 20 >= total}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : query || selectedTags.length > 0 || selectedTypes.length > 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No results found
              </h3>
              <p className="text-gray-600">
                Try adjusting your search or filters
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Start searching
              </h3>
              <p className="text-gray-600">
                Enter a search query or apply filters to find bookmarks
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
