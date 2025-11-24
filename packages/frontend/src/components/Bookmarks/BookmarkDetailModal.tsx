import { useState, useEffect } from 'react';
import {
  BookmarkWithRelations,
  UpdateBookmarkRequest,
  Tag,
} from '@bookmark-manager/shared';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import { useCollectionStore } from '../../stores/collectionStore';

interface BookmarkDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: BookmarkWithRelations | null;
  onPreview?: () => void;
}

export function BookmarkDetailModal({
  isOpen,
  onClose,
  bookmark,
  onPreview,
}: BookmarkDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [collectionId, setCollectionId] = useState<string>('');
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateBookmark = useBookmarkStore((state) => state.updateBookmark);
  const deleteBookmark = useBookmarkStore((state) => state.deleteBookmark);
  const fetchTags = useBookmarkStore((state) => state.fetchTags);
  const collections = useCollectionStore((state) => state.collections);

  useEffect(() => {
    if (isOpen && bookmark) {
      setTitle(bookmark.title);
      setExcerpt(bookmark.excerpt || '');
      setCollectionId(bookmark.collectionId || '');
      setSelectedTags(bookmark.tags.map((t) => t.name));

      // Load available tags
      fetchTags()
        .then((tags) => {
          setAvailableTags(tags);
          setFilteredTags(tags);
        })
        .catch((err) => {
          console.error('Failed to fetch tags:', err);
        });
    }
  }, [isOpen, bookmark, fetchTags]);

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
      setSelectedTags(selectedTags.slice(0, -1));
    }
  };

  const handleSave = async () => {
    if (!bookmark) return;

    setError(null);
    setLoading(true);

    try {
      const data: UpdateBookmarkRequest = {
        title: title.trim(),
        excerpt: excerpt.trim() || undefined,
        collectionId: collectionId || null,
        tags: selectedTags,
      };

      await updateBookmark(bookmark.id, data);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update bookmark');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!bookmark) return;

    setLoading(true);
    try {
      await deleteBookmark(bookmark.id);
      handleClose();
    } catch (err: unknown) {
      setError(err.message || 'Failed to delete bookmark');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setError(null);
    setShowDeleteConfirm(false);
    onClose();
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen || !bookmark) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit Bookmark' : 'Bookmark Details'}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {/* Cover Image */}
            {bookmark.coverUrl && (
              <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={bookmark.coverUrl}
                  alt={bookmark.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL
              </label>
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 break-all"
              >
                {bookmark.url}
              </a>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              ) : (
                <p className="text-gray-900">{bookmark.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              {isEditing ? (
                <textarea
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              ) : (
                <p className="text-gray-700">
                  {bookmark.excerpt || 'No description'}
                </p>
              )}
            </div>

            {/* Collection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Collection
              </label>
              {isEditing ? (
                <select
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
              ) : (
                <p className="text-gray-900">
                  {bookmark.collectionId
                    ? collections.find((c) => c.id === bookmark.collectionId)
                        ?.title || 'Unknown'
                    : 'No Collection'}
                </p>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              {isEditing ? (
                <div className="border border-gray-300 rounded-md p-2 focus-within:ring-2 focus-within:ring-blue-500">
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
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="Type to add tags..."
                    className="w-full outline-none"
                    disabled={loading}
                  />
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
              ) : (
                <div className="flex flex-wrap gap-2">
                  {bookmark.tags.length > 0 ? (
                    bookmark.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-gray-100 text-gray-800"
                      >
                        {tag.name}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-500">No tags</p>
                  )}
                </div>
              )}
            </div>

            {/* Highlights */}
            {bookmark.highlights.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Highlights ({bookmark.highlights.length})
                </label>
                <div className="space-y-2">
                  {bookmark.highlights.map((highlight) => (
                    <div
                      key={highlight.id}
                      className="border border-gray-200 rounded-md p-3"
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: highlight.color,
                      }}
                    >
                      <p className="text-gray-900 italic">
                        "{highlight.textSelected}"
                      </p>
                      {highlight.annotationMd && (
                        <p className="text-gray-600 mt-2 text-sm">
                          {highlight.annotationMd}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Type:</span>
                <span className="text-gray-900 capitalize">
                  {bookmark.type}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Domain:</span>
                <span className="text-gray-900">{bookmark.domain}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-900">
                  {formatDate(bookmark.createdAt)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Updated:</span>
                <span className="text-gray-900">
                  {formatDate(bookmark.updatedAt)}
                </span>
              </div>
              {bookmark.isDuplicate && (
                <div className="flex items-center text-sm text-yellow-600">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Potential duplicate
                </div>
              )}
              {bookmark.isBroken && (
                <div className="flex items-center text-sm text-red-600">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Broken link
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                <p className="text-yellow-800 mb-3">
                  Are you sure you want to delete this bookmark? This action
                  cannot be undone.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700"
                    disabled={loading}
                  >
                    {loading ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between pt-4">
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-red-600 bg-red-50 rounded-md hover:bg-red-100"
                  disabled={loading || showDeleteConfirm}
                >
                  Delete
                </button>
                {onPreview && (
                  <button
                    onClick={onPreview}
                    className="px-4 py-2 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                    disabled={loading}
                  >
                    Preview
                  </button>
                )}
              </div>
              <div className="flex space-x-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    disabled={loading}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
