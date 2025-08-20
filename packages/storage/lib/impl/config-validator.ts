/**
 * Configuration Validation Service
 * Implements Azure API configuration validation with
 * real-time validation and connectivity testing for config integrity.
 */

import type {
  SecureConfigRecord,
  ValidationResult,
  ValidationTest,
  ValidationIssue,
  UserPreferences,
} from '../types/config';

/**
 * Validation test configuration
 */
export interface ValidationConfig {
  /** Enable network connectivity tests */
  enableConnectivityTests: boolean;
  /** Timeout for network tests in milliseconds */
  networkTimeout: number;
  /** Enable real-time validation */
  enableRealTimeValidation: boolean;
  /** Validation cache duration in minutes */
  cacheValidationResults: number;
  /** Maximum concurrent validation operations */
  maxConcurrentValidations: number;
}

/**
 * Network test result
 */
export interface NetworkTestResult {
  /** Whether the test passed */
  success: boolean;
  /** Response time in milliseconds */
  responseTime: number;
  /** HTTP status code */
  statusCode?: number;
  /** Error message if test failed */
  error?: string;
  /** Additional test metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration validation service
 */
export class ConfigValidator {
  private validationConfig: ValidationConfig;
  private validationCache: Map<string, { result: ValidationResult; expires: number }> = new Map();
  private ongoingValidations: Map<string, Promise<ValidationResult>> = new Map();

  constructor(config: Partial<ValidationConfig> = {}) {
    this.validationConfig = {
      enableConnectivityTests: true,
      networkTimeout: 10000, // 10 seconds
      enableRealTimeValidation: true,
      cacheValidationResults: 5, // 5 minutes
      maxConcurrentValidations: 3,
      ...config,
    };
  }

  /**
   * Validate complete configuration
   */
  public async validateConfiguration(config: SecureConfigRecord): Promise<ValidationResult> {
    const startTime = Date.now();
    const configHash = this.generateConfigHash(config);

    // Check cache first
    if (this.validationConfig.cacheValidationResults > 0) {
      const cached = this.validationCache.get(configHash);
      if (cached && cached.expires > Date.now()) {
        return cached.result;
      }
    }

    // Check if validation is already in progress
    if (this.ongoingValidations.has(configHash)) {
      return this.ongoingValidations.get(configHash)!;
    }

    // Start new validation
    const validationPromise = this.performValidation(config, startTime);
    this.ongoingValidations.set(configHash, validationPromise);

    try {
      const result = await validationPromise;

      // Cache result
      if (this.validationConfig.cacheValidationResults > 0) {
        this.validationCache.set(configHash, {
          result,
          expires: Date.now() + this.validationConfig.cacheValidationResults * 60 * 1000,
        });
      }

      return result;
    } finally {
      this.ongoingValidations.delete(configHash);
    }
  }

  /**
   * Validate specific configuration field
   */
  public async validateField(
    fieldName: keyof SecureConfigRecord,
    value: unknown,
    context?: Partial<SecureConfigRecord>,
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    switch (fieldName) {
      case 'encryptedApiKey':
        issues.push(...this.validateApiKey(value as string));
        break;
      case 'serviceRegion':
        issues.push(...this.validateRegion(value as string));
        break;
      case 'endpoint':
        issues.push(...this.validateEndpoint(value as string, context?.serviceRegion));
        break;
      case 'language':
        issues.push(...this.validateLanguage(value as string));
        break;
      case 'preferences':
        issues.push(...this.validatePreferences(value as UserPreferences));
        break;
      default:
        // No specific validation for other fields
        break;
    }

    return issues;
  }

