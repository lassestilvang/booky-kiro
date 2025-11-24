import { create } from 'zustand';
import {
  BookmarkWithRelations,
  CreateBookmarkRequest,
  UpdateBookmarkRequest,
  Tag,
} from '@bookmark-manager/shared';
import { apiClient } from '../lib/api';

interface BookmarkState {
  bookmarks: BookmarkWithRelations[];
  selectedBookmark: BookmarkWithRelations | null;
  loading: boolean;
  error: string | null;
  filters: {
    tags: string[];
    type: string[];
    domain: string[];
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
  };

  // Actions
  fetchBookmarks: (collectionId?: string) => Promise<void>;
  createBookmark: (
    data: CreateBookmarkRequest
  ) => Promise<BookmarkWithRelations>;
  updateBookmark: (id: string, data: UpdateBookmarkRequest) => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  selectBookmark: (bookmark: BookmarkWithRelations | null) => void;
  setFilters: (filters: Partial<BookmarkState['filters']>) => void;
  clearFilters: () => void;
  fetchTags: () => Promise<Tag[]>;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  selectedBookmark: null,
  loading: false,
  error: null,
  filters: {
    tags: [],
    type: [],
    domain: [],
  },

  fetchBookmarks: async (collectionId?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (collectionId) {
        params.append('collection', collectionId);
      }

      const filters = get().filters;
      if (filters.tags.length > 0) {
        filters.tags.forEach((tag) => params.append('tags', tag));
      }
      if (filters.type.length > 0) {
        filters.type.forEach((type) => params.append('type', type));
      }
      if (filters.domain.length > 0) {
        filters.domain.forEach((domain) => params.append('domain', domain));
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo.toISOString());
      }
      if (filters.search) {
        params.append('q', filters.search);
      }

      const response = await apiClient.get(
        `/v1/bookmarks?${params.toString()}`
      );
      set({ bookmarks: response.data, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch bookmarks',
        loading: false,
      });
    }
  },

  createBookmark: async (data) => {
    try {
      const response = await apiClient.post('/v1/bookmarks', data);
      const newBookmark = response.data.bookmark;
      set((state) => ({
        bookmarks: [newBookmark, ...state.bookmarks],
      }));
      return newBookmark;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to create bookmark'
      );
    }
  },

  updateBookmark: async (id, data) => {
    try {
      const response = await apiClient.put(`/v1/bookmarks/${id}`, data);
      const updatedBookmark = response.data;
      set((state) => ({
        bookmarks: state.bookmarks.map((b) =>
          b.id === id ? updatedBookmark : b
        ),
        selectedBookmark:
          state.selectedBookmark?.id === id
            ? updatedBookmark
            : state.selectedBookmark,
      }));
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to update bookmark'
      );
    }
  },

  deleteBookmark: async (id) => {
    try {
      await apiClient.delete(`/v1/bookmarks/${id}`);
      set((state) => ({
        bookmarks: state.bookmarks.filter((b) => b.id !== id),
        selectedBookmark:
          state.selectedBookmark?.id === id ? null : state.selectedBookmark,
      }));
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to delete bookmark'
      );
    }
  },

  selectBookmark: (bookmark) => {
    set({ selectedBookmark: bookmark });
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  clearFilters: () => {
    set({
      filters: {
        tags: [],
        type: [],
        domain: [],
      },
    });
  },

  fetchTags: async () => {
    try {
      const response = await apiClient.get('/v1/tags');
      return response.data;
    } catch (error: unknown) {
      throw new Error(
        (error as unknown).response?.data?.message || 'Failed to fetch tags'
      );
    }
  },
}));
