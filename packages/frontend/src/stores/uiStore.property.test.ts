import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

// Mock the API client before importing the store
vi.mock('../lib/api', () => ({
  apiClient: {
    put: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({
      data: {
        preferences: {
          viewMode: 'grid',
          theme: 'light',
        },
      },
    }),
  },
}));

// Import store after API mock is set up
import { useUIStore } from './uiStore';

describe('UI Store Property Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset the store to initial state
    useUIStore.setState({
      viewMode: 'grid',
      theme: 'light',
      sidebarOpen: true,
    });
    vi.clearAllMocks();
  });

  /**
   * Feature: bookmark-manager-platform, Property 14: View Preference Persistence
   * Validates: Requirements 4.5
   */
  it('should persist view mode preference across sessions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'grid' as const,
          'headlines' as const,
          'masonry' as const,
          'list' as const
        ),
        async (viewMode) => {
          // Set the view mode
          await useUIStore.getState().setViewMode(viewMode);

          // Verify it's set in the store
          expect(useUIStore.getState().viewMode).toBe(viewMode);

          // Simulate a new session by creating a new store instance
          // The persist middleware should restore from localStorage
          const storedData = localStorage.getItem('ui-storage');
          expect(storedData).toBeTruthy();

          if (storedData) {
            const parsed = JSON.parse(storedData);
            expect(parsed.state.viewMode).toBe(viewMode);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 14: View Preference Persistence
   * Validates: Requirements 4.5
   */
  it('should persist theme preference across sessions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('light' as const, 'dark' as const),
        async (theme) => {
          // Set the theme
          await useUIStore.getState().setTheme(theme);

          // Verify it's set in the store
          expect(useUIStore.getState().theme).toBe(theme);

          // Verify it's persisted to localStorage
          const storedData = localStorage.getItem('ui-storage');
          expect(storedData).toBeTruthy();

          if (storedData) {
            const parsed = JSON.parse(storedData);
            expect(parsed.state.theme).toBe(theme);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 14: View Preference Persistence
   * Validates: Requirements 4.5
   */
  it('should sync preferences to backend when changed', async () => {
    const { apiClient } = await import('../lib/api');

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'grid' as const,
          'headlines' as const,
          'masonry' as const,
          'list' as const
        ),
        fc.constantFrom('light' as const, 'dark' as const),
        async (viewMode, theme) => {
          vi.clearAllMocks();

          // Set view mode
          await useUIStore.getState().setViewMode(viewMode);

          // Verify API was called with correct data
          expect(apiClient.put).toHaveBeenCalledWith('/v1/user', {
            preferences: {
              viewMode,
              theme: expect.any(String),
            },
          });

          vi.clearAllMocks();

          // Set theme
          await useUIStore.getState().setTheme(theme);

          // Verify API was called with correct data
          expect(apiClient.put).toHaveBeenCalledWith('/v1/user', {
            preferences: {
              viewMode: expect.any(String),
              theme,
            },
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 14: View Preference Persistence
   * Validates: Requirements 4.5
   */
  it('should handle API failures gracefully without losing local state', async () => {
    const { apiClient } = await import('../lib/api');

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'grid' as const,
          'headlines' as const,
          'masonry' as const,
          'list' as const
        ),
        async (viewMode) => {
          // Mock API failure
          vi.mocked(apiClient.put).mockRejectedValueOnce(
            new Error('Network error')
          );

          // Set view mode (should not throw)
          await useUIStore.getState().setViewMode(viewMode);

          // Verify local state is still updated
          expect(useUIStore.getState().viewMode).toBe(viewMode);

          // Verify it's still persisted locally
          const storedData = localStorage.getItem('ui-storage');
          if (storedData) {
            const parsed = JSON.parse(storedData);
            expect(parsed.state.viewMode).toBe(viewMode);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 14: View Preference Persistence
   * Validates: Requirements 4.5
   */
  it('should load preferences from backend on request', async () => {
    const { apiClient } = await import('../lib/api');

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('grid', 'headlines', 'masonry', 'list'),
        fc.constantFrom('light', 'dark'),
        async (viewMode, theme) => {
          // Mock backend response
          vi.mocked(apiClient.get).mockResolvedValueOnce({
            data: {
              preferences: {
                viewMode,
                theme,
              },
            },
          });

          // Load preferences
          await useUIStore.getState().loadPreferences();

          // Verify state is updated
          expect(useUIStore.getState().viewMode).toBe(viewMode);
          expect(useUIStore.getState().theme).toBe(theme);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 14: View Preference Persistence
   * Validates: Requirements 4.5
   */
  it('should use default preferences when backend returns no data', async () => {
    const { apiClient } = await import('../lib/api');

    // Mock backend response with no preferences
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {},
    });

    // Load preferences
    await useUIStore.getState().loadPreferences();

    // Verify defaults are used (state should remain unchanged)
    const state = useUIStore.getState();
    expect(['grid', 'headlines', 'masonry', 'list']).toContain(state.viewMode);
    expect(['light', 'dark']).toContain(state.theme);
  });

  /**
   * Feature: bookmark-manager-platform, Property 14: View Preference Persistence
   * Validates: Requirements 4.5
   */
  it('should sync all preferences together', async () => {
    const { apiClient } = await import('../lib/api');

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'grid' as const,
          'headlines' as const,
          'masonry' as const,
          'list' as const
        ),
        fc.constantFrom('light' as const, 'dark' as const),
        async (viewMode, theme) => {
          // Set both preferences
          useUIStore.setState({ viewMode, theme });

          vi.clearAllMocks();

          // Sync preferences
          await useUIStore.getState().syncPreferences();

          // Verify API was called with both preferences
          expect(apiClient.put).toHaveBeenCalledWith('/v1/user', {
            preferences: {
              viewMode,
              theme,
            },
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
