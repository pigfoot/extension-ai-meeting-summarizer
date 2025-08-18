/**
 * Teams Page Handler
 *
 * Teams interface detection and integration with adaptive UI placement
 * and layout analysis for content scripts.
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
 * Teams interface type detection results
 */
export interface TeamsPageInfo {
  /** Interface type detected */
  interfaceType: 'desktop-app' | 'web-app' | 'mobile-web' | 'unknown';
  /** Meeting context */
  meetingContext: 'in-meeting' | 'meeting-lobby' | 'meeting-ended' | 'pre-meeting' | 'no-meeting';
  /** View mode */
  viewMode: 'meeting' | 'chat' | 'calendar' | 'files' | 'apps' | 'unknown';
  /** App version information */
  version: {
    platform: 'teams-web' | 'teams-desktop' | 'teams-mobile' | 'unknown';
    version?: string;
    build?: string;
  };
  /** Layout information */
  layout: TeamsLayout;
  /** Available content areas */
  contentAreas: TeamsContentArea[];
  /** Meeting controls */
  controls: TeamsMeetingControls;
}

/**
 * Teams layout configuration
 */
export interface TeamsLayout {
  /** Layout variant */
  variant: 'meeting-stage' | 'meeting-sidebar' | 'chat-view' | 'grid-view' | 'together-mode' | 'unknown';
  /** Content structure */
  structure: {
    /** Main meeting area */
    meetingStage: string;
    /** Participant area */
    participantArea: string;
    /** Chat panel */
    chatPanel: string;
    /** Control bar */
    controlBar: string;
    /** Side panel */
    sidePanel?: string;
    /** Header area */
    header: string;
  };
  /** Available injection zones */
  injectionZones: TeamsInjectionZone[];
  /** Theme information */
  theme: {
    /** Theme mode */
    mode: 'light' | 'dark' | 'high-contrast' | 'auto';
    /** Color scheme */
    colors: {
      primary: string;
      secondary: string;
      background: string;
      surface: string;
      text: string;
      accent: string;
    };
  };
  /** Responsive breakpoints */
  breakpoints: {
    current: 'mobile' | 'tablet' | 'desktop' | 'widescreen';
    width: number;
    height: number;
  };
}

/**
 * Teams content area
 */
export interface TeamsContentArea {
  /** Area identifier */
  id: string;
  /** Area type */
  type: 'meeting-stage' | 'chat' | 'participants' | 'shared-content' | 'controls' | 'sidebar';
  /** Area selector */
  selector: string;
  /** Whether area is currently visible */
  isVisible: boolean;
  /** Whether area contains meeting content */
  hasMeetingContent: boolean;
  /** Meeting recordings or content in this area */
  meetingContent: TeamsMeetingContent[];
  /** Area boundaries */
  boundaries: {
    top: number;
    left: number;
    width: number;
    height: number;
    zIndex: number;
  };
  /** Area state */
  state: 'active' | 'inactive' | 'minimized' | 'hidden';
}

/**
 * Teams meeting controls
 */
export interface TeamsMeetingControls {
  /** Main control bar */
  controlBar: {
    selector: string;
    controls: TeamsControl[];
    isVisible: boolean;
  };
  /** Secondary controls */
  secondaryControls: {
    selector: string;
    controls: TeamsControl[];
    isVisible: boolean;
  };
  /** Meeting options */
  meetingOptions: {
    selector: string;
    options: TeamsControl[];
    isVisible: boolean;
  };
  /** Participant controls */
  participantControls?: {
    selector: string;
    controls: TeamsControl[];
    isVisible: boolean;
  };
}

/**
 * Teams control element
 */
export interface TeamsControl {
  /** Control identifier */
  id: string;
  /** Control type */
  type: 'button' | 'toggle' | 'dropdown' | 'slider' | 'input';
  /** Control action */
  action: string;
  /** Control selector */
  selector: string;
  /** Whether control is enabled */
  isEnabled: boolean;
  /** Control state */
  state?: Record<string, unknown>;
  /** Control element reference */
  element: Element;
}

/**
 * Teams injection zone
 */
export interface TeamsInjectionZone {
  /** Zone identifier */
  id: string;
  /** Zone name */
  name: string;
  /** Zone selector */
  selector: string;
  /** Zone priority (higher = better) */
  priority: number;
  /** Zone context */
  context: 'meeting' | 'chat' | 'sidebar' | 'controls' | 'stage';
  /** Supported component types */
  supportedComponents: string[];
  /** Zone constraints */
  constraints: {
    maxWidth?: number;
    maxHeight?: number;
    position: 'static' | 'relative' | 'absolute' | 'fixed';
    zIndex?: number;
    adaptToMeetingState?: boolean;
  };
  /** Zone availability conditions */
  availability: {
    meetingStates: string[];
    viewModes: string[];
    screenSizes: string[];
  };
}

/**
 * Teams meeting content
 */
