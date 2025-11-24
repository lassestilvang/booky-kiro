import { useState } from 'react';
import { ExportFormat } from '@bookmark-manager/shared';
import { useCollectionStore } from '../../stores/collectionStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('html');
  const [exportType, setExportType] = useState<
    'all' | 'collection' | 'filtered'
  >('all');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collections = useCollectionStore((state) => state.collections);
  const filters = useBookmarkStore((state) => state.filters);
  const hasActiveFilters =
    filters.tags.length > 0 ||
    filters.type.length > 0 ||
    filters.domain.length > 0 ||
    filters.dateFrom !== undefined ||
    filters.dateTo !== undefined ||
    filters.search !== undefined;

  if (!isOpen) return null;

  const handleExport = async () => {
    setExporting(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      let url = '';
      const params = new URLSearchParams();
      params.append('format', format);

      if (exportType === 'collection') {
        if (!selectedCollectionId) {
          setError('Please select a collection to export');
          setExporting(false);
          return;
        }
        url = `/v1/export/${selectedCollectionId}?${params.toString()}`;
      } else if (exportType === 'filtered') {
        // Add filter parameters
        if (filters.tags.length > 0) {
          params.append('tags', filters.tags.join(','));
        }
        if (filters.type.length > 0) {
          params.append('type', filters.type.join(','));
        }
        if (filters.domain.length > 0) {
          params.append('domain', filters.domain.join(','));
        }
        if (filters.dateFrom) {
          params.append('dateFrom', filters.dateFrom.toISOString());
        }
        if (filters.dateTo) {
          params.append('dateTo', filters.dateTo.toISOString());
        }
        url = `/v1/export?${params.toString()}`;
      } else {
        // Export all
        url = `/v1/export?${params.toString()}`;
      }

      // Fetch the export file
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${API_BASE_URL}${url}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Export failed');
      }

      // Get the filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `bookmarks-${new Date().toISOString().split('T')[0]}.${format}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // Close dialog after successful export
      setTimeout(() => {
        handleClose();
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Failed to export bookmarks');
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    setFormat('html');
    setExportType('all');
    setSelectedCollectionId('');
    setExporting(false);
    setError(null);
    onClose();
  };

  const getFormatDescription = (fmt: ExportFormat): string => {
    switch (fmt) {
      case 'html':
        return 'Browser-compatible format (Netscape Bookmark Format)';
      case 'csv':
        return 'Spreadsheet format with basic metadata';
      case 'txt':
        return 'Plain text format with titles and URLs';
      case 'json':
        return 'Complete data with all metadata, tags, and highlights';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Export Bookmarks
          </h2>
          <button
            onClick={handleClose}
            disabled={exporting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
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

        {/* Body */}
        <div className="px-6 py-4">
          {/* Export Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What to Export
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="all"
                  checked={exportType === 'all'}
                  onChange={(e) => setExportType(e.target.value as 'all')}
                  disabled={exporting}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">All Bookmarks</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="collection"
                  checked={exportType === 'collection'}
                  onChange={(e) =>
                    setExportType(e.target.value as 'collection')
                  }
                  disabled={exporting}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Specific Collection
                </span>
              </label>
              {hasActiveFilters && (
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="filtered"
                    checked={exportType === 'filtered'}
                    onChange={(e) =>
                      setExportType(e.target.value as 'filtered')
                    }
                    disabled={exporting}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    Current Filtered Results
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Collection Selection */}
          {exportType === 'collection' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Collection
              </label>
              <select
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                disabled={exporting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a collection...</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.icon} {collection.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Format Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <div className="space-y-2">
              {(['html', 'csv', 'txt', 'json'] as ExportFormat[]).map((fmt) => (
                <label key={fmt} className="flex items-start">
                  <input
                    type="radio"
                    value={fmt}
                    checked={format === fmt}
                    onChange={(e) => setFormat(e.target.value as ExportFormat)}
                    disabled={exporting}
                    className="mr-2 mt-1"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900 uppercase">
                      {fmt}
                    </span>
                    <p className="text-xs text-gray-500">
                      {getFormatDescription(fmt)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Active Filters Display */}
          {exportType === 'filtered' && hasActiveFilters && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-medium text-blue-900 mb-2">
                Active Filters:
              </p>
              <div className="flex flex-wrap gap-1">
                {filters.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                  </span>
                ))}
                {filters.type.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {type}
                  </span>
                ))}
                {filters.domain.map((domain) => (
                  <span
                    key={domain}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {domain}
                  </span>
                ))}
                {filters.dateFrom && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    From: {filters.dateFrom.toLocaleDateString()}
                  </span>
                )}
                {filters.dateTo && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    To: {filters.dateTo.toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-red-600 mr-3 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-900">
                    Export Failed
                  </h4>
                  <p className="text-sm text-red-800 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="text-xs text-gray-500">
            <p>
              Your bookmarks will be downloaded as a file. Choose the format
              that best suits your needs.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            onClick={handleClose}
            disabled={exporting}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={
              exporting ||
              (exportType === 'collection' && !selectedCollectionId)
            }
            className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {exporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Exporting...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
