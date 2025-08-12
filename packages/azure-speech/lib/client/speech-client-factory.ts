/**
 * Speech client factory for Azure Speech SDK
 * Implements Speech SDK client creation and lifecycle management
 * Provides client disposal and resource cleanup functions
 */

import { SpeechConfigBuilder } from '../config/speech-config';
import type { SpeechClient, SpeechClientStatus, AzureSpeechConfig, TranscriptionConfig } from '../types';
import { TranscriptionError, TranscriptionErrorType, ErrorCategory, RetryStrategy, ErrorSeverity } from '../types/errors';

/**
 * Speech client implementation with Azure Speech SDK integration
 */
export class AzureSpeechClient implements SpeechClient {
  private config: AzureSpeechConfig;
  private status: SpeechClientStatus = 'disconnected';
  private recognizer?: unknown; // Azure Speech SDK recognizer
  private connection?: unknown; // Azure Speech SDK connection
  private eventListeners: Map<string, Set<(data?: unknown) => void>> = new Map();
  private disposed: boolean = false;

  constructor(config: AzureSpeechConfig) {
    this.config = config;
    this.initializeEventListeners();
  }

  /**
   * Initialize event listener management
   */
  private initializeEventListeners(): void {
    this.eventListeners.set('connected', new Set());
    this.eventListeners.set('disconnected', new Set());
    this.eventListeners.set('error', new Set());
    this.eventListeners.set('recognizing', new Set());
    this.eventListeners.set('recognized', new Set());
  }

  /**
   * Connect to Azure Speech service
   */
  async connect(): Promise<void> {
    if (this.disposed) {
      throw new Error('Client has been disposed');
    }

    if (this.status === 'connected') {
      return; // Already connected
    }

    try {
      this.status = 'connecting';

      // Note: This is a stub implementation since we can't import the actual Azure SDK
      // In real implementation, this would use:
      // import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

      console.warn('Azure Speech Client: Using stub implementation - real SDK integration pending');

      // Simulate connection
      await this.simulateConnection();

      this.status = 'connected';
      this.emit('connected', { timestamp: new Date() });
    } catch (error) {
      this.status = 'error';
      const transcriptionError: TranscriptionError = {
        name: 'TranscriptionError',
        type: TranscriptionErrorType.CONNECTION_FAILED,
        category: ErrorCategory.NETWORK,
        message: `Failed to connect to Azure Speech service: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
        retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        notifyUser: true,
      };

      this.emit('error', transcriptionError);
      throw transcriptionError;
    }
  }

  /**
   * Disconnect from Azure Speech service
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected') {
      return; // Already disconnected
    }

    try {
      // Clean up recognizer
      if (this.recognizer) {
        // In real implementation: this.recognizer.close();
        this.recognizer = undefined;
      }

      // Clean up connection
      if (this.connection) {
        // In real implementation: this.connection.close();
        this.connection = undefined;
      }

      this.status = 'disconnected';
      this.emit('disconnected', { timestamp: new Date() });
    } catch (error) {
      console.error('Error during disconnect:', error);
      this.status = 'error';
    }
  }

  /**
   * Start transcription process
   */
  async startTranscription(): Promise<void> {
    if (this.disposed) {
      throw new Error('Client has been disposed');
    }

    if (this.status !== 'connected') {
      throw new Error('Client must be connected before starting transcription');
    }

    try {
      // In real implementation, this would setup the recognizer and start recognition
      console.warn('Azure Speech Client: Starting transcription (stub implementation)');

      this.emit('recognizing', {
        text: 'Transcription started...',
        timestamp: new Date(),
      });
    } catch (error) {
      const transcriptionError: TranscriptionError = {
        name: 'TranscriptionError',
        type: TranscriptionErrorType.TRANSCRIPTION_FAILED,
        category: ErrorCategory.SERVICE,
        message: `Failed to start transcription: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
        retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        notifyUser: true,
      };

      this.emit('error', transcriptionError);
      throw transcriptionError;
    }
  }

  /**
   * Stop transcription process
   */
  async stopTranscription(): Promise<void> {
    try {
      // In real implementation, this would stop the recognizer
      console.warn('Azure Speech Client: Stopping transcription (stub implementation)');
    } catch (error) {
      console.error('Error stopping transcription:', error);
    }
  }

  /**
   * Get current client status
   */
  getStatus(): SpeechClientStatus {
    return this.status;
  }

