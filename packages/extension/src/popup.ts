import browser from 'webextension-polyfill';

// ============================================================================
// Popup UI Controller
// ============================================================================

class PopupController {
  private elements: {
    authStatus: HTMLElement;
    statusMessage: HTMLElement;
    authenticatedView: HTMLElement;
    unauthenticatedView: HTMLElement;
    savePageBtn: HTMLButtonElement;
    saveAllTabsBtn: HTMLButtonElement;
    openSidePanelBtn: HTMLButtonElement;
    openWebAppBtn: HTMLButtonElement;
    loginBtn: HTMLButtonElement;
    logoutBtn: HTMLButtonElement;
  };

  constructor() {
    this.elements = {
      authStatus: document.getElementById('authStatus')!,
      statusMessage: document.getElementById('statusMessage')!,
      authenticatedView: document.getElementById('authenticatedView')!,
      unauthenticatedView: document.getElementById('unauthenticatedView')!,
      savePageBtn: document.getElementById('savePageBtn') as HTMLButtonElement,
      saveAllTabsBtn: document.getElementById(
        'saveAllTabsBtn'
      ) as HTMLButtonElement,
      openSidePanelBtn: document.getElementById(
        'openSidePanelBtn'
      ) as HTMLButtonElement,
      openWebAppBtn: document.getElementById(
        'openWebAppBtn'
      ) as HTMLButtonElement,
      loginBtn: document.getElementById('loginBtn') as HTMLButtonElement,
      logoutBtn: document.getElementById('logoutBtn') as HTMLButtonElement,
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Check authentication status
    await this.updateAuthStatus();

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.elements.savePageBtn.addEventListener('click', () =>
      this.handleSavePage()
    );
    this.elements.saveAllTabsBtn.addEventListener('click', () =>
      this.handleSaveAllTabs()
    );
    this.elements.openSidePanelBtn.addEventListener('click', () =>
      this.handleOpenSidePanel()
    );
    this.elements.openWebAppBtn.addEventListener('click', () =>
      this.handleOpenWebApp()
    );
    this.elements.loginBtn.addEventListener('click', () => this.handleLogin());
    this.elements.logoutBtn.addEventListener('click', () =>
      this.handleLogout()
    );
  }

  private async updateAuthStatus(): Promise<void> {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'GET_AUTH_STATUS',
      });

      if (response.authenticated) {
        this.showAuthenticatedView();
      } else {
        this.showUnauthenticatedView();
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      this.showUnauthenticatedView();
    }
  }

  private showAuthenticatedView(): void {
    this.elements.authStatus.textContent = 'Logged in';
    this.elements.authStatus.classList.add('authenticated');
    this.elements.authenticatedView.classList.remove('hidden');
    this.elements.unauthenticatedView.classList.add('hidden');
  }

  private showUnauthenticatedView(): void {
    this.elements.authStatus.textContent = 'Not logged in';
    this.elements.authStatus.classList.remove('authenticated');
    this.elements.authenticatedView.classList.add('hidden');
    this.elements.unauthenticatedView.classList.remove('hidden');
  }

  private async handleSavePage(): Promise<void> {
    this.setButtonLoading(this.elements.savePageBtn, true);

    try {
      await browser.runtime.sendMessage({
        type: 'SAVE_CURRENT_PAGE',
      });

      this.showStatus('Page saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save page:', error);
      this.showStatus('Failed to save page', 'error');
    } finally {
      this.setButtonLoading(this.elements.savePageBtn, false);
    }
  }

  private async handleSaveAllTabs(): Promise<void> {
    this.setButtonLoading(this.elements.saveAllTabsBtn, true);

    try {
      await browser.runtime.sendMessage({
        type: 'SAVE_ALL_TABS',
      });

      this.showStatus('All tabs saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save all tabs:', error);
      this.showStatus('Failed to save all tabs', 'error');
    } finally {
      this.setButtonLoading(this.elements.saveAllTabsBtn, false);
    }
  }

  private async handleOpenSidePanel(): Promise<void> {
    try {
      // Open side panel (Chrome 114+)
      if ('sidePanel' in browser) {
        await (browser as any).sidePanel.open();
      } else {
        this.showStatus('Side panel not supported', 'info');
      }
    } catch (error) {
      console.error('Failed to open side panel:', error);
      this.showStatus('Failed to open side panel', 'error');
    }
  }

  private async handleOpenWebApp(): Promise<void> {
    const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:5173';
    await browser.tabs.create({ url: webAppUrl });
    window.close();
  }

  private async handleLogin(): Promise<void> {
    this.setButtonLoading(this.elements.loginBtn, true);

    try {
      // Trigger OAuth flow
      await browser.runtime.sendMessage({
        type: 'START_OAUTH',
      });

      // Wait a bit and check auth status
      setTimeout(() => {
        this.updateAuthStatus();
        this.setButtonLoading(this.elements.loginBtn, false);
      }, 1000);
    } catch (error) {
      console.error('Login failed:', error);
      this.showStatus('Login failed', 'error');
      this.setButtonLoading(this.elements.loginBtn, false);
    }
  }

  private async handleLogout(): Promise<void> {
    try {
      await browser.runtime.sendMessage({
        type: 'LOGOUT',
      });

      this.showStatus('Logged out successfully', 'success');
      this.showUnauthenticatedView();
    } catch (error) {
      console.error('Logout failed:', error);
      this.showStatus('Logout failed', 'error');
    }
  }

  private showStatus(
    message: string,
    type: 'success' | 'error' | 'info'
  ): void {
    this.elements.statusMessage.textContent = message;
    this.elements.statusMessage.className = `status-message status-${type}`;
    this.elements.statusMessage.classList.remove('hidden');

    setTimeout(() => {
      this.elements.statusMessage.classList.add('hidden');
    }, 3000);
  }

  private setButtonLoading(button: HTMLButtonElement, loading: boolean): void {
    button.disabled = loading;
    if (loading) {
      button.dataset.originalText = button.textContent || '';
      button.textContent = '⏳ Loading...';
    } else {
      button.textContent = button.dataset.originalText || '';
    }
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
