/**
 * SharePoint Page Handler
 *
 * SharePoint-specific page detection and integration with meeting page
 * layout analysis and control placement for content scripts.
 */

// import { injectionController } from '../injection/injection-controller';
// import { DOM } from '../utils/dom-utils';
// import { domUtils } from '../utils/dom-utils';
import { eventManager } from '../utils/event-manager';
import { mutationObserver } from '../utils/mutation-observer';
import type { InjectionPoint } from '../types/content-script';
// import type { UIComponent } from '../types/content-script';
import type { PageIntegrationContext, MeetingContentInfo, InjectionPointInfo } from '../types/page-integration';
// import type { MeetingDetection } from '@extension/meeting-detector';

/**
 * SharePoint page type detection results
 */
export interface SharePointPageInfo {
  /** Page type detected */
  pageType: 'meeting-recording' | 'teams-meeting' | 'document-library' | 'site-page' | 'unknown';
  /** SharePoint version */
  version: 'classic' | 'modern' | 'unknown';
  /** Site collection URL */
  siteUrl: string;
  /** Current web URL */
  webUrl: string;
  /** Page layout information */
  layout: SharePointLayout;
  /** Available content areas */
  contentAreas: SharePointContentArea[];
  /** Navigation elements */
  navigation: SharePointNavigation;
}

/**
 * SharePoint page layout configuration
 */
export interface SharePointLayout {
  /** Layout type */
  type: 'modern-page' | 'classic-page' | 'webpart-page' | 'wiki-page' | 'app-page';
  /** Content structure */
  structure: {
    /** Main content selector */
    mainContent: string;
    /** Sidebar selectors */
    sidebars: string[];
    /** Header selector */
    header: string;
    /** Footer selector */
    footer: string;
    /** Command bar selector */
    commandBar?: string;
  };
  /** Available injection zones */
  injectionZones: InjectionZone[];
  /** Theme information */
  theme: {
    /** Theme variant */
    variant: 'light' | 'dark' | 'high-contrast';
    /** Primary colors */
    colors: {
      primary: string;
      accent: string;
      background: string;
      text: string;
    };
  };
}

/**
 * SharePoint content area
 */
export interface SharePointContentArea {
  /** Area identifier */
  id: string;
  /** Area type */
  type: 'web-part' | 'content-zone' | 'navigation' | 'chrome';
  /** Area selector */
  selector: string;
  /** Whether area contains meeting content */
  hasMeetingContent: boolean;
  /** Detected recordings in this area */
  recordings: MeetingRecording[];
  /** Area boundaries */
  boundaries: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

/**
 * SharePoint navigation structure
 */
export interface SharePointNavigation {
  /** Top navigation */
  topNav: {
    selector: string;
    items: NavigationItem[];
  };
  /** Left navigation */
  leftNav: {
    selector: string;
    items: NavigationItem[];
  };
  /** Breadcrumb */
  breadcrumb: {
    selector: string;
    items: NavigationItem[];
  };
  /** Quick launch */
  quickLaunch?: {
    selector: string;
    items: NavigationItem[];
  };
}

/**
 * Navigation item
 */
export interface NavigationItem {
  /** Item text */
  text: string;
  /** Item URL */
  url: string;
  /** Whether item is active */
  isActive: boolean;
  /** Child items */
  children: NavigationItem[];
}

/**
 * Injection zone for UI components
 */
export interface InjectionZone {
  /** Zone identifier */
  id: string;
  /** Zone name */
  name: string;
  /** Zone selector */
  selector: string;
  /** Zone priority */
  priority: number;
  /** Supported component types */
  supportedComponents: string[];
  /** Zone constraints */
  constraints: {
    maxWidth?: number;
    maxHeight?: number;
    position: 'static' | 'relative' | 'absolute' | 'fixed';
    zIndex?: number;
  };
}

/**
 * Meeting recording information specific to SharePoint
 */
export interface MeetingRecording {
  /** Recording ID */
  id: string;
  /** Recording title */
  title: string;
  /** Recording URL */
  url: string;
  /** SharePoint document ID */
  documentId?: string;
  /** Stream video ID */
  streamVideoId?: string;
  /** Recording metadata */
  metadata: {
    duration?: number;
    size?: number;
    format: string;
    created: Date;
    modified: Date;
    owner: string;
  };
  /** Access permissions */
  permissions: {
    canView: boolean;
    canDownload: boolean;
    canShare: boolean;
    canEdit: boolean;
  };
  /** Element reference */
  element: Element;
}

/**
 * SharePoint page handler for meeting content integration
 */
export class SharePointPageHandler {
  private pageInfo: SharePointPageInfo | null = null;
  private contentAreas: Map<string, SharePointContentArea> = new Map();
  private injectionZones: Map<string, InjectionZone> = new Map();
  private meetingRecordings: Map<string, MeetingRecording> = new Map();
  private observerRegistrations: string[] = [];

