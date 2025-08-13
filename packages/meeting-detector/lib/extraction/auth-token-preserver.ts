/**
 * Auth Token Preserver
 * Extracts and preserves authentication tokens for protected media access
 */

import type { AuthTokenInfo, AuthTokenType } from '../types/index';

/**
 * Authentication token extraction and secure handling
 */
export class AuthTokenPreserver {
  private tokenCache = new Map<string, CachedToken>();
  private sessionTokens = new Map<string, SessionToken>();
  private tokenExpiration = new Map<string, number>();

  constructor() {
    this.setupTokenCleanup();
  }

  /**
   * Extract authentication tokens from page and requests
   */
  extractAuthTokens(document: Document, url: string): AuthTokenInfo[] {
    const tokens: AuthTokenInfo[] = [];

    try {
      // Extract tokens from cookies
      tokens.push(...this.extractCookieTokens(document));

      // Extract tokens from localStorage/sessionStorage
      tokens.push(...this.extractStorageTokens());

      // Extract tokens from meta tags
      tokens.push(...this.extractMetaTokens(document));

      // Extract tokens from URL parameters
      tokens.push(...this.extractUrlTokens(url));

      // Extract tokens from page scripts
      tokens.push(...this.extractScriptTokens(document));

      // Cache valid tokens for session use
      this.cacheTokensForSession(tokens, url);
    } catch (error) {
      console.error('Token extraction error:', error);
    }

    return tokens;
  }

  /**
   * Preserve tokens for protected media access without permanent storage
   */
  preserveTokensForMediaAccess(tokens: AuthTokenInfo[], mediaUrl: string): PreservedTokens {
    const preserved: PreservedTokens = {
      mediaUrl,
      tokens: [],
      headers: new Map(),
      cookieString: '',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour default
      preservedAt: new Date(),
    };

    try {
      for (const token of tokens) {
        // Only preserve non-sensitive, short-lived tokens
        if (this.isSafeToPreserve(token)) {
          preserved.tokens.push(token);

          // Convert to appropriate format for media requests
          switch (token.type) {
            case 'bearer':
              preserved.headers.set('Authorization', `Bearer ${token.value}`);
              break;
            case 'cookie':
              preserved.cookieString += `${token.scope}=${token.value}; `;
              break;
            case 'header':
              if (token.scope) {
                preserved.headers.set(token.scope, token.value);
              }
              break;
            case 'query_param':
              // Add to URL parameters when making requests
              break;
          }
        }
      }

      // Determine actual expiration based on token lifetimes
      const shortestExpiry = this.findShortestExpiry(tokens);
      if (shortestExpiry) {
        preserved.expiresAt = shortestExpiry;
      }

      // Store in session cache with automatic cleanup
      this.storeInSessionCache(mediaUrl, preserved);
    } catch (error) {
      console.error('Token preservation error:', error);
    }

    return preserved;
  }

  /**
   * Get preserved tokens for media URL
   */
  getPreservedTokens(mediaUrl: string): PreservedTokens | null {
    const cacheKey = this.generateCacheKey(mediaUrl);
    const cached = this.tokenCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if tokens are still valid
    if (this.areTokensExpired(cached.preserved)) {
      this.tokenCache.delete(cacheKey);
      return null;
    }

    return cached.preserved;
  }

  /**
   * Apply tokens to fetch request configuration
   */
  applyTokensToRequest(preservedTokens: PreservedTokens, requestInit: RequestInit = {}): RequestInit {
    const modifiedInit = { ...requestInit };

    try {
      // Apply headers
      const headers = new Headers(modifiedInit.headers);
      for (const [key, value] of preservedTokens.headers) {
        headers.set(key, value);
      }
      modifiedInit.headers = headers;

      // Apply cookies if supported
      if (preservedTokens.cookieString) {
        headers.set('Cookie', preservedTokens.cookieString.trim());
      }

      // Set credentials mode for cross-origin requests
      modifiedInit.credentials = 'include';
    } catch (error) {
      console.error('Token application error:', error);
    }

    return modifiedInit;
  }

