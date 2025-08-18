/**
 * Azure client coordinator for centralized Azure Speech service management
 * Handles authentication, client lifecycle, and connection pooling
 */

import type {
  AzureSpeechConfig,
  SpeechClient,
  SpeechClientStatus,
  SpeechServiceQuota,
  SpeechServiceMetrics,
} from '@extension/azure-speech';

/**
 * Azure client pool configuration
 */
export interface ClientPoolConfig {
  /** Maximum number of concurrent clients */
  maxClients: number;
  /** Client idle timeout in milliseconds */
  idleTimeout: number;
  /** Enable client reuse */
  enableReuse: boolean;
  /** Client creation timeout */
  creationTimeout: number;
  /** Health check interval */
  healthCheckInterval: number;
}

/**
 * Client connection info
 */
export interface ClientConnection {
  /** Client identifier */
  clientId: string;
  /** Speech client instance */
  client: SpeechClient;
  /** Current status */
  status: SpeechClientStatus;
  /** Creation timestamp */
  createdAt: string;
  /** Last used timestamp */
  lastUsed: string;
  /** Number of active operations */
  activeOperations: number;
  /** Associated Azure configuration */
  config: AzureSpeechConfig;
  /** Connection health metrics */
  health: {
    /** Connection uptime in milliseconds */
    uptime: number;
    /** Number of requests processed */
    requestsProcessed: number;
    /** Number of errors encountered */
    errorCount: number;
    /** Average response time */
    avgResponseTime: number;
  };
}

/**
 * Authentication token info
 */
export interface AuthToken {
  /** Access token */
  token: string;
  /** Token expiration time */
  expiresAt: string;
  /** Azure region */
  region: string;
  /** Subscription key hash */
  subscriptionKeyHash: string;
  /** Token renewal status */
  renewalStatus: 'valid' | 'renewing' | 'expired';
}

/**
 * Client coordinator statistics
 */
export interface ClientCoordinatorStats {
  /** Total clients created */
  totalClientsCreated: number;
  /** Active clients count */
  activeClients: number;
  /** Idle clients count */
  idleClients: number;
  /** Total requests processed */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average client utilization */
  averageUtilization: number;
  /** Client pool efficiency */
  poolEfficiency: number;
  /** Last statistics update */
  lastUpdated: string;
}

/**
 * Azure client coordinator for centralized Speech service management
 */
