import browser from 'webextension-polyfill';
import type {
  BookmarkWithRelations,
  Collection,
  PaginatedResponse,
} from '@bookmark-manager/shared';
import { OAuthService } from './oauth';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1';

// ============================================================================
// API Client for Side Panel
// ============================================================================

class SidePanelApiClient {
  constructor(
    private oauthService: OAuthService,
    private baseUrl: string = API_BASE_URL
  ) {}

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const accessToken = await this.oauthService.getValidAccessToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Request failed',
      }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  async getRecentBookmarks(
    limit: number = 20
  ): Promise<PaginatedResponse<BookmarkWithRelations>> {
    return this.request<PaginatedResponse<BookmarkWithRelations>>(
      `/bookmarks?limit=${limit}&sortBy=createdAt&sortOrder=desc`
    );
  }

  async getCollections(): Promise<Collection[]> {
    const response =
      await this.request<PaginatedResponse<Collection>>('/collections');
    return response.data;
  }

  async getBookmarksByCollection(
    collectionId: string,
    limit: number = 20
  ): Promise<PaginatedResponse<BookmarkWithRelations>> {
    return this.request<PaginatedResponse<BookmarkWithRelations>>(
      `/bookmarks?collectionId=${collectionId}&limit=${limit}&sortBy=createdAt&sortOrder=desc`
    );
  }

  async searchBookmarks(
    query: string,
    limit: number = 20
  ): Promise<PaginatedResponse<BookmarkWithRelations>> {
    const encodedQuery = encodeURIComponent(query);
    return this.request<PaginatedResponse<BookmarkWithRelations>>(
      `/bookmarks?q=${encodedQuery}&limit=${limit}`
    );
  }
}

// ============================================================================
// Side Panel Controller
// ============================================================================

class SidePanelController {
  private elements: {
    searchInput: HTMLInputElement;
    bookmarksList: HTMLElement;
    collectionsList: HTMLElement;
    quickSaveBtn: HTMLButtonElement;
    loginPrompt: HTMLElement;
    mainContent: HTMLElement;
  };

  private bookmarks: BookmarkWithRelations[] = [];
  private collections: Collection[] = [];
  private oauthService: OAuthService;
  private apiClient: SidePanelApiClient;
  private selectedCollectionId: string | null = null;