export interface TeamsMeetingContent {
  /** Content ID */
  id: string;
  /** Content type */
  type: 'recording' | 'shared-screen' | 'whiteboard' | 'file' | 'live-stream';
  /** Content title */
  title: string;
  /** Content URL or reference */
  url?: string;
  /** Meeting ID this content belongs to */
  meetingId?: string;
  /** Organizer information */
  organizer?: string;
  /** Content metadata */
  metadata: {
    duration?: number;
    size?: number;
    format?: string;
    created?: Date;
    participants?: string[];
    isRecording?: boolean;
    isLive?: boolean;
  };
  /** Access information */
  access: {
    canView: boolean;
    canDownload: boolean;
    canShare: boolean;
    canRecord: boolean;
    canTranscribe: boolean;
  };
  /** Element reference */
  element: Element;
}

/**
 * Teams page handler for meeting content integration
 */
export class TeamsPageHandler {
  private pageInfo: TeamsPageInfo | null = null;
  private contentAreas: Map<string, TeamsContentArea> = new Map();
  private injectionZones: Map<string, TeamsInjectionZone> = new Map();
  private meetingContent: Map<string, TeamsMeetingContent> = new Map();
  private controls: Map<string, TeamsControl> = new Map();
  private observerRegistrations: string[] = [];
  private layoutObserver: ResizeObserver | null = null;

  /**
   * Initialize Teams page handler
   */
  async initialize(): Promise<PageIntegrationContext | null> {
    try {
      // Detect Teams interface
      this.pageInfo = await this.detectTeamsInterface();
      if (!this.pageInfo) {
        return null;
      }

      // Analyze layout and content areas
      await this.analyzeTeamsLayout();

      // Detect meeting content
      await this.detectMeetingContent();

      // Setup adaptive monitoring
      this.setupAdaptiveMonitoring();

      // Create integration context
      return this.createIntegrationContext();
    } catch (error) {
      console.error('Failed to initialize Teams handler:', error);
      return null;
    }
  }

  /**
   * Detect Teams interface type and context
   */
  private async detectTeamsInterface(): Promise<TeamsPageInfo | null> {
    // Check if we're on Teams
    if (!this.isTeamsInterface()) {
      return null;
    }

    const interfaceType = this.detectInterfaceType();
    const meetingContext = this.detectMeetingContext();
    const viewMode = this.detectViewMode();
    const version = this.detectVersion();
    const layout = await this.detectTeamsLayout();
    const contentAreas = await this.detectContentAreas();
    const controls = this.detectMeetingControls();

    return {
      interfaceType,
      meetingContext,
      viewMode,
      version,
      layout,
      contentAreas,
      controls,
    };
  }

  /**
   * Check if current page is Teams interface
   */
  private isTeamsInterface(): boolean {
    // Check for Teams indicators
    const indicators = [
      'teams.microsoft.com',
      'teams.live.com',
      'teams-for-business.microsoft.com',
      '[data-tid]', // Teams uses data-tid attributes
      '[data-app="teams"]',
      '.ts-calling-screen',
      '.teams-app',
      '.meeting-stage',
      '.teams-meeting',
      '#teams-app-chrome',
    ];

    return indicators.some(indicator => {
      if (indicator.includes('.com')) {
        return window.location.hostname.includes(indicator.replace('teams.', '').replace('.com', ''));
      } else if (indicator.startsWith('[') || indicator.startsWith('.') || indicator.startsWith('#')) {
        return document.querySelector(indicator) !== null;
      } else {
        return (window as Window & Record<string, unknown>)[indicator] !== undefined;
      }
    });
  }

  /**
   * Detect Teams interface type
   */
  private detectInterfaceType(): TeamsPageInfo['interfaceType'] {
    // Check user agent and interface clues
    const userAgent = navigator.userAgent.toLowerCase();

    // Desktop app indicators
    if (userAgent.includes('teams/') || userAgent.includes('msteams')) {
      return 'desktop-app';
    }

    // Mobile web indicators
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      return 'mobile-web';
    }

    // Web app (most common)
    if (window.location.hostname.includes('teams.microsoft.com')) {
      return 'web-app';
    }

