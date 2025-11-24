import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../lib/api';

interface Permission {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: 'owner' | 'editor' | 'viewer';
  createdAt: string;
}

interface SharingDialogProps {
  collectionId: string;
  collectionTitle: string;
  isPublic: boolean;
  shareSlug?: string;
  onClose: () => void;
  onUpdate: () => void;
}

export const SharingDialog: React.FC<SharingDialogProps> = ({
  collectionId,
  collectionTitle,
  isPublic: initialIsPublic,
  shareSlug: initialShareSlug,
  onClose,
  onUpdate,
}) => {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [shareSlug, setShareSlug] = useState(initialShareSlug);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'editor' | 'viewer'>('viewer');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const isPro = user?.plan === 'pro';

  useEffect(() => {
    if (isPro) {
      fetchPermissions();
    }
  }, [isPro, collectionId]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/v1/collections/${collectionId}/permissions`
      );
      setPermissions(response.data.permissions || []);
      setError(null);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message || 'Failed to load permissions'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleShareWithUser = async () => {
    if (!newUserEmail.trim()) return;

    try {
      setError(null);
      await apiClient.post(`/v1/collections/${collectionId}/share`, {
        email: newUserEmail,
        role: newUserRole,
      });

      setNewUserEmail('');
      await fetchPermissions();
      onUpdate();
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message || 'Failed to share collection'
      );
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    try {
      setError(null);
      await apiClient.delete(`/v1/collections/${collectionId}/share/${userId}`);
      await fetchPermissions();
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to revoke access');
    }
  };

  const handleTogglePublic = async () => {
    try {
      setError(null);
      const response = await apiClient.put(`/v1/collections/${collectionId}`, {
        isPublic: !isPublic,
      });

      setIsPublic(response.data.collection.isPublic);
      setShareSlug(response.data.collection.shareSlug);
      onUpdate();
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message || 'Failed to update public status'
      );
    }
  };

  const handleCopyPublicLink = () => {
    if (shareSlug) {
      const link = `${window.location.origin}/public/${shareSlug}`;
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (!isPro) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-yellow-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Pro Feature
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Collection sharing is available with a Pro subscription.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Share Collection
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
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
          <p className="text-sm text-gray-500 mt-1">{collectionTitle}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-red-600 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Public Link Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Public Link
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Anyone with the link can view this collection
                </p>
              </div>
              <button
                onClick={handleTogglePublic}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPublic ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPublic ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {isPublic && shareSlug && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}/public/${shareSlug}`}
                  readOnly
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50"
                />
                <button
                  onClick={handleCopyPublicLink}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                >
                  {copiedLink ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          {/* Share with Specific Users */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Share with Specific Users
            </h3>

            <div className="flex gap-2 mb-4">
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <select
                value={newUserRole}
                onChange={(e) =>
                  setNewUserRole(e.target.value as 'editor' | 'viewer')
                }
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button
                onClick={handleShareWithUser}
                disabled={!newUserEmail.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
              >
                Share
              </button>
            </div>

            {/* Permissions List */}
            {loading ? (
              <div className="text-center py-4">
                <svg
                  className="animate-spin h-6 w-6 text-gray-400 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            ) : permissions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No users have access yet
              </p>
            ) : (
              <div className="space-y-2">
                {permissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {permission.userName || permission.userEmail}
                      </p>
                      <p className="text-xs text-gray-500">
                        {permission.userEmail}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          permission.role === 'owner'
                            ? 'bg-purple-100 text-purple-800'
                            : permission.role === 'editor'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {permission.role.charAt(0).toUpperCase() +
                          permission.role.slice(1)}
                      </span>
                      {permission.role !== 'owner' && (
                        <button
                          onClick={() => handleRevokeAccess(permission.userId)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <svg
                className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium">Permission Roles</p>
                <ul className="mt-2 space-y-1 text-blue-700">
                  <li>
                    • <strong>Owner:</strong> Full control over the collection
                  </li>
                  <li>
                    • <strong>Editor:</strong> Can add, edit, and delete
                    bookmarks
                  </li>
                  <li>
                    • <strong>Viewer:</strong> Can only view bookmarks
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
