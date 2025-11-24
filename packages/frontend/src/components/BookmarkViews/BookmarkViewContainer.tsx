import { BookmarkWithRelations } from '@bookmark-manager/shared';
import { useUIStore } from '../../stores/uiStore';
import { GridView } from './GridView';
import { HeadlinesView } from './HeadlinesView';
import { MasonryView } from './MasonryView';
import { ListView } from './ListView';

interface BookmarkViewContainerProps {
  bookmarks: BookmarkWithRelations[];
  onBookmarkClick?: (bookmark: BookmarkWithRelations) => void;
}

export function BookmarkViewContainer({
  bookmarks,
  onBookmarkClick,
}: BookmarkViewContainerProps) {
  const viewMode = useUIStore((state) => state.viewMode);

  switch (viewMode) {
    case 'grid':
      return (
        <GridView bookmarks={bookmarks} onBookmarkClick={onBookmarkClick} />
      );
    case 'headlines':
      return (
        <HeadlinesView
          bookmarks={bookmarks}
          onBookmarkClick={onBookmarkClick}
        />
      );
    case 'masonry':
      return (
        <MasonryView bookmarks={bookmarks} onBookmarkClick={onBookmarkClick} />
      );
    case 'list':
      return (
        <ListView bookmarks={bookmarks} onBookmarkClick={onBookmarkClick} />
      );
    default:
      return (
        <GridView bookmarks={bookmarks} onBookmarkClick={onBookmarkClick} />
      );
  }
}
