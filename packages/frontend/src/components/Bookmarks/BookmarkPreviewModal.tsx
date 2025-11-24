import { useState, useEffect } from 'react';
import { BookmarkWithRelations } from '@bookmark-manager/shared';
import { apiClient } from '../../lib/api';

interface BookmarkPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: BookmarkWithRelations | null;
}

type PreviewMode = 'original' | 'snapshot' | 'error';

export function BookmarkPreviewModal({
  isOpen,
  onClose,
  bookmark,
}: BookmarkPreviewModalProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('original');
  const [snapshotContent, setSnapshotContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && bookmark) {
      // Reset state when opening modal
      setPreviewMode('original');
      setSnapshotContent(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, bookmark]);

  const loadSnapshot = async () => {
    if (!bookmark?.contentSnapshotPath) {
      setError('No archived snapshot available for this bookmark');
      setPreviewMode('error');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(
        `/v1/bookmarks/${bookmark.id}/snapshot`
      );
      setSnapshotContent(response.data.content);
      setPreviewMode('snapshot');
    } catch (err: unknown) {
      setError(
        (err as unknown).response?.data?.message ||
          'Failed to load archived snapshot. The snapshot may not be available yet.'
      );
      setPreviewMode('error');
    } finally {
      setLoading(false);
    }
  };

  const handleIframeError = () => {
    // If original page fails to load, try to load snapshot
    if (previewMode === 'original' && bookmark?.contentSnapshotPath) {
      loadSnapshot();
    } else {
      setError('Failed to load content');
      setPreviewMode('error');
    }
  };

  const renderVideoPlayer = () => {
    if (!bookmark) return null;

    // Check if it's a YouTube video
    const youtubeMatch = bookmark.url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/
    );
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      return (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={bookmark.title}
        />
      );
    }

    // Check if it's a Vimeo video
    const vimeoMatch = bookmark.url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      return (
        <iframe
          src={`https://player.vimeo.com/video/${videoId}`}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={bookmark.title}
        />
      );
    }

    // For other video types, use HTML5 video player
    return (
      <video
        src={bookmark.url}
        controls
        className="w-full h-full"
        title={bookmark.title}
      >
        Your browser does not support the video tag.
      </video>
    );
  };

  const renderContent = () => {
    if (!bookmark) return null;

    // Show loading state
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading archived snapshot...</p>
          </div>
        </div>
      );
    }

    // Show error state
    if (previewMode === 'error') {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md px-4">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-gray-700 mb-4">{error}</p>
            {bookmark.contentSnapshotPath && (
              <button
                onClick={loadSnapshot}
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Try Archived Snapshot
              </button>
            )}
          </div>
        </div>
      );
    }

    // Show video player for video bookmarks
    if (bookmark.type === 'video') {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center">
          {renderVideoPlayer()}
        </div>
      );
    }

    // Show snapshot content if available
    if (previewMode === 'snapshot' && snapshotContent) {
      return (
        <div className="w-full h-full overflow-auto bg-white">
          <div
            className="max-w-4xl mx-auto p-8 prose prose-lg"
            dangerouslySetInnerHTML={{ __html: snapshotContent }}
          />
        </div>
      );
    }

    // Show original page in iframe
    return (
      <iframe
        src={bookmark.url}
        className="w-full h-full border-0"
        title={bookmark.title}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        onError={handleIframeError}
      />
    );
  };

  if (!isOpen || !bookmark) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {bookmark.title}
            </h2>
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 truncate block"
            >
              {bookmark.url}
            </a>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center space-x-2 mr-4">
            {bookmark.contentSnapshotPath && (
              <>
                <button
                  onClick={() => setPreviewMode('original')}
                  className={`px-3 py-1 text-sm rounded-md ${
                    previewMode === 'original'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  disabled={loading}
                >
                  Original
                </button>
                <button
                  onClick={loadSnapshot}
                  className={`px-3 py-1 text-sm rounded-md ${
                    previewMode === 'snapshot'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  disabled={loading}
                >
                  Archived
                </button>
              </>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
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
        <div className="flex-1 overflow-hidden">{renderContent()}</div>

        {/* Footer with highlights if available */}
        {bookmark.highlights.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 p-4 max-h-48 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Highlights ({bookmark.highlights.length})
            </h3>
            <div className="space-y-2">
              {bookmark.highlights.slice(0, 3).map((highlight) => (
                <div
                  key={highlight.id}
                  className="text-sm border-l-4 pl-3 py-1"
                  style={{ borderLeftColor: highlight.color }}
                >
                  <p className="text-gray-900 italic">
                    "{highlight.textSelected}"
                  </p>
                  {highlight.annotationMd && (
                    <p className="text-gray-600 text-xs mt-1">
                      {highlight.annotationMd}
                    </p>
                  )}
                </div>
              ))}
              {bookmark.highlights.length > 3 && (
                <p className="text-xs text-gray-500">
                  +{bookmark.highlights.length - 3} more highlights
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
