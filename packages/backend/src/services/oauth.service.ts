import crypto from 'crypto';
import { Pool } from 'pg';

export interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret?: string; // Only returned on registration for confidential clients
  name: string;
  redirectUris: string[];
  isPublic: boolean;
  createdAt: Date;
}

export interface AuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256' | 'plain';
  scopes: string[];
  expiresAt: Date;
}

/**
 * OAuth2 service with PKCE support for public clients
 */
export class OAuthService {
  private authCodes: Map<string, AuthorizationCode> = new Map();

  constructor(private pool: Pool) {}

  /**
   * Register a new OAuth client
   */
  async registerClient(
    name: string,
    redirectUris: string[],
    isPublic: boolean = true
  ): Promise<OAuthClient> {
    const clientId = this.generateClientId();
    let clientSecret: string | undefined;
    let clientSecretHash: string | null = null;

    if (!isPublic) {
      clientSecret = this.generateClientSecret();
      clientSecretHash = await this.hashClientSecret(clientSecret);
    }

    const result = await this.pool.query(
      `INSERT INTO oauth_clients (client_id, client_secret_hash, name, redirect_uris, is_public)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [clientId, clientSecretHash, name, redirectUris, isPublic]
    );

    const client = this.mapClientRow(result.rows[0]);

    // Only return client secret on registration for confidential clients
    if (clientSecret) {
      client.clientSecret = clientSecret;
    }

    return client;
  }

  /**
   * Get OAuth client by client ID
   */
  async getClient(clientId: string): Promise<OAuthClient | null> {
    const result = await this.pool.query(
      'SELECT * FROM oauth_clients WHERE client_id = $1',
      [clientId]
    );

    return result.rows.length > 0 ? this.mapClientRow(result.rows[0]) : null;
  }

  /**
   * Generate authorization code with PKCE
   */
  async generateAuthorizationCode(
    clientId: string,
    userId: string,
    redirectUri: string,
    codeChallenge: string,
    codeChallengeMethod: 'S256' | 'plain',
    scopes: string[]
  ): Promise<string> {
    // Verify client exists
    const client = await this.getClient(clientId);
    if (!client) {
      throw new Error('Invalid client');
    }

    // Verify redirect URI is registered
    if (!client.redirectUris.includes(redirectUri)) {
      throw new Error('Invalid redirect URI');
    }

    // Generate authorization code
    const code = this.generateRandomCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store authorization code (in-memory for now, should use Redis in production)
    this.authCodes.set(code, {
      code,
      clientId,
      userId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      scopes,
      expiresAt,
    });

    return code;
  }

  /**
   * Exchange authorization code for access token with PKCE verification
   */
  async exchangeCodeForToken(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
    scopes: string[];
  }> {
    // Retrieve authorization code
    const authCode = this.authCodes.get(code);
    if (!authCode) {
      throw new Error('Invalid or expired authorization code');
    }

    // Verify code hasn't expired
    if (authCode.expiresAt < new Date()) {
      this.authCodes.delete(code);
      throw new Error('Authorization code expired');
    }

    // Verify client ID matches
    if (authCode.clientId !== clientId) {
      throw new Error('Client ID mismatch');
    }

    // Verify redirect URI matches
    if (authCode.redirectUri !== redirectUri) {
      throw new Error('Redirect URI mismatch');
    }

    // Verify PKCE code verifier
    if (
      !this.verifyCodeChallenge(
        codeVerifier,
        authCode.codeChallenge,
        authCode.codeChallengeMethod
      )
    ) {
      throw new Error('Invalid code verifier');
    }

    // Delete authorization code (one-time use)
    this.authCodes.delete(code);

    // Generate access and refresh tokens
    const accessToken = this.generateAccessToken();
    const refreshToken = this.generateRefreshToken();

    // Store tokens in database
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await this.pool.query(
      `INSERT INTO oauth_tokens (user_id, client_id, access_token, refresh_token, scopes, expires_at)
       VALUES ($1, (SELECT id FROM oauth_clients WHERE client_id = $2), $3, $4, $5, $6)`,
      [
        authCode.userId,
        clientId,
        accessToken,
        refreshToken,
        authCode.scopes,
        expiresAt,
      ]
    );

    return {
      accessToken,
      refreshToken,
      userId: authCode.userId,
      scopes: authCode.scopes,
    };
  }

  /**
   * Verify PKCE code challenge
   */
  private verifyCodeChallenge(
    codeVerifier: string,
    codeChallenge: string,
    method: 'S256' | 'plain'
  ): boolean {
    if (method === 'plain') {
      return codeVerifier === codeChallenge;
    }

    // S256: BASE64URL(SHA256(code_verifier))
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const computedChallenge = this.base64UrlEncode(hash);
    return computedChallenge === codeChallenge;
  }

  /**
   * Generate random client ID
   */
  private generateClientId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate random client secret
   */
  private generateClientSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash client secret
   */
  private async hashClientSecret(secret: string): Promise<string> {
    const bcrypt = await import('bcrypt');
    return bcrypt.hash(secret, 12);
  }

  /**
   * Generate random authorization code
   */
  private generateRandomCode(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate access token
   */
  private generateAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Base64 URL encode
   */
  private base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Get token information by access token
   */
  async getTokenInfo(accessToken: string): Promise<{
    userId: string;
    clientId: string;
    scopes: string[];
    expiresAt: Date;
  } | null> {
    const result = await this.pool.query(
      `SELECT ot.user_id, oc.client_id, ot.scopes, ot.expires_at
       FROM oauth_tokens ot
       JOIN oauth_clients oc ON ot.client_id = oc.id
       WHERE ot.access_token = $1 AND ot.expires_at > NOW()`,
      [accessToken]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      clientId: row.client_id,
      scopes: row.scopes || [],
      expiresAt: new Date(row.expires_at),
    };
  }

  /**
   * Validate token has required scopes
   */
  async validateTokenScopes(
    accessToken: string,
    requiredScopes: string[]
  ): Promise<boolean> {
    const tokenInfo = await this.getTokenInfo(accessToken);
    if (!tokenInfo) {
      return false;
    }

    // Check if token has all required scopes
    return requiredScopes.every((scope) => tokenInfo.scopes.includes(scope));
  }

  /**
   * Map database row to OAuthClient
   */
  private mapClientRow(row: any): OAuthClient {
    return {
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      redirectUris: row.redirect_uris,
      isPublic: row.is_public,
      createdAt: new Date(row.created_at),
    };
  }
}
