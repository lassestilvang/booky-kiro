import { create } from 'zustand';
import { Collection } from '@bookmark-manager/shared';
import { apiClient } from '../lib/api';

interface CollectionState {
  collections: Collection[];
  selectedCollectionId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchCollections: () => Promise<void>;
  createCollection: (data: {
    title: string;
    icon?: string;
    parentId?: string;
  }) => Promise<Collection>;
  updateCollection: (
    id: string,
    data: {
      title?: string;
      icon?: string;
      parentId?: string | null;
      sortOrder?: number;
      isPublic?: boolean;
    }
  ) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  selectCollection: (id: string | null) => void;
  reorderCollections: (
    updates: Array<{ id: string; sortOrder: number; parentId?: string | null }>
  ) => Promise<void>;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collections: [],
  selectedCollectionId: null,
  loading: false,
  error: null,

  fetchCollections: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.get('/v1/collections');
      set({ collections: response.data, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch collections',
        loading: false,
      });
    }
  },

  createCollection: async (data) => {
    try {
      const response = await apiClient.post('/v1/collections', data);
      const newCollection = response.data;
      set((state) => ({
        collections: [...state.collections, newCollection],
      }));
      return newCollection;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to create collection'
      );
    }
  },

  updateCollection: async (id, data) => {
    try {
      const response = await apiClient.put(`/v1/collections/${id}`, data);
      const updatedCollection = response.data;
      set((state) => ({
        collections: state.collections.map((c) =>
          c.id === id ? updatedCollection : c
        ),
      }));
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to update collection'
      );
    }
  },

  deleteCollection: async (id) => {
    try {
      await apiClient.delete(`/v1/collections/${id}`);
      set((state) => ({
        collections: state.collections.filter((c) => c.id !== id),
        selectedCollectionId:
          state.selectedCollectionId === id ? null : state.selectedCollectionId,
      }));
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to delete collection'
      );
    }
  },

  selectCollection: (id) => {
    set({ selectedCollectionId: id });
  },

  reorderCollections: async (updates) => {
    // Optimistically update UI
    const previousCollections = get().collections;

    set((state) => ({
      collections: state.collections.map((c) => {
        const update = updates.find((u) => u.id === c.id);
        if (update) {
          return {
            ...c,
            sortOrder: update.sortOrder,
            parentId:
              update.parentId !== undefined
                ? update.parentId || undefined
                : c.parentId,
          } as Collection;
        }
        return c;
      }),
    }));

    try {
      // Send updates to backend
      await Promise.all(
        updates.map((update) =>
          apiClient.put(`/v1/collections/${update.id}`, {
            sortOrder: update.sortOrder,
            parentId: update.parentId,
          })
        )
      );
    } catch (error: any) {
      // Revert on error
      set({ collections: previousCollections });
      throw new Error(
        error.response?.data?.message || 'Failed to reorder collections'
      );
    }
  },
}));
