/**
 * Regional Compatibility Handler
 * Implements international deployment and localization support for multi-language content detection
 */

// import { versionHandler } from './version-handler';
import type { MeetingDetection, DetectionConfig } from '../types/index';
import type { TenantRegion, TenantInfo } from '../types/tenant';

/**
 * Regional compatibility and localization support for SharePoint deployments
 */
export class RegionalHandler {
  private regionalConfigs: Map<TenantRegion, RegionalConfig> = new Map();
  private localizationCache: Map<string, LocalizationData> = new Map();
  private detectionPatterns: Map<string, LocalizedPattern[]> = new Map();

  constructor() {
    this.initializeRegionalConfigs();
    this.setupLocalizationPatterns();
  }

  /**
   * Detect tenant region from URL and content
   */
  async detectRegion(url: string, document: Document): Promise<RegionDetectionResult> {
    const urlBasedRegion = this.detectRegionFromUrl(url);
    const contentBasedRegion = await this.detectRegionFromContent(document);
    const languageBasedRegion = this.detectRegionFromLanguage(document);

    // Combine detection methods with confidence scoring
    const detectionResults = [
      { region: urlBasedRegion.region, confidence: urlBasedRegion.confidence, method: 'url' },
      { region: contentBasedRegion.region, confidence: contentBasedRegion.confidence, method: 'content' },
      { region: languageBasedRegion.region, confidence: languageBasedRegion.confidence, method: 'language' },
    ].filter(result => result.region !== 'unknown');

    if (detectionResults.length === 0) {
      return {
        region: 'unknown',
        confidence: 0,
        detectionMethod: 'none',
        supportedLanguages: ['en'],
        timeZone: 'UTC',
        dateFormat: 'en-US',
        currency: 'USD',
      };
    }

    // Find highest confidence result
    const bestResult = detectionResults.reduce((best, current) =>
      current.confidence > best.confidence ? current : best,
    );

    const regionalConfig = this.getRegionalConfig(bestResult.region);

    return {
      region: bestResult.region,
      confidence: bestResult.confidence,
      detectionMethod: bestResult.method,
      supportedLanguages: regionalConfig.supportedLanguages,
      timeZone: regionalConfig.defaultTimeZone,
      dateFormat: regionalConfig.defaultDateFormat,
      currency: regionalConfig.defaultCurrency,
      additionalContext: {
        alternativeRegions: detectionResults.map(r => r.region).filter(r => r !== bestResult.region),
        detectionDetails: detectionResults,
      },
    };
  }

  /**
   * Get localized detection patterns for specific region/language
   */
  getLocalizedPatterns(region: TenantRegion, language: string): LocalizedPattern[] {
    const key = `${region}_${language}`;

    if (this.detectionPatterns.has(key)) {
      return this.detectionPatterns.get(key)!;
    }

    // Fallback to region default
    const regionKey = `${region}_default`;
    if (this.detectionPatterns.has(regionKey)) {
      return this.detectionPatterns.get(regionKey)!;
    }

    // Final fallback to global patterns
    return this.detectionPatterns.get('global_default') || [];
  }

  /**
   * Apply regional adaptations to detection configuration
   */
  applyRegionalAdaptations(config: DetectionConfig, region: TenantRegion, _language?: string): DetectionConfig {
    void _language;
    const regionalConfig = this.getRegionalConfig(region);
    const adaptedConfig = { ...config };

    // Adjust timeout based on regional network conditions
    adaptedConfig.timeoutMs = Math.max(config.timeoutMs, regionalConfig.minimumTimeout);

    // Apply regional custom domains
    if (regionalConfig.customDomains) {
      adaptedConfig.customDomains = [
        ...(config.customDomains || []),
        ...(regionalConfig.customDomains as Array<{
          domain: string;
          platform: string;
          settings: Record<string, unknown>;
        }>),
      ];
    }

    // Enable debug mode for regions with known issues
    if (regionalConfig.enableDebugMode) {
      adaptedConfig.debug = true;
    }

    return adaptedConfig;
  }

