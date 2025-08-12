/**
 * Azure Speech API credential validation
 * Provides comprehensive validation of Azure Speech Service credentials including
 * format validation, connectivity testing, and region verification
 */

import type {
  AuthConfig,
  CredentialValidationResult,
  AuthenticationError,
  AuthenticationErrorType,
  ApiKeyValidationOptions,
  HealthCheckResult,
} from '../types/auth';
import type { AzureRegion } from '../types/index';

/**
 * Azure Speech Service API endpoints for different regions
 */
const AZURE_SPEECH_ENDPOINTS: Record<AzureRegion, string> = {
  eastus: 'https://eastus.api.cognitive.microsoft.com',
  eastus2: 'https://eastus2.api.cognitive.microsoft.com',
  westus: 'https://westus.api.cognitive.microsoft.com',
  westus2: 'https://westus2.api.cognitive.microsoft.com',
  westus3: 'https://westus3.api.cognitive.microsoft.com',
  centralus: 'https://centralus.api.cognitive.microsoft.com',
  northcentralus: 'https://northcentralus.api.cognitive.microsoft.com',
  southcentralus: 'https://southcentralus.api.cognitive.microsoft.com',
  westcentralus: 'https://westcentralus.api.cognitive.microsoft.com',
  northeurope: 'https://northeurope.api.cognitive.microsoft.com',
  westeurope: 'https://westeurope.api.cognitive.microsoft.com',
  uksouth: 'https://uksouth.api.cognitive.microsoft.com',
  ukwest: 'https://ukwest.api.cognitive.microsoft.com',
  francecentral: 'https://francecentral.api.cognitive.microsoft.com',
  germanynorth: 'https://germanynorth.api.cognitive.microsoft.com',
  swedencentral: 'https://swedencentral.api.cognitive.microsoft.com',
  switzerlandnorth: 'https://switzerlandnorth.api.cognitive.microsoft.com',
  southeastasia: 'https://southeastasia.api.cognitive.microsoft.com',
  eastasia: 'https://eastasia.api.cognitive.microsoft.com',
  australiaeast: 'https://australiaeast.api.cognitive.microsoft.com',
  australiasoutheast: 'https://australiasoutheast.api.cognitive.microsoft.com',
  centralindia: 'https://centralindia.api.cognitive.microsoft.com',
  japaneast: 'https://japaneast.api.cognitive.microsoft.com',
  japanwest: 'https://japanwest.api.cognitive.microsoft.com',
  koreacentral: 'https://koreacentral.api.cognitive.microsoft.com',
  canadacentral: 'https://canadacentral.api.cognitive.microsoft.com',
  brazilsouth: 'https://brazilsouth.api.cognitive.microsoft.com',
  southafricanorth: 'https://southafricanorth.api.cognitive.microsoft.com',
  uaenorth: 'https://uaenorth.api.cognitive.microsoft.com',
};

/**
 * Default validation options
 */
const DEFAULT_VALIDATION_OPTIONS: ApiKeyValidationOptions = {
  testConnectivity: true,
  validateRegion: true,
  checkQuota: false,
  timeout: 10000,
  skipCache: false,
};

/**
 * Validation result cache
 */
