import { useState } from 'react';
import { SearchInterface } from '../components/Search';
import { SearchResult } from '@bookmark-manager/shared';
import { BookmarkDetailModal } from '../components/Bookmarks';
import { useBookmarkStore } from '../stores/bookmarkStore';

export function SearchPage() {
  const [showBookmarkDetailModal, setShowBookmarkDetailModal] = useState(false);
  const selectBookmark = useBookmarkStore((state) => state.selectBookmark);
  const selectedBookmark = useBookmarkStore((state) => state.selectedBookmark);

  const handleResultClick = (result: SearchResult) => {
    selectBookmark(result.bookmark);
    setShowBookmarkDetailModal(true);
  };

  return (
    <div className="h-[calc(100vh-4rem)]">
      <SearchInterface onResultClick={handleResultClick} />

      {/* Bookmark Detail Modal */}
      <BookmarkDetailModal
        isOpen={showBookmarkDetailModal}
        onClose={() => {
          setShowBookmarkDetailModal(false);
          selectBookmark(null);
        }}
        bookmark={selectedBookmark}
      />
    </div>
  );
}
