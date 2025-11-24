import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

interface Highlight {
  id: string;
  bookmarkId: string;
  textSelected: string;
  color: string;
  annotationMd?: string;
  positionContext: {
    before: string;
    after: string;
    xpath?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface HighlightToolProps {
  bookmarkId: string;
  highlights: Highlight[];
  onHighlightCreate: (
    highlight: Omit<Highlight, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onHighlightUpdate: (id: string, updates: Partial<Highlight>) => Promise<void>;
  onHighlightDelete: (id: string) => Promise<void>;
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Green', value: '#00FF00' },
  { name: 'Blue', value: '#00BFFF' },
  { name: 'Pink', value: '#FF69B4' },
  { name: 'Orange', value: '#FFA500' },
  { name: 'Purple', value: '#9370DB' },
];

export const HighlightTool: React.FC<HighlightToolProps> = ({
  bookmarkId,
  highlights,
  onHighlightCreate,
  onHighlightUpdate,
  onHighlightDelete,
}) => {
  const { user } = useAuthStore();
  const [selectedText, setSelectedText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FFFF00');
  const [annotation, setAnnotation] = useState('');
  const [editingHighlight, setEditingHighlight] = useState<string | null>(null);

  // Check if user has Pro access
  const isPro = user?.plan === 'pro';

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      const text = selection.toString();
      setSelectedText(text);
    }
  };

  const getPrecedingText = (range: Range, length: number): string => {
    const container = range.startContainer;
    const offset = range.startOffset;
    let text = '';

    if (container.nodeType === Node.TEXT_NODE) {
      text = (container.textContent || '').substring(
        Math.max(0, offset - length),
        offset
      );
    }

    return text;
  };

  const getFollowingText = (range: Range, length: number): string => {
    const container = range.endContainer;
    const offset = range.endOffset;
    let text = '';

    if (container.nodeType === Node.TEXT_NODE) {
      text = (container.textContent || '').substring(offset, offset + length);
    }

    return text;
  };

  const handleCreateHighlight = async () => {
    if (!selectedText || !isPro) return;

    const selection = window.getSelection();
    if (!selection) return;

    const range = selection.getRangeAt(0);

    await onHighlightCreate({
      bookmarkId,
      textSelected: selectedText,
      color: selectedColor,
      annotationMd: annotation || undefined,
      positionContext: {
        before: getPrecedingText(range, 50),
        after: getFollowingText(range, 50),
      },
    });

    // Reset form
    setSelectedText('');
    setAnnotation('');
  };

  const handleUpdateHighlight = async (highlightId: string) => {
    const highlight = highlights.find((h) => h.id === highlightId);
    if (!highlight) return;

    await onHighlightUpdate(highlightId, {
      color: selectedColor,
      annotationMd: annotation || undefined,
    });

    setEditingHighlight(null);
    setAnnotation('');
  };

  const startEditing = (highlight: Highlight) => {
    setEditingHighlight(highlight.id);
    setSelectedColor(highlight.color);
    setAnnotation(highlight.annotationMd || '');
  };

  if (!isPro) {
    return (
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
            <h3 className="text-sm font-medium text-yellow-800">Pro Feature</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Highlights and annotations are available with a Pro subscription.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Text Selection Tool */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          Create Highlight
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Selected Text
            </label>
            <div
              className="border border-gray-300 rounded-md p-3 bg-gray-50 min-h-[60px] cursor-text"
              onMouseUp={handleTextSelection}
            >
              {selectedText || 'Select text from the page to highlight...'}
            </div>
          </div>

          {selectedText && (
            <>
              {/* Color Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Highlight Color
                </label>
                <div className="flex gap-2">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setSelectedColor(color.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        selectedColor === color.value
                          ? 'border-gray-900 scale-110'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Annotation Editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Annotation (Markdown supported)
                </label>
                <textarea
                  value={annotation}
                  onChange={(e) => setAnnotation(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="Add your notes here... (supports **bold**, *italic*, etc.)"
                />
              </div>

              <button
                onClick={handleCreateHighlight}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Highlight
              </button>
            </>
          )}
        </div>
      </div>

      {/* Existing Highlights List */}
      {highlights.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Your Highlights
          </h3>

          <div className="space-y-3">
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className="border border-gray-200 rounded-md p-3"
                style={{
                  borderLeftWidth: '4px',
                  borderLeftColor: highlight.color,
                }}
              >
                {editingHighlight === highlight.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Color
                      </label>
                      <div className="flex gap-2">
                        {HIGHLIGHT_COLORS.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => setSelectedColor(color.value)}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              selectedColor === color.value
                                ? 'border-gray-900 scale-110'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Annotation
                      </label>
                      <textarea
                        value={annotation}
                        onChange={(e) => setAnnotation(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateHighlight(highlight.id)}
                        className="flex-1 bg-blue-600 text-white py-1 px-3 rounded-md hover:bg-blue-700 text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingHighlight(null);
                          setAnnotation('');
                        }}
                        className="flex-1 bg-gray-200 text-gray-700 py-1 px-3 rounded-md hover:bg-gray-300 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-gray-900 mb-2">
                      "{highlight.textSelected}"
                    </div>

                    {highlight.annotationMd && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-2">
                        {highlight.annotationMd}
                      </div>
                    )}

                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() => startEditing(highlight)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onHighlightDelete(highlight.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
