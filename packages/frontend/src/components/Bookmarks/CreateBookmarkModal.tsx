import { useState, useEffect } from 'react';
import { CreateBookmarkRequest, Tag } from '@bookmark-manager/shared';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import { useCollectionStore } from '../../stores/collectionStore';

interface CreateBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBookmarkModal({
  isOpen,
  onClose,
}: CreateBookmarkModalProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [collectionId, setCollectionId] = useState<string>('');
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractingMetadata, setExtractingMetadata] = useState(false);

  const createBookmark = useBookmarkStore((state) => state.createBookmark);
  const fetchTags = useBookmarkStore((state) => state.fetchTags);
  const collections = useCollectionStore((state) => state.collections);
  const selectedCollectionId = useCollectionStore(
    (state) => state.selectedCollectionId
  );

  useEffect(() => {
    if (isOpen) {
      // Load available tags
      fetchTags()
        .then((tags) => {
          setAvailableTags(tags);
          setFilteredTags(tags);
        })
        .catch((err) => {
          console.error('Failed to fetch tags:', err);
        });

      // Pre-select current collection if any
      if (selectedCollectionId) {
        setCollectionId(selectedCollectionId);
      }
    }
  }, [isOpen, selectedCollectionId, fetchTags]);

  useEffect(() => {
    // Filter tags based on input
    if (tagInput.trim()) {
      const filtered = availableTags.filter((tag) =>
        tag.name.toLowerCase().includes(tagInput.toLowerCase())
      );
      setFilteredTags(filtered);
    } else {
      setFilteredTags(availableTags);
    }
  }, [tagInput, availableTags]);

  const handleUrlBlur = async () => {
    if (!url || title) return;

    setExtractingMetadata(true);
    try {
      // Try to extract metadata from URL
      // In a real implementation, this would call a backend endpoint
      // For now, we'll just extract the domain as title
      const urlObj = new URL(url);
      setTitle(urlObj.hostname);
    } catch (err) {
      // Invalid URL, ignore
    } finally {
      setExtractingMetadata(false);
    }
  };

  const handleAddTag = (tagName: string) => {
    const normalizedTag = tagName.trim().toLowerCase();
    if (normalizedTag && !selectedTags.includes(normalizedTag)) {
      setSelectedTags([...selectedTags, normalizedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tagName));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && selectedTags.length > 0) {
      // Remove last tag on backspace if input is empty
      setSelectedTags(selectedTags.slice(0, -1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);

    try {
      const data: CreateBookmarkRequest = {
        url: url.trim(),
        title: title.trim() || undefined,
        excerpt: excerpt.trim() || undefined,
        collectionId: collectionId || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      };

      await createBookmark(data);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create bookmark');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setTitle('');
    setExcerpt('');
    setCollectionId('');
    setTagInput('');
    setSelectedTags([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Add Bookmark
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* URL Input */}
            <div>
              <label
                htmlFor="url"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                URL *
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={loading}
              />
              {extractingMetadata && (
                <p className="text-sm text-gray-500 mt-1">
                  Extracting metadata...
                </p>
              )}
            </div>

            {/* Title Input */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional - will be extracted from page if not provided"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            {/* Excerpt Input */}
            <div>
              <label
                htmlFor="excerpt"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Optional description or notes"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            {/* Collection Selection */}
            <div>
              <label
                htmlFor="collection"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Collection
              </label>
              <select
                id="collection"
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">No Collection</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.icon} {collection.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Tag Input with Autocomplete */}
            <div>
              <label
                htmlFor="tags"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Tags
              </label>
              <div className="border border-gray-300 rounded-md p-2 focus-within:ring-2 focus-within:ring-blue-500">
                {/* Selected Tags */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                        disabled={loading}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {/* Tag Input */}
                <input
                  type="text"
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder="Type to add tags..."
                  className="w-full outline-none"
                  disabled={loading}
                />

                {/* Tag Suggestions */}
                {tagInput && filteredTags.length > 0 && (
                  <div className="mt-2 border-t border-gray-200 pt-2 max-h-32 overflow-y-auto">
                    {filteredTags.slice(0, 5).map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleAddTag(tag.name)}
                        className="block w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm"
                        disabled={loading}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Press Enter to add a tag, or select from suggestions
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Bookmark'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