  constructor() {
    this.oauthService = new OAuthService();
    this.apiClient = new SidePanelApiClient(this.oauthService);

    this.elements = {
      searchInput: document.getElementById('searchInput') as HTMLInputElement,
      bookmarksList: document.getElementById('bookmarksList')!,
      collectionsList: document.getElementById('collectionsList')!,
      quickSaveBtn: document.getElementById(
        'quickSaveBtn'
      ) as HTMLButtonElement,
      loginPrompt: document.getElementById('loginPrompt')!,
      mainContent: document.getElementById('mainContent')!,
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Check authentication status
    const isAuthenticated = await this.oauthService.isAuthenticated();

    if (!isAuthenticated) {
      this.showLoginPrompt();
      return;
    }

    // Set up event listeners
    this.setupEventListeners();

    // Load data
    await this.loadCollections();
    await this.loadRecentBookmarks();
  }

  private showLoginPrompt(): void {
    this.elements.loginPrompt.style.display = 'flex';
    this.elements.mainContent.style.display = 'none';

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        try {
          await browser.runtime.sendMessage({ type: 'START_OAUTH' });
          // Reload after successful login
          window.location.reload();
        } catch (error) {
          console.error('Login failed:', error);
        }
      });
    }
  }

  private setupEventListeners(): void {
    this.elements.searchInput.addEventListener('input', (e) =>
      this.handleSearch((e.target as HTMLInputElement).value)
    );

    this.elements.quickSaveBtn.addEventListener('click', () =>
      this.handleQuickSave()
    );
  }

  private async loadCollections(): Promise<void> {
    try {
      this.collections = await this.apiClient.getCollections();

      // Render "All Bookmarks" first
      let html = `
        <div class="collection-item ${this.selectedCollectionId === null ? 'active' : ''}" data-id="all">
          <span class="collection-icon">📁</span>
          <span class="collection-name">All Bookmarks</span>
        </div>
      `;

      // Render user collections
      html += this.collections
        .map(
          (collection) => `
        <div class="collection-item ${this.selectedCollectionId === collection.id ? 'active' : ''}" data-id="${collection.id}">
          <span class="collection-icon">${this.escapeHtml(collection.icon || '📂')}</span>
          <span class="collection-name">${this.escapeHtml(collection.title)}</span>
        </div>
      `
        )
        .join('');

      this.elements.collectionsList.innerHTML = html;

      // Add click handlers
      this.elements.collectionsList
        .querySelectorAll('.collection-item')
        .forEach((item) => {
          item.addEventListener('click', () => {
            const id = item.getAttribute('data-id');
            this.handleCollectionClick(id === 'all' ? null : id);
          });
        });
    } catch (error) {
      console.error('Failed to load collections:', error);
      this.elements.collectionsList.innerHTML = `
        <div class="error-message">Failed to load collections</div>
      `;
    }
  }

  private async loadRecentBookmarks(): Promise<void> {
    try {
      this.showLoading();

      const response = await this.apiClient.getRecentBookmarks(20);
      this.bookmarks = response.data;

      this.renderBookmarks(this.bookmarks);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
      this.showError('Failed to load bookmarks');
    }
  }

  private async handleCollectionClick(
    collectionId: string | null
  ): Promise<void> {
    this.selectedCollectionId = collectionId;

    // Update active state
    this.elements.collectionsList
      .querySelectorAll('.collection-item')
      .forEach((item) => {
        item.classList.remove('active');
      });

    const activeItem = this.elements.collectionsList.querySelector(
      `[data-id="${collectionId || 'all'}"]`
    );
    if (activeItem) {
      activeItem.classList.add('active');
    }

    // Load bookmarks for collection
    try {
      this.showLoading();

      let response: PaginatedResponse<BookmarkWithRelations>;
      if (collectionId) {
        response = await this.apiClient.getBookmarksByCollection(
          collectionId,
          20
        );
      } else {
        response = await this.apiClient.getRecentBookmarks(20);
      }

      this.bookmarks = response.data;
      this.renderBookmarks(this.bookmarks);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
      this.showError('Failed to load bookmarks');
    }
  }

  private async handleSearch(query: string): Promise<void> {
    if (!query.trim()) {
      // If search is cleared, reload current view
      if (this.selectedCollectionId) {
        await this.handleCollectionClick(this.selectedCollectionId);
      } else {
        await this.loadRecentBookmarks();
      }
      return;
    }

    try {
      this.showLoading();
      const response = await this.apiClient.searchBookmarks(query, 20);
      this.bookmarks = response.data;
      this.renderBookmarks(this.bookmarks);
    } catch (error) {
      console.error('Search failed:', error);
      this.showError('Search failed');
    }
  }

  private renderBookmarks(bookmarks: BookmarkWithRelations[]): void {
    if (bookmarks.length === 0) {
      this.showEmptyState();
      return;
    }

    this.elements.bookmarksList.innerHTML = bookmarks
      .map(
        (bookmark) => `
        <div class="bookmark-item" data-id="${bookmark.id}">
          ${bookmark.coverUrl ? `<div class="bookmark-cover" style="background-image: url('${this.escapeHtml(bookmark.coverUrl)}')"></div>` : ''}
          <div class="bookmark-content">
            <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
            <div class="bookmark-url">${this.escapeHtml(this.getDomain(bookmark.url))}</div>
            ${bookmark.excerpt ? `<div class="bookmark-excerpt">${this.escapeHtml(this.truncate(bookmark.excerpt, 80))}</div>` : ''}
            <div class="bookmark-meta">
              <span>${this.formatDate(bookmark.createdAt)}</span>
              ${bookmark.tags.length > 0 ? `<span>• ${bookmark.tags.length} tags</span>` : ''}
              ${bookmark.highlights.length > 0 ? `<span>• ${bookmark.highlights.length} highlights</span>` : ''}
            </div>
          </div>
        </div>
      `
      )
      .join('');

    // Add click handlers
    this.elements.bookmarksList
      .querySelectorAll('.bookmark-item')
      .forEach((item) => {
        item.addEventListener('click', () => {
          const id = item.getAttribute('data-id');
          const bookmark = bookmarks.find((b) => b.id === id);
          if (bookmark) {
            this.openBookmark(bookmark);
          }
        });
      });
  }

  private showLoading(): void {
    this.elements.bookmarksList.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Loading bookmarks...</p>
      </div>
    `;
  }

  private showEmptyState(): void {
    this.elements.bookmarksList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        <p>No bookmarks yet</p>
        <p style="margin-top: 8px; font-size: 12px;">
          Click the button below to save your first bookmark
        </p>
      </div>
    `;
  }

  private showError(message: string): void {
    this.elements.bookmarksList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <p>${this.escapeHtml(message)}</p>
      </div>
    `;
  }

  private async handleQuickSave(): Promise<void> {
    this.elements.quickSaveBtn.disabled = true;
    this.elements.quickSaveBtn.textContent = '⏳ Saving...';

    try {
      await browser.runtime.sendMessage({
        type: 'SAVE_CURRENT_PAGE',
      });

      this.elements.quickSaveBtn.textContent = '✓ Saved!';
      setTimeout(() => {
        this.elements.quickSaveBtn.textContent = '💾 Save Current Page';
        this.elements.quickSaveBtn.disabled = false;
      }, 2000);

      // Reload bookmarks
      await this.loadRecentBookmarks();
    } catch (error) {
      console.error('Failed to save page:', error);
      this.elements.quickSaveBtn.textContent = '✗ Failed';
      setTimeout(() => {
        this.elements.quickSaveBtn.textContent = '💾 Save Current Page';
        this.elements.quickSaveBtn.disabled = false;
      }, 2000);
    }
  }

  private async openBookmark(bookmark: BookmarkWithRelations): Promise<void> {
    await browser.tabs.create({ url: bookmark.url });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return new Date(date).toLocaleDateString();
  }

  private getDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}

// Initialize side panel
document.addEventListener('DOMContentLoaded', () => {
  new SidePanelController();
});
