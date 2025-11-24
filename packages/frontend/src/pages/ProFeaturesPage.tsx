import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  HighlightTool,
  FileUpload,
  BackupManagement,
  SharingDialog,
} from '../components/ProFeatures';

export const ProFeaturesPage: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<
    'highlights' | 'files' | 'backups' | 'sharing'
  >('highlights');
  const [showSharingDialog, setShowSharingDialog] = useState(false);

  const isPro = user?.plan === 'pro';

  // Mock data for demonstration
  const mockHighlights = [
    {
      id: '1',
      bookmarkId: 'bookmark-1',
      textSelected: 'This is an important passage that I want to remember.',
      color: '#FFFF00',
      annotationMd: 'This relates to the main thesis of the article.',
      positionContext: {
        before: 'In the previous paragraph, the author mentioned',
        after: 'which leads to the conclusion that',
      },
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
  ];

  const handleHighlightCreate = async (highlight: any) => {
    console.log('Creating highlight:', highlight);
    // In real implementation, this would call the API
  };

  const handleHighlightUpdate = async (id: string, updates: any) => {
    console.log('Updating highlight:', id, updates);
    // In real implementation, this would call the API
  };

  const handleHighlightDelete = async (id: string) => {
    console.log('Deleting highlight:', id);
    // In real implementation, this would call the API
  };

  const handleFileUploadComplete = (fileId: string, bookmarkId: string) => {
    console.log('File uploaded:', fileId, bookmarkId);
    // In real implementation, this would update the UI
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pro Features</h1>
          <p className="text-gray-600 mt-2">
            {isPro
              ? 'Manage your Pro features and settings'
              : 'Upgrade to Pro to unlock these powerful features'}
          </p>
        </div>

        {/* Pro Badge */}
        {isPro && (
          <div className="mb-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-4 text-white">
            <div className="flex items-center">
              <svg
                className="w-6 h-6 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-semibold">Pro Account Active</p>
                <p className="text-sm opacity-90">
                  You have access to all premium features
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('highlights')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'highlights'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Highlights & Annotations
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'files'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                File Uploads
              </button>
              <button
                onClick={() => setActiveTab('backups')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'backups'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Backups
              </button>
              <button
                onClick={() => setActiveTab('sharing')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'sharing'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Sharing & Collaboration
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'highlights' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Highlights & Annotations
              </h2>
              <p className="text-gray-600 mb-6">
                Select text from your saved pages to create highlights with
                custom colors and annotations. Perfect for research and
                note-taking.
              </p>
              <HighlightTool
                bookmarkId="demo-bookmark"
                highlights={mockHighlights}
                onHighlightCreate={handleHighlightCreate}
                onHighlightUpdate={handleHighlightUpdate}
                onHighlightDelete={handleHighlightDelete}
              />
            </div>
          )}

          {activeTab === 'files' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                File Uploads
              </h2>
              <p className="text-gray-600 mb-6">
                Upload PDFs, images, and videos directly to your bookmark
                collection. Files are stored securely and indexed for full-text
                search.
              </p>
              <FileUpload onUploadComplete={handleFileUploadComplete} />
            </div>
          )}

          {activeTab === 'backups' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Automated Backups
              </h2>
              <p className="text-gray-600 mb-6">
                Your data is automatically backed up daily. Download backups
                anytime or generate on-demand backups before making major
                changes.
              </p>
              <BackupManagement />
            </div>
          )}

          {activeTab === 'sharing' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Sharing & Collaboration
              </h2>
              <p className="text-gray-600 mb-6">
                Share your collections with specific users or make them publicly
                accessible. Collaborate with team members using role-based
                permissions.
              </p>

              {isPro ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setShowSharingDialog(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Open Sharing Dialog (Demo)
                  </button>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">
                      Features:
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start">
                        <svg
                          className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Share collections with specific users via email
                      </li>
                      <li className="flex items-start">
                        <svg
                          className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Generate public links for read-only access
                      </li>
                      <li className="flex items-start">
                        <svg
                          className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Role-based permissions (Owner, Editor, Viewer)
                      </li>
                      <li className="flex items-start">
                        <svg
                          className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Real-time collaboration for editors
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
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
              )}
            </div>
          )}
        </div>

        {/* Upgrade CTA for Free Users */}
        {!isPro && (
          <div className="mt-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-2">Upgrade to Pro</h2>
            <p className="text-lg opacity-90 mb-6">
              Unlock all premium features and take your bookmark management to
              the next level
            </p>
            <button className="bg-white text-purple-600 px-8 py-3 rounded-md font-semibold hover:bg-gray-100 transition-colors">
              Upgrade Now
            </button>
          </div>
        )}
      </div>

      {/* Sharing Dialog */}
      {showSharingDialog && (
        <SharingDialog
          collectionId="demo-collection"
          collectionTitle="Demo Collection"
          isPublic={false}
          onClose={() => setShowSharingDialog(false)}
          onUpdate={() => console.log('Collection updated')}
        />
      )}
    </div>
  );
};
