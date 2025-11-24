import { useState, useEffect } from 'react';
import {
  Collection,
  BookmarkWithRelations,
  SearchResult,
} from '@bookmark-manager/shared';
import { useBookmarkStore } from '../stores/bookmarkStore';
import { useCollectionStore } from '../stores/collectionStore';
import {
  CollectionSidebar,
  CreateCollectionModal,
  EditCollectionModal,
  DeleteCollectionModal,
} from '../components/Collections';
import {
  CreateBookmarkModal,
  BookmarkDetailModal,
  BookmarkFilters,
  BookmarkPreviewModal,
} from '../components/Bookmarks';
import { BookmarkViewContainer } from '../components/BookmarkViews';
import { SearchInterface } from '../components/Search';
import { ImportDialog, ExportDialog } from '../components/ImportExport';

export function DashboardPage() {
  const [showCreateCollectionModal, setShowCreateCollectionModal] =
    useState(false);
  const [showEditCollectionModal, setShowEditCollectionModal] = useState(false);
  const [showDeleteCollectionModal, setShowDeleteCollectionModal] =
    useState(false);
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null);

  const [showCreateBookmarkModal, setShowCreateBookmarkModal] = useState(false);
  const [showBookmarkDetailModal, setShowBookmarkDetailModal] = useState(false);
  const [showBookmarkPreviewModal, setShowBookmarkPreviewModal] =
    useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const bookmarks = useBookmarkStore((state) => state.bookmarks);
  const loading = useBookmarkStore((state) => state.loading);
  const selectedBookmark = useBookmarkStore((state) => state.selectedBookmark);
  const selectBookmark = useBookmarkStore((state) => state.selectBookmark);
  const fetchBookmarks = useBookmarkStore((state) => state.fetchBookmarks);

  const selectedCollectionId = useCollectionStore(
    (state) => state.selectedCollectionId
  );

  useEffect(() => {
    // Fetch bookmarks when component mounts or collection changes
    fetchBookmarks(selectedCollectionId || undefined);
  }, [selectedCollectionId, fetchBookmarks]);

  useEffect(() => {
    // Listen for keyboard shortcut to open create bookmark modal
    const handleOpenCreateBookmark = () => {
      setShowCreateBookmarkModal(true);
    };
    window.addEventListener('open-create-bookmark', handleOpenCreateBookmark);
    return () =>
      window.removeEventListener(
        'open-create-bookmark',
        handleOpenCreateBookmark
      );
  }, []);

  const handleEditCollectionClick = (collection: Collection) => {
    setSelectedCollection(collection);
    setShowEditCollectionModal(true);
  };

  const handleDeleteCollectionClick = (collection: Collection) => {
    setSelectedCollection(collection);
    setShowDeleteCollectionModal(true);
  };

  const handleBookmarkClick = (bookmark: BookmarkWithRelations) => {
    selectBookmark(bookmark);
    setShowBookmarkDetailModal(true);
  };

  const handleSearchResultClick = (result: SearchResult) => {
    selectBookmark(result.bookmark);
    setShowBookmarkDetailModal(true);
  };

  const handleApplyFilters = () => {
    fetchBookmarks(selectedCollectionId || undefined);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Collection Sidebar */}
      <CollectionSidebar
        onCreateClick={() => setShowCreateCollectionModal(true)}
        onEditClick={handleEditCollectionClick}
        onDeleteClick={handleDeleteCollectionClick}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Add Bookmark Button */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedCollectionId
                  ? useCollectionStore
                      .getState()
                      .collections.find((c) => c.id === selectedCollectionId)
                      ?.title || 'Bookmarks'
                  : 'All Bookmarks'}
              </h1>
              <p
                className="text-sm text-gray-600 dark:text-gray-400 mt-1"
                role="status"
                aria-live="polite"
              >
                {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2" role="toolbar" aria-label="Bookmark actions">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
                aria-label="Toggle search"
                aria-pressed={showSearch}
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Search
              </button>
              <button
                onClick={() => setShowImportDialog(true)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
                aria-label="Import bookmarks"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Import
              </button>
              <button
                onClick={() => setShowExportDialog(true)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
                aria-label="Export bookmarks"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export
              </button>
              <button
                onClick={() => setShowCreateBookmarkModal(true)}
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 flex items-center"
                aria-label="Add new bookmark"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Bookmark
              </button>
            </div>
          </div>
        </div>

        {/* Search or Bookmarks View */}
        {showSearch ? (
          <SearchInterface onResultClick={handleSearchResultClick} />
        ) : (
          <>
            {/* Filters */}
            <BookmarkFilters onApplyFilters={handleApplyFilters} />

            {/* Bookmarks View */}
            <div
              className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900"
              role="region"
              aria-label="Bookmarks list"
            >
              {loading ? (
                <div
                  className="flex items-center justify-center h-full"
                  role="status"
                  aria-live="polite"
                >
                  <div className="text-center">
                    <div
                      className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"
                      aria-hidden="true"
                    ></div>
                    <p className="text-gray-600 dark:text-gray-400 mt-4">
                      Loading bookmarks...
                    </p>
                  </div>
                </div>
              ) : bookmarks.length > 0 ? (
                <BookmarkViewContainer
                  bookmarks={bookmarks}
                  onBookmarkClick={handleBookmarkClick}
                />
              ) : (
                <div
                  className="flex items-center justify-center h-full"
                  role="status"
                >
                  <div className="text-center">
                    <svg
                      className="w-16 h-16 text-gray-400 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No bookmarks yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Start saving your favorite web pages and content
                    </p>
                    <button
                      onClick={() => setShowCreateBookmarkModal(true)}
                      className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                      aria-label="Add your first bookmark"
                    >
                      Add Your First Bookmark
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Collection Modals */}
      <CreateCollectionModal
        isOpen={showCreateCollectionModal}
        onClose={() => setShowCreateCollectionModal(false)}
      />
      <EditCollectionModal
        isOpen={showEditCollectionModal}
        onClose={() => {
          setShowEditCollectionModal(false);
          setSelectedCollection(null);
        }}
        collection={selectedCollection}
      />
      <DeleteCollectionModal
        isOpen={showDeleteCollectionModal}
        onClose={() => {
          setShowDeleteCollectionModal(false);
          setSelectedCollection(null);
        }}
        collection={selectedCollection}
      />

      {/* Bookmark Modals */}
      <CreateBookmarkModal
        isOpen={showCreateBookmarkModal}
        onClose={() => setShowCreateBookmarkModal(false)}
      />
      <BookmarkDetailModal
        isOpen={showBookmarkDetailModal}
        onClose={() => {
          setShowBookmarkDetailModal(false);
          selectBookmark(null);
        }}
        bookmark={selectedBookmark}
        onPreview={() => {
          setShowBookmarkDetailModal(false);
          setShowBookmarkPreviewModal(true);
        }}
      />
      <BookmarkPreviewModal
        isOpen={showBookmarkPreviewModal}
        onClose={() => {
          setShowBookmarkPreviewModal(false);
        }}
        bookmark={selectedBookmark}
      />

      {/* Import/Export Dialogs */}
      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onSuccess={() => {
          // Refresh bookmarks after successful import
          fetchBookmarks(selectedCollectionId || undefined);
        }}
      />
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
    </div>
  );
}
