import browser from 'webextension-polyfill';
import type {
  CreateBookmarkRequest,
  CreateHighlightRequest,
  BookmarkWithRelations,
} from '@bookmark-manager/shared';
import { OAuthService } from './oauth';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1';

// Storage keys
const STORAGE_KEYS = {
  DEFAULT_COLLECTION: 'default_collection',
  USER: 'user',
} as const;

// Types
interface PageMetadata {
  title: string;
  description?: string;
  image?: string;
  url: string;
}

// ============================================================================
// API Client
// ============================================================================

class ApiClient {
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
      // Token expired or invalid, clear tokens
      await this.oauthService.clearTokens();
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

  async createBookmark(
    data: CreateBookmarkRequest
  ): Promise<BookmarkWithRelations> {
    return this.request<BookmarkWithRelations>('/bookmarks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createHighlight(data: CreateHighlightRequest): Promise<void> {
    return this.request<void>('/highlights', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDefaultCollection(): Promise<string | null> {
    const result = await browser.storage.local.get(
      STORAGE_KEYS.DEFAULT_COLLECTION
    );
    return result[STORAGE_KEYS.DEFAULT_COLLECTION] || null;
  }
}

// ============================================================================
// Metadata Extraction
// ============================================================================

class MetadataExtractor {
  async extractFromTab(tabId: number): Promise<PageMetadata> {
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: this.extractMetadataFromPage,
      });

      if (results && results[0]?.result) {
        return results[0].result as PageMetadata;
      }
    } catch (error) {
      console.error('Failed to extract metadata:', error);
    }

    // Fallback to tab info
    const tab = await browser.tabs.get(tabId);
    return {
      title: tab.title || 'Untitled',
      url: tab.url || '',
    };
  }

  private extractMetadataFromPage(): PageMetadata {
    const getMetaContent = (name: string): string | undefined => {
      const meta = document.querySelector(
        `meta[name="${name}"], meta[property="${name}"]`
      );
      return meta?.getAttribute('content') || undefined;
    };

    return {
      title:
        getMetaContent('og:title') ||
        getMetaContent('twitter:title') ||
        document.title,
      description:
        getMetaContent('og:description') ||
        getMetaContent('twitter:description') ||
        getMetaContent('description'),
      image: getMetaContent('og:image') || getMetaContent('twitter:image'),
      url: window.location.href,
    };
  }
}

// ============================================================================
// Background Service
// ============================================================================

class BackgroundService {
  private oauthService: OAuthService;
  private apiClient: ApiClient;
  private metadataExtractor: MetadataExtractor;

  constructor() {
    this.oauthService = new OAuthService();
    this.apiClient = new ApiClient(this.oauthService);
    this.metadataExtractor = new MetadataExtractor();
  }

  async initialize(): Promise<void> {
    // Set up context menus
    await this.setupContextMenus();

    // Set up message listeners
    this.setupMessageListeners();

    // Set up command listeners
    this.setupCommandListeners();

    console.log('Bookmark Manager Extension - Background worker ready');
  }

  private async setupContextMenus(): Promise<void> {
    // Remove existing menus
    await browser.contextMenus.removeAll();

    // Save page
    browser.contextMenus.create({
      id: 'save-page',
      title: 'Save page to Bookmark Manager',
      contexts: ['page'],
    });

    // Save link
    browser.contextMenus.create({
      id: 'save-link',
      title: 'Save link to Bookmark Manager',
      contexts: ['link'],
    });

    // Save image
    browser.contextMenus.create({
      id: 'save-image',
      title: 'Save image to Bookmark Manager',
      contexts: ['image'],
    });

    // Save video
    browser.contextMenus.create({
      id: 'save-video',
      title: 'Save video to Bookmark Manager',
      contexts: ['video'],
    });

    // Save selection as highlight
    browser.contextMenus.create({
      id: 'save-highlight',
      title: 'Save selection as highlight',
      contexts: ['selection'],
    });

    // Context menu click handler
    browser.contextMenus.onClicked.addListener(
      this.handleContextMenuClick.bind(this)
    );
  }

