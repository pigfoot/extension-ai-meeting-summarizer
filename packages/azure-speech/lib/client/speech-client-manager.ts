/**
 * Speech client manager for Azure Speech SDK
 * Coordinates Speech SDK client operations with initialization and configuration
 * Provides connection management and health monitoring
 */

import { SpeechClientFactory } from './speech-client-factory';
import { getRateLimiter } from '../utils/rate-limiter';
import type { AzureSpeechConfig, SpeechClientStatus, SpeechServiceQuota } from '../types';
import type { AzureSpeechClient } from './speech-client-factory';
import { TranscriptionError, ErrorCategory, RetryStrategy, ErrorSeverity } from '../types/errors';
import type { AzureSpeechRateLimiter } from '../utils/rate-limiter';

/**
 * Client manager configuration
 */
interface ClientManagerConfig {
  /** Default Azure Speech configuration */
  defaultConfig: AzureSpeechConfig;
  /** Maximum number of concurrent clients */
  maxClients: number;
  /** Client idle timeout in milliseconds */
  clientIdleTimeout: number;
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
  /** Enable automatic client recycling */
  enableAutoRecycling: boolean;
  /** Rate limiter configuration */
  rateLimiterConfig?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    maxConcurrentRequests: number;
  };
}

/**
 * Client health status
 */
interface ClientHealthStatus {
  clientId: string;
  status: SpeechClientStatus;
  isHealthy: boolean;
  lastActivity: Date;
  errorCount: number;
  connectionUptime?: number;
  responseTime?: number;
}

/**
 * Manager statistics
 */
interface ManagerStats {
  totalClients: number;
  activeClients: number;
  healthyClients: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
}

/**
 * Speech client manager implementation
 */
class SpeechClientManager {
  private config: ClientManagerConfig;
  private clientFactory: SpeechClientFactory;
  private rateLimiter: AzureSpeechRateLimiter;
  private clients: Map<
    string,
    {
      client: AzureSpeechClient;
      lastActivity: Date;
      errorCount: number;
      requestCount: number;
      createdAt: Date;
    }
  > = new Map();

  private healthCheckInterval?: NodeJS.Timeout;
  private recycleInterval?: NodeJS.Timeout;
  private stats: ManagerStats;
  private quotaInfo?: SpeechServiceQuota;
  private startTime: Date;

  constructor(config: Partial<ClientManagerConfig> & { defaultConfig: AzureSpeechConfig }) {
    this.config = {
      maxClients: 10,
      clientIdleTimeout: 300000, // 5 minutes
      healthCheckInterval: 60000, // 1 minute
      enableAutoRecycling: true,
      ...config,
    };

    this.clientFactory = SpeechClientFactory.getInstance();
    this.rateLimiter = getRateLimiter(this.config.rateLimiterConfig);
    this.startTime = new Date();

    this.stats = {
      totalClients: 0,
      activeClients: 0,
      healthyClients: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: 0,
    };

    this.startHealthChecking();
    if (this.config.enableAutoRecycling) {
      this.startAutoRecycling();
    }
  }