  /**
   * Localize meeting detection results
   */
  async localizeDetectionResult(
    detection: MeetingDetection,
    targetLanguage: string,
    region: TenantRegion,
  ): Promise<MeetingDetection> {
    const localizationData = await this.getLocalizationData(targetLanguage, region);

    if (!localizationData) {
      return detection; // Return unchanged if no localization available
    }

    const localizedDetection = { ...detection };

    // Localize metadata
    if (detection.metadata) {
      localizedDetection.metadata = {
        ...detection.metadata,
        title: await this.localizeText(detection.metadata.title, localizationData),
        topics: await Promise.all(detection.metadata.topics.map(topic => this.localizeText(topic, localizationData))),
      };

      // Format dates according to regional settings
      if (detection.metadata.date) {
        const regionalConfig = this.getRegionalConfig(region);
        localizedDetection.metadata.date = this.formatDateForRegion(
          detection.metadata.date,
          regionalConfig.defaultDateFormat,
          regionalConfig.defaultTimeZone,
        );
      }
    }

    return localizedDetection;
  }

  /**
   * Validate regional compliance
   */
  async validateRegionalCompliance(
    tenantInfo: TenantInfo,
    detectionConfig: DetectionConfig,
  ): Promise<ComplianceValidationResult> {
    const region = tenantInfo.region;
    const regionalConfig = this.getRegionalConfig(region);
    const violations: ComplianceViolation[] = [];
    const warnings: string[] = [];

    // Check data residency requirements
    if (regionalConfig.dataResidencyRequired) {
      const hasLocalEndpoints = this.validateDataResidency(tenantInfo, regionalConfig);
      if (!hasLocalEndpoints) {
        violations.push({
          type: 'data_residency',
          severity: 'high',
          description: 'Data must be processed within regional boundaries',
          recommendation: 'Configure local API endpoints',
        });
      }
    }

    // Check privacy regulations compliance
    if (regionalConfig.privacyRegulations) {
      const privacyCompliance = await this.validatePrivacyCompliance(
        detectionConfig,
        regionalConfig.privacyRegulations,
      );
      violations.push(...privacyCompliance.violations);
      warnings.push(...privacyCompliance.warnings);
    }

    // Check language requirements
    if (regionalConfig.requiredLanguages) {
      const languageSupport = this.validateLanguageSupport(tenantInfo, regionalConfig.requiredLanguages);
      if (!languageSupport.isCompliant) {
        warnings.push(`Missing support for required languages: ${languageSupport.missingLanguages.join(', ')}`);
      }
    }

    // Check security requirements
    const securityCompliance = this.validateSecurityRequirements(
      detectionConfig,
      regionalConfig.securityRequirements || [],
    );
    violations.push(...securityCompliance.violations);

    return {
      isCompliant: violations.length === 0,
      region,
      violations,
      warnings,
      recommendations: this.generateComplianceRecommendations(violations, warnings, region),
    };
  }

  /**
   * Get regional configuration for deployment optimization
   */
  getRegionalOptimizations(region: TenantRegion): RegionalOptimizations {
    const config = this.getRegionalConfig(region);

    return {
      cdnEndpoints: config.cdnEndpoints || [],
      apiEndpoints: config.apiEndpoints || {},
      cachingStrategy: config.cachingStrategy || 'standard',
      networkOptimizations: config.networkOptimizations || [],
      contentDelivery: config.contentDeliveryOptimizations || {},
    };
  }

  // Private methods