  private setupMessageListeners(): void {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender)
        .then(sendResponse)
        .catch((error) => {
          console.error('Message handler error:', error);
          sendResponse({ error: error.message });
        });
      return true; // Keep channel open for async response
    });
  }

  private setupCommandListeners(): void {
    browser.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });
  }

  private async handleContextMenuClick(
    info: browser.Menus.OnClickData,
    tab?: browser.Tabs.Tab
  ): Promise<void> {
    if (!tab?.id) return;

    const isAuth = await this.oauthService.isAuthenticated();
    if (!isAuth) {
      await this.showNotification('Please log in to save bookmarks', 'error');
      return;
    }

    try {
      switch (info.menuItemId) {
        case 'save-page':
          await this.saveCurrentPage(tab);
          break;
        case 'save-link':
          if (info.linkUrl) {
            await this.saveUrl(info.linkUrl, tab);
          }
          break;
        case 'save-image':
          if (info.srcUrl) {
            await this.saveUrl(info.srcUrl, tab, 'image');
          }
          break;
        case 'save-video':
          if (info.srcUrl) {
            await this.saveUrl(info.srcUrl, tab, 'video');
          }
          break;
        case 'save-highlight':
          if (info.selectionText) {
            await this.saveHighlight(info.selectionText, tab);
          }
          break;
      }
    } catch (error) {
      console.error('Context menu action failed:', error);
      await this.showNotification('Failed to save bookmark', 'error');
    }
  }

  private async handleMessage(
    message: any,
    sender: browser.Runtime.MessageSender
  ): Promise<any> {
    switch (message.type) {
      case 'SAVE_CURRENT_PAGE':
        if (sender.tab) {
          return this.saveCurrentPage(sender.tab);
        }
        break;

      case 'SAVE_HIGHLIGHT':
        if (sender.tab) {
          return this.saveHighlight(
            message.data.text,
            sender.tab,
            message.data.context
          );
        }
        break;

      case 'SAVE_ALL_TABS':
        return this.saveAllTabs();

      case 'GET_AUTH_STATUS':
        return { authenticated: await this.oauthService.isAuthenticated() };

      case 'START_OAUTH':
        return this.startOAuthFlow();

      case 'LOGOUT':
        await this.oauthService.clearTokens();
        return { success: true };

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  private async handleCommand(command: string): Promise<void> {
    switch (command) {
      case 'save-page':
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab) {
          await this.saveCurrentPage(tab);
        }
        break;
    }
  }

  private async startOAuthFlow(): Promise<void> {
    try {
      const tokens = await this.oauthService.startOAuthFlow();
      await this.oauthService.storeTokens(tokens);
      await this.showNotification('Successfully logged in!', 'success');
    } catch (error) {
      console.error('OAuth flow failed:', error);
      await this.showNotification('Login failed', 'error');
      throw error;
    }
  }

  async saveCurrentPage(tab: browser.Tabs.Tab): Promise<void> {
    if (!tab.id || !tab.url) {
      throw new Error('Invalid tab');
    }

    const metadata = await this.metadataExtractor.extractFromTab(tab.id);
    const collectionId = await this.apiClient.getDefaultCollection();

    const bookmarkData: CreateBookmarkRequest = {
      url: metadata.url,
      title: metadata.title,
      excerpt: metadata.description,
      coverUrl: metadata.image,
      collectionId: collectionId || undefined,
    };

    await this.apiClient.createBookmark(bookmarkData);
    await this.showNotification('Bookmark saved!', 'success');
  }

  async saveUrl(
    url: string,
    tab: browser.Tabs.Tab,
    type?: 'image' | 'video'
  ): Promise<void> {
    const collectionId = await this.apiClient.getDefaultCollection();

    const bookmarkData: CreateBookmarkRequest = {
      url,
      title: url.split('/').pop() || 'Untitled',
      type: type || 'article',
      collectionId: collectionId || undefined,
    };

    await this.apiClient.createBookmark(bookmarkData);
    await this.showNotification(`${type || 'Link'} saved!`, 'success');
  }

  async saveHighlight(
    text: string,
    tab: browser.Tabs.Tab,
    context?: any
  ): Promise<void> {
    if (!tab.url) {
      throw new Error('Invalid tab');
    }

    // First, ensure the page is saved as a bookmark
    const metadata = await this.metadataExtractor.extractFromTab(tab.id!);
    const collectionId = await this.apiClient.getDefaultCollection();

    const bookmark = await this.apiClient.createBookmark({
      url: metadata.url,
      title: metadata.title,
      excerpt: metadata.description,
      coverUrl: metadata.image,
      collectionId: collectionId || undefined,
    });

    // Create the highlight
    const highlightData: CreateHighlightRequest = {
      bookmarkId: bookmark.id,
      textSelected: text,
      positionContext: context || {
        before: '',
        after: '',
      },
    };

    await this.apiClient.createHighlight(highlightData);
    await this.showNotification('Highlight saved!', 'success');
  }

  async saveAllTabs(): Promise<void> {
    const tabs = await browser.tabs.query({ currentWindow: true });
    const date = new Date().toISOString().split('T')[0];
    const bulkTag = `bulk-${date}`;

    let savedCount = 0;
    let failedCount = 0;

    for (const tab of tabs) {
      if (!tab.url || tab.url.startsWith('chrome://')) {
        continue;
      }

      try {
        const metadata = await this.metadataExtractor.extractFromTab(tab.id!);
        const collectionId = await this.apiClient.getDefaultCollection();

        await this.apiClient.createBookmark({
          url: metadata.url,
          title: metadata.title,
          excerpt: metadata.description,
          coverUrl: metadata.image,
          tags: [bulkTag],
          collectionId: collectionId || undefined,
        });

        savedCount++;
      } catch (error) {
        console.error(`Failed to save tab ${tab.url}:`, error);
        failedCount++;
      }
    }

    await this.showNotification(
      `Saved ${savedCount} tabs${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      'success'
    );
  }

  private async showNotification(
    message: string,
    type: 'success' | 'error' = 'success'
  ): Promise<void> {
    await browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon48.png'),
      title: 'Bookmark Manager',
      message,
    });
  }
}

// ============================================================================
// Initialize
// ============================================================================

const backgroundService = new BackgroundService();
backgroundService.initialize();
