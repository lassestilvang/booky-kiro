import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../lib/api';

type ViewMode = 'grid' | 'headlines' | 'masonry' | 'list';

interface UIState {
  viewMode: ViewMode;
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  syncPreferences: () => Promise<void>;
  loadPreferences: () => Promise<void>;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      viewMode: 'grid',
      theme: 'light',
      sidebarOpen: true,
      setViewMode: async (mode) => {
        set({ viewMode: mode });
        // Sync to backend
        try {
          await apiClient.put('/v1/user', {
            preferences: {
              viewMode: mode,
              theme: get().theme,
            },
          });
        } catch (error) {
          console.error('Failed to sync view mode to backend:', error);
        }
      },
      setTheme: async (theme) => {
        set({ theme });
        // Sync to backend
        try {
          await apiClient.put('/v1/user', {
            preferences: {
              viewMode: get().viewMode,
              theme,
            },
          });
        } catch (error) {
          console.error('Failed to sync theme to backend:', error);
        }
      },
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      syncPreferences: async () => {
        try {
          const { viewMode, theme } = get();
          await apiClient.put('/v1/user', {
            preferences: {
              viewMode,
              theme,
            },
          });
        } catch (error) {
          console.error('Failed to sync preferences to backend:', error);
        }
      },
      loadPreferences: async () => {
        try {
          const response = await apiClient.get('/v1/user');
          const user = response.data;
          if (user.preferences) {
            set({
              viewMode: user.preferences.viewMode || 'grid',
              theme: user.preferences.theme || 'light',
            });
          }
        } catch (error) {
          console.error('Failed to load preferences from backend:', error);
        }
      },
    }),
    {
      name: 'ui-storage',
    }
  )
);