  private initializeRegionalConfigs(): void {
    // North America
    this.regionalConfigs.set('north_america', {
      region: 'north_america',
      supportedLanguages: ['en', 'es', 'fr'],
      defaultLanguage: 'en',
      defaultTimeZone: 'America/New_York',
      defaultDateFormat: 'MM/dd/yyyy',
      defaultCurrency: 'USD',
      domainPatterns: [/\.sharepoint\.com$/, /\.microsoftonline\.com$/, /teams\.microsoft\.com$/],
      minimumTimeout: 5000,
      dataResidencyRequired: false,
      enableDebugMode: false,
      privacyRegulations: ['CCPA'],
      securityRequirements: ['tls_1_2'],
    });

    // Europe
    this.regionalConfigs.set('europe', {
      region: 'europe',
      supportedLanguages: ['en', 'de', 'fr', 'es', 'it', 'nl', 'pt', 'pl', 'sv', 'da', 'no', 'fi'],
      defaultLanguage: 'en',
      defaultTimeZone: 'Europe/London',
      defaultDateFormat: 'dd/MM/yyyy',
      defaultCurrency: 'EUR',
      domainPatterns: [
        /\.sharepoint\.de$/,
        /\.sharepoint\.fr$/,
        /\.sharepoint\.it$/,
        /\.microsoftonline\.de$/,
        /teams\.microsoft\.de$/,
      ],
      minimumTimeout: 6000,
      dataResidencyRequired: true,
      enableDebugMode: false,
      privacyRegulations: ['GDPR', 'DPA'],
      securityRequirements: ['tls_1_3', 'gdpr_compliance'],
      requiredLanguages: ['en'],
    });

    // Asia Pacific
    this.regionalConfigs.set('asia_pacific', {
      region: 'asia_pacific',
      supportedLanguages: ['en', 'zh-cn', 'zh-tw', 'ja', 'ko', 'hi', 'th', 'vi'],
      defaultLanguage: 'en',
      defaultTimeZone: 'Asia/Singapore',
      defaultDateFormat: 'yyyy/MM/dd',
      defaultCurrency: 'USD',
      domainPatterns: [/\.sharepoint\.cn$/, /\.partner\.microsoftonline\.cn$/, /\.sharepoint\.com\.au$/],
      minimumTimeout: 8000,
      dataResidencyRequired: true,
      enableDebugMode: true, // Higher latency regions may need debugging
      privacyRegulations: ['PDPA', 'PIPEDA'],
      securityRequirements: ['tls_1_2', 'local_encryption'],
    });

    // Additional regions...
    this.setupAdditionalRegions();
  }

