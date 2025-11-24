import { useEffect, useState } from 'react';
import { Collection } from '@bookmark-manager/shared';
import { useCollectionStore } from '../../stores/collectionStore';
import { CollectionItem } from './CollectionItem';

interface CollectionSidebarProps {
  onCreateClick: () => void;
  onEditClick: (collection: Collection) => void;
  onDeleteClick: (collection: Collection) => void;
}

export function CollectionSidebar({
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: CollectionSidebarProps) {
  const {
    collections,
    selectedCollectionId,
    loading,
    error,
    fetchCollections,
    selectCollection,
    reorderCollections,
  } = useCollectionStore();

  const [draggedItem, setDraggedItem] = useState<Collection | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Build hierarchy
  const rootCollections = collections
    .filter((c) => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const getChildren = (parentId: string): Collection[] => {
    return collections
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  const handleDragStart = (collection: Collection) => {
    setDraggedItem(collection);
  };

  const handleDragOver = (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    setDragOverItem(collectionId);
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetCollection: Collection | null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) return;

    // Don't allow dropping on self or descendants
    if (targetCollection && draggedItem.id === targetCollection.id) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    try {
      // Calculate new sort order
      const siblings = targetCollection
        ? getChildren(targetCollection.id)
        : rootCollections;

      const newSortOrder =
        siblings.length > 0
          ? Math.max(...siblings.map((s) => s.sortOrder)) + 1
          : 0;

      await reorderCollections([
        {
          id: draggedItem.id,
          sortOrder: newSortOrder,
          parentId: targetCollection?.id || null,
        },
      ]);
    } catch (error) {
      console.error('Failed to reorder collection:', error);
    }

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDropOnRoot = async (e: React.DragEvent) => {
    e.preventDefault();

    if (!draggedItem) return;

    try {
      const newSortOrder =
        rootCollections.length > 0
          ? Math.max(...rootCollections.map((c) => c.sortOrder)) + 1
          : 0;

      await reorderCollections([
        {
          id: draggedItem.id,
          sortOrder: newSortOrder,
          parentId: null,
        },
      ]);
    } catch (error) {
      console.error('Failed to move to root:', error);
    }

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const renderCollection = (collection: Collection, level: number = 0) => {
    const children = getChildren(collection.id);
    const isSelected = selectedCollectionId === collection.id;
    const isDragOver = dragOverItem === collection.id;

    return (
      <div key={collection.id}>
        <CollectionItem
          collection={collection}
          level={level}
          isSelected={isSelected}
          isDragOver={isDragOver}
          onSelect={() => selectCollection(collection.id)}
          onDragStart={() => handleDragStart(collection)}
          onDragOver={(e) => handleDragOver(e, collection.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, collection)}
          onEdit={onEditClick}
          onDelete={onDeleteClick}
        />
        {children.length > 0 && (
          <div>
            {children.map((child) => renderCollection(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading && collections.length === 0) {
    return (
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Collections</h2>
          <button
            onClick={onCreateClick}
            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            title="Create collection"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        {/* All Bookmarks */}
        <button
          onClick={() => selectCollection(null)}
          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
            selectedCollectionId === null
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            <span className="font-medium">All Bookmarks</span>
          </div>
        </button>
      </div>

      {/* Collections List */}
      <div
        className="flex-1 overflow-y-auto p-2"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverItem('root');
        }}
        onDragLeave={() => setDragOverItem(null)}
        onDrop={handleDropOnRoot}
      >
        {error && (
          <div className="mx-2 mb-2 p-2 bg-red-50 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        {rootCollections.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p>No collections yet</p>
            <p className="mt-1">Click + to create one</p>
          </div>
        ) : (
          <div className="space-y-1">
            {rootCollections.map((collection) => renderCollection(collection))}
          </div>
        )}
      </div>
    </div>
  );
}
