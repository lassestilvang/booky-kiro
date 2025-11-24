import { useState, useEffect } from 'react';
import { BookmarkType, Tag } from '@bookmark-manager/shared';
import { useBookmarkStore } from '../../stores/bookmarkStore';

interface BookmarkFiltersProps {
  onApplyFilters: () => void;
}

export function BookmarkFilters({ onApplyFilters }: BookmarkFiltersProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const filters = useBookmarkStore((state) => state.filters);
  const setFilters = useBookmarkStore((state) => state.setFilters);
  const clearFilters = useBookmarkStore((state) => state.clearFilters);
  const fetchTags = useBookmarkStore((state) => state.fetchTags);
  const bookmarks = useBookmarkStore((state) => state.bookmarks);

  useEffect(() => {
    // Load available tags
    fetchTags()
      .then((tags) => {
        setAvailableTags(tags);
      })
      .catch((err) => {
        console.error('Failed to fetch tags:', err);
      });

    // Extract unique domains from bookmarks
    const domains = Array.from(
      new Set(bookmarks.map((b) => b.domain).filter(Boolean))
    ).sort();
    setAvailableDomains(domains);
  }, [fetchTags, bookmarks]);

  const handleSearchChange = (value: string) => {
    setFilters({ search: value || undefined });
  };

  const handleTagToggle = (tagName: string) => {
    const newTags = filters.tags.includes(tagName)
      ? filters.tags.filter((t) => t !== tagName)
      : [...filters.tags, tagName];
    setFilters({ tags: newTags });
  };

  const handleTypeToggle = (type: BookmarkType) => {
    const newTypes = filters.type.includes(type)
      ? filters.type.filter((t) => t !== type)
      : [...filters.type, type];
    setFilters({ type: newTypes });
  };

  const handleDomainToggle = (domain: string) => {
    const newDomains = filters.domain.includes(domain)
      ? filters.domain.filter((d) => d !== domain)
      : [...filters.domain, domain];
    setFilters({ domain: newDomains });
  };

  const handleDateFromChange = (value: string) => {
    setFilters({ dateFrom: value ? new Date(value) : undefined });
  };

  const handleDateToChange = (value: string) => {
    setFilters({ dateTo: value ? new Date(value) : undefined });
  };

  const handleClearFilters = () => {
    clearFilters();
    onApplyFilters();
  };

  const hasActiveFilters =
    filters.tags.length > 0 ||
    filters.type.length > 0 ||
    filters.domain.length > 0 ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.search;

  const bookmarkTypes: BookmarkType[] = [
    'article',
    'video',
    'image',
    'file',
    'document',
  ];

  return (
    <div className="bg-white border-b border-gray-200 p-4 space-y-4">
      {/* Search Input */}
      <div className="flex items-center space-x-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search bookmarks..."
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onApplyFilters();
              }
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>
        <button
          onClick={onApplyFilters}
          className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Search
        </button>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          {showAdvanced ? 'Hide' : 'Filters'}
        </button>
      </div>

      {/* Tag Filter Chips */}
      {filters.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
            >
              {tag}
              <button
                onClick={() => handleTagToggle(tag)}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          {/* Tag Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTags.length > 0 ? (
                availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.name)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      filters.tags.includes(tag.name)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No tags available</p>
              )}
            </div>
          </div>

          {/* Type Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Type
            </label>
            <div className="flex flex-wrap gap-2">
              {bookmarkTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeToggle(type)}
                  className={`px-3 py-1 rounded-full text-sm capitalize transition-colors ${
                    filters.type.includes(type)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Domain Filters */}
          {availableDomains.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Domain
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                <div className="space-y-1">
                  {availableDomains.map((domain) => (
                    <label
                      key={domain}
                      className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.domain.includes(domain)}
                        onChange={() => handleDomainToggle(domain)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{domain}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Date Range Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Date Range
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">From</label>
                <input
                  type="date"
                  value={
                    filters.dateFrom
                      ? filters.dateFrom.toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <input
                  type="date"
                  value={
                    filters.dateTo
                      ? filters.dateTo.toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-2">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Clear All Filters
              </button>
            )}
            <button
              onClick={onApplyFilters}
              className="ml-auto px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && !showAdvanced && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {filters.tags.length > 0 && `${filters.tags.length} tag(s)`}
            {filters.type.length > 0 &&
              (filters.tags.length > 0 ? ', ' : '') +
                `${filters.type.length} type(s)`}
            {filters.domain.length > 0 &&
              (filters.tags.length > 0 || filters.type.length > 0 ? ', ' : '') +
                `${filters.domain.length} domain(s)`}
            {(filters.dateFrom || filters.dateTo) &&
              (filters.tags.length > 0 ||
              filters.type.length > 0 ||
              filters.domain.length > 0
                ? ', '
                : '') + 'date range'}
            {' active'}
          </span>
          <button
            onClick={handleClearFilters}
            className="text-blue-600 hover:text-blue-800"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
