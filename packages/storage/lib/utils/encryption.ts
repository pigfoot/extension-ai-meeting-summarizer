/**
 * Encryption Utilities
 * Implements AES-256 encryption for API credentials with
 * secure key generation and validation functions for Azure API storage.
 */

import type { EncryptionAlgorithm, KeyDerivationFunction, EncryptionMetadata, SecurityLevel } from '../types/config';

/**
 * Encryption result with metadata
 */
export interface EncryptionResult {
  /** Whether encryption was successful */
  success: boolean;
  /** Encrypted data (base64 encoded) */
  encryptedData?: string;
  /** Encryption metadata */
  metadata?: EncryptionMetadata;
  /** Error information if encryption failed */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Decryption result
 */
export interface DecryptionResult {
  /** Whether decryption was successful */
  success: boolean;
  /** Decrypted data */
  data?: string;
  /** Error information if decryption failed */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Key generation options
 */
export interface KeyGenerationOptions {
  /** Key derivation function to use */
  kdf: KeyDerivationFunction;
  /** Number of iterations for key derivation */
  iterations: number;
  /** Salt length in bytes */
  saltLength: number;
  /** Key length in bytes */
  keyLength: number;
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  /** Encryption algorithm */
  algorithm: EncryptionAlgorithm;
  /** Security level */
  securityLevel: SecurityLevel;
  /** Key generation options */
  keyOptions: KeyGenerationOptions;
  /** Enable key rotation */
  enableKeyRotation: boolean;
  /** Key rotation interval in days */
  keyRotationInterval: number;
}

/**
 * Encryption utilities for secure data storage
 */
export class EncryptionUtils {
  private defaultConfig: EncryptionConfig;
  private keyCache: Map<string, CryptoKey> = new Map();

  constructor(config?: Partial<EncryptionConfig>) {
    this.defaultConfig = {
      algorithm: 'AES-256-GCM',
      securityLevel: 'confidential',
      keyOptions: {
        kdf: 'PBKDF2',
        iterations: 100000,
        saltLength: 32,
        keyLength: 32,
      },
      enableKeyRotation: true,
      keyRotationInterval: 90, // 90 days
      ...config,
    };
  }

  /**
   * Encrypt sensitive data with secure key derivation
   */
  public async encryptData(
    data: string,
    password: string,
    config?: Partial<EncryptionConfig>,
  ): Promise<EncryptionResult> {
    try {
      const effectiveConfig = { ...this.defaultConfig, ...config };

      // Generate salt and IV
      const salt = this.generateRandomBytes(effectiveConfig.keyOptions.saltLength);
      const iv = this.generateRandomBytes(12); // GCM requires 12-byte IV

      // Derive encryption key
      const key = await this.deriveKey(password, salt, effectiveConfig.keyOptions);

      // Encrypt data
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv.buffer as ArrayBuffer,
        },
        key,
        dataBuffer.buffer as ArrayBuffer,
      );

      // Combine IV + encrypted data + auth tag
      const encryptedArray = new Uint8Array(encrypted);
      const combined = new Uint8Array(iv.length + encryptedArray.length);
      combined.set(iv, 0);
      combined.set(encryptedArray, iv.length);

      // Create metadata
      const metadata: EncryptionMetadata = {
        algorithm: effectiveConfig.algorithm,
        keyDerivation: effectiveConfig.keyOptions.kdf,
        iv: this.arrayBufferToBase64(iv.buffer as ArrayBuffer),
        salt: this.arrayBufferToBase64(salt.buffer as ArrayBuffer),
        iterations: effectiveConfig.keyOptions.iterations,
        authTag: '', // GCM includes auth tag in encrypted data
        securityLevel: effectiveConfig.securityLevel,
        keyId: this.generateKeyId(),
        encryptedAt: new Date().toISOString(),
        keyRotation: {
          nextRotation: this.calculateNextRotation(effectiveConfig.keyRotationInterval),
          rotationInterval: effectiveConfig.keyRotationInterval,
          autoRotate: effectiveConfig.enableKeyRotation,
        },
      };

      return {
        success: true,
        encryptedData: this.arrayBufferToBase64(combined.buffer as ArrayBuffer),
        metadata,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ENCRYPTION_FAILED',
          message: `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Decrypt data using stored metadata
   */
  public async decryptData(
    encryptedData: string,
    password: string,
    metadata: EncryptionMetadata,
  ): Promise<DecryptionResult> {
    try {
      // Parse encrypted data
      const combined = this.base64ToArrayBuffer(encryptedData);
      const iv = new Uint8Array(combined.slice(0, 12)); // First 12 bytes are IV
      const encrypted = combined.slice(12); // Rest is encrypted data + auth tag

      // Derive decryption key using stored metadata
      const salt = this.base64ToArrayBuffer(metadata.salt);
      const keyOptions: KeyGenerationOptions = {
        kdf: metadata.keyDerivation,
        iterations: metadata.iterations,
        saltLength: salt.byteLength,
        keyLength: 32, // AES-256 key length
      };

      const key = await this.deriveKey(password, new Uint8Array(salt), keyOptions);

      // Decrypt data
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        encrypted,
      );

      // Decode to string
      const decoder = new TextDecoder();
      const decryptedData = decoder.decode(decrypted);

      return {
        success: true,
        data: decryptedData,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DECRYPTION_FAILED',
          message: `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Generate secure random password
   */
  public generateSecurePassword(length = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const randomBytes = this.generateRandomBytes(length);

    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[(randomBytes[i] ?? 0) % charset.length];
    }

    return password;
  }