  /**
   * Initialize SharePoint page handler
   */
  async initialize(): Promise<PageIntegrationContext | null> {
    try {
      // Detect SharePoint page information
      this.pageInfo = await this.detectSharePointPage();
      if (!this.pageInfo) {
        return null;
      }

      // Analyze page layout
      await this.analyzePageLayout();

      // Detect meeting content
      await this.detectMeetingContent();

      // Setup page monitoring
      this.setupPageMonitoring();

      // Create integration context
      return this.createIntegrationContext();
    } catch (error) {
      console.error('Failed to initialize SharePoint handler:', error);
      return null;
    }
  }

  /**
   * Detect SharePoint page information
   */
  private async detectSharePointPage(): Promise<SharePointPageInfo | null> {
    // Check if we're on a SharePoint page
    if (!this.isSharePointPage()) {
      return null;
    }

    const pageType = this.detectPageType();
    const version = this.detectSharePointVersion();
    const urls = this.extractSiteUrls();
    const layout = await this.detectPageLayout();
    const contentAreas = await this.detectContentAreas();
    const navigation = this.detectNavigation();

    return {
      pageType,
      version,
      siteUrl: urls.siteUrl,
      webUrl: urls.webUrl,
      layout,
      contentAreas,
      navigation,
    };
  }

  /**
   * Check if current page is SharePoint
   */
  private isSharePointPage(): boolean {
    // Check for SharePoint indicators
    const indicators = [
      'sharepoint.com',
      '_spPageContextInfo',
      'SP.ClientContext',
      '[data-sp-feature-tag]',
      '.ms-webpart-chrome',
      '#s4-workspace',
    ];

    return indicators.some(indicator => {
      if (indicator.includes('.com')) {
        return window.location.hostname.includes(indicator);
      } else if (indicator.startsWith('[') || indicator.startsWith('.') || indicator.startsWith('#')) {
        return document.querySelector(indicator) !== null;
      } else {
        return (window as Window & Record<string, unknown>)[indicator] !== undefined;
      }
    });
  }

  /**
   * Detect SharePoint page type
   */
  private detectPageType(): SharePointPageInfo['pageType'] {
    const url = window.location.href.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // Check for meeting recording indicators
    if (url.includes('recording') || url.includes('stream') || url.includes('video')) {
      return 'meeting-recording';
    }

    // Check for Teams meeting page
    if (url.includes('teams') || url.includes('meeting')) {
      return 'teams-meeting';
    }

    // Check for document library
    if (pathname.includes('forms/') || document.querySelector('[data-automationid="DocumentLibrary"]')) {
      return 'document-library';
    }

    // Check for site page
    if (pathname.includes('sitepages/') || document.querySelector('[data-sp-feature-tag="Site Pages"]')) {
      return 'site-page';
    }

    return 'unknown';
  }

  /**
   * Detect SharePoint version
   */
  private detectSharePointVersion(): SharePointPageInfo['version'] {
    // Check for modern SharePoint indicators
    if (
      document.querySelector('[data-sp-feature-tag]') ||
      document.querySelector('.od-TopBar') ||
      document.querySelector('[data-automationid="SiteHeader"]')
    ) {
      return 'modern';
    }

    // Check for classic SharePoint indicators
    if (
      document.querySelector('#s4-workspace') ||
      document.querySelector('.ms-webpart-chrome') ||
      document.querySelector('#zz1_TopNavigationMenu')
    ) {
      return 'classic';
    }

    return 'unknown';
  }

  /**
   * Extract site and web URLs
   */
  private extractSiteUrls(): { siteUrl: string; webUrl: string } {
    let siteUrl = '';
    let webUrl = '';

    // Try to get from _spPageContextInfo
    const pageContext = (
      window as Window & {
        _spPageContextInfo?: {
          siteServerRelativeUrl?: string;
          siteUrl?: string;
          webServerRelativeUrl?: string;
          webUrl?: string;
        };
      }
    )._spPageContextInfo;
    if (pageContext) {
      siteUrl = pageContext.siteServerRelativeUrl || pageContext.siteUrl || '';
      webUrl = pageContext.webServerRelativeUrl || pageContext.webUrl || '';
    }

    // Fallback to URL parsing
    if (!siteUrl || !webUrl) {
      const url = new URL(window.location.href);
      const pathParts = url.pathname.split('/').filter(part => part);

      if (pathParts.length > 0) {
        siteUrl = `${url.origin}/${pathParts[0]}`;
        webUrl = siteUrl;
      }
    }

    return { siteUrl, webUrl };
  }