export class AzureClientCoordinator {
  private config: ClientPoolConfig;
  private clientPool = new Map<string, ClientConnection>();
  private authTokens = new Map<string, AuthToken>();
  private stats: ClientCoordinatorStats;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: ClientPoolConfig) {
    this.config = config;
    this.stats = this.initializeStats();

    this.startHealthChecking();
    this.startClientCleanup();
  }

  /**
   * Get or create Azure Speech client
   */
  async getClient(azureConfig: AzureSpeechConfig): Promise<ClientConnection> {
    try {
      console.log(`[AzureClientCoordinator] Requesting client for region: ${azureConfig.serviceRegion}`);

      // Check for existing client that can be reused
      if (this.config.enableReuse) {
        const existingClient = this.findReusableClient(azureConfig);
        if (existingClient) {
          this.updateClientUsage(existingClient.clientId);
          console.log(`[AzureClientCoordinator] Reusing existing client: ${existingClient.clientId}`);
          return existingClient;
        }
      }

      // Check pool capacity
      if (this.clientPool.size >= this.config.maxClients) {
        // Try to cleanup idle clients
        await this.cleanupIdleClients();

        if (this.clientPool.size >= this.config.maxClients) {
          throw new Error('Client pool capacity exceeded');
        }
      }

      // Create new client
      const clientConnection = await this.createNewClient(azureConfig);
      this.clientPool.set(clientConnection.clientId, clientConnection);

      // Update statistics
      this.stats.totalClientsCreated++;
      this.updateStats();

      console.log(`[AzureClientCoordinator] Created new client: ${clientConnection.clientId}`);

      return clientConnection;
    } catch (error) {
      console.error('[AzureClientCoordinator] Failed to get client:', error);
      throw error;
    }
  }

  /**
   * Release client back to pool
   */
  async releaseClient(clientId: string): Promise<void> {
    const clientConnection = this.clientPool.get(clientId);
    if (!clientConnection) {
      console.warn(`[AzureClientCoordinator] Client ${clientId} not found for release`);
      return;
    }

    try {
      // Decrement active operations
      clientConnection.activeOperations = Math.max(0, clientConnection.activeOperations - 1);
      clientConnection.lastUsed = new Date().toISOString();

      // If no active operations and client should not be reused, disconnect
      if (clientConnection.activeOperations === 0 && !this.config.enableReuse) {
        await this.disconnectClient(clientId);
      }

      console.log(
        `[AzureClientCoordinator] Released client: ${clientId} (active ops: ${clientConnection.activeOperations})`,
      );
    } catch (error) {
      console.error(`[AzureClientCoordinator] Error releasing client ${clientId}:`, error);
    }
  }

  /**
   * Disconnect and remove client from pool
   */
  async disconnectClient(clientId: string): Promise<void> {
    const clientConnection = this.clientPool.get(clientId);
    if (!clientConnection) {
      return;
    }

    try {
      console.log(`[AzureClientCoordinator] Disconnecting client: ${clientId}`);

      // Update status
      clientConnection.status = 'disconnected';

      // Disconnect the client
      await clientConnection.client.disconnect();

      // Remove from pool
      this.clientPool.delete(clientId);

      // Update statistics
      this.updateStats();
    } catch (error) {
      console.error(`[AzureClientCoordinator] Error disconnecting client ${clientId}:`, error);
    }
  }

  /**
   * Get authentication token for Azure region
   */
  async getAuthToken(subscriptionKey: string, region: string): Promise<string> {
    const tokenKey = this.getTokenKey(subscriptionKey, region);
    const existingToken = this.authTokens.get(tokenKey);

    // Check if existing token is valid
    if (existingToken && this.isTokenValid(existingToken)) {
      return existingToken.token;
    }

    // Renew token
    console.log(`[AzureClientCoordinator] Renewing auth token for region: ${region}`);

    try {
      const newToken = await this.renewAuthToken(subscriptionKey, region);
      this.authTokens.set(tokenKey, newToken);
      return newToken.token;
    } catch (error) {
      console.error(`[AzureClientCoordinator] Failed to renew auth token for ${region}:`, error);
      throw error;
    }
  }

  /**
   * Get Azure service quota information
   */
  async getServiceQuota(_region: string): Promise<SpeechServiceQuota> {
    // This would integrate with Azure management APIs
    // For now, return mock quota data
    return {
      current: 50,
      limit: 1000,
      resetPeriod: 3600,
      timeUntilReset: 1800,
    };
  }

  /**
   * Get service metrics across all clients
   */
  getServiceMetrics(): SpeechServiceMetrics {
    const metrics: SpeechServiceMetrics = {
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      averageProcessingTime: 0,
      quotaUsage: {
        current: 0,
        limit: 1000,
        resetPeriod: 3600,
        timeUntilReset: 1800,
      },
    };

    // Calculate average processing time across all clients
    let totalProcessingTime = 0;
    let totalRequests = 0;

    for (const client of this.clientPool.values()) {
      totalProcessingTime += client.health.avgResponseTime * client.health.requestsProcessed;
      totalRequests += client.health.requestsProcessed;
    }

    if (totalRequests > 0) {
      metrics.averageProcessingTime = totalProcessingTime / totalRequests;
    }

    return metrics;
  }

  /**
   * Get client coordinator statistics
   */
  getStats(): ClientCoordinatorStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get all active client connections
   */
  getActiveClients(): ClientConnection[] {
    return Array.from(this.clientPool.values()).filter(client => client.status === 'connected');
  }

  /**
   * Update client pool configuration
   */
  updateConfig(config: Partial<ClientPoolConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart health checking if interval changed
    if (config.healthCheckInterval) {
      this.stopHealthChecking();
      this.startHealthChecking();
    }

    console.log('[AzureClientCoordinator] Configuration updated');
  }

  /**
   * Shutdown client coordinator
   */
  async shutdown(): Promise<void> {
    console.log('[AzureClientCoordinator] Shutting down');

    // Stop background tasks
    this.stopHealthChecking();
    this.stopClientCleanup();

    // Disconnect all clients
    const clientIds = Array.from(this.clientPool.keys());
    for (const clientId of clientIds) {
      try {
        await this.disconnectClient(clientId);
      } catch (error) {
        console.warn(`[AzureClientCoordinator] Error disconnecting client ${clientId} during shutdown:`, error);
      }
    }

    // Clear all data
    this.clientPool.clear();
    this.authTokens.clear();

    console.log('[AzureClientCoordinator] Shutdown completed');
  }

  /**
   * Find reusable client in pool
   */
  private findReusableClient(azureConfig: AzureSpeechConfig): ClientConnection | null {
    for (const client of this.clientPool.values()) {
      if (
        client.status === 'connected' &&
        client.config.serviceRegion === azureConfig.serviceRegion &&
        client.config.subscriptionKey === azureConfig.subscriptionKey &&
        client.activeOperations < 3 // Limit concurrent operations per client
      ) {
        return client;
      }
    }
    return null;
  }

  /**
   * Create new Azure Speech client
   */
  private async createNewClient(azureConfig: AzureSpeechConfig): Promise<ClientConnection> {
    const clientId = `azure-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Get authentication token
      const _authToken = await this.getAuthToken(azureConfig.subscriptionKey, azureConfig.serviceRegion);

      // Create speech client (mock implementation)
      const speechClient: SpeechClient = {
        connect: async () => {
          console.log(`[SpeechClient ${clientId}] Connecting to Azure Speech`);
        },
        disconnect: async () => {
          console.log(`[SpeechClient ${clientId}] Disconnecting from Azure Speech`);
        },
        startTranscription: async () => {
          console.log(`[SpeechClient ${clientId}] Starting transcription`);
        },
        stopTranscription: async () => {
          console.log(`[SpeechClient ${clientId}] Stopping transcription`);
        },
      };

      // Connect the client
      await speechClient.connect();

      // Create client connection
      const clientConnection: ClientConnection = {
        clientId,
        client: speechClient,
        status: 'connected',
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        activeOperations: 0,
        config: azureConfig,
        health: {
          uptime: 0,
          requestsProcessed: 0,
          errorCount: 0,
          avgResponseTime: 0,
        },
      };

      return clientConnection;
    } catch (error) {
      console.error(`[AzureClientCoordinator] Failed to create client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Update client usage statistics
   */
  private updateClientUsage(clientId: string): void {
    const client = this.clientPool.get(clientId);
    if (!client) return;

    client.lastUsed = new Date().toISOString();
    client.activeOperations++;
    client.health.requestsProcessed++;

    // Update uptime
    const createdTime = new Date(client.createdAt).getTime();
    client.health.uptime = Date.now() - createdTime;
  }

  /**
   * Get token key for authentication cache
   */
  private getTokenKey(subscriptionKey: string, region: string): string {
    // Create hash of subscription key for security
    const keyHash = btoa(subscriptionKey).slice(0, 8);
    return `${region}-${keyHash}`;
  }

  /**
   * Check if authentication token is valid
   */
  private isTokenValid(token: AuthToken): boolean {
    if (token.renewalStatus === 'expired') {
      return false;
    }

    const expiryTime = new Date(token.expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;

    // Renew if expiring within 5 minutes
    return timeUntilExpiry > 300000;
  }

  /**
   * Renew authentication token
   */
  private async renewAuthToken(subscriptionKey: string, region: string): Promise<AuthToken> {
    // This would make actual Azure authentication request
    // For now, return mock token

    const token: AuthToken = {
      token: `mock-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      region,
      subscriptionKeyHash: btoa(subscriptionKey).slice(0, 8),
      renewalStatus: 'valid',
    };

    console.log(`[AzureClientCoordinator] Auth token renewed for region: ${region}`);

    return token;
  }

  /**
   * Cleanup idle clients
   */
  private async cleanupIdleClients(): Promise<void> {
    const now = Date.now();
    const idleThreshold = this.config.idleTimeout;

    for (const [clientId, client] of this.clientPool) {
      const lastUsedTime = new Date(client.lastUsed).getTime();
      const idleTime = now - lastUsedTime;

      if (client.activeOperations === 0 && idleTime > idleThreshold && client.status !== 'disconnected') {
        console.log(`[AzureClientCoordinator] Cleaning up idle client: ${clientId} (idle: ${idleTime}ms)`);
        await this.disconnectClient(clientId);
      }
    }
  }

  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    console.log('[AzureClientCoordinator] Health checking started');
  }

  /**
   * Stop health checking
   */
  private stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[AzureClientCoordinator] Health checking stopped');
    }
  }

  /**
   * Start client cleanup task
   */
  private startClientCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(async () => {
      await this.cleanupIdleClients();
    }, 60000); // Every minute

    console.log('[AzureClientCoordinator] Client cleanup started');
  }

  /**
   * Stop client cleanup task
   */
  private stopClientCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[AzureClientCoordinator] Client cleanup stopped');
    }
  }

  /**
   * Perform health checks on all clients
   */
  private performHealthChecks(): void {
    for (const [clientId, client] of this.clientPool) {
      // Update uptime
      const createdTime = new Date(client.createdAt).getTime();
      client.health.uptime = Date.now() - createdTime;

      // Check for unhealthy clients
      if (client.health.errorCount > 10) {
        console.warn(`[AzureClientCoordinator] Client ${clientId} has high error count: ${client.health.errorCount}`);
      }

      // Check for slow clients
      if (client.health.avgResponseTime > 5000) {
        console.warn(
          `[AzureClientCoordinator] Client ${clientId} has slow response time: ${client.health.avgResponseTime}ms`,
        );
      }
    }

    // Clean up expired tokens
    this.cleanupExpiredTokens();
  }

  /**
   * Clean up expired authentication tokens
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();

    for (const [tokenKey, token] of this.authTokens) {
      const expiryTime = new Date(token.expiresAt).getTime();

      if (now > expiryTime) {
        this.authTokens.delete(tokenKey);
        console.log(`[AzureClientCoordinator] Cleaned up expired token for region: ${token.region}`);
      }
    }
  }

  /**
   * Update coordinator statistics
   */
  private updateStats(): void {
    this.stats.activeClients = Array.from(this.clientPool.values()).filter(
      client => client.status === 'connected',
    ).length;

    this.stats.idleClients = Array.from(this.clientPool.values()).filter(
      client => client.status === 'connected' && client.activeOperations === 0,
    ).length;

    // Calculate pool efficiency
    if (this.stats.activeClients > 0) {
      const totalOperations = Array.from(this.clientPool.values()).reduce(
        (sum, client) => sum + client.activeOperations,
        0,
      );
      this.stats.averageUtilization = (totalOperations / this.stats.activeClients) * 100;
      this.stats.poolEfficiency = (this.stats.activeClients / this.config.maxClients) * 100;
    }

    this.stats.lastUpdated = new Date().toISOString();
  }

  /**
   * Initialize coordinator statistics
   */
  private initializeStats(): ClientCoordinatorStats {
    return {
      totalClientsCreated: 0,
      activeClients: 0,
      idleClients: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageUtilization: 0,
      poolEfficiency: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
