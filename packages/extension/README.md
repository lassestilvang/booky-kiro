# Bookmark Manager Browser Extension

A browser extension for quickly saving and managing bookmarks with the Bookmark Manager platform.

## Features

- **Quick Save**: Save the current page with one click
- **Context Menus**: Right-click to save links, images, and videos
- **Highlight Capture**: Select text and save it as a highlight
- **Bulk Save**: Save all open tabs at once
- **Side Panel**: Browse recent bookmarks without leaving your current tab
- **OAuth2 Authentication**: Secure login with PKCE flow

## Installation

### Development

1. Build the extension:

   ```bash
   npm run build
   ```

2. Load the extension in your browser:

   **Chrome/Edge/Brave:**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `packages/extension/dist` directory

   **Firefox:**
   - Navigate to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select any file in the `packages/extension/dist` directory

### Production

The extension will be published to the Chrome Web Store and Firefox Add-ons once ready.

## Usage

### First Time Setup

1. Click the extension icon in your browser toolbar
2. Click "Login with OAuth" to authenticate
3. You'll be redirected to the Bookmark Manager web app to authorize the extension
4. Once authorized, you can start saving bookmarks

### Saving Bookmarks

**Save Current Page:**

- Click the extension icon and click "Save Current Page"
- Or use the keyboard shortcut (if configured)

**Save from Context Menu:**

- Right-click on a page, link, image, or video
- Select "Save to Bookmark Manager"

**Save Highlights:**

- Select text on any page
- A "Save Highlight" button will appear
- Click it to save the selected text as a highlight

**Save All Tabs:**

- Click the extension icon
- Click "Save All Tabs"
- All tabs will be saved with a bulk tag containing the current date

### Side Panel

The side panel provides quick access to your recent bookmarks:

1. Click the extension icon
2. Click "Open Side Panel"
3. Browse your recent bookmarks
4. Click any bookmark to open it in a new tab

## Architecture

The extension consists of four main components:

1. **Background Service Worker** (`background.ts`): Handles API communication, context menus, and bookmark saving
2. **Content Script** (`content.ts`): Runs on web pages to capture text selections and highlights
3. **Popup** (`popup.ts`): Quick actions interface accessible from the toolbar
4. **Side Panel** (`sidepanel.ts`): Browse bookmarks without leaving your current tab

### OAuth2 PKCE Flow

The extension uses OAuth2 with PKCE (Proof Key for Code Exchange) for secure authentication:

1. User clicks "Login" in the popup
2. Extension generates a code verifier and challenge
3. Browser opens the authorization URL with the challenge
4. User authorizes the extension on the web app
5. Extension receives an authorization code
6. Extension exchanges the code for access and refresh tokens using the verifier
7. Tokens are securely stored in browser storage

### Token Management

- Access tokens are automatically refreshed when they expire
- Tokens are stored securely in browser local storage
- Logout clears all stored tokens

## Development

### Build Commands

```bash
# Build for production
npm run build

# Build and watch for changes
npm run dev

# Run tests
npm run test

# Run tests once
npm run test:run

# Lint code
npm run lint
```

### Project Structure

```
packages/extension/
├── src/
│   ├── background.ts       # Background service worker
│   ├── content.ts          # Content script
│   ├── popup.ts            # Popup UI controller
│   ├── sidepanel.ts        # Side panel controller
│   ├── oauth.ts            # OAuth2 PKCE implementation
│   ├── popup.html          # Popup HTML
│   ├── sidepanel.html      # Side panel HTML
│   └── test-setup.ts       # Test configuration
├── icons/                  # Extension icons
├── dist/                   # Build output
├── manifest.json           # Extension manifest (V3)
├── build.js                # Build script
└── package.json
```

### Testing

The extension includes unit tests for the OAuth service:

```bash
npm run test:run
```

Tests cover:

- Token storage and retrieval
- Token expiration detection
- Authentication status checking
- PKCE flow components

## Browser Compatibility

- Chrome 88+
- Edge 88+
- Firefox 109+
- Safari 15.4+ (with some limitations)

## Security

- OAuth2 with PKCE for secure authentication
- No client secrets stored in the extension
- Tokens stored in browser local storage (encrypted by browser)
- State parameter for CSRF protection
- Automatic token refresh

## Permissions

The extension requires the following permissions:

- `storage`: Store authentication tokens and preferences
- `tabs`: Access tab information for saving bookmarks
- `contextMenus`: Add context menu items
- `activeTab`: Access the current tab's content
- `notifications`: Show save confirmations
- `identity`: OAuth2 authentication flow
- `host_permissions`: Access all URLs for metadata extraction

## Contributing

See the main project README for contribution guidelines.

## License

See the main project LICENSE file.