const validationCache = new Map<string, { result: CredentialValidationResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Create authentication error
 */
function createAuthError(
  type: AuthenticationErrorType,
  message: string,
  statusCode?: number,
  retryable: boolean = false,
  retryAfter?: number,
): AuthenticationError {
  return {
    type,
    message,
    retryable,
    timestamp: new Date(),
    details: {},
    ...(statusCode !== undefined && { statusCode }),
    ...(retryAfter !== undefined && { retryAfter }),
  };
}

/**
 * Validate subscription key format
 */
function validateSubscriptionKeyFormat(subscriptionKey: string): AuthenticationError[] {
  const errors: AuthenticationError[] = [];

  if (!subscriptionKey) {
    errors.push(createAuthError('INVALID_SUBSCRIPTION_KEY', 'Subscription key is required'));
    return errors;
  }

  if (typeof subscriptionKey !== 'string') {
    errors.push(createAuthError('INVALID_SUBSCRIPTION_KEY', 'Subscription key must be a string'));
    return errors;
  }

  // Azure subscription keys are typically 32-character hex strings
  if (subscriptionKey.length !== 32) {
    errors.push(createAuthError('INVALID_SUBSCRIPTION_KEY', 'Subscription key should be 32 characters long'));
  }

  // Check if it's a valid hex string
  if (!/^[a-fA-F0-9]+$/.test(subscriptionKey)) {
    errors.push(
      createAuthError('INVALID_SUBSCRIPTION_KEY', 'Subscription key should contain only hexadecimal characters'),
    );
  }

  return errors;
}

/**
 * Validate region availability
 */
function validateRegion(region: string): AuthenticationError[] {
  const errors: AuthenticationError[] = [];

  if (!region) {
    errors.push(createAuthError('INVALID_REGION', 'Region is required'));
    return errors;
  }

  if (!(region in AZURE_SPEECH_ENDPOINTS)) {
    errors.push(
      createAuthError(
        'INVALID_REGION',
        `Invalid region '${region}'. Supported regions: ${Object.keys(AZURE_SPEECH_ENDPOINTS).join(', ')}`,
      ),
    );
  }

  return errors;
}

/**
 * Test connectivity to Azure Speech Service
 */
async function testConnectivity(
  subscriptionKey: string,
  region: AzureRegion,
  timeout: number,
): Promise<{ success: boolean; error?: AuthenticationError; responseTime?: number }> {
  const startTime = Date.now();
  const endpoint = AZURE_SPEECH_ENDPOINTS[region];

  if (!endpoint) {
    return {
      success: false,
      error: createAuthError('INVALID_REGION', `No endpoint found for region: ${region}`),
    };
  }

  // Create a minimal request to test authentication
  const testUrl = `${endpoint}/speechtotext/v3.0/endpoints`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return { success: true, responseTime };
    }

    // Handle specific HTTP status codes
    let errorType: AuthenticationErrorType;
    let message: string;
    let retryable = false;

    switch (response.status) {
      case 401:
        errorType = 'UNAUTHORIZED';
        message = 'Invalid subscription key or insufficient permissions';
        break;
      case 403:
        errorType = 'FORBIDDEN';
        message = 'Access denied. Check subscription key and region configuration';
        break;
      case 429:
        errorType = 'QUOTA_EXCEEDED';
        message = 'API quota exceeded. Try again later';
        retryable = true;
        break;
      case 503:
        errorType = 'SERVICE_UNAVAILABLE';
        message = 'Azure Speech Service temporarily unavailable';
        retryable = true;
        break;
      default:
        errorType = 'NETWORK_ERROR';
        message = `HTTP ${response.status}: ${response.statusText}`;
        retryable = response.status >= 500;
    }

    return {
      success: false,
      error: createAuthError(errorType, message, response.status, retryable),
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: createAuthError('TIMEOUT', `Request timed out after ${timeout}ms`, undefined, true),
        responseTime,
      };
    }

    return {
      success: false,
      error: createAuthError(
        'NETWORK_ERROR',
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        true,
      ),
      responseTime,
    };
  }
}

/**
 * Check quota information
 */