  /**
   * Validate encryption metadata
   */
  public validateMetadata(metadata: EncryptionMetadata): boolean {
    try {
      // Check required fields
      if (!metadata.algorithm || !metadata.keyDerivation || !metadata.iv || !metadata.salt) {
        return false;
      }

      // Validate algorithm
      const supportedAlgorithms: EncryptionAlgorithm[] = ['AES-256-GCM', 'AES-256-CBC', 'ChaCha20-Poly1305'];
      if (!supportedAlgorithms.includes(metadata.algorithm)) {
        return false;
      }

      // Validate key derivation function
      const supportedKDFs: KeyDerivationFunction[] = ['PBKDF2', 'scrypt', 'Argon2'];
      if (!supportedKDFs.includes(metadata.keyDerivation)) {
        return false;
      }

      // Validate iterations count (minimum security threshold)
      if (metadata.iterations < 10000) {
        return false;
      }

      // Validate base64 encoded fields
      try {
        this.base64ToArrayBuffer(metadata.iv);
        this.base64ToArrayBuffer(metadata.salt);
      } catch {
        return false;
      }

      // Validate dates
      try {
        new Date(metadata.encryptedAt);
        new Date(metadata.keyRotation.nextRotation);
      } catch {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if key rotation is needed
   */
  public needsKeyRotation(metadata: EncryptionMetadata): boolean {
    if (!metadata.keyRotation.autoRotate) {
      return false;
    }

    const nextRotation = new Date(metadata.keyRotation.nextRotation);
    const now = new Date();

    return now >= nextRotation;
  }

  /**
   * Rotate encryption key for existing data
   */
  public async rotateKey(
    encryptedData: string,
    oldPassword: string,
    newPassword: string,
    metadata: EncryptionMetadata,
  ): Promise<EncryptionResult> {
    try {
      // First decrypt with old password
      const decryptResult = await this.decryptData(encryptedData, oldPassword, metadata);
      if (!decryptResult.success || !decryptResult.data) {
        return {
          success: false,
          error: {
            code: 'KEY_ROTATION_FAILED',
            message: 'Failed to decrypt data with old password',
          },
        };
      }

      // Encrypt with new password
      const encryptResult = await this.encryptData(decryptResult.data, newPassword);
      if (!encryptResult.success) {
        return {
          success: false,
          error: {
            code: 'KEY_ROTATION_FAILED',
            message: 'Failed to encrypt data with new password',
          },
        };
      }

      return encryptResult;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'KEY_ROTATION_FAILED',
          message: `Key rotation failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Generate cryptographically secure hash
   */
  public async generateHash(data: string, algorithm = 'SHA-256'): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
    return this.arrayBufferToBase64(hashBuffer);
  }

  /**
   * Verify data integrity using hash
   */
  public async verifyIntegrity(data: string, expectedHash: string, algorithm = 'SHA-256'): Promise<boolean> {
    try {
      const actualHash = await this.generateHash(data, algorithm);
      return actualHash === expectedHash;
    } catch {
      return false;
    }
  }

  /**
   * Derive encryption key from password and salt
   */
  private async deriveKey(password: string, salt: Uint8Array, options: KeyGenerationOptions): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Create cache key
    const cacheKey = `${password}-${this.arrayBufferToBase64(salt.buffer as ArrayBuffer)}-${options.iterations}`;

    // Check cache first
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, ['deriveKey']);

    // Derive key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: options.iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: options.keyLength * 8, // Convert to bits
      },
      false,
      ['encrypt', 'decrypt'],
    );

    // Cache the derived key
    this.keyCache.set(cacheKey, key);

    return key;
  }

  /**
   * Generate cryptographically secure random bytes
   */
  private generateRandomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i] ?? 0);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Generate unique key identifier
   */
  private generateKeyId(): string {
    const randomBytes = this.generateRandomBytes(16);
    return this.arrayBufferToBase64(randomBytes.buffer as ArrayBuffer).substring(0, 12);
  }

  /**
   * Calculate next key rotation date
   */
  private calculateNextRotation(intervalDays: number): string {
    const now = new Date();
    const nextRotation = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    return nextRotation.toISOString();
  }

  /**
   * Clear key cache (for security)
   */
  public clearKeyCache(): void {
    this.keyCache.clear();
  }

  /**
   * Get encryption configuration
   */
  public getConfig(): EncryptionConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Update encryption configuration
   */
  public updateConfig(config: Partial<EncryptionConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    // Clear cache when config changes
    this.clearKeyCache();
  }
}
