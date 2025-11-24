import { BookmarkWithRelations } from '@bookmark-manager/shared';

interface GridViewProps {
  bookmarks: BookmarkWithRelations[];
  onBookmarkClick?: (bookmark: BookmarkWithRelations) => void;
}

export function GridView({ bookmarks, onBookmarkClick }: GridViewProps) {
  if (bookmarks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No bookmarks to display</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
          onClick={() => onBookmarkClick?.(bookmark)}
        >
          {/* Cover Image */}
          <div className="aspect-video bg-gray-200 relative">
            {bookmark.coverUrl ? (
              <img
                src={bookmark.coverUrl}
                alt={bookmark.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg
                  className="w-12 h-12"
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
            {/* Type Badge */}
            <div className="absolute top-2 right-2">
              <span className="px-2 py-1 text-xs font-medium bg-white bg-opacity-90 rounded">
                {bookmark.type}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
              {bookmark.title}
            </h3>
            {bookmark.excerpt && (
              <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                {bookmark.excerpt}
              </p>
            )}
            {/* Tags */}
            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {bookmark.tags.slice(0, 3).map((tag) => (
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
                {bookmark.tags.length > 3 && (
                  <span className="px-2 py-1 text-xs text-gray-500">
                    +{bookmark.tags.length - 3}
                  </span>
                )}
              </div>
            )}
            {/* Domain */}
            <div className="text-xs text-gray-500 truncate">
              {bookmark.domain}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