  private setupAdditionalRegions(): void {
    // Australia
    this.regionalConfigs.set('australia', {
      region: 'australia',
      supportedLanguages: ['en'],
      defaultLanguage: 'en',
      defaultTimeZone: 'Australia/Sydney',
      defaultDateFormat: 'dd/MM/yyyy',
      defaultCurrency: 'AUD',
      domainPatterns: [/\.sharepoint\.com\.au$/],
      minimumTimeout: 7000,
      dataResidencyRequired: true,
      enableDebugMode: false,
      privacyRegulations: ['Privacy Act'],
      securityRequirements: ['tls_1_2'],
    });

    // Canada
    this.regionalConfigs.set('canada', {
      region: 'canada',
      supportedLanguages: ['en', 'fr'],
      defaultLanguage: 'en',
      defaultTimeZone: 'America/Toronto',
      defaultDateFormat: 'yyyy-MM-dd',
      defaultCurrency: 'CAD',
      domainPatterns: [/\.sharepoint\.ca$/],
      minimumTimeout: 5000,
      dataResidencyRequired: true,
      enableDebugMode: false,
      privacyRegulations: ['PIPEDA'],
      securityRequirements: ['tls_1_2'],
    });

    // India
    this.regionalConfigs.set('india', {
      region: 'india',
      supportedLanguages: ['en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'pa'],
      defaultLanguage: 'en',
      defaultTimeZone: 'Asia/Kolkata',
      defaultDateFormat: 'dd-MM-yyyy',
      defaultCurrency: 'INR',
      domainPatterns: [/\.sharepoint\.in$/],
      minimumTimeout: 10000,
      dataResidencyRequired: true,
      enableDebugMode: false,
      privacyRegulations: ['DPDP Act'],
      securityRequirements: ['tls_1_2', 'local_storage'],
    });

    // Japan
    this.regionalConfigs.set('japan', {
      region: 'japan',
      supportedLanguages: ['ja', 'en'],
      defaultLanguage: 'ja',
      defaultTimeZone: 'Asia/Tokyo',
      defaultDateFormat: 'yyyy年MM月dd日',
      defaultCurrency: 'JPY',
      domainPatterns: [/\.sharepoint\.jp$/],
      minimumTimeout: 6000,
      dataResidencyRequired: true,
      enableDebugMode: false,
      privacyRegulations: ['APPI'],
      securityRequirements: ['tls_1_2'],
    });
  }

  private setupLocalizationPatterns(): void {
    // Global default patterns
    this.detectionPatterns.set('global_default', [
      {
        language: 'en',
        patterns: {
          meetingTitle: ['meeting', 'conference', 'call', 'session'],
          participants: ['attendees', 'participants', 'members'],
          recording: ['recording', 'video', 'audio'],
          agenda: ['agenda', 'topics', 'items'],
        },
        confidence: 0.8,
      },
    ]);

    // European patterns
    this.detectionPatterns.set('europe_de', [
      {
        language: 'de',
        patterns: {
          meetingTitle: ['besprechung', 'konferenz', 'meeting', 'sitzung'],
          participants: ['teilnehmer', 'mitglieder', 'personen'],
          recording: ['aufzeichnung', 'video', 'audio', 'mitschnitt'],
          agenda: ['tagesordnung', 'agenda', 'themen', 'punkte'],
        },
        confidence: 0.9,
      },
    ]);

    this.detectionPatterns.set('europe_fr', [
      {
        language: 'fr',
        patterns: {
          meetingTitle: ['réunion', 'conférence', 'meeting', 'session'],
          participants: ['participants', 'membres', 'attendees'],
          recording: ['enregistrement', 'vidéo', 'audio'],
          agenda: ['ordre du jour', 'agenda', 'sujets', 'points'],
        },
        confidence: 0.9,
      },
    ]);

    // Asian patterns
    this.detectionPatterns.set('asia_pacific_zh-cn', [
      {
        language: 'zh-cn',
        patterns: {
          meetingTitle: ['会议', '会话', '讨论', '会面'],
          participants: ['参会者', '与会人员', '成员'],
          recording: ['录音', '录像', '记录'],
          agenda: ['议程', '议题', '主题'],
        },
        confidence: 0.85,
      },
    ]);

    this.detectionPatterns.set('asia_pacific_ja', [
      {
        language: 'ja',
        patterns: {
          meetingTitle: ['会議', 'ミーティング', '打ち合わせ'],
          participants: ['参加者', 'メンバー', '出席者'],
          recording: ['録画', '録音', '記録'],
          agenda: ['議題', 'アジェンダ', '話題'],
        },
        confidence: 0.85,
      },
    ]);
  }

  private detectRegionFromUrl(url: string): { region: TenantRegion; confidence: number } {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      for (const [region, config] of this.regionalConfigs) {
        for (const pattern of config.domainPatterns) {
          if (pattern.test(hostname)) {
            return { region, confidence: 0.9 };
          }
        }
      }

      // Check for common regional indicators
      if (hostname.includes('.de') || hostname.includes('germany')) {
        return { region: 'europe', confidence: 0.7 };
      }
      if (hostname.includes('.jp') || hostname.includes('japan')) {
        return { region: 'japan', confidence: 0.7 };
      }
      if (hostname.includes('.au') || hostname.includes('australia')) {
        return { region: 'australia', confidence: 0.7 };
      }
      if (hostname.includes('.ca') || hostname.includes('canada')) {
        return { region: 'canada', confidence: 0.7 };
      }
    } catch {
      // Invalid URL
    }

    return { region: 'unknown', confidence: 0 };
  }