  /**
   * Detect page layout structure
   */
  private async detectPageLayout(): Promise<SharePointLayout> {
    const version = this.detectSharePointVersion();

    if (version === 'modern') {
      return this.detectModernLayout();
    } else if (version === 'classic') {
      return this.detectClassicLayout();
    } else {
      return this.detectGenericLayout();
    }
  }

  /**
   * Detect modern SharePoint layout
   */
  private detectModernLayout(): SharePointLayout {
    const structure = {
      mainContent: '[data-automationid="contentScrollRegion"], .CanvasComponent, [role="main"]',
      sidebars: ['[data-automationid="SiteNavigation"]', '.od-SideNav'],
      header: '[data-automationid="SiteHeader"], .od-TopBar',
      footer: '[data-automationid="SiteFooter"], .od-BottomBar',
      commandBar: '[data-automationid="CommandBar"]',
    };

    const injectionZones: InjectionZone[] = [
      {
        id: 'command-bar',
        name: 'Command Bar',
        selector: '[data-automationid="CommandBar"]',
        priority: 5,
        supportedComponents: ['transcribe-button'],
        constraints: {
          position: 'relative',
          maxHeight: 48,
        },
      },
      {
        id: 'canvas-header',
        name: 'Canvas Header',
        selector: '.CanvasComponent:first-child',
        priority: 4,
        supportedComponents: ['status-panel', 'progress-indicator'],
        constraints: {
          position: 'relative',
        },
      },
      {
        id: 'content-area',
        name: 'Content Area',
        selector: '[data-automationid="contentScrollRegion"]',
        priority: 3,
        supportedComponents: ['summary-display', 'progress-indicator'],
        constraints: {
          position: 'relative',
        },
      },
    ];

    return {
      type: 'modern-page',
      structure,
      injectionZones,
      theme: this.detectTheme(),
    };
  }

  /**
   * Detect classic SharePoint layout
   */
  private detectClassicLayout(): SharePointLayout {
    const structure = {
      mainContent: '#s4-workspace, .ms-webpart-page, #MSO_ContentTable',
      sidebars: ['#s4-leftpanel', '.ms-nav'],
      header: '#s4-topheader2, .ms-dlgFrameContainer',
      footer: '#s4-footer',
      commandBar: '.ms-cui-ribbon, .ms-webpart-chrome-title',
    };

    const injectionZones: InjectionZone[] = [
      {
        id: 'ribbon-area',
        name: 'Ribbon Area',
        selector: '.ms-cui-ribbon',
        priority: 5,
        supportedComponents: ['transcribe-button'],
        constraints: {
          position: 'relative',
          maxHeight: 100,
        },
      },
      {
        id: 'webpart-chrome',
        name: 'Web Part Chrome',
        selector: '.ms-webpart-chrome-title',
        priority: 4,
        supportedComponents: ['transcribe-button'],
        constraints: {
          position: 'relative',
        },
      },
      {
        id: 'workspace',
        name: 'Workspace',
        selector: '#s4-workspace',
        priority: 3,
        supportedComponents: ['summary-display', 'status-panel'],
        constraints: {
          position: 'relative',
        },
      },
    ];

    return {
      type: 'classic-page',
      structure,
      injectionZones,
      theme: this.detectTheme(),
    };
  }

  /**
   * Detect generic layout for unknown versions
   */
  private detectGenericLayout(): SharePointLayout {
    const structure = {
      mainContent: 'main, [role="main"], .main-content, body',
      sidebars: ['.sidebar', '.nav', '.navigation'],
      header: 'header, .header, .top-bar',
      footer: 'footer, .footer',
    };

    const injectionZones: InjectionZone[] = [
      {
        id: 'main-content',
        name: 'Main Content',
        selector: 'main, [role="main"]',
        priority: 3,
        supportedComponents: ['transcribe-button', 'summary-display'],
        constraints: {
          position: 'relative',
        },
      },
    ];

    return {
      type: 'app-page',
      structure,
      injectionZones,
      theme: this.detectTheme(),
    };
  }

