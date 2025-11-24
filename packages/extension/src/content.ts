import browser from 'webextension-polyfill';

// ============================================================================
// Content Script - Handles text selection and highlight capture
// ============================================================================

interface PositionContext {
  before: string;
  after: string;
  xpath?: string;
}

class ContentScript {
  private selectionMenu: HTMLElement | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Listen for text selection
    document.addEventListener('mouseup', this.handleSelection.bind(this));
    document.addEventListener('keyup', this.handleSelection.bind(this));

    // Listen for messages from background script
    browser.runtime.onMessage.addListener(this.handleMessage.bind(this));

    console.log('Bookmark Manager Extension - Content script loaded');
  }

  private handleSelection(event: Event): void {
    const selection = window.getSelection();

    if (!selection || selection.toString().trim().length === 0) {
      this.hideSelectionMenu();
      return;
    }

    // Show selection menu near the selection
    this.showSelectionMenu(selection);
  }

  private showSelectionMenu(selection: Selection): void {
    // Remove existing menu
    this.hideSelectionMenu();

    // Create menu
    this.selectionMenu = document.createElement('div');
    this.selectionMenu.id = 'bookmark-manager-selection-menu';
    this.selectionMenu.style.cssText = `
      position: absolute;
      background: #1f2937;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      z-index: 999999;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    this.selectionMenu.textContent = '💾 Save Highlight';

    // Position near selection
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    this.selectionMenu.style.top = `${window.scrollY + rect.bottom + 5}px`;
    this.selectionMenu.style.left = `${window.scrollX + rect.left}px`;

    // Add click handler
    this.selectionMenu.addEventListener('click', () => {
      this.captureHighlight(selection);
    });

    document.body.appendChild(this.selectionMenu);

    // Hide menu when clicking elsewhere
    setTimeout(() => {
      document.addEventListener(
        'click',
        (e) => {
          if (e.target !== this.selectionMenu) {
            this.hideSelectionMenu();
          }
        },
        { once: true }
      );
    }, 100);
  }

  private hideSelectionMenu(): void {
    if (this.selectionMenu) {
      this.selectionMenu.remove();
      this.selectionMenu = null;
    }
  }

  private async captureHighlight(selection: Selection): Promise<void> {
    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const context = this.getPositionContext(range);

    try {
      // Send to background script
      await browser.runtime.sendMessage({
        type: 'SAVE_HIGHLIGHT',
        data: {
          text,
          context,
        },
      });

      // Visual feedback
      this.showSuccessFeedback();
    } catch (error) {
      console.error('Failed to save highlight:', error);
      this.showErrorFeedback();
    }

    this.hideSelectionMenu();
  }

  private getPositionContext(range: Range): PositionContext {
    const beforeRange = document.createRange();
    beforeRange.setStart(
      range.startContainer.parentElement || range.startContainer,
      0
    );
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const before = beforeRange.toString().slice(-50);

    const afterRange = document.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEnd(
      range.endContainer.parentElement || range.endContainer,
      (range.endContainer.textContent || '').length
    );
    const after = afterRange.toString().slice(0, 50);

    return {
      before,
      after,
      xpath: this.getXPath(range.startContainer),
    };
  }

  private getXPath(node: Node): string {
    if (node.nodeType === Node.DOCUMENT_NODE) {
      return '/';
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return this.getXPath(node.parentNode!) + '/text()';
    }

    let element = node as Element;
    let path = '';

    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = element.previousSibling;

      while (sibling) {
        if (
          sibling.nodeType === Node.ELEMENT_NODE &&
          sibling.nodeName === element.nodeName
        ) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = element.nodeName.toLowerCase();
      const pathIndex = index > 0 ? `[${index + 1}]` : '';
      path = `/${tagName}${pathIndex}${path}`;

      element = element.parentElement!;
    }

    return path;
  }

  private showSuccessFeedback(): void {
    this.showToast('✓ Highlight saved!', '#10b981');
  }

  private showErrorFeedback(): void {
    this.showToast('✗ Failed to save highlight', '#ef4444');
  }

  private showToast(message: string, color: string): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${color};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        toast.remove();
        style.remove();
      }, 300);
    }, 3000);
  }

  private handleMessage(
    message: any,
    sender: browser.Runtime.MessageSender
  ): void {
    // Handle messages from background script if needed
    console.log('Content script received message:', message);
  }
}

// Initialize content script
new ContentScript();