  /**
   * Get client configuration
   */
  getConfig(): AzureSpeechConfig {
    return { ...this.config };
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, listener: (data?: unknown) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(listener);
    }
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, listener: (data?: unknown) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Dispose client and clean up resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    try {
      // Disconnect if connected
      if (this.status === 'connected') {
        await this.disconnect();
      }

      // Clear event listeners
      this.eventListeners.clear();

      // Mark as disposed
      this.disposed = true;
    } catch (error) {
      console.error('Error during client disposal:', error);
    }
  }

  /**
   * Check if client is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Simulate connection for stub implementation
   */
  private async simulateConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Simulate network delay
      setTimeout(
        () => {
          // Simulate occasional connection failures
          if (Math.random() < 0.1) {
            // 10% failure rate for testing
            reject(new Error('Simulated connection failure'));
          } else {
            resolve();
          }
        },
        1000 + Math.random() * 2000,
      ); // 1-3 seconds delay
    });
  }
}

/**
 * Speech client factory class
 */
export class SpeechClientFactory {
  private static instance: SpeechClientFactory;
  private activeClients: Map<string, AzureSpeechClient> = new Map();

  /**
   * Get singleton instance
   */
  static getInstance(): SpeechClientFactory {
    if (!SpeechClientFactory.instance) {
      SpeechClientFactory.instance = new SpeechClientFactory();
    }
    return SpeechClientFactory.instance;
  }

  /**
   * Create new speech client
   */
  createClient(config: AzureSpeechConfig, clientId?: string): AzureSpeechClient {
    const id = clientId || this.generateClientId();

    // Dispose existing client if exists
    const existingClient = this.activeClients.get(id);
    if (existingClient) {
      existingClient.dispose().catch(console.error);
    }

    // Create new client
    const client = new AzureSpeechClient(config);
    this.activeClients.set(id, client);

    return client;
  }

  /**
   * Get existing client by ID
   */
  getClient(clientId: string): AzureSpeechClient | undefined {
    return this.activeClients.get(clientId);
  }

  /**
   * Dispose client by ID
   */
  async disposeClient(clientId: string): Promise<void> {
    const client = this.activeClients.get(clientId);
    if (client) {
      await client.dispose();
      this.activeClients.delete(clientId);
    }
  }

  /**
   * Get all active client IDs
   */
  getActiveClientIds(): string[] {
    return Array.from(this.activeClients.keys());
  }

  /**
   * Dispose all clients
   */
  async disposeAllClients(): Promise<void> {
    const disposalPromises = Array.from(this.activeClients.values()).map(client =>
      client.dispose().catch(console.error),
    );

    await Promise.all(disposalPromises);
    this.activeClients.clear();
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.activeClients.size;
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `speech-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function for creating speech clients
 */
export const createSpeechClient = (config: AzureSpeechConfig, clientId?: string): AzureSpeechClient => {
  const factory = SpeechClientFactory.getInstance();
  return factory.createClient(config, clientId);
};

/**
 * Factory function for creating speech client with builder pattern
 */
export const createSpeechClientWithBuilder = (
  subscriptionKey: string,
  region: AzureSpeechConfig['region'],
  transcriptionConfig?: TranscriptionConfig,
): AzureSpeechClient => {
  const configBuilder = new SpeechConfigBuilder(subscriptionKey, region);

  if (transcriptionConfig) {
    configBuilder.setTranscriptionConfig(transcriptionConfig);
  }

  const config = configBuilder.build();
  return createSpeechClient(config);
};

/**
 * Utility functions for client management
 */
export const ClientUtils = {
  /**
   * Wait for client to reach desired status
   */
  async waitForStatus(client: AzureSpeechClient, status: SpeechClientStatus, timeout = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (client.getStatus() === status) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for client status: ${status}`));
      }, timeout);

      const checkStatus = () => {
        if (client.getStatus() === status) {
          clearTimeout(timeoutId);
          resolve();
        } else if (client.getStatus() === 'error') {
          clearTimeout(timeoutId);
          reject(new Error('Client entered error state'));
        } else {
          // Continue checking
          setTimeout(checkStatus, 100);
        }
      };

      checkStatus();
    });
  },

  /**
   * Test client connectivity
   */
  async testConnectivity(client: AzureSpeechClient): Promise<boolean> {
    try {
      await client.connect();
      await client.disconnect();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get client health status
   */
  getHealthStatus(client: AzureSpeechClient): {
    status: SpeechClientStatus;
    isHealthy: boolean;
    lastActivity?: Date;
  } {
    const status = client.getStatus();
    return {
      status,
      isHealthy: status === 'connected',
      lastActivity: new Date(), // In real implementation, track actual activity
    };
  },
};