    return 'unknown';
  }

  /**
   * Detect current meeting context
   */
  private detectMeetingContext(): TeamsPageInfo['meetingContext'] {
    // Check for meeting indicators in URL and DOM
    const url = window.location.href.toLowerCase();

    if (url.includes('/meetup-join/') || url.includes('/l/meetup-join/')) {
      // Check if meeting has started
      if (document.querySelector('.ts-calling-screen, .calling-stage')) {
        return 'in-meeting';
      } else if (document.querySelector('.lobby-screen, .pre-join-screen')) {
        return 'meeting-lobby';
      } else {
        return 'pre-meeting';
      }
    }

    if (url.includes('/meetup') && document.querySelector('.meeting-ended')) {
      return 'meeting-ended';
    }

    // Check for meeting indicators in DOM
    if (document.querySelector('.ts-calling-screen, .meeting-stage')) {
      return 'in-meeting';
    }

    if (document.querySelector('.lobby-screen, .pre-join-screen')) {
      return 'meeting-lobby';
    }

    return 'no-meeting';
  }

  /**
   * Detect current view mode
   */
  private detectViewMode(): TeamsPageInfo['viewMode'] {
    // Check URL path and DOM elements
    const path = window.location.pathname.toLowerCase();

    if (path.includes('/meetup') || document.querySelector('.ts-calling-screen')) {
      return 'meeting';
    }

    if (path.includes('/conversations') || document.querySelector('.chat-conversation')) {
      return 'chat';
    }

    if (path.includes('/calendar') || document.querySelector('.calendar-view')) {
      return 'calendar';
    }

    if (path.includes('/files') || document.querySelector('.files-view')) {
      return 'files';
    }

    if (path.includes('/apps') || document.querySelector('.apps-view')) {
      return 'apps';
    }

    return 'unknown';
  }

  /**
   * Detect Teams version information
   */
  private detectVersion(): TeamsPageInfo['version'] {
    const userAgent = navigator.userAgent;

    // Try to extract version from user agent
    const versionMatch = userAgent.match(/teams[/\s](\d+\.\d+\.\d+)/i);
    const buildMatch = userAgent.match(/build[/\s](\d+)/i);

    let platform: TeamsPageInfo['version']['platform'] = 'unknown';

    if (userAgent.includes('Teams/')) {
      platform = 'teams-desktop';
    } else if (window.location.hostname.includes('teams.microsoft.com')) {
      platform = 'teams-web';
    } else if (userAgent.includes('Mobile')) {
      platform = 'teams-mobile';
    }

    return {
      platform,
      version: versionMatch ? versionMatch[1] : undefined,
      build: buildMatch ? buildMatch[1] : undefined,
    };
  }

  /**
   * Detect Teams layout configuration
   */
  private async detectTeamsLayout(): Promise<TeamsLayout> {
    const meetingContext = this.detectMeetingContext();
    const viewMode = this.detectViewMode();

    // Determine layout variant based on context
    let variant: TeamsLayout['variant'] = 'unknown';

    if (meetingContext === 'in-meeting') {
      if (document.querySelector('.gallery-view, .grid-view')) {
        variant = 'grid-view';
      } else if (document.querySelector('.together-mode')) {
        variant = 'together-mode';
      } else if (document.querySelector('.meeting-sidebar')) {
        variant = 'meeting-sidebar';
      } else {
        variant = 'meeting-stage';
      }
    } else if (viewMode === 'chat') {
      variant = 'chat-view';
    }

    const structure = this.detectLayoutStructure(variant);
    const injectionZones = this.createInjectionZones(variant);
    const theme = this.detectTeamsTheme();
    const breakpoints = this.detectResponsiveBreakpoints();

    return {
      variant,
      structure,
      injectionZones,
      theme,
      breakpoints,
    };
  }

  /**
   * Detect layout structure selectors
   */
  private detectLayoutStructure(variant: TeamsLayout['variant']): TeamsLayout['structure'] {
    const selectors = {
      'meeting-stage': {
        meetingStage: '.ts-calling-screen, .meeting-stage, .main-content',
        participantArea: '.participants-container, .roster-container, .people-list',
        chatPanel: '.chat-container, .conversation-container, #chat-canvas',
        controlBar: '.calling-controls, .meeting-controls, .bottom-bar',
        sidePanel: '.side-panel, .sidebar-container',
        header: '.teams-header, .calling-header, .app-header',
      },
      'grid-view': {
        meetingStage: '.gallery-container, .grid-container, .participants-grid',
        participantArea: '.participant-tile, .video-tile',
        chatPanel: '.chat-panel, .side-chat',
        controlBar: '.calling-controls, .grid-controls',
        header: '.meeting-header, .grid-header',
      },
      'chat-view': {
        meetingStage: '.chat-main, .conversation-main',
        participantArea: '.participant-info, .user-list',
        chatPanel: '.message-container, .chat-messages',
        controlBar: '.chat-controls, .message-controls',
        header: '.chat-header, .conversation-header',
      },
      'meeting-sidebar': {
        meetingStage: '.meeting-content, .presentation-area',
        participantArea: '.sidebar-participants, .mini-roster',
        chatPanel: '.sidebar-chat, .side-conversation',
        controlBar: '.meeting-controls',
        sidePanel: '.meeting-sidebar',
        header: '.meeting-header',
      },
      'together-mode': {
        meetingStage: '.together-mode-container, .immersive-meeting',
        participantArea: '.together-participants, .scene-participants',
        chatPanel: '.together-chat',
        controlBar: '.together-controls',
        header: '.together-header',
      },
    };

    const defaultStructure = {
      meetingStage: '.main-content, [role="main"]',
      participantArea: '.participants, .roster',
      chatPanel: '.chat, .messages',
      controlBar: '.controls, .toolbar',
      header: '.header, .top-bar',
    };

    return selectors[variant] || defaultStructure;
  }

  /**
   * Create injection zones for Teams layout
   */
  private createInjectionZones(variant: TeamsLayout['variant']): TeamsInjectionZone[] {
    const baseZones: TeamsInjectionZone[] = [
      {
        id: 'control-bar',
        name: 'Control Bar',
        selector: '.calling-controls, .meeting-controls',
        priority: 9,
        context: 'controls',
        supportedComponents: ['transcribe-button'],
        constraints: {
          position: 'relative',
          maxHeight: 56,
          adaptToMeetingState: true,
        },
        availability: {
          meetingStates: ['in-meeting', 'meeting-lobby'],
          viewModes: ['meeting'],
          screenSizes: ['tablet', 'desktop', 'widescreen'],
        },
      },
      {
        id: 'meeting-header',
        name: 'Meeting Header',
        selector: '.calling-header, .meeting-header, .teams-header',
        priority: 8,
        context: 'meeting',
        supportedComponents: ['status-panel', 'transcribe-button'],
        constraints: {
          position: 'relative',
          maxHeight: 64,
        },
        availability: {
          meetingStates: ['in-meeting', 'pre-meeting'],
          viewModes: ['meeting'],
          screenSizes: ['desktop', 'widescreen'],
        },
      },
      {
        id: 'chat-panel',
        name: 'Chat Panel',
        selector: '.chat-container, .side-chat',
        priority: 6,
        context: 'chat',
        supportedComponents: ['summary-display', 'progress-indicator'],
        constraints: {
          position: 'relative',
          maxWidth: 400,
        },
        availability: {
          meetingStates: ['in-meeting'],
          viewModes: ['meeting', 'chat'],
          screenSizes: ['desktop', 'widescreen'],
        },
      },
      {
        id: 'sidebar',
        name: 'Sidebar',
        selector: '.side-panel, .meeting-sidebar',
        priority: 7,
        context: 'sidebar',
        supportedComponents: ['status-panel', 'summary-display'],
        constraints: {
          position: 'relative',
          maxWidth: 320,
        },
        availability: {
          meetingStates: ['in-meeting'],
          viewModes: ['meeting'],
          screenSizes: ['widescreen'],
        },
      },
      {
        id: 'stage-overlay',
        name: 'Stage Overlay',
        selector: '.meeting-stage, .ts-calling-screen',
        priority: 5,
        context: 'stage',
        supportedComponents: ['progress-indicator'],
        constraints: {
          position: 'absolute',
          zIndex: 1000,
          adaptToMeetingState: true,
        },
        availability: {
          meetingStates: ['in-meeting'],
          viewModes: ['meeting'],
          screenSizes: ['mobile', 'tablet', 'desktop', 'widescreen'],
        },
      },
    ];

    // Add variant-specific zones
    if (variant === 'grid-view') {
      baseZones.push({
        id: 'grid-overlay',
        name: 'Grid Overlay',
        selector: '.gallery-container, .grid-container',
        priority: 4,
        context: 'stage',
        supportedComponents: ['transcribe-button'],
        constraints: {
          position: 'absolute',
          zIndex: 999,
        },
        availability: {
          meetingStates: ['in-meeting'],
          viewModes: ['meeting'],
          screenSizes: ['desktop', 'widescreen'],
        },
      });
    }

    return baseZones;
  }

  /**
   * Detect Teams theme
   */
  private detectTeamsTheme(): TeamsLayout['theme'] {
    const rootStyle = getComputedStyle(document.documentElement);

    // Teams theme detection
    let mode: TeamsLayout['theme']['mode'] = 'light';

    if (
      document.body.classList.contains('app-dark') ||
      document.body.classList.contains('theme-dark') ||
      rootStyle.getPropertyValue('--theme-type') === 'dark'
    ) {
      mode = 'dark';
    } else if (
      document.body.classList.contains('high-contrast') ||
      rootStyle.getPropertyValue('--high-contrast-mode') === 'true'
    ) {
      mode = 'high-contrast';
    }

    // Extract Teams color scheme
    const colors = {
      primary:
        rootStyle.getPropertyValue('--communication-tint-primary') ||
        rootStyle.getPropertyValue('--brand-primary') ||
        '#6264a7',
      secondary:
        rootStyle.getPropertyValue('--communication-tint-secondary') ||
        rootStyle.getPropertyValue('--brand-secondary') ||
        '#464775',
      background:
        rootStyle.getPropertyValue('--surface-background') ||
        rootStyle.getPropertyValue('--background-color') ||
        '#ffffff',
      surface:
        rootStyle.getPropertyValue('--surface-primary') || rootStyle.getPropertyValue('--surface-color') || '#f3f2f1',
      text:
        rootStyle.getPropertyValue('--foreground-primary') || rootStyle.getPropertyValue('--text-color') || '#252423',
      accent:
        rootStyle.getPropertyValue('--communication-tint-shade') ||
        rootStyle.getPropertyValue('--accent-color') ||
        '#5b5fc7',
    };

    return { mode, colors };
  }

  /**
   * Detect responsive breakpoints
   */
  private detectResponsiveBreakpoints(): TeamsLayout['breakpoints'] {
    const width = window.innerWidth;
    const height = window.innerHeight;

    let current: TeamsLayout['breakpoints']['current'] = 'desktop';

    if (width < 768) {
      current = 'mobile';
    } else if (width < 1024) {
      current = 'tablet';
    } else if (width >= 1920) {
      current = 'widescreen';
    }

    return { current, width, height };
  }

  /**
   * Detect content areas in Teams interface
   */
  private async detectContentAreas(): Promise<TeamsContentArea[]> {
    const areas: TeamsContentArea[] = [];

    // Common Teams content area configurations
    const areaConfigs = [
      { type: 'meeting-stage', selector: '.ts-calling-screen, .meeting-stage, .gallery-container' },
      { type: 'chat', selector: '.chat-container, .conversation-container, #chat-canvas' },
      { type: 'participants', selector: '.participants-container, .roster-container, .people-list' },
      { type: 'shared-content', selector: '.shared-content, .presentation-area, .screen-share' },
      { type: 'controls', selector: '.calling-controls, .meeting-controls, .bottom-bar' },
      { type: 'sidebar', selector: '.side-panel, .meeting-sidebar, .right-panel' },
    ];

    for (const config of areaConfigs) {
      const elements = document.querySelectorAll(config.selector);

      elements.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        const meetingContent = this.findMeetingContentInElement(element);
        const computedStyle = getComputedStyle(element);

        areas.push({
          id: `${config.type}-${index}`,
          type: config.type as TeamsContentArea['type'],
          selector: `${config.selector}:nth-child(${index + 1})`,
          isVisible: rect.width > 0 && rect.height > 0 && computedStyle.visibility !== 'hidden',
          hasMeetingContent: meetingContent.length > 0,
          meetingContent,
          boundaries: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            zIndex: parseInt(computedStyle.zIndex) || 0,
          },
          state: this.determineAreaState(element),
        });
      });
    }

    return areas;
  }

  /**
   * Find meeting content within an element
   */
  private findMeetingContentInElement(element: Element): TeamsMeetingContent[] {
    const content: TeamsMeetingContent[] = [];

    // Look for recording indicators
    const recordingElements = element.querySelectorAll(
      '[data-recording], [data-meeting-id], .recording-item, [title*="recording" i]',
    );

    recordingElements.forEach((el, index) => {
      content.push({
        id: `recording-${Date.now()}-${index}`,
        type: 'recording',
        title: el.textContent?.trim() || `Recording ${index + 1}`,
        url: el.getAttribute('href') || el.getAttribute('data-url') || undefined,
        meetingId: el.getAttribute('data-meeting-id') || undefined,
        metadata: {
          isRecording: true,
          created: new Date(),
        },
        access: {
          canView: true,
          canDownload: false,
          canShare: false,
          canRecord: false,
          canTranscribe: true,
        },
        element: el,
      });
    });

    // Look for shared content
    const sharedElements = element.querySelectorAll('.shared-content, .screen-share, .presentation-area');

    sharedElements.forEach((el, index) => {
      content.push({
        id: `shared-${Date.now()}-${index}`,
        type: 'shared-screen',
        title: `Shared Content ${index + 1}`,
        metadata: {
          isLive: true,
        },
        access: {
          canView: true,
          canDownload: false,
          canShare: false,
          canRecord: true,
          canTranscribe: true,
        },
        element: el,
      });
    });

    return content;
  }

  /**
   * Determine area state
   */
  private determineAreaState(element: Element): TeamsContentArea['state'] {
    const computedStyle = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      return 'hidden';
    }

    if (rect.width < 100 || rect.height < 100) {
      return 'minimized';
    }

    if (element.classList.contains('inactive') || element.getAttribute('aria-hidden') === 'true') {
      return 'inactive';
    }

    return 'active';
  }

  /**
   * Detect meeting controls
   */
  private detectMeetingControls(): TeamsMeetingControls {
    const controlBar = this.detectControlBar();
    const secondaryControls = this.detectSecondaryControls();
    const meetingOptions = this.detectMeetingOptions();
    const participantControls = this.detectParticipantControls();

    return {
      controlBar,
      secondaryControls,
      meetingOptions,
      participantControls,
    };
  }

  /**
   * Detect main control bar
   */
  private detectControlBar(): TeamsMeetingControls['controlBar'] {
    const selector = '.calling-controls, .meeting-controls, .bottom-bar';
    const container = document.querySelector(selector);

    if (!container) {
      return {
        selector,
        controls: [],
        isVisible: false,
      };
    }

    const controls = this.extractControlsFromContainer(container, 'control-bar');

    return {
      selector,
      controls,
      isVisible: this.isElementVisible(container),
    };
  }

  /**
   * Detect secondary controls
   */
  private detectSecondaryControls(): TeamsMeetingControls['secondaryControls'] {
    const selector = '.secondary-controls, .overflow-controls, .more-controls';
    const container = document.querySelector(selector);

    if (!container) {
      return {
        selector,
        controls: [],
        isVisible: false,
      };
    }

    const controls = this.extractControlsFromContainer(container, 'secondary');

    return {
      selector,
      controls,
      isVisible: this.isElementVisible(container),
    };
  }

  /**
   * Detect meeting options
   */
  private detectMeetingOptions(): TeamsMeetingControls['meetingOptions'] {
    const selector = '.meeting-options, .settings-controls, .meeting-settings';
    const container = document.querySelector(selector);

    if (!container) {
      return {
        selector,
        controls: [],
        isVisible: false,
      };
    }

    const controls = this.extractControlsFromContainer(container, 'options');

    return {
      selector,
      controls,
      isVisible: this.isElementVisible(container),
    };
  }

  /**
   * Detect participant controls
   */
  private detectParticipantControls(): TeamsMeetingControls['participantControls'] | undefined {
    const selector = '.participant-controls, .roster-controls, .people-controls';
    const container = document.querySelector(selector);

    if (!container) {
      return undefined;
    }

    const controls = this.extractControlsFromContainer(container, 'participants');

    return {
      selector,
      controls,
      isVisible: this.isElementVisible(container),
    };
  }

  /**
   * Extract controls from container element
   */
  private extractControlsFromContainer(container: Element, context: string): TeamsControl[] {
    const controls: TeamsControl[] = [];
    const controlElements = container.querySelectorAll('button, [role="button"], input, select');

    controlElements.forEach((element, index) => {
      const id = element.id || `${context}-control-${index}`;
      const type = this.determineControlType(element);
      const action = this.determineControlAction(element);
      const selector = this.generateControlSelector(element, container);

      controls.push({
        id,
        type,
        action,
        selector,
        isEnabled: !element.hasAttribute('disabled'),
        element,
      });

      this.controls.set(id, controls[controls.length - 1]);
    });

    return controls;
  }

  /**
   * Determine control type
   */
  private determineControlType(element: Element): TeamsControl['type'] {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'button' || element.getAttribute('role') === 'button') {
      return element.getAttribute('aria-pressed') ? 'toggle' : 'button';
    }

    if (tagName === 'input') {
      const inputType = element.getAttribute('type');
      if (inputType === 'range') return 'slider';
      return 'input';
    }

    if (tagName === 'select' || element.getAttribute('role') === 'combobox') {
      return 'dropdown';
    }

    return 'button';
  }

  /**
   * Determine control action
   */
  private determineControlAction(element: Element): string {
    // Try to extract action from various attributes
    const action =
      element.getAttribute('data-action') ||
      element.getAttribute('data-tid') ||
      element.getAttribute('aria-label') ||
      element.textContent?.trim() ||
      'unknown';

    return action.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Generate control selector
   */
  private generateControlSelector(element: Element, container: Element): string {
    // Create relative selector within container
    const containerSelector = this.getElementSelector(container);
    const elementIndex = Array.from(container.children).indexOf(element as HTMLElement);

    if (element.id) {
      return `#${element.id}`;
    }

    if (element.className) {
      return `${containerSelector} .${element.className.split(' ')[0]}`;
    }

    return `${containerSelector} > :nth-child(${elementIndex + 1})`;
  }

  /**
   * Get element selector
   */
  private getElementSelector(element: Element): string {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }

  /**
   * Check if element is visible
   */
  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  /**
   * Analyze Teams layout
   */
  private async analyzeTeamsLayout(): Promise<void> {
    if (!this.pageInfo) return;

    // Register injection zones
    this.pageInfo.layout.injectionZones.forEach(zone => {
      this.injectionZones.set(zone.id, zone);
    });

    // Store content areas
    this.pageInfo.contentAreas.forEach(area => {
      this.contentAreas.set(area.id, area);
    });

    // Setup layout observer for adaptive behavior
    this.setupLayoutObserver();
  }

  /**
   * Setup layout observer for adaptive behavior
   */
  private setupLayoutObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.layoutObserver = new ResizeObserver(entries => {
        this.handleLayoutChanges(entries);
      });

      // Observe main containers
      const mainContainers = document.querySelectorAll('.ts-calling-screen, .meeting-stage, .teams-app');
      mainContainers.forEach(container => {
        this.layoutObserver?.observe(container);
      });
    }
  }

  /**
   * Handle layout changes
   */
  private handleLayoutChanges(entries: ResizeObserverEntry[]): void {
    entries.forEach(entry => {
      const element = entry.target;
      const newSize = entry.contentRect;

      // Update breakpoints
      if (this.pageInfo) {
        this.pageInfo.layout.breakpoints = this.detectResponsiveBreakpoints();
      }

      // Update injection zone availability
      this.updateInjectionZoneAvailability();

      // Notify layout change
      const layoutChange = {
        element,
        newSize,
        breakpoint: this.pageInfo?.layout.breakpoints.current,
      };

      this.handleLayoutChange(layoutChange);
    });
  }

  /**
   * Update injection zone availability based on current layout
   */
  private updateInjectionZoneAvailability(): void {
    if (!this.pageInfo) return;

    const currentBreakpoint = this.pageInfo.layout.breakpoints.current;
    const currentMeetingState = this.pageInfo.meetingContext;
    const currentViewMode = this.pageInfo.viewMode;

    this.injectionZones.forEach(zone => {
      const isAvailable =
        zone.availability.screenSizes.includes(currentBreakpoint) &&
        zone.availability.meetingStates.includes(currentMeetingState) &&
        zone.availability.viewModes.includes(currentViewMode) &&
        document.querySelector(zone.selector) !== null;

      // Update zone availability
      (zone as TeamsInjectionZone & { isCurrentlyAvailable?: boolean }).isCurrentlyAvailable = isAvailable;
    });
  }

  /**
   * Handle layout change
   */
  private handleLayoutChange(_change: { type: string; target?: Element }): void {
    // Emit layout change event for components to adapt
    // TODO: Implement layout change handling
  }

  /**
   * Detect meeting content
   */
  private async detectMeetingContent(): Promise<void> {
    // Collect meeting content from all areas
    this.contentAreas.forEach(area => {
      area.meetingContent.forEach(content => {
        this.meetingContent.set(content.id, content);
      });
    });

    // Look for additional meeting content
    await this.detectAdditionalMeetingContent();
  }

  /**
   * Detect additional meeting content
   */
  private async detectAdditionalMeetingContent(): Promise<void> {
    // Look for Teams recording links
    const recordingLinks = document.querySelectorAll(
      'a[href*="stream.microsoft.com"], a[href*="teams.microsoft.com"][href*="recording"]',
    );

    recordingLinks.forEach((link, index) => {
      const href = link.getAttribute('href') || '';
      const title = link.textContent?.trim() || `Teams Recording ${index + 1}`;

      const content: TeamsMeetingContent = {
        id: `teams-recording-${Date.now()}-${index}`,
        type: 'recording',
        title,
        url: href,
        metadata: {
          format: 'teams-stream',
          created: new Date(),
          isRecording: true,
        },
        access: {
          canView: true,
          canDownload: false,
          canShare: true,
          canRecord: false,
          canTranscribe: true,
        },
        element: link,
      };

      this.meetingContent.set(content.id, content);
    });

    // Look for active meeting content
    const activeMeeting = document.querySelector('.ts-calling-screen, .meeting-stage');
    if (activeMeeting && this.pageInfo?.meetingContext === 'in-meeting') {
      const content: TeamsMeetingContent = {
        id: `live-meeting-${Date.now()}`,
        type: 'live-stream',
        title: 'Live Meeting',
        metadata: {
          isLive: true,
          created: new Date(),
        },
        access: {
          canView: true,
          canDownload: false,
          canShare: false,
          canRecord: true,
          canTranscribe: true,
        },
        element: activeMeeting,
      };

      this.meetingContent.set(content.id, content);
    }
  }

  /**
   * Setup adaptive monitoring for Teams
   */
  private setupAdaptiveMonitoring(): void {
    // Monitor meeting state changes
    mutationObserver.onContentDetection(newContent => {
      this.handleNewContent(newContent);
    });

    // Monitor layout changes
    mutationObserver.onPageChange(changes => {
      this.handlePageChanges(changes);
    });

    // Start monitoring
    mutationObserver.startMonitoring();
  }

  /**
   * Handle new content detection
   */
  private handleNewContent(newContent: Array<{ element?: Element; links?: Element[] }>): void {
    newContent.forEach(content => {
      // Process Teams-specific content
      if (content.element) {
        const teamsContent = this.extractTeamsContentInfo(content.element);
        if (teamsContent) {
          this.meetingContent.set(teamsContent.id, teamsContent);
        }
      }
    });
  }

  /**
   * Extract Teams content information
   */
  private extractTeamsContentInfo(element: Element): TeamsMeetingContent | null {
    // Check for Teams-specific content indicators
    if (element.matches('a[href*="stream.microsoft.com"], a[href*="teams"][href*="recording"]')) {
      return {
        id: `dynamic-teams-${Date.now()}`,
        type: 'recording',
        title: element.textContent?.trim() || 'Teams Recording',
        url: element.getAttribute('href') || undefined,
        metadata: {
          format: 'teams',
          created: new Date(),
        },
        access: {
          canView: true,
          canDownload: false,
          canShare: true,
          canRecord: false,
          canTranscribe: true,
        },
        element,
      };
    }

    return null;
  }

  /**
   * Handle page changes
   */
  private handlePageChanges(changes: Array<{ type: string; target?: Element }>): void {
    // Re-analyze if significant changes detected
    const significantChanges = changes.filter(
      change => change.type === 'layout-change' || change.type === 'navigation' || change.affectsMeetingContent,
    );

    if (significantChanges.length > 0) {
      // Debounce re-analysis
      setTimeout(() => {
        this.reanalyzeInterface();
      }, 1000);
    }
  }

  /**
   * Re-analyze Teams interface
   */
  private async reanalyzeInterface(): Promise<void> {
    try {
      const newPageInfo = await this.detectTeamsInterface();
      if (newPageInfo) {
        this.pageInfo = newPageInfo;
        await this.analyzeTeamsLayout();
        await this.detectMeetingContent();
      }
    } catch (error) {
      console.error('Failed to re-analyze Teams interface:', error);
    }
  }

  /**
   * Create integration context
   */
  private createIntegrationContext(): PageIntegrationContext {
    if (!this.pageInfo) {
      throw new Error('Page info not available');
    }

    const availableContent: MeetingContentInfo[] = Array.from(this.meetingContent.values()).map(content => ({
      id: content.id,
      type: content.type,
      title: content.title,
      location: content.url || '',
      accessibility: 'accessible',
      permissions: {
        canAccess: content.access.canView,
        canDownload: content.access.canDownload,
        canShare: content.access.canShare,
      },
      format: {
        type: content.metadata.format || 'unknown',
        duration: content.metadata.duration,
        size: content.metadata.size,
      },
      isLoading: false,
      confidence: 0.9,
    }));

    const injectionPoints: InjectionPointInfo[] = Array.from(this.injectionZones.values())
      .filter(zone => (zone as TeamsInjectionZone & { isCurrentlyAvailable?: boolean }).isCurrentlyAvailable !== false)
      .map(zone => ({
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
      contextId: `teams-${Date.now()}`,
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
          canShare: this.pageInfo.meetingContext === 'in-meeting',
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
        pageType: 'teams',
        layoutVariant: this.pageInfo.layout.variant,
        containers: {
          main: this.pageInfo.layout.structure.meetingStage,
          sidebar: this.pageInfo.layout.structure.sidePanel || this.pageInfo.layout.structure.chatPanel,
          header: this.pageInfo.layout.structure.header,
          footer: this.pageInfo.layout.structure.controlBar,
        },
        injectionPoints,
        theme: {
          colorScheme: this.pageInfo.layout.theme.mode,
          cssVariables: this.pageInfo.layout.theme.colors,
        },
        breakpoint: this.pageInfo.layout.breakpoints.current,
        constraints: {
          restrictions: [],
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        teamsInterfaceType: this.pageInfo.interfaceType,
        meetingContext: this.pageInfo.meetingContext,
        viewMode: this.pageInfo.viewMode,
        layoutVariant: this.pageInfo.layout.variant,
        contentAreas: this.pageInfo.contentAreas.length,
        meetingContent: this.meetingContent.size,
        platform: this.pageInfo.version.platform,
      },
    };
  }

  /**
   * Get optimal injection point for component type
   */
  getOptimalInjectionPoint(componentType: string): InjectionPoint | null {
    if (!this.pageInfo) return null;

    // Find suitable zones based on current context
    const currentBreakpoint = this.pageInfo.layout.breakpoints.current;
    const currentMeetingState = this.pageInfo.meetingContext;
    const currentViewMode = this.pageInfo.viewMode;

    const suitableZones = Array.from(this.injectionZones.values())
      .filter(
        zone =>
          zone.supportedComponents.includes(componentType) &&
          zone.availability.screenSizes.includes(currentBreakpoint) &&
          zone.availability.meetingStates.includes(currentMeetingState) &&
          zone.availability.viewModes.includes(currentViewMode) &&
          document.querySelector(zone.selector) !== null,
      )
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
   * Get meeting content found in Teams
   */
  getMeetingContent(): TeamsMeetingContent[] {
    return Array.from(this.meetingContent.values());
  }

  /**
   * Get page information
   */
  getPageInfo(): TeamsPageInfo | null {
    return this.pageInfo;
  }

  /**
   * Get available controls
   */
  getControls(): TeamsControl[] {
    return Array.from(this.controls.values());
  }

  /**
   * Cleanup handler resources
   */
  cleanup(): void {
    // Stop monitoring
    mutationObserver.stopMonitoring();

    // Disconnect layout observer
    if (this.layoutObserver) {
      this.layoutObserver.disconnect();
      this.layoutObserver = null;
    }

    // Clear registrations
    this.observerRegistrations.forEach(id => {
      eventManager.removeEventListener(id);
    });

    // Clear data
    this.contentAreas.clear();
    this.injectionZones.clear();
    this.meetingContent.clear();
    this.controls.clear();
  }
}

// Export handler class (already exported above)