  private async detectRegionFromContent(document: Document): Promise<{ region: TenantRegion; confidence: number }> {
    // Analyze page content for regional indicators
    const content = document.body.textContent || '';

    // Check for currency symbols and formats
    const currencyPatterns = {
      ['europe']: /€|EUR|pound|£/i,
      ['north_america']: /\$|USD|dollar/i,
      ['japan']: /¥|JPY|yen/i,
      ['australia']: /AUD|A\$/i,
      ['canada']: /CAD|C\$/i,
    };

    for (const [region, pattern] of Object.entries(currencyPatterns)) {
      if (pattern.test(content)) {
        return { region: region as TenantRegion, confidence: 0.6 };
      }
    }

    // Check for time zone indicators
    const timeZonePatterns = {
      ['europe']: /CET|CEST|GMT|BST|UTC\+[01]/i,
      ['north_america']: /EST|EDT|PST|PDT|CST|CDT|MST|MDT/i,
      ['asia_pacific']: /JST|CST|IST|SGT|UTC\+[89]/i,
      ['australia']: /AEST|AEDT|AWST|ACST/i,
    };

    for (const [region, pattern] of Object.entries(timeZonePatterns)) {
      if (pattern.test(content)) {
        return { region: region as TenantRegion, confidence: 0.5 };
      }
    }

    return { region: 'unknown', confidence: 0 };
  }

  private detectRegionFromLanguage(document: Document): { region: TenantRegion; confidence: number } {
    const lang =
      document.documentElement.lang?.toLowerCase() ||
      document.querySelector('html')?.getAttribute('lang')?.toLowerCase() ||
      '';

    const languageRegionMap: Record<string, TenantRegion> = {
      de: 'europe',
      'de-de': 'europe',
      fr: 'europe',
      'fr-fr': 'europe',
      es: 'europe',
      it: 'europe',
      ja: 'japan',
      'ja-jp': 'japan',
      'zh-cn': 'asia_pacific',
      'zh-tw': 'asia_pacific',
      ko: 'asia_pacific',
      hi: 'india',
      'en-au': 'australia',
      'en-ca': 'canada',
      'fr-ca': 'canada',
    };

    if (languageRegionMap[lang]) {
      return { region: languageRegionMap[lang], confidence: 0.8 };
    }

    // Fallback to broader language families
    if (lang.startsWith('zh')) {
      return { region: 'asia_pacific', confidence: 0.6 };
    }
    if (lang.startsWith('de') || lang.startsWith('fr') || lang.startsWith('es') || lang.startsWith('it')) {
      return { region: 'europe', confidence: 0.6 };
    }

    return { region: 'unknown', confidence: 0 };
  }

  private getRegionalConfig(region: TenantRegion): RegionalConfig {
    return this.regionalConfigs.get(region) || this.getDefaultRegionalConfig();
  }

  private getDefaultRegionalConfig(): RegionalConfig {
    return {
      region: 'unknown',
      supportedLanguages: ['en'],
      defaultLanguage: 'en',
      defaultTimeZone: 'UTC',
      defaultDateFormat: 'yyyy-MM-dd',
      defaultCurrency: 'USD',
      domainPatterns: [],
      minimumTimeout: 5000,
      dataResidencyRequired: false,
      enableDebugMode: false,
    };
  }

  private async getLocalizationData(language: string, region: TenantRegion): Promise<LocalizationData | null> {
    const cacheKey = `${language}_${region}`;

    if (this.localizationCache.has(cacheKey)) {
      return this.localizationCache.get(cacheKey)!;
    }

    // In a real implementation, this would load from localization files
    // For now, return null to indicate no localization available
    return null;
  }

  private async localizeText(text: string, localizationData: LocalizationData): Promise<string> {
    // Simple localization logic - in practice this would be more sophisticated
    return localizationData.translations[text] || text;
  }

  private formatDateForRegion(date: Date, _format: string, _timeZone: string): Date {
    void _format;
    void _timeZone;
    // This would use proper date formatting libraries like date-fns or Intl
    // For now, return the original date
    return date;
  }

  private validateDataResidency(tenantInfo: TenantInfo, regionalConfig: RegionalConfig): boolean {
    // Check if tenant has local endpoints configured
    const hasLocalSharePoint = tenantInfo.sharePointConfig.rootSiteUrl.includes(
      regionalConfig.domainPatterns[0]?.source.replace(/[[\]\\^$.*+?{}|]/g, '') || '',
    );

    return hasLocalSharePoint;
  }