  /**
   * Initialize the client manager
   */
  async initialize(): Promise<void> {
    try {
      // Create initial client to test configuration
      const testClientId = 'initialization-test';
      const testClient = await this.createClient(testClientId);

      // Test connectivity
      await testClient.connect();
      await testClient.disconnect();

      // Remove test client
      await this.removeClient(testClientId);

      console.log('SpeechClientManager initialized successfully');
    } catch (error) {
      throw new Error(
        `Failed to initialize SpeechClientManager: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create a new speech client
   */
  async createClient(clientId?: string, config?: Partial<AzureSpeechConfig>): Promise<AzureSpeechClient> {
    // Check rate limiting
    const allowed = await this.rateLimiter.allowRequest('client-creation', 'high');
    if (!allowed) {
      throw this.createError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded for client creation');
    }

    // Check client limit
    if (this.clients.size >= this.config.maxClients) {
      // Try to recycle idle clients
      this.recycleIdleClients();

      if (this.clients.size >= this.config.maxClients) {
        throw this.createError('CONCURRENT_REQUEST_LIMIT', 'Maximum number of clients reached');
      }
    }

    try {
      const finalConfig = { ...this.config.defaultConfig, ...config };
      const id = clientId || this.generateClientId();

      // Remove existing client if exists
      if (this.clients.has(id)) {
        await this.removeClient(id);
      }

      // Create new client
      const client = this.clientFactory.createClient(finalConfig, id);

      // Track client
      this.clients.set(id, {
        client,
        lastActivity: new Date(),
        errorCount: 0,
        requestCount: 0,
        createdAt: new Date(),
      });

      this.stats.totalClients++;
      this.updateStats();

      return client;
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    } finally {
      this.rateLimiter.completeRequest('client-creation');
    }
  }

  /**
   * Get existing client by ID
   */
  getClient(clientId: string): AzureSpeechClient | undefined {
    const clientInfo = this.clients.get(clientId);
    if (clientInfo) {
      clientInfo.lastActivity = new Date();
      return clientInfo.client;
    }
    return undefined;
  }

  /**
   * Get or create client
   */
  async getOrCreateClient(clientId: string, config?: Partial<AzureSpeechConfig>): Promise<AzureSpeechClient> {
    const existingClient = this.getClient(clientId);
    if (existingClient && !existingClient.isDisposed()) {
      return existingClient;
    }

    return this.createClient(clientId, config);
  }

  /**
   * Remove client by ID
   */
  async removeClient(clientId: string): Promise<void> {
    const clientInfo = this.clients.get(clientId);
    if (clientInfo) {
      try {
        await clientInfo.client.dispose();
      } catch (error) {
        console.error(`Error disposing client ${clientId}:`, error);
      }

      this.clients.delete(clientId);
      this.updateStats();
    }
  }

  /**
   * Remove all clients
   */
  async removeAllClients(): Promise<void> {
    const disposalPromises = Array.from(this.clients.keys()).map(clientId => this.removeClient(clientId));

    await Promise.all(disposalPromises);
  }

  /**
   * Get all client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get client health status
   */
  getClientHealth(clientId: string): ClientHealthStatus | undefined {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo) {
      return undefined;
    }

    const status = clientInfo.client.getStatus();
    const connectionUptime = status === 'connected' ? Date.now() - clientInfo.createdAt.getTime() : undefined;

    return {
      clientId,
      status,
      isHealthy: status === 'connected' && clientInfo.errorCount < 5,
      lastActivity: clientInfo.lastActivity,
      errorCount: clientInfo.errorCount,
      responseTime: this.calculateAverageResponseTime(),
      ...(connectionUptime !== undefined && { connectionUptime }),
    };
  }

  /**
   * Get health status for all clients
   */
  getAllClientHealth(): ClientHealthStatus[] {
    return Array.from(this.clients.keys())
      .map(clientId => this.getClientHealth(clientId))
      .filter((health): health is ClientHealthStatus => health !== undefined);
  }

  /**
   * Execute operation with client
   */
  async executeWithClient<T>(
    clientId: string,
    operation: (client: AzureSpeechClient) => Promise<T>,
    config?: Partial<AzureSpeechConfig>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      // Get or create client
      const client = await this.getOrCreateClient(clientId, config);
      const clientInfo = this.clients.get(clientId);

      if (!clientInfo) {
        throw this.createError('INTERNAL_SERVER_ERROR', 'Client tracking lost');
      }

      // Check rate limiting
      const allowed = await this.rateLimiter.allowRequest(`client-${clientId}`, 'normal');
      if (!allowed) {
        throw this.createError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded for client operation');
      }

      // Execute operation
      const result = await operation(client);

      // Update tracking
      clientInfo.lastActivity = new Date();
      clientInfo.requestCount++;
      this.stats.successfulRequests++;

      return result;
    } catch (error) {
      // Update error tracking
      const clientInfo = this.clients.get(clientId);
      if (clientInfo) {
        clientInfo.errorCount++;
      }

      this.stats.failedRequests++;
      throw error;
    } finally {
      // Update response time
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      this.rateLimiter.completeRequest(`client-${clientId}`);
    }
  }

  /**
   * Update quota information
   */
  updateQuotaInfo(quotaInfo: SpeechServiceQuota): void {
    this.quotaInfo = quotaInfo;
    this.rateLimiter.updateQuotaInfo(quotaInfo);
  }

  /**
   * Get current quota information
   */
  getQuotaInfo(): SpeechServiceQuota | undefined {
    return this.quotaInfo;
  }

  /**
   * Get manager statistics
   */
  getStats(): ManagerStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalClients: this.clients.size,
      activeClients: 0,
      healthyClients: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Shutdown manager and clean up resources
   */
  async shutdown(): Promise<void> {
    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.recycleInterval) {
      clearInterval(this.recycleInterval);
    }

    // Remove all clients
    await this.removeAllClients();

    console.log('SpeechClientManager shutdown complete');
  }

  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Start automatic client recycling
   */
  private startAutoRecycling(): void {
    this.recycleInterval = setInterval(() => {
      this.recycleIdleClients();
    }, this.config.clientIdleTimeout / 2);
  }

  /**
   * Perform health check on all clients
   */
  private async performHealthCheck(): Promise<void> {
    const healthPromises = Array.from(this.clients.entries()).map(async ([clientId, clientInfo]) => {
      try {
        const status = clientInfo.client.getStatus();

        // Check if client needs attention
        if (status === 'error' || clientInfo.errorCount > 10) {
          console.warn(`Client ${clientId} is unhealthy, scheduling for removal`);
          await this.removeClient(clientId);
        }
      } catch (error) {
        console.error(`Health check failed for client ${clientId}:`, error);
      }
    });

    await Promise.all(healthPromises);
    this.updateStats();
  }

  /**
   * Recycle idle clients
   */
  private async recycleIdleClients(): Promise<void> {
    const now = new Date();
    const idleThreshold = new Date(now.getTime() - this.config.clientIdleTimeout);

    const idleClients = Array.from(this.clients.entries())
      .filter(([, clientInfo]) => clientInfo.lastActivity < idleThreshold)
      .map(([clientId]) => clientId);

    if (idleClients.length > 0) {
      console.log(`Recycling ${idleClients.length} idle clients`);

      const recyclePromises = idleClients.map(clientId => this.removeClient(clientId));
      await Promise.all(recyclePromises);
    }
  }

  /**
   * Update manager statistics
   */
  private updateStats(): void {
    const healthyClients = this.getAllClientHealth().filter(health => health.isHealthy).length;

    this.stats.activeClients = this.clients.size;
    this.stats.healthyClients = healthyClients;
    this.stats.totalRequests = this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.uptime = Date.now() - this.startTime.getTime();
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(newResponseTime: number): void {
    const alpha = 0.1; // Exponential moving average factor
    this.stats.averageResponseTime = this.stats.averageResponseTime * (1 - alpha) + newResponseTime * alpha;
  }

  /**
   * Calculate average response time for specific client
   */
  private calculateAverageResponseTime(): number {
    // In a real implementation, this would track per-client response times
    return this.stats.averageResponseTime;
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `speech-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create standardized error
   */
  private createError(type: string, message: string): TranscriptionError {
    return {
      name: 'TranscriptionError',
      type: type as TranscriptionError['type'],
      category: ErrorCategory.SERVICE,
      message,
      retryable: true,
      retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      severity: ErrorSeverity.MEDIUM,
      timestamp: new Date(),
      notifyUser: true,
    };
  }
}

/**
 * Global client manager instance
 */
let globalClientManager: SpeechClientManager | undefined;

/**
 * Get or create global client manager
 */
const getClientManager = (
  config?: Partial<ClientManagerConfig> & { defaultConfig: AzureSpeechConfig },
): SpeechClientManager => {
  if (!globalClientManager && config) {
    globalClientManager = new SpeechClientManager(config);
  }

  if (!globalClientManager) {
    throw new Error('Client manager not initialized. Provide configuration on first call.');
  }

  return globalClientManager;
};

/**
 * Initialize global client manager
 */
const initializeGlobalClientManager = async (
  config: Partial<ClientManagerConfig> & { defaultConfig: AzureSpeechConfig },
): Promise<SpeechClientManager> => {
  globalClientManager = new SpeechClientManager(config);
  await globalClientManager.initialize();
  return globalClientManager;
};

/**
 * Shutdown global client manager
 */
const shutdownGlobalClientManager = async (): Promise<void> => {
  if (globalClientManager) {
    await globalClientManager.shutdown();
    globalClientManager = undefined;
  }
};

/**
 * Client manager utility functions
 */
const ClientManagerUtils = {
  /**
   * Create configuration for meeting processing
   */
  createMeetingConfig(defaultConfig: AzureSpeechConfig): ClientManagerConfig {
    return {
      defaultConfig,
      maxClients: 5,
      clientIdleTimeout: 600000, // 10 minutes for meetings
      healthCheckInterval: 30000, // 30 seconds
      enableAutoRecycling: true,
      rateLimiterConfig: {
        requestsPerMinute: 10,
        requestsPerHour: 500,
        maxConcurrentRequests: 3,
      },
    };
  },

  /**
   * Create configuration for high-volume processing
   */
  createHighVolumeConfig(defaultConfig: AzureSpeechConfig): ClientManagerConfig {
    return {
      defaultConfig,
      maxClients: 20,
      clientIdleTimeout: 300000, // 5 minutes
      healthCheckInterval: 60000, // 1 minute
      enableAutoRecycling: true,
      rateLimiterConfig: {
        requestsPerMinute: 50,
        requestsPerHour: 2000,
        maxConcurrentRequests: 10,
      },
    };
  },
};

// Export all interfaces and classes at the end
export type { ClientManagerConfig, ClientHealthStatus, ManagerStats };

export {
  SpeechClientManager,
  getClientManager,
  initializeGlobalClientManager,
  shutdownGlobalClientManager,
  ClientManagerUtils,
};