  /**
   * Detect current theme
   */
  private detectTheme(): SharePointLayout['theme'] {
    const rootStyle = getComputedStyle(document.documentElement);

    // Try to detect theme from CSS variables
    const themeColors = {
      primary: rootStyle.getPropertyValue('--themePrimary') || '#0078d4',
      accent: rootStyle.getPropertyValue('--themeSecondary') || '#106ebe',
      background: rootStyle.getPropertyValue('--bodyBackground') || '#ffffff',
      text: rootStyle.getPropertyValue('--bodyText') || '#323130',
    };

    // Detect theme variant
    let variant: 'light' | 'dark' | 'high-contrast' = 'light';

    if (
      document.body.classList.contains('dark') ||
      (themeColors.background.includes('rgb') && this.isColorDark(themeColors.background))
    ) {
      variant = 'dark';
    }

    if (document.body.classList.contains('high-contrast') || rootStyle.getPropertyValue('--ms-high-contrast-adjust')) {
      variant = 'high-contrast';
    }

    return {
      variant,
      colors: themeColors,
    };
  }

  /**
   * Check if color is dark
   */
  private isColorDark(color: string): boolean {
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      const lightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return lightness < 0.5;
    }
    return false;
  }

  /**
   * Detect content areas on the page
   */
  private async detectContentAreas(): Promise<SharePointContentArea[]> {
    const areas: SharePointContentArea[] = [];

    // Common SharePoint content area selectors
    const areaSelectors = [
      { type: 'web-part', selector: '.ms-webpart-chrome, .CanvasComponent' },
      { type: 'content-zone', selector: '[data-automationid="contentScrollRegion"], .ms-webpart-zone' },
      { type: 'navigation', selector: '[data-automationid="SiteNavigation"], .ms-nav' },
      { type: 'chrome', selector: '.od-TopBar, #s4-workspace' },
    ];

    for (const areaConfig of areaSelectors) {
      const elements = document.querySelectorAll(areaConfig.selector);

      elements.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        const recordings = this.findRecordingsInElement(element);

        areas.push({
          id: `${areaConfig.type}-${index}`,
          type: areaConfig.type as SharePointContentArea['type'],
          selector: `${areaConfig.selector}:nth-child(${index + 1})`,
          hasMeetingContent: recordings.length > 0,
          recordings,
          boundaries: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
        });
      });
    }

    return areas;
  }

  /**
   * Find recordings within an element
   */
  private findRecordingsInElement(element: Element): MeetingRecording[] {
    const recordings: MeetingRecording[] = [];

    // Look for recording links
    const recordingLinks = element.querySelectorAll('a[href*="recording"], a[href*="stream"], a[href*="video"]');

    recordingLinks.forEach((link, index) => {
      const href = link.getAttribute('href') || '';
      const title = link.textContent?.trim() || `Recording ${index + 1}`;

      recordings.push({
        id: `recording-${Date.now()}-${index}`,
        title,
        url: href,
        metadata: {
          format: this.extractFormatFromUrl(href),
          created: new Date(),
          modified: new Date(),
          owner: 'Unknown',
        },
        permissions: {
          canView: true,
          canDownload: false,
          canShare: false,
          canEdit: false,
        },
        element: link,
      });
    });

    return recordings;
  }

  /**
   * Extract format from URL
   */
  private extractFormatFromUrl(url: string): string {
    if (url.includes('stream')) return 'stream';
    if (url.includes('.mp4')) return 'mp4';
    if (url.includes('.mp3')) return 'mp3';
    return 'unknown';
  }

  /**
   * Detect navigation structure
   */
  private detectNavigation(): SharePointNavigation {
    return {
      topNav: {
        selector: '.od-TopBar, #zz1_TopNavigationMenu',
        items: this.extractNavigationItems('.od-TopBar a, #zz1_TopNavigationMenu a'),
      },
      leftNav: {
        selector: '[data-automationid="SiteNavigation"], #s4-leftpanel',
        items: this.extractNavigationItems('[data-automationid="SiteNavigation"] a, #s4-leftpanel a'),
      },
      breadcrumb: {
        selector: '[data-automationid="Breadcrumb"], .ms-breadcrumb',
        items: this.extractNavigationItems('[data-automationid="Breadcrumb"] a, .ms-breadcrumb a'),
      },
    };
  }

  /**
   * Extract navigation items from selector
   */
  private extractNavigationItems(selector: string): NavigationItem[] {
    const items: NavigationItem[] = [];
    const elements = document.querySelectorAll(selector);

    elements.forEach(element => {
      const link = element as HTMLAnchorElement;
      items.push({
        text: link.textContent?.trim() || '',
        url: link.href || '',
        isActive: link.classList.contains('is-selected') || link.classList.contains('active'),
        children: [], // Could be enhanced to detect sub-navigation
      });
    });

    return items;
  }

  /**
   * Analyze page layout for optimal injection points
   */
  private async analyzePageLayout(): Promise<void> {
    if (!this.pageInfo) return;

    // Register injection zones
    this.pageInfo.layout.injectionZones.forEach(zone => {
      this.injectionZones.set(zone.id, zone);
    });

    // Store content areas
    this.pageInfo.contentAreas.forEach(area => {
      this.contentAreas.set(area.id, area);
    });
  }

  /**
   * Detect meeting content on the page
   */
  private async detectMeetingContent(): Promise<void> {
    // Find all recordings across content areas
    this.contentAreas.forEach(area => {
      area.recordings.forEach(recording => {
        this.meetingRecordings.set(recording.id, recording);
      });
    });

    // Look for additional meeting indicators
    await this.detectAdditionalMeetingContent();
  }

  /**
   * Detect additional meeting content
   */
  private async detectAdditionalMeetingContent(): Promise<void> {
    // Look for Stream embeds
    const streamEmbeds = document.querySelectorAll('iframe[src*="microsoftstream.com"]');
    streamEmbeds.forEach((embed, index) => {
      const src = embed.getAttribute('src') || '';
      const recording: MeetingRecording = {
        id: `stream-embed-${index}`,
        title: `Stream Video ${index + 1}`,
        url: src,
        streamVideoId: this.extractStreamVideoId(src),
        metadata: {
          format: 'stream',
          created: new Date(),
          modified: new Date(),
          owner: 'Unknown',
        },
        permissions: {
          canView: true,
          canDownload: false,
          canShare: false,
          canEdit: false,
        },
        element: embed,
      };

      this.meetingRecordings.set(recording.id, recording);
    });

    // Look for Teams meeting links
    const teamsLinks = document.querySelectorAll('a[href*="teams.microsoft.com"]');
    teamsLinks.forEach((link, index) => {
      const href = link.getAttribute('href') || '';
      if (href.includes('meetup-join') || href.includes('l/meetup')) {
        const recording: MeetingRecording = {
          id: `teams-meeting-${index}`,
          title: link.textContent?.trim() || `Teams Meeting ${index + 1}`,
          url: href,
          metadata: {
            format: 'teams',
            created: new Date(),
            modified: new Date(),
            owner: 'Unknown',
          },
          permissions: {
            canView: true,
            canDownload: false,
            canShare: false,
            canEdit: false,
          },
          element: link,
        };

        this.meetingRecordings.set(recording.id, recording);
      }
    });
  }

  /**
   * Extract Stream video ID from URL
   */
  private extractStreamVideoId(url: string): string | undefined {
    const match = url.match(/\/video\/([a-f0-9-]+)/);
    return match ? match[1] : undefined;
  }

  /**
   * Setup page monitoring for dynamic content
   */
  private setupPageMonitoring(): void {
    // Monitor for new content
    mutationObserver.onContentDetection(newContent => {
      this.handleNewContent(newContent);
    });

    // Monitor for page changes
    mutationObserver.onPageChange(changes => {
      this.handlePageChanges(changes);
    });

    // Start monitoring
    mutationObserver.startMonitoring();
  }

  /**
   * Handle new content detection
   */
  private handleNewContent(newContent: Array<{ links?: Element[] }>): void {
    newContent.forEach(content => {
      // Process new recordings
      if (content.links?.length > 0) {
        content.links.forEach((link: Element, index: number) => {
          const href = link.getAttribute('href') || '';
          if (href.includes('recording') || href.includes('stream')) {
            const recording: MeetingRecording = {
              id: `dynamic-recording-${Date.now()}-${index}`,
              title: link.textContent?.trim() || 'New Recording',
              url: href,
              metadata: {
                format: this.extractFormatFromUrl(href),
                created: new Date(),
                modified: new Date(),
                owner: 'Unknown',
              },
              permissions: {
                canView: true,
                canDownload: false,
                canShare: false,
                canEdit: false,
              },
              element: link,
            };

            this.meetingRecordings.set(recording.id, recording);
          }
        });
      }
    });
  }

  /**
   * Handle page changes
   */
  private handlePageChanges(changes: Array<{ type: string }>): void {
    // Re-analyze layout if significant changes detected
    const significantChanges = changes.filter(
      change => change.type === 'layout-change' || change.type === 'navigation',
    );

    if (significantChanges.length > 0) {
      // Debounce re-analysis
      setTimeout(() => {
        this.analyzePageLayout();
      }, 1000);
    }
  }

  /**
   * Create page integration context
   */
  private createIntegrationContext(): PageIntegrationContext {
    if (!this.pageInfo) {
      throw new Error('Page info not available');
    }

    const availableContent: MeetingContentInfo[] = Array.from(this.meetingRecordings.values()).map(recording => ({
      id: recording.id,
      type: 'recording',
      title: recording.title,
      location: recording.url,
      accessibility: 'accessible',
      permissions: {
        canAccess: recording.permissions.canView,
        canDownload: recording.permissions.canDownload,
        canShare: recording.permissions.canShare,
      },
      format: {
        type: recording.metadata.format,
        duration: recording.metadata.duration,
        size: recording.metadata.size,
      },
      isLoading: false,
      confidence: 0.8,
    }));

    const injectionPoints: InjectionPointInfo[] = Array.from(this.injectionZones.values()).map(zone => ({
      id: zone.id,
      selector: zone.selector,
      method: 'append',
      priority: zone.priority,
      isAvailable: document.querySelector(zone.selector) !== null,
      validate: () => document.querySelector(zone.selector) !== null,
      supportedFeatures: zone.supportedComponents,
      constraints: zone.constraints,
    }));

    return {
      contextId: `sharepoint-${Date.now()}`,
      pageUrl: window.location.href,
      pageTitle: document.title,
      meetingDetection: null, // Will be set by orchestrator
      availableContent,
      userPermissions: {
        userInfo: {
          roles: [],
        },
        pagePermissions: {
          canView: true,
          canInteract: true,
          canAccessMeetings: availableContent.length > 0,
          canDownload: false,
          canShare: false,
        },
        contentPermissions: new Map(),
        featurePermissions: new Map(),
        authenticationStatus: 'authenticated',
        evaluatedAt: new Date(),
      },
      integrationStatus: 'active',
      availableFeatures: [],
      activeFeatures: new Set(),
      pageLayout: {
        pageType: 'sharepoint',
        layoutVariant: this.pageInfo.version,
        containers: {
          main: this.pageInfo.layout.structure.mainContent,
          sidebar: this.pageInfo.layout.structure.sidebars[0],
          header: this.pageInfo.layout.structure.header,
          footer: this.pageInfo.layout.structure.footer,
        },
        injectionPoints,
        theme: {
          colorScheme: this.pageInfo.layout.theme.variant,
          cssVariables: this.pageInfo.layout.theme.colors,
        },
        breakpoint: 'desktop',
        constraints: {
          restrictions: [],
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        sharePointVersion: this.pageInfo.version,
        pageType: this.pageInfo.pageType,
        siteUrl: this.pageInfo.siteUrl,
        contentAreas: this.pageInfo.contentAreas.length,
        recordings: this.meetingRecordings.size,
      },
    };
  }

  /**
   * Get optimal injection point for component type
   */
  getOptimalInjectionPoint(componentType: string): InjectionPoint | null {
    // Find best zone for component type
    const suitableZones = Array.from(this.injectionZones.values())
      .filter(zone => zone.supportedComponents.includes(componentType))
      .sort((a, b) => b.priority - a.priority);

    if (suitableZones.length === 0) {
      return null;
    }

    const bestZone = suitableZones[0];

    return {
      id: bestZone.id,
      selector: bestZone.selector,
      method: 'append',
      priority: bestZone.priority,
      isAvailable: document.querySelector(bestZone.selector) !== null,
      validate: () => document.querySelector(bestZone.selector) !== null,
    };
  }

  /**
   * Get meeting recordings found on page
   */
  getMeetingRecordings(): MeetingRecording[] {
    return Array.from(this.meetingRecordings.values());
  }

  /**
   * Get page information
   */
  getPageInfo(): SharePointPageInfo | null {
    return this.pageInfo;
  }

  /**
   * Cleanup handler resources
   */
  cleanup(): void {
    // Stop monitoring
    mutationObserver.stopMonitoring();

    // Clear registrations
    this.observerRegistrations.forEach(id => {
      eventManager.removeEventListener(id);
    });

    // Clear data
    this.contentAreas.clear();
    this.injectionZones.clear();
    this.meetingRecordings.clear();
  }
}

// Export handler class (already exported above)