  private async validatePrivacyCompliance(
    config: DetectionConfig,
    regulations: string[],
  ): Promise<{ violations: ComplianceViolation[]; warnings: string[] }> {
    const violations: ComplianceViolation[] = [];
    const warnings: string[] = [];

    if (regulations.includes('GDPR')) {
      if (!config.validateUrls) {
        violations.push({
          type: 'privacy',
          severity: 'high',
          description: 'GDPR requires URL validation to prevent data leakage',
          recommendation: 'Enable URL validation in detection config',
        });
      }
    }

    return { violations, warnings };
  }

  private validateLanguageSupport(
    _tenantInfo: TenantInfo,
    _requiredLanguages: string[],
  ): { isCompliant: boolean; missingLanguages: string[] } {
    void _tenantInfo;
    void _requiredLanguages;
    // This would check if the tenant supports all required languages
    // For now, assume compliance
    return { isCompliant: true, missingLanguages: [] };
  }

  private validateSecurityRequirements(
    config: DetectionConfig,
    requirements: string[],
  ): { violations: ComplianceViolation[] } {
    const violations: ComplianceViolation[] = [];

    if (requirements.includes('tls_1_3') && config.timeoutMs < 10000) {
      violations.push({
        type: 'security',
        severity: 'medium',
        description: 'TLS 1.3 requirement may need longer timeouts',
        recommendation: 'Increase timeout to at least 10 seconds',
      });
    }

    return { violations };
  }

  private generateComplianceRecommendations(
    violations: ComplianceViolation[],
    warnings: string[],
    region: TenantRegion,
  ): string[] {
    const recommendations: string[] = [];

    violations.forEach(violation => {
      recommendations.push(violation.recommendation);
    });

    if (warnings.length > 0) {
      recommendations.push('Review configuration warnings for optimal compliance');
    }

    const regionalConfig = this.getRegionalConfig(region);
    if (regionalConfig.dataResidencyRequired) {
      recommendations.push('Ensure all data processing occurs within regional boundaries');
    }

    return recommendations;
  }
}

// Supporting interfaces and types

export interface RegionalConfig {
  region: TenantRegion;
  supportedLanguages: string[];
  defaultLanguage: string;
  defaultTimeZone: string;
  defaultDateFormat: string;
  defaultCurrency: string;
  domainPatterns: RegExp[];
  minimumTimeout: number;
  dataResidencyRequired: boolean;
  enableDebugMode: boolean;
  privacyRegulations?: string[];
  securityRequirements?: string[];
  requiredLanguages?: string[];
  customDomains?: unknown[];
  cdnEndpoints?: string[];
  apiEndpoints?: Record<string, string>;
  cachingStrategy?: string;
  networkOptimizations?: string[];
  contentDeliveryOptimizations?: Record<string, unknown>;
}

export interface LocalizedPattern {
  language: string;
  patterns: Record<string, string[]>;
  confidence: number;
}

export interface LocalizationData {
  language: string;
  region: TenantRegion;
  translations: Record<string, string>;
  dateFormats: Record<string, string>;
  timeFormats: Record<string, string>;
  numberFormats: Record<string, string>;
}

export interface RegionDetectionResult {
  region: TenantRegion;
  confidence: number;
  detectionMethod: string;
  supportedLanguages: string[];
  timeZone: string;
  dateFormat: string;
  currency: string;
  additionalContext?: Record<string, unknown>;
}

export interface ComplianceValidationResult {
  isCompliant: boolean;
  region: TenantRegion;
  violations: ComplianceViolation[];
  warnings: string[];
  recommendations: string[];
}

export interface ComplianceViolation {
  type: 'privacy' | 'security' | 'data_residency' | 'accessibility';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
}

export interface RegionalOptimizations {
  cdnEndpoints: string[];
  apiEndpoints: Record<string, string>;
  cachingStrategy: string;
  networkOptimizations: string[];
  contentDelivery: Record<string, unknown>;
}

// Create singleton instance
export const regionalHandler = new RegionalHandler();