  /**
   * Test Azure Speech API connectivity
   */
  public async testConnectivity(endpoint: string, apiKey: string, region: string): Promise<NetworkTestResult> {
    if (!this.validationConfig.enableConnectivityTests) {
      return {
        success: false,
        responseTime: 0,
        error: 'Connectivity tests are disabled',
      };
    }

    const startTime = Date.now();

    try {
      // Construct Azure Speech API test endpoint
      const testUrl = this.buildTestEndpoint(endpoint, region);

      // Create test request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.validationConfig.networkTimeout);

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      return {
        success: response.ok,
        responseTime,
        statusCode: response.status,
        metadata: {
          headers: Object.fromEntries(response.headers.entries()),
          url: testUrl,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          responseTime,
          error: `Request timeout after ${this.validationConfig.networkTimeout}ms`,
        };
      }

      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get validation recommendations
   */
  public getValidationRecommendations(config: SecureConfigRecord): string[] {
    const recommendations: string[] = [];

    // Check API key security
    if (config.encryptedApiKey && config.encryptedApiKey.length < 32) {
      recommendations.push('Consider using a more secure API key with sufficient length');
    }

    // Check region optimization
    if (config.serviceRegion) {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const userRegion = this.getRegionFromTimezone(userTimezone);
      if (userRegion && config.serviceRegion !== userRegion) {
        recommendations.push(`Consider using region '${userRegion}' for better performance based on your location`);
      }
    }

    // Check preferences optimization
    if (config.preferences) {
      if (config.preferences.cacheRetentionDays > 30) {
        recommendations.push('Consider reducing cache retention days to save storage space');
      }

      if (config.preferences.confidenceThreshold < 0.7) {
        recommendations.push('Consider increasing confidence threshold for better transcription quality');
      }
    }

    // Check key rotation
    if (config.encryptionMetadata && config.encryptionMetadata.keyRotation) {
      const nextRotation = new Date(config.encryptionMetadata.keyRotation.nextRotation);
      const daysUntilRotation = (nextRotation.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

      if (daysUntilRotation < 7) {
        recommendations.push('Your encryption key will expire soon. Consider rotating it proactively.');
      }
    }

    return recommendations;
  }

  /**
   * Perform complete validation
   */
  private async performValidation(config: SecureConfigRecord, startTime: number): Promise<ValidationResult> {
    const tests: ValidationTest[] = [];
    const issues: ValidationIssue[] = [];
    let score = 0;
    const maxScore = 6; // Total number of validation categories

    // 1. API Key validation
    const apiKeyTest = await this.runApiKeyValidation(config.encryptedApiKey);
    tests.push(apiKeyTest);
    if (apiKeyTest.status === 'passed') score += 1;

    // 2. Region validation
    const regionTest = this.runRegionValidation(config.serviceRegion);
    tests.push(regionTest);
    if (regionTest.status === 'passed') score += 1;

    // 3. Endpoint validation
    const endpointTest = this.runEndpointValidation(config.endpoint, config.serviceRegion);
    tests.push(endpointTest);
    if (endpointTest.status === 'passed') score += 1;

    // 4. Language validation
    const languageTest = this.runLanguageValidation(config.language);
    tests.push(languageTest);
    if (languageTest.status === 'passed') score += 1;

    // 5. Preferences validation
    const preferencesTest = this.runPreferencesValidation(config.preferences);
    tests.push(preferencesTest);
    if (preferencesTest.status === 'passed') score += 1;

    // 6. Connectivity test (if enabled)
    let connectivityTest: ValidationTest;
    if (this.validationConfig.enableConnectivityTests && config.encryptedApiKey) {
      connectivityTest = await this.runConnectivityTest(config.endpoint, config.encryptedApiKey, config.serviceRegion);
      tests.push(connectivityTest);
      if (connectivityTest.status === 'passed') score += 1;
    } else {
      connectivityTest = {
        testId: 'connectivity-test',
        name: 'Connectivity Test',
        status: 'skipped',
        duration: 0,
        message: 'Connectivity tests are disabled',
      };
      tests.push(connectivityTest);
    }

    // Collect issues from all tests
    tests.forEach(test => {
      if (test.error) {
        issues.push({
          severity: test.status === 'failed' ? 'error' : 'warning',
          code: test.error.code,
          message: test.error.message,
          field: this.getFieldFromTestId(test.testId),
          resolution: this.getResolutionForTest(test.testId),
        });
      }
    });

    // Calculate final score
    const finalScore = score / maxScore;
    const _totalDuration = Date.now() - startTime;

    // Determine overall status
    let status: ValidationResult['status'];
    if (finalScore >= 0.9) {
      status = 'valid';
    } else if (finalScore >= 0.7) {
      status = 'pending'; // Good but needs minor fixes
    } else if (finalScore >= 0.5) {
      status = 'invalid'; // Has issues but recoverable
    } else {
      status = 'invalid'; // Major issues
    }

    const now = new Date().toISOString();

    return {
      status,
      tests,
      score: finalScore,
      issues,
      validatedAt: now,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      performance: {
        responseTime: connectivityTest.status === 'passed' ? connectivityTest.duration : 0,
        successRate: finalScore,
        serviceAvailable: connectivityTest.status === 'passed',
      },
    };
  }

  /**
   * API Key validation
   */
  private async runApiKeyValidation(apiKey: string): Promise<ValidationTest> {
    const startTime = Date.now();

    try {
      const issues = this.validateApiKey(apiKey);
      const duration = Date.now() - startTime;

      if (issues.length === 0) {
        return {
          testId: 'api-key-validation',
          name: 'API Key Validation',
          status: 'passed',
          duration,
          message: 'API key format is valid',
        };
      } else {
        return {
          testId: 'api-key-validation',
          name: 'API Key Validation',
          status: 'failed',
          duration,
          message: 'API key validation failed',
          error: {
            code: issues[0]?.code ?? 'UNKNOWN_ERROR',
            message: issues[0]?.message ?? 'Unknown validation error',
          },
        };
      }
    } catch (error) {
      return {
        testId: 'api-key-validation',
        name: 'API Key Validation',
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Region validation
   */
  private runRegionValidation(region: string): ValidationTest {
    const startTime = Date.now();

    try {
      const issues = this.validateRegion(region);
      const duration = Date.now() - startTime;

      if (issues.length === 0) {
        return {
          testId: 'region-validation',
          name: 'Region Validation',
          status: 'passed',
          duration,
          message: 'Region is valid',
        };
      } else {
        return {
          testId: 'region-validation',
          name: 'Region Validation',
          status: 'failed',
          duration,
          message: 'Region validation failed',
          error: {
            code: issues[0]?.code ?? 'UNKNOWN_ERROR',
            message: issues[0]?.message ?? 'Unknown validation error',
          },
        };
      }
    } catch (error) {
      return {
        testId: 'region-validation',
        name: 'Region Validation',
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Endpoint validation
   */
  private runEndpointValidation(endpoint: string, region?: string): ValidationTest {
    const startTime = Date.now();

    try {
      const issues = this.validateEndpoint(endpoint, region);
      const duration = Date.now() - startTime;

      if (issues.length === 0) {
        return {
          testId: 'endpoint-validation',
          name: 'Endpoint Validation',
          status: 'passed',
          duration,
          message: 'Endpoint is valid',
        };
      } else {
        const severity = issues.some(i => i.severity === 'error') ? 'failed' : 'warning';
        return {
          testId: 'endpoint-validation',
          name: 'Endpoint Validation',
          status: severity,
          duration,
          message: 'Endpoint validation completed with issues',
          error: {
            code: issues[0]?.code ?? 'UNKNOWN_ERROR',
            message: issues[0]?.message ?? 'Unknown validation error',
          },
        };
      }
    } catch (error) {
      return {
        testId: 'endpoint-validation',
        name: 'Endpoint Validation',
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Language validation
   */
  private runLanguageValidation(language: string): ValidationTest {
    const startTime = Date.now();

    try {
      const issues = this.validateLanguage(language);
      const duration = Date.now() - startTime;

      if (issues.length === 0) {
        return {
          testId: 'language-validation',
          name: 'Language Validation',
          status: 'passed',
          duration,
          message: 'Language code is valid',
        };
      } else {
        return {
          testId: 'language-validation',
          name: 'Language Validation',
          status: 'warning',
          duration,
          message: 'Language validation completed with warnings',
          error: {
            code: issues[0]?.code ?? 'UNKNOWN_ERROR',
            message: issues[0]?.message ?? 'Unknown validation error',
          },
        };
      }
    } catch (error) {
      return {
        testId: 'language-validation',
        name: 'Language Validation',
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Preferences validation
   */
  private runPreferencesValidation(preferences: UserPreferences): ValidationTest {
    const startTime = Date.now();

    try {
      const issues = this.validatePreferences(preferences);
      const duration = Date.now() - startTime;

      if (issues.length === 0) {
        return {
          testId: 'preferences-validation',
          name: 'Preferences Validation',
          status: 'passed',
          duration,
          message: 'Preferences are valid',
        };
      } else {
        return {
          testId: 'preferences-validation',
          name: 'Preferences Validation',
          status: 'warning',
          duration,
          message: 'Some preferences have issues',
          error: {
            code: issues[0]?.code ?? 'UNKNOWN_ERROR',
            message: issues[0]?.message ?? 'Unknown validation error',
          },
        };
      }
    } catch (error) {
      return {
        testId: 'preferences-validation',
        name: 'Preferences Validation',
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Connectivity test
   */
  private async runConnectivityTest(endpoint: string, apiKey: string, region: string): Promise<ValidationTest> {
    const startTime = Date.now();

    try {
      const testResult = await this.testConnectivity(endpoint, apiKey, region);
      const duration = Date.now() - startTime;

      if (testResult.success) {
        return {
          testId: 'connectivity-test',
          name: 'Connectivity Test',
          status: 'passed',
          duration,
          message: `Successfully connected to Azure Speech API (${testResult.responseTime}ms)`,
          result: testResult,
        };
      } else {
        return {
          testId: 'connectivity-test',
          name: 'Connectivity Test',
          status: 'failed',
          duration,
          message: 'Failed to connect to Azure Speech API',
          error: {
            code: 'CONNECTIVITY_FAILED',
            message: testResult.error || 'Unknown connectivity error',
            details: testResult,
          },
        };
      }
    } catch (error) {
      return {
        testId: 'connectivity-test',
        name: 'Connectivity Test',
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          code: 'CONNECTIVITY_TEST_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Validate API key format and security
   */
  private validateApiKey(apiKey: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!apiKey) {
      issues.push({
        severity: 'error',
        code: 'MISSING_API_KEY',
        message: 'API key is required',
        field: 'encryptedApiKey',
        resolution: 'Provide a valid Azure Speech Service subscription key',
      });
      return issues;
    }

    if (apiKey.length < 16) {
      issues.push({
        severity: 'error',
        code: 'INVALID_API_KEY_LENGTH',
        message: 'API key appears to be too short',
        field: 'encryptedApiKey',
        resolution: 'Verify the API key is complete and correctly copied',
      });
    }

    // Check for common placeholder values
    const placeholders = ['your-api-key', 'insert-key-here', 'api-key', 'subscription-key'];
    if (placeholders.some(placeholder => apiKey.toLowerCase().includes(placeholder))) {
      issues.push({
        severity: 'error',
        code: 'PLACEHOLDER_API_KEY',
        message: 'API key appears to be a placeholder value',
        field: 'encryptedApiKey',
        resolution: 'Replace with your actual Azure Speech Service subscription key',
      });
    }

    return issues;
  }

  /**
   * Validate Azure region
   */
  private validateRegion(region: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!region) {
      issues.push({
        severity: 'error',
        code: 'MISSING_REGION',
        message: 'Region is required',
        field: 'region',
        resolution: 'Specify a valid Azure region (e.g., eastus, westeurope)',
      });
      return issues;
    }

    // List of valid Azure regions for Speech Services
    const validRegions = [
      'eastus',
      'eastus2',
      'westus',
      'westus2',
      'centralus',
      'northcentralus',
      'southcentralus',
      'westcentralus',
      'canadacentral',
      'canadaeast',
      'brazilsouth',
      'northeurope',
      'westeurope',
      'uksouth',
      'ukwest',
      'francecentral',
      'francesouth',
      'germanywestcentral',
      'norwayeast',
      'switzerlandnorth',
      'uaenorth',
      'southafricanorth',
      'centralindia',
      'southindia',
      'westindia',
      'eastasia',
      'southeastasia',
      'japaneast',
      'japanwest',
      'koreacentral',
      'koreasouth',
      'australiaeast',
      'australiasoutheast',
    ];

    if (!validRegions.includes(region.toLowerCase())) {
      issues.push({
        severity: 'warning',
        code: 'UNKNOWN_REGION',
        message: `Region '${region}' is not in the list of known Azure regions`,
        field: 'region',
        resolution: 'Verify the region name with Azure portal or documentation',
      });
    }

    return issues;
  }

  /**
   * Validate endpoint URL
   */
  private validateEndpoint(endpoint: string, region?: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!endpoint) {
      issues.push({
        severity: 'error',
        code: 'MISSING_ENDPOINT',
        message: 'Endpoint URL is required',
        field: 'endpoint',
        resolution: 'Provide the Azure Speech Service endpoint URL',
      });
      return issues;
    }

    // Check URL format
    try {
      const url = new URL(endpoint);

      if (url.protocol !== 'https:') {
        issues.push({
          severity: 'error',
          code: 'INSECURE_ENDPOINT',
          message: 'Endpoint must use HTTPS protocol',
          field: 'endpoint',
          resolution: 'Use an HTTPS endpoint URL',
        });
      }

      // Check if it looks like an Azure Cognitive Services endpoint
      if (!url.hostname.includes('cognitiveservices.azure.com')) {
        issues.push({
          severity: 'warning',
          code: 'SUSPICIOUS_ENDPOINT',
          message: 'Endpoint does not appear to be an Azure Cognitive Services URL',
          field: 'endpoint',
          resolution: 'Verify the endpoint URL with your Azure portal',
        });
      }

      // Check region consistency
      if (region && !url.hostname.includes(region)) {
        issues.push({
          severity: 'warning',
          code: 'REGION_MISMATCH',
          message: 'Endpoint region does not match specified region',
          field: 'endpoint',
          resolution: 'Ensure endpoint and region settings are consistent',
        });
      }
    } catch (_error) {
      issues.push({
        severity: 'error',
        code: 'INVALID_ENDPOINT_URL',
        message: 'Endpoint is not a valid URL',
        field: 'endpoint',
        resolution: 'Provide a valid URL format (https://...)',
      });
    }

    return issues;
  }

  /**
   * Validate language code
   */
  private validateLanguage(language: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!language) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_LANGUAGE',
        message: 'Language code is not specified',
        field: 'language',
        resolution: 'Specify a language code (e.g., en-US, zh-TW)',
      });
      return issues;
    }

    // Common language codes supported by Azure Speech
    const supportedLanguages = [
      'en-US',
      'en-GB',
      'en-AU',
      'en-CA',
      'en-IN',
      'zh-CN',
      'zh-TW',
      'zh-HK',
      'ja-JP',
      'ko-KR',
      'fr-FR',
      'fr-CA',
      'de-DE',
      'es-ES',
      'es-MX',
      'pt-BR',
      'it-IT',
      'ru-RU',
      'ar-EG',
      'hi-IN',
      'th-TH',
      'vi-VN',
    ];

    if (!supportedLanguages.includes(language)) {
      issues.push({
        severity: 'info',
        code: 'UNCOMMON_LANGUAGE',
        message: `Language '${language}' may not be supported or needs verification`,
        field: 'language',
        resolution: 'Check Azure Speech Services documentation for supported languages',
      });
    }

    return issues;
  }

  /**
   * Validate user preferences
   */
  private validatePreferences(preferences: UserPreferences): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!preferences) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_PREFERENCES',
        message: 'User preferences are not configured',
        field: 'preferences',
        resolution: 'Configure user preferences for optimal experience',
      });
      return issues;
    }

    // Validate cache retention
    if (preferences.cacheRetentionDays < 1 || preferences.cacheRetentionDays > 365) {
      issues.push({
        severity: 'warning',
        code: 'INVALID_CACHE_RETENTION',
        message: 'Cache retention days should be between 1 and 365',
        field: 'preferences.cacheRetentionDays',
        resolution: 'Set cache retention between 1-365 days',
      });
    }

    // Validate storage usage threshold
    if (preferences.maxStorageUsage < 0.1 || preferences.maxStorageUsage > 1) {
      issues.push({
        severity: 'warning',
        code: 'INVALID_STORAGE_THRESHOLD',
        message: 'Storage usage threshold should be between 0.1 and 1.0',
        field: 'preferences.maxStorageUsage',
        resolution: 'Set storage threshold between 10% and 100%',
      });
    }

    // Validate confidence threshold
    if (preferences.confidenceThreshold < 0 || preferences.confidenceThreshold > 1) {
      issues.push({
        severity: 'warning',
        code: 'INVALID_CONFIDENCE_THRESHOLD',
        message: 'Confidence threshold should be between 0 and 1',
        field: 'preferences.confidenceThreshold',
        resolution: 'Set confidence threshold between 0 and 1',
      });
    }

    return issues;
  }

  /**
   * Build test endpoint URL
   */
  private buildTestEndpoint(endpoint: string, region: string): string {
    try {
      const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
      return `${baseUrl}/speechtotext/v3.0/endpoints`;
    } catch {
      // Fallback to region-based URL
      return `https://${region}.api.cognitive.microsoft.com/speechtotext/v3.0/endpoints`;
    }
  }

  /**
   * Get region from timezone (rough approximation)
   */
  private getRegionFromTimezone(timezone: string): string | null {
    const regionMap: Record<string, string> = {
      'America/New_York': 'eastus',
      'America/Chicago': 'centralus',
      'America/Denver': 'westus2',
      'America/Los_Angeles': 'westus',
      'Europe/London': 'uksouth',
      'Europe/Paris': 'francecentral',
      'Europe/Berlin': 'germanywestcentral',
      'Europe/Amsterdam': 'westeurope',
      'Asia/Tokyo': 'japaneast',
      'Asia/Seoul': 'koreacentral',
      'Asia/Shanghai': 'eastasia',
      'Asia/Singapore': 'southeastasia',
      'Australia/Sydney': 'australiaeast',
    };

    return regionMap[timezone] || null;
  }

  /**
   * Generate configuration hash for caching
   */
  private generateConfigHash(config: SecureConfigRecord): string {
    const hashData = {
      region: config.serviceRegion,
      endpoint: config.endpoint,
      language: config.language,
      // Don't include API key in hash for security
      version: config.configVersion,
    };

    return btoa(JSON.stringify(hashData)).substring(0, 16);
  }

  /**
   * Get field name from test ID
   */
  private getFieldFromTestId(testId: string): string {
    const fieldMap: Record<string, string> = {
      'api-key-validation': 'encryptedApiKey',
      'region-validation': 'region',
      'endpoint-validation': 'endpoint',
      'language-validation': 'language',
      'preferences-validation': 'preferences',
      'connectivity-test': 'endpoint',
    };

    return fieldMap[testId] || '';
  }

  /**
   * Get resolution advice for test
   */
  private getResolutionForTest(testId: string): string {
    const resolutionMap: Record<string, string> = {
      'api-key-validation': 'Verify your Azure Speech Service subscription key',
      'region-validation': 'Check the Azure region name in your portal',
      'endpoint-validation': 'Verify the service endpoint URL',
      'language-validation': 'Check supported language codes in Azure documentation',
      'preferences-validation': 'Review and adjust your preferences settings',
      'connectivity-test': 'Check your internet connection and API credentials',
    };

    return resolutionMap[testId] || 'Review the configuration setting';
  }

  /**
   * Clear validation cache
   */
  public clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.validationCache.size,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
    };
  }
}
