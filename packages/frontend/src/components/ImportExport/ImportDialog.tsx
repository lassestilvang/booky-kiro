import { useState } from 'react';
import { apiClient } from '../../lib/api';
import { ImportResponse } from '@bookmark-manager/shared';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ImportDialog({
  isOpen,
  onClose,
  onSuccess,
}: ImportDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'html' | 'json'>('html');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setProgress(null);

      // Auto-detect import type from file extension
      if (file.name.endsWith('.json')) {
        setImportType('json');
      } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        setImportType('html');
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Please select a file to import');
      return;
    }

    setImporting(true);
    setError(null);
    setProgress(null);

    try {
      const fileContent = await selectedFile.text();

      let response;
      if (importType === 'html') {
        response = await apiClient.post<ImportResponse>('/v1/import/html', {
          html: fileContent,
        });
      } else {
        // Parse JSON file
        const jsonData = JSON.parse(fileContent);
        response = await apiClient.post<ImportResponse>('/v1/import/json', {
          data: jsonData,
        });
      }

      setProgress(response.data);

      // If successful, notify parent and close after a delay
      if (response.data.success) {
        setTimeout(() => {
          onSuccess?.();
          handleClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to import bookmarks'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImportType('html');
    setImporting(false);
    setProgress(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Import Bookmarks
          </h2>
          <button
            onClick={handleClose}
            disabled={importing}
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
          {/* Import Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Import Format
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="html"
                  checked={importType === 'html'}
                  onChange={(e) => setImportType(e.target.value as 'html')}
                  disabled={importing}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  HTML (Browser Bookmarks)
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="json"
                  checked={importType === 'json'}
                  onChange={(e) => setImportType(e.target.value as 'json')}
                  disabled={importing}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">JSON (Full Data)</span>
              </label>
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept={importType === 'html' ? '.html,.htm' : '.json'}
                onChange={handleFileSelect}
                disabled={importing}
                className="hidden"
                id="import-file-input"
              />
              <label
                htmlFor="import-file-input"
                className="cursor-pointer block"
              >
                <svg
                  className="w-12 h-12 text-gray-400 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600">
                      Click to select a file
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {importType === 'html'
                        ? 'HTML or HTM files'
                        : 'JSON files'}
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Progress Display */}
          {importing && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-sm text-blue-900">
                  Importing bookmarks...
                </span>
              </div>
            </div>
          )}

          {/* Success/Error Display */}
          {progress && !importing && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                progress.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <div className="flex items-start">
                <svg
                  className={`w-5 h-5 mr-3 mt-0.5 ${
                    progress.success ? 'text-green-600' : 'text-yellow-600'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1">
                  <h4
                    className={`text-sm font-medium ${
                      progress.success ? 'text-green-900' : 'text-yellow-900'
                    }`}
                  >
                    {progress.success
                      ? 'Import Completed Successfully'
                      : 'Import Completed with Warnings'}
                  </h4>
                  <div className="mt-2 text-sm text-gray-700">
                    <p>Imported {progress.importedBookmarks} bookmarks</p>
                    <p>Imported {progress.importedCollections} collections</p>
                    <p>Imported {progress.importedTags} tags</p>
                  </div>
                  {progress.errors && progress.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-yellow-900 mb-1">
                        Errors:
                      </p>
                      <ul className="text-xs text-yellow-800 list-disc list-inside max-h-32 overflow-y-auto">
                        {progress.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
                    Import Failed
                  </h4>
                  <p className="text-sm text-red-800 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="text-xs text-gray-500">
            {importType === 'html' ? (
              <p>
                Import bookmarks from browser exports (Chrome, Firefox, Safari,
                Edge). Folder structure will be preserved as collections.
              </p>
            ) : (
              <p>
                Import complete bookmark data including metadata, tags, and
                highlights from a previous export.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            onClick={handleClose}
            disabled={importing}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {progress?.success ? 'Close' : 'Cancel'}
          </button>
          {!progress?.success && (
            <button
              onClick={handleImport}
              disabled={!selectedFile || importing}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
