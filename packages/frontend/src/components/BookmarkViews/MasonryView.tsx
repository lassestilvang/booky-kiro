import { BookmarkWithRelations } from '@bookmark-manager/shared';
import { useEffect, useRef, useState } from 'react';

interface MasonryViewProps {
  bookmarks: BookmarkWithRelations[];
  onBookmarkClick?: (bookmark: BookmarkWithRelations) => void;
}

export function MasonryView({ bookmarks, onBookmarkClick }: MasonryViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);

  // Adjust column count based on container width
  useEffect(() => {
    const updateColumns = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      if (width < 640) setColumns(1);
      else if (width < 1024) setColumns(2);
      else if (width < 1536) setColumns(3);
      else setColumns(4);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  if (bookmarks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No bookmarks to display</p>
      </div>
    );
  }

  // Distribute bookmarks across columns
  const columnArrays: BookmarkWithRelations[][] = Array.from(
    { length: columns },
    () => []
  );
  bookmarks.forEach((bookmark, index) => {
    columnArrays[index % columns].push(bookmark);
  });

  return (
    <div ref={containerRef} className="p-4">
      <div className="flex gap-4">
        {columnArrays.map((columnBookmarks, columnIndex) => (
          <div key={columnIndex} className="flex-1 space-y-4">
            {columnBookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                onClick={() => onBookmarkClick?.(bookmark)}
              >
                {/* Cover Image - variable height */}
                {bookmark.coverUrl && (
                  <div className="relative">
                    <img
                      src={bookmark.coverUrl}
                      alt={bookmark.title}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                    {/* Type Badge */}
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-1 text-xs font-medium bg-white bg-opacity-90 rounded">
                        {bookmark.type}
                      </span>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="p-4">
                  {!bookmark.coverUrl && (
                    <div className="mb-2">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded">
                        {bookmark.type}
                      </span>
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {bookmark.title}
                  </h3>
                  {bookmark.excerpt && (
                    <p className="text-sm text-gray-600 mb-3">
                      {bookmark.excerpt}
                    </p>
                  )}
                  {/* Tags */}
                  {bookmark.tags && bookmark.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {bookmark.tags.map((tag) => (
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
                    </div>
                  )}
                  {/* Domain and Date */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="truncate">{bookmark.domain}</span>
                    <span className="flex-shrink-0 ml-2">
                      {new Date(bookmark.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
