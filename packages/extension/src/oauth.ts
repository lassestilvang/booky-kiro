import browser from 'webextension-polyfill';

// ============================================================================
// OAuth2 PKCE Implementation for Browser Extension
// ============================================================================

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1';
const REDIRECT_URI = browser.identity.getRedirectURL('oauth');

interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
}

interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class OAuthService {
  /**
   * Generate PKCE code verifier and challenge
   * Code verifier: Random string 43-128 characters
   * Code challenge: Base64URL(SHA256(code_verifier))
   */
  private async generatePKCEChallenge(): Promise<PKCEChallenge> {
    // Generate random code verifier
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = this.base64URLEncode(array);

    // Generate code challenge from verifier
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const codeChallenge = this.base64URLEncode(new Uint8Array(hash));

    return { codeVerifier, codeChallenge };
  }

  /**
   * Base64URL encode (without padding)
   */
  private base64URLEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Generate random state parameter for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  /**
   * Start OAuth2 PKCE flow
   * Opens authorization URL in browser and waits for redirect
   */
  async startOAuthFlow(): Promise<OAuthTokens> {
    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = await this.generatePKCEChallenge();
    const state = this.generateState();

    // Store code verifier and state for later verification
    await browser.storage.local.set({
      oauth_code_verifier: codeVerifier,
      oauth_state: state,
    });

    // Build authorization URL
    const authUrl = new URL(`${API_BASE_URL}/auth/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', 'browser-extension');
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set(
      'scope',
      'read:bookmarks write:bookmarks read:collections write:collections'
    );

    try {
      // Launch web auth flow
      const redirectUrl = await browser.identity.launchWebAuthFlow({
        url: authUrl.toString(),
        interactive: true,
      });

      // Parse redirect URL to get authorization code
      const url = new URL(redirectUrl);
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      if (!code) {
        throw new Error('No authorization code received');
      }

      // Verify state parameter
      const storedState = (await browser.storage.local.get('oauth_state'))
        .oauth_state;
      if (returnedState !== storedState) {
        throw new Error('State parameter mismatch - possible CSRF attack');
      }

      // Exchange authorization code for tokens
      const tokens = await this.exchangeCodeForTokens(code, codeVerifier);

      // Clean up temporary storage
      await browser.storage.local.remove([
        'oauth_code_verifier',
        'oauth_state',
      ]);

      return tokens;
    } catch (error) {
      // Clean up on error
      await browser.storage.local.remove([
        'oauth_code_verifier',
        'oauth_state',
      ]);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string
  ): Promise<OAuthTokens> {
    const response = await fetch(`${API_BASE_URL}/auth/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: 'browser-extension',
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Token exchange failed',
      }));
      throw new Error(error.message || 'Token exchange failed');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(`${API_BASE_URL}/auth/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'browser-extension',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Token refresh failed',
      }));
      throw new Error(error.message || 'Token refresh failed');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Store tokens securely in extension storage
   */
  async storeTokens(tokens: OAuthTokens): Promise<void> {
    const expiresAt = Date.now() + tokens.expiresIn * 1000;

    await browser.storage.local.set({
      auth_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: expiresAt,
    });
  }

  /**
   * Get stored tokens
   */
  async getStoredTokens(): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  } | null> {
    const result = await browser.storage.local.get([
      'auth_token',
      'refresh_token',
      'token_expires_at',
    ]);

    if (!result.auth_token) {
      return null;
    }

    return {
      accessToken: result.auth_token,
      refreshToken: result.refresh_token,
      expiresAt: result.token_expires_at,
    };
  }

  /**
   * Check if access token is expired or about to expire
   */
  async isTokenExpired(): Promise<boolean> {
    const tokens = await this.getStoredTokens();
    if (!tokens) {
      return true;
    }

    // Consider token expired if it expires in less than 5 minutes
    const bufferTime = 5 * 60 * 1000;
    return Date.now() + bufferTime >= tokens.expiresAt;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(): Promise<string | null> {
    const tokens = await this.getStoredTokens();
    if (!tokens) {
      return null;
    }

    // Check if token is expired
    if (await this.isTokenExpired()) {
      try {
        // Refresh the token
        const newTokens = await this.refreshAccessToken(tokens.refreshToken);
        await this.storeTokens(newTokens);
        return newTokens.accessToken;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        // Clear invalid tokens
        await this.clearTokens();
        return null;
      }
    }

    return tokens.accessToken;
  }

  /**
   * Clear stored tokens (logout)
   */
  async clearTokens(): Promise<void> {
    await browser.storage.local.remove([
      'auth_token',
      'refresh_token',
      'token_expires_at',
    ]);
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getValidAccessToken();
    return token !== null;
  }
}