async function checkQuota(
  subscriptionKey: string,
  region: AzureRegion,
  timeout: number,
): Promise<{ usage?: number; limit?: number; resetPeriod?: string; error?: AuthenticationError }> {
  const endpoint = AZURE_SPEECH_ENDPOINTS[region];

  if (!endpoint) {
    return {
      error: createAuthError('INVALID_REGION', `No endpoint found for region: ${region}`),
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Note: This is a simplified quota check. In a real implementation,
    // you would need to use the appropriate Azure billing/usage API
    const response = await fetch(`${endpoint}/speechtotext/v3.0/usage`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        usage: data.usage || 0,
        limit: data.limit || 1000000,
        resetPeriod: data.resetPeriod || 'monthly',
      };
    }

    // If quota endpoint is not available, return empty result
    return {};
  } catch (error) {
    // Quota check is optional, so we don't fail validation if it fails
    return {
      error: createAuthError(
        'NETWORK_ERROR',
        `Failed to check quota: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ),
    };
  }
}

/**
 * Generate cache key for validation results
 */
function getCacheKey(config: AuthConfig, options: ApiKeyValidationOptions): string {
  const key = `${config.subscriptionKey}-${config.region}-${JSON.stringify(options)}`;
  return btoa(key).replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Get cached validation result
 */
function getCachedResult(cacheKey: string): CredentialValidationResult | null {
  const cached = validationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  if (cached) {
    validationCache.delete(cacheKey);
  }

  return null;
}

/**
 * Cache validation result
 */
function cacheResult(cacheKey: string, result: CredentialValidationResult): void {
  validationCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
  });

  // Clean up old cache entries
  if (validationCache.size > 100) {
    const oldEntries = Array.from(validationCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, validationCache.size - 100);

    oldEntries.forEach(([key]) => validationCache.delete(key));
  }
}

/**
 * Azure Speech API credential validator
 */
export class CredentialValidator {
  /**
   * Validate Azure Speech API credentials
   */
  static async validateCredentials(
    config: AuthConfig,
    options: Partial<ApiKeyValidationOptions> = {},
  ): Promise<CredentialValidationResult> {
    const validationOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
    const cacheKey = getCacheKey(config, validationOptions);

    // Check cache if not skipped
    if (!validationOptions.skipCache) {
      const cached = getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const errors: AuthenticationError[] = [];
    const warnings: string[] = [];
    const validatedAt = new Date();

    // Validate subscription key format
    errors.push(...validateSubscriptionKeyFormat(config.subscriptionKey));

    // Validate region
    const regionErrors = validateRegion(config.region);
    errors.push(...regionErrors);

    // If basic validation failed, return early
    if (errors.length > 0) {
      const result: CredentialValidationResult = {
        isValid: false,
        errors,
        warnings,
        validatedAt,
      };

      cacheResult(cacheKey, result);
      return result;
    }

    let validatedRegion: AzureRegion | undefined;

    // Test connectivity if requested
    if (validationOptions.testConnectivity) {
      const connectivityResult = await testConnectivity(
        config.subscriptionKey,
        config.region as AzureRegion,
        validationOptions.timeout,
      );

      if (!connectivityResult.success && connectivityResult.error) {
        errors.push(connectivityResult.error);
      } else if (connectivityResult.success) {
        validatedRegion = config.region as AzureRegion;

        if (connectivityResult.responseTime && connectivityResult.responseTime > 5000) {
          warnings.push(`Slow response time: ${connectivityResult.responseTime}ms`);
        }
      }
    }

    // Check quota if requested
    let quotaInfo;
    if (validationOptions.checkQuota && validatedRegion) {
      const quotaResult = await checkQuota(config.subscriptionKey, validatedRegion, validationOptions.timeout);

      if (quotaResult.error) {
        warnings.push(`Quota check failed: ${quotaResult.error.message}`);
      } else {
        quotaInfo = {
          usage: quotaResult.usage || 0,
          limit: quotaResult.limit || 1000000,
          resetPeriod: quotaResult.resetPeriod || 'monthly',
        };

        // Warn if usage is high
        if (quotaInfo.usage / quotaInfo.limit > 0.8) {
          warnings.push(
            `High quota usage: ${quotaInfo.usage}/${quotaInfo.limit} (${Math.round((quotaInfo.usage / quotaInfo.limit) * 100)}%)`,
          );
        }
      }
    }

    // Additional validation warnings
    if (config.endpoint) {
      try {
        new URL(config.endpoint);
      } catch {
        warnings.push('Custom endpoint URL format appears invalid');
      }
    }

    if (config.tokenRefreshInterval && config.tokenRefreshInterval < 300000) {
      warnings.push('Token refresh interval is very short (< 5 minutes)');
    }

    const result: CredentialValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedAt,
      ...(validatedRegion && { validatedRegion }),
      ...(quotaInfo && { quotaInfo }),
    };

    // Cache successful validations
    if (result.isValid) {
      cacheResult(cacheKey, result);
    }

    return result;
  }

  /**
   * Perform health check on Azure Speech Service
   */
  static async healthCheck(config: AuthConfig, timeout: number = 10000): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const endpoints: HealthCheckResult['endpoints'] = [];
    const errors: AuthenticationError[] = [];

    const baseEndpoint = AZURE_SPEECH_ENDPOINTS[config.region as AzureRegion];
    if (!baseEndpoint) {
      errors.push(createAuthError('INVALID_REGION', `No endpoint found for region: ${config.region}`));

      return {
        isHealthy: false,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        endpoints,
        serviceStatus: 'outage',
        errors,
      };
    }

    // Test multiple endpoints
    const testEndpoints = [`${baseEndpoint}/speechtotext/v3.0/endpoints`, `${baseEndpoint}/speechtotext/v3.0/models`];

    const endpointResults = await Promise.allSettled(
      testEndpoints.map(async url => {
        const endpointStartTime = Date.now();

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Ocp-Apim-Subscription-Key': config.subscriptionKey,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const responseTime = Date.now() - endpointStartTime;

          return {
            url,
            status: response.ok ? 'healthy' : 'unhealthy',
            responseTime,
          } as const;
        } catch (error) {
          const responseTime = Date.now() - endpointStartTime;

          return {
            url,
            status: 'timeout' as const,
            responseTime,
          };
        }
      }),
    );

    // Process endpoint results
    endpointResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        endpoints.push(result.value);
      } else {
        endpoints.push({
          url: testEndpoints[index] || '',
          status: 'unhealthy',
          responseTime: timeout,
        });

        errors.push(
          createAuthError('NETWORK_ERROR', `Health check failed for ${testEndpoints[index]}: ${result.reason}`),
        );
      }
    });

    const healthyEndpoints = endpoints.filter(ep => ep.status === 'healthy').length;
    const totalEndpoints = endpoints.length;

    let serviceStatus: HealthCheckResult['serviceStatus'];
    let isHealthy: boolean;

    if (healthyEndpoints === totalEndpoints) {
      serviceStatus = 'operational';
      isHealthy = true;
    } else if (healthyEndpoints > 0) {
      serviceStatus = 'degraded';
      isHealthy = true;
    } else {
      serviceStatus = 'outage';
      isHealthy = false;
    }

    const averageResponseTime = endpoints.reduce((sum, ep) => sum + ep.responseTime, 0) / endpoints.length;

    return {
      isHealthy,
      responseTime: averageResponseTime,
      timestamp: new Date(),
      endpoints,
      serviceStatus,
      errors,
    };
  }

  /**
   * Clear validation cache
   */
  static clearCache(): void {
    validationCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; hitRate: number } {
    return {
      size: validationCache.size,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
    };
  }
}