  /**
   * Modify URL with query parameter tokens
   */
  applyTokensToUrl(url: string, preservedTokens: PreservedTokens): string {
    try {
      const urlObj = new URL(url);

      for (const token of preservedTokens.tokens) {
        if (token.type === 'query_param' && token.scope) {
          urlObj.searchParams.set(token.scope, token.value);
        }
      }

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Clear all preserved tokens
   */
  clearPreservedTokens(): void {
    this.tokenCache.clear();
    this.sessionTokens.clear();
    this.tokenExpiration.clear();
  }

  /**
   * Clear expired tokens
   */
  clearExpiredTokens(): void {
    const now = Date.now();

    // Clear expired token cache
    for (const [key, cached] of this.tokenCache) {
      if (this.areTokensExpired(cached.preserved)) {
        this.tokenCache.delete(key);
      }
    }

    // Clear expired session tokens
    for (const [key, expiry] of this.tokenExpiration) {
      if (now > expiry) {
        this.sessionTokens.delete(key);
        this.tokenExpiration.delete(key);
      }
    }
  }

  /**
   * Cache tokens for session use
   */
  private cacheTokensForSession(tokens: AuthTokenInfo[], url: string): void {
    try {
      const cacheKey = this.generateCacheKey(url);
      const validTokens = tokens.filter(
        token => token.value && token.expiresAt && new Date(token.expiresAt) > new Date(),
      );

      if (validTokens.length > 0) {
        const firstToken = validTokens[0];
        if (firstToken?.value) {
          const expiryTime = Date.now() + 30 * 60 * 1000; // 30 minutes
          const sessionToken: SessionToken = {
            token: firstToken.value,
            scope: 'session',
            expiresAt: new Date(expiryTime),
          };
          this.sessionTokens.set(cacheKey, sessionToken);
          this.tokenExpiration.set(cacheKey, expiryTime);
        }
      }
    } catch (error) {
      console.error('Session token caching error:', error);
    }
  }

  // Private methods

  private extractCookieTokens(document: Document): AuthTokenInfo[] {
    const tokens: AuthTokenInfo[] = [];

    try {
      const cookies = document.cookie.split(';');

      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');

        if (name && value && this.isAuthCookie(name)) {
          tokens.push({
            type: 'cookie',
            value: value,
            scope: name,
            expiresAt: this.extractCookieExpiry(cookie),
          });
        }
      }
    } catch (error) {
      console.error('Cookie token extraction error:', error);
    }

    return tokens;
  }

  private extractStorageTokens(): AuthTokenInfo[] {
    const tokens: AuthTokenInfo[] = [];

    try {
      // Check localStorage
      tokens.push(...this.extractFromStorage(localStorage, 'localStorage'));

      // Check sessionStorage
      tokens.push(...this.extractFromStorage(sessionStorage, 'sessionStorage'));
    } catch (error) {
      console.error('Storage token extraction error:', error);
    }

    return tokens;
  }

  private extractFromStorage(storage: Storage, storageType: string): AuthTokenInfo[] {
    const tokens: AuthTokenInfo[] = [];

    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && this.isAuthStorageKey(key)) {
          const value = storage.getItem(key);
          if (value) {
            tokens.push({
              type: 'header',
              value: value,
              scope: key,
              expiresAt: this.extractStorageExpiry(value),
            });
          }
        }
      }
    } catch (error) {
      console.error(`${storageType} extraction error:`, error);
    }

    return tokens;
  }

  private extractMetaTokens(document: Document): AuthTokenInfo[] {
    const tokens: AuthTokenInfo[] = [];

    try {
      const metaTags = document.querySelectorAll('meta[name], meta[property]');

      for (const meta of metaTags) {
        const name = meta.getAttribute('name') || meta.getAttribute('property') || '';
        const content = meta.getAttribute('content') || '';

        if (this.isAuthMeta(name) && content) {
          tokens.push({
            type: 'header',
            value: content,
            scope: name,
            expiresAt: undefined,
          });
        }
      }
    } catch (error) {
      console.error('Meta token extraction error:', error);
    }

    return tokens;
  }

  private extractUrlTokens(url: string): AuthTokenInfo[] {
    const tokens: AuthTokenInfo[] = [];

    try {
      const urlObj = new URL(url);

      for (const [key, value] of urlObj.searchParams) {
        if (this.isAuthUrlParam(key)) {
          tokens.push({
            type: 'query_param',
            value: value,
            scope: key,
            expiresAt: this.extractParamExpiry(value),
          });
        }
      }
    } catch (error) {
      console.error('URL token extraction error:', error);
    }

    return tokens;
  }

  private extractScriptTokens(document: Document): AuthTokenInfo[] {
    const tokens: AuthTokenInfo[] = [];

    try {
      const scripts = document.querySelectorAll('script');

      for (const script of scripts) {
        const content = script.textContent || '';

        // Look for token patterns in script content
        const extractedTokens = this.extractTokensFromScript(content);
        tokens.push(...extractedTokens);
      }
    } catch (error) {
      console.error('Script token extraction error:', error);
    }

    return tokens;
  }

  private extractTokensFromScript(scriptContent: string): AuthTokenInfo[] {
    const tokens: AuthTokenInfo[] = [];

    // Common token patterns in scripts
    const tokenPatterns = [
      { pattern: /access_token['":\s]+['"]([^'"]+)['"]/i, type: 'bearer' as AuthTokenType },
      { pattern: /bearer['":\s]+['"]([^'"]+)['"]/i, type: 'bearer' as AuthTokenType },
      { pattern: /auth['":\s]+['"]([^'"]+)['"]/i, type: 'header' as AuthTokenType },
      { pattern: /token['":\s]+['"]([^'"]+)['"]/i, type: 'header' as AuthTokenType },
    ];

    for (const { pattern, type } of tokenPatterns) {
      const matches = scriptContent.match(pattern);
      if (matches && matches[1]) {
        tokens.push({
          type,
          value: matches[1],
          scope: 'script_extracted',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes default
        });
      }
    }

    return tokens;
  }

  private isSafeToPreserve(token: AuthTokenInfo): boolean {
    // Only preserve tokens that are:
    // 1. Short-lived (< 2 hours)
    // 2. Not personal/sensitive
    // 3. Related to media access

    const maxLifetime = 2 * 60 * 60 * 1000; // 2 hours
    const now = Date.now();

    // Check expiry
    if (token.expiresAt && token.expiresAt.getTime() - now > maxLifetime) {
      return false;
    }

    // Check if token appears to be for media access
    const mediaRelatedScopes = ['media', 'stream', 'video', 'audio', 'recording', 'playback', 'content', 'resource'];

    const scope = token.scope?.toLowerCase() || '';
    return mediaRelatedScopes.some(keyword => scope.includes(keyword));
  }

  private findShortestExpiry(tokens: AuthTokenInfo[]): Date | null {
    let shortest: Date | null = null;

    for (const token of tokens) {
      if (token.expiresAt) {
        if (!shortest || token.expiresAt < shortest) {
          shortest = token.expiresAt;
        }
      }
    }

    return shortest;
  }

  private storeInSessionCache(mediaUrl: string, preserved: PreservedTokens): void {
    const cacheKey = this.generateCacheKey(mediaUrl);

    this.tokenCache.set(cacheKey, {
      preserved,
      cachedAt: new Date(),
    });

    // Set expiration
    this.tokenExpiration.set(cacheKey, preserved.expiresAt.getTime());
  }

  private generateCacheKey(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return url;
    }
  }

  private areTokensExpired(preserved: PreservedTokens): boolean {
    return Date.now() > preserved.expiresAt.getTime();
  }

  private setupTokenCleanup(): void {
    // Clean up expired tokens every 10 minutes
    setInterval(
      () => {
        this.clearExpiredTokens();
      },
      10 * 60 * 1000,
    );
  }

  // Helper methods for token identification

  private isAuthCookie(name: string): boolean {
    const authCookiePatterns = [/auth/i, /token/i, /session/i, /access/i, /bearer/i, /credential/i, /login/i];
    return authCookiePatterns.some(pattern => pattern.test(name));
  }

  private isAuthStorageKey(key: string): boolean {
    const authKeyPatterns = [/auth/i, /token/i, /access/i, /bearer/i, /credential/i, /session/i];
    return authKeyPatterns.some(pattern => pattern.test(key));
  }

  private isAuthMeta(name: string): boolean {
    const authMetaPatterns = [/csrf/i, /token/i, /auth/i, /bearer/i];
    return authMetaPatterns.some(pattern => pattern.test(name));
  }

  private isAuthUrlParam(key: string): boolean {
    const authParamNames = ['access_token', 'auth', 'token', 'bearer', 'api_key', 'key', 'credential'];
    return authParamNames.includes(key.toLowerCase());
  }

  private extractCookieExpiry(cookie: string): Date | undefined {
    const expiresMatch = cookie.match(/expires=([^;]+)/i);
    if (expiresMatch && expiresMatch[1]) {
      try {
        return new Date(expiresMatch[1]);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private extractStorageExpiry(value: string): Date | undefined {
    try {
      const parsed = JSON.parse(value);
      if (parsed.expires || parsed.expiresAt) {
        return new Date(parsed.expires || parsed.expiresAt);
      }
    } catch {
      // Not JSON or no expiry field
    }
    return undefined;
  }

  private extractParamExpiry(value: string): Date | undefined {
    // Some tokens encode expiry in the value itself
    try {
      const decoded = atob(value);
      const parsed = JSON.parse(decoded);
      if (parsed.exp) {
        return new Date(parsed.exp * 1000); // JWT style expiry
      }
    } catch {
      // Not base64 JSON or no expiry
    }
    return undefined;
  }
}

// Supporting interfaces

export interface PreservedTokens {
  mediaUrl: string;
  tokens: AuthTokenInfo[];
  headers: Map<string, string>;
  cookieString: string;
  expiresAt: Date;
  preservedAt: Date;
}

interface CachedToken {
  preserved: PreservedTokens;
  cachedAt: Date;
}

interface SessionToken {
  token: string;
  scope: string;
  expiresAt: Date;
}

// Create singleton instance
export const authTokenPreserver = new AuthTokenPreserver();
