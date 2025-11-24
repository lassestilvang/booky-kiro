import { BookmarkWithRelations } from '@bookmark-manager/shared';

interface ListViewProps {
  bookmarks: BookmarkWithRelations[];
  onBookmarkClick?: (bookmark: BookmarkWithRelations) => void;
}

export function ListView({ bookmarks, onBookmarkClick }: ListViewProps) {
  if (bookmarks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No bookmarks to display</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Title
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Type
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Domain
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Tags
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Created
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bookmarks.map((bookmark) => (
              <tr
                key={bookmark.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onBookmarkClick?.(bookmark)}
              >
                {/* Title with thumbnail */}
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    {bookmark.coverUrl ? (
                      <img
                        src={bookmark.coverUrl}
                        alt={bookmark.title}
                        className="h-10 w-16 object-cover rounded flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-10 w-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-6 h-6 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="ml-4 min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {bookmark.title}
                      </div>
                      {bookmark.excerpt && (
                        <div className="text-sm text-gray-500 truncate">
                          {bookmark.excerpt}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Type */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded capitalize">
                    {bookmark.type}
                  </span>
                </td>

                {/* Domain */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 truncate max-w-xs">
                    {bookmark.domain}
                  </div>
                </td>

                {/* Tags */}
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {bookmark.tags && bookmark.tags.length > 0 ? (
                      <>
                        {bookmark.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            style={
                              tag.color
                                ? { backgroundColor: tag.color + '20' }
                                : undefined
                            }
                          >
                            {tag.name}
                          </span>
                        ))}
                        {bookmark.tags.length > 2 && (
                          <span className="px-2 py-1 text-xs text-gray-500">
                            +{bookmark.tags.length - 2}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </div>
                </td>

                {/* Created Date */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {new Date(bookmark.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(bookmark.createdAt).toLocaleTimeString()}
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    {bookmark.contentIndexed && (
                      <span className="inline-flex items-center text-xs text-green-600">
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Indexed
                      </span>
                    )}
                    {bookmark.isDuplicate && (
                      <span className="inline-flex items-center text-xs text-yellow-600">
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Duplicate
                      </span>
                    )}
                    {bookmark.isBroken && (
                      <span className="inline-flex items-center text-xs text-red-600">
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Broken
                      </span>
                    )}
                    {bookmark.highlights && bookmark.highlights.length > 0 && (
                      <span className="inline-flex items-center text-xs text-blue-600">
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        {bookmark.highlights.length}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
