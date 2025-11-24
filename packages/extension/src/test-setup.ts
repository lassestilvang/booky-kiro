import { vi } from 'vitest';

// Mock chrome/browser API BEFORE any imports
// This prevents webextension-polyfill from throwing errors
(global as any).chrome = {
  runtime: { id: 'test-extension-id' },
};

// Mock browser API for testing
const mockBrowser = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
  identity: {
    getRedirectURL: vi.fn(() => 'https://extension-id.chromiumapp.org/oauth'),
    launchWebAuthFlow: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  },
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  commands: {
    onCommand: {
      addListener: vi.fn(),
    },
  },
  notifications: {
    create: vi.fn(),
  },
  scripting: {
    executeScript: vi.fn(),
  },
};

// @ts-ignore
global.browser = mockBrowser;

// Mock crypto API methods (crypto is read-only, so we spy on methods)
if (!global.crypto) {
  Object.defineProperty(global, 'crypto', {
    value: {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
      subtle: {
        digest: async (algorithm: string, data: BufferSource) => {
          // Simple mock hash
          return new Uint8Array(32).buffer;
        },
      },
    },
    writable: false,
    configurable: true,
  });
}

// Mock fetch
global.fetch = vi.fn();
