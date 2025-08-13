/**
 * SharePoint Analyzer
 * Specialized analysis for SharePoint pages and meeting content
 */

import { pageClassifier } from '../detection/page-classifier';
import type { MeetingMetadata } from '../types/index';
import type { PageAnalysisResult, ContentIndicator, AnalyzedElement, SharePointPagePattern } from '../types/page';

/**
 * SharePoint-specific page analysis and meeting detection
 */
export class SharePointAnalyzer {
  private patterns: SharePointPagePattern[] = [];
  private documentLibrarySelectors: string[] = [];
  private meetingWorkspaceSelectors: string[] = [];

  constructor() {
    this.initializePatterns();
    this.initializeSelectors();
  }

  /**
   * Analyze SharePoint page for meeting content
   */
  async analyzeSharePointPage(url: string, document: Document): Promise<PageAnalysisResult> {
    const startTime = Date.now();

    try {
      // Basic page classification
      const basicAnalysis = await pageClassifier.classifyPage(url, _document);

      // SharePoint-specific analysis
      const sharePointElements = this.analyzeSharePointStructure(document);
      const documentLibraryInfo = this.analyzeDocumentLibrary(document);
      const meetingWorkspaceInfo = this.analyzeMeetingWorkspace(document);
      const streamIntegration = this.analyzeStreamIntegration(document);

      // Combine indicators
      const indicators = [
        ...basicAnalysis.indicators,
        ...this.getDocumentLibraryIndicators(documentLibraryInfo),
        ...this.getMeetingWorkspaceIndicators(meetingWorkspaceInfo),
        ...this.getStreamIndicators(streamIntegration),
      ];

      // Enhanced analysis result
      return {
        ...basicAnalysis,
        elements: [...basicAnalysis.elements, ...sharePointElements],
        indicators,
        confidence: this.calculateSharePointConfidence(indicators, sharePointElements),
        analysisTime: Date.now() - startTime,
        pageMetadata: {
          ...basicAnalysis.pageMetadata,
          ...this.extractSharePointMetadata(document),
        },
      };
    } catch (error) {
      console.error('SharePoint analysis error:', error);
      throw error;
    }
  }

  /**
   * Analyze page for general page analysis interface
   */
  async analyzePage(document: Document, url: string): Promise<PageAnalysisResult> {
    const analysis = await this.analyzeSharePointPage(url, _document);
    return {
      platform: 'sharepoint' as const,
      confidence: analysis.confidence,
      isMeetingPage: analysis.confidence > 0.5,
      indicators: analysis.indicators || [],
      elements: analysis.elements || [],
      status: 'completed' as const,
      analysisTime: Date.now(),
      url: url,
      errors: analysis.errors || [],
      pageMetadata: analysis.pageMetadata || {},
    };
  }

  /**
   * Extract meeting metadata from SharePoint page
   */
  extractMeetingMetadata(document: Document, url: string): MeetingMetadata {
    const metadata: Partial<MeetingMetadata> = {
      title: '',
      participants: [],
      topics: [],
    };

    try {
      // Extract title from various sources
      metadata.title = this.extractMeetingTitle(document);

      // Extract date information
      metadata.date = this.extractMeetingDate(document);

      // Extract organizer information
      metadata.organizer = this.extractOrganizer(document);

      // Extract participants
      metadata.participants = this.extractParticipants(document);

      // Extract duration
      metadata.duration = this.extractDuration(document);

      // Extract topics from content
      metadata.topics = this.extractTopics(document);

      // Extract SharePoint-specific IDs
      metadata.platformIds = this.extractSharePointIds(url, _document);

      // Extract location/context
      metadata.location = this.extractLocation(document);

      // Extract permissions
      metadata.permissions = this.extractPermissions(document);
    } catch (error) {
      console.error('Metadata extraction error:', error);
    }

    return {
      title: metadata.title || 'Unknown Meeting',
      participants: metadata.participants || [],
      topics: metadata.topics || [],
      date: metadata.date,
      organizer: metadata.organizer,
      duration: metadata.duration,
      platformIds: metadata.platformIds,
      location: metadata.location,
      permissions: metadata.permissions,
    };
  }

  /**
   * Detect meeting folders in document library
   */
  detectMeetingFolders(document: Document): MeetingFolderInfo[] {
    const folders: MeetingFolderInfo[] = [];

    try {
      // Look for folder items in document library
      const folderSelectors = [
        '[data-automationid="DetailsListCell"][data-item-key*="folder"]',
        '.ms-DetailsRow[data-item-key*="folder"]',
        '.od-ItemTile-folder',
      ];

      for (const selector of folderSelectors) {
        const folderElements = document.querySelectorAll(selector);

        for (const element of folderElements) {
          const folderInfo = this.analyzeFolderElement(element);
          if (folderInfo && this.isMeetingFolder(folderInfo)) {
            folders.push(folderInfo);
          }
        }
      }

      // Alternative method: analyze folder names in breadcrumbs
      const breadcrumbFolders = this.analyzeBreadcrumbFolders(document);
      folders.push(...breadcrumbFolders);
    } catch (error) {
      console.error('Meeting folder detection error:', error);
    }

    return folders;
  }

  /**
   * Analyze document library structure
   */
  analyzeDocumentLibrary(document: Document): DocumentLibraryInfo {
    const info: DocumentLibraryInfo = {
      isDocumentLibrary: false,
      itemCount: 0,
      hasRecordings: false,
      recordings: [],
      folders: [],
      viewType: 'unknown',
    };

    try {
      // Check if this is a document library
      info.isDocumentLibrary = this.isDocumentLibraryPage(document);

      if (!info.isDocumentLibrary) {
        return info;
      }

      // Extract library name
      info.libraryName = this.extractLibraryName(document);

      // Count items
      info.itemCount = this.countLibraryItems(document);

      // Detect view type
      info.viewType = this.detectViewType(document);

      // Find recordings
      info.recordings = this.findRecordingsInLibrary(document);
      info.hasRecordings = info.recordings.length > 0;

      // Find meeting folders
      info.folders = this.detectMeetingFolders(document);
    } catch (error) {
      console.error('Document library analysis error:', error);
    }

    return info;
  }

  /**
   * Analyze meeting workspace
   */
  analyzeMeetingWorkspace(document: Document): MeetingWorkspaceInfo {
    const info: MeetingWorkspaceInfo = {
      isMeetingWorkspace: false,
      features: [],
      agendaItems: [],
      documents: [],
      decisions: [],
    };

    try {
      // Check if this is a meeting workspace
      info.isMeetingWorkspace = this.isMeetingWorkspacePage(document);

      if (!info.isMeetingWorkspace) {
        return info;
      }

      // Extract workspace name
      info.workspaceName = this.extractWorkspaceName(document);

      // Detect available features
      info.features = this.detectWorkspaceFeatures(document);

      // Extract agenda items
      info.agendaItems = this.extractAgendaItems(document);

      // Find documents
      info.documents = this.findWorkspaceDocuments(document);

      // Extract decisions
      info.decisions = this.extractDecisions(document);
    } catch (error) {
      console.error('Meeting workspace analysis error:', error);
    }

    return info;
  }

  /**
   * Analyze Stream integration
   */
  analyzeStreamIntegration(document: Document): StreamIntegrationInfo {
    const info: StreamIntegrationInfo = {
      hasStreamIntegration: false,
      streamVideos: [],
      streamChannels: [],
      embeddedPlayers: [],
    };

    try {
      // Check for Stream web parts or components
      const streamSelectors = [
        '[data-component-id*="Stream"]',
        '.StreamWebPart',
        '[class*="stream-video"]',
        '.ms-StreamVideo',
      ];

      let hasStreamContent = false;

      for (const selector of streamSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          hasStreamContent = true;

          // Extract all stream video info from document
          const streamVideos = this.extractStreamVideoInfo(document);
          info.streamVideos.push(...streamVideos);
        }
      }

      // Check for embedded Stream players
      const embeddedPlayers = this.extractEmbeddedPlayerInfo(document);
      info.embeddedPlayers.push(...embeddedPlayers);

      info.hasStreamIntegration = hasStreamContent || info.embeddedPlayers.length > 0;
    } catch (error) {
      console.error('Stream integration analysis error:', error);
    }

    return info;
  }

  // Private methods

  private initializePatterns(): void {
    this.patterns = [
      {
        name: 'Document Library',
        description: 'SharePoint document library with potential recordings',
        selectors: [
          {
            selector: '.ms-DetailsList',
            description: 'Modern list view',
            platform: 'sharepoint',
            elementType: 'content_area',
            required: true,
          },
          {
            selector: '[data-automationid="DetailsList"]',
            description: 'Details list component',
            platform: 'sharepoint',
            elementType: 'content_area',
            required: false,
          },
        ],
        versions: ['sharepoint_online'],
        confidence: 0.8,
        meetingIndicators: ['recordings', 'meetings', 'audio', 'video'],
      },
      {
        name: 'Meeting Workspace',
        description: 'SharePoint meeting workspace site',
        selectors: [
          {
            selector: '.ms-meetingWorkspace',
            description: 'Meeting workspace container',
            platform: 'sharepoint',
            elementType: 'content_area',
            required: true,
          },
        ],
        versions: ['sharepoint_2019', 'sharepoint_online'],
        confidence: 0.9,
        meetingIndicators: ['agenda', 'minutes', 'decisions', 'action items'],
      },
      {
        name: 'Stream Integration',
        description: 'Microsoft Stream video integration',
        selectors: [
          {
            selector: '[data-component-id*="Stream"]',
            description: 'Stream web part',
            platform: 'sharepoint',
            elementType: 'media_player',
            required: true,
          },
        ],
        versions: ['sharepoint_online'],
        confidence: 0.95,
        meetingIndicators: ['video', 'recording', 'stream'],
      },
    ];
  }

  private initializeSelectors(): void {
    this.documentLibrarySelectors = [
      '.ms-DetailsList',
      '.od-Files-list',
      '[data-automationid="DetailsList"]',
      '.ms-List',
      '.ms-GroupedList',
    ];

    this.meetingWorkspaceSelectors = [
      '.ms-meetingWorkspace',
      '[data-automation-id="meetingWorkspace"]',
      '.meeting-site-content',
    ];
  }

  private analyzeSharePointStructure(document: Document): AnalyzedElement[] {
    const elements: AnalyzedElement[] = [];

    // Analyze key SharePoint components
    const componentSelectors = [
      { selector: '.ms-Nav', type: 'navigation_element' as const },
      { selector: '.ms-CommandBar', type: 'toolbar' as const },
      { selector: '.ms-Panel', type: 'sidebar' as const },
      { selector: '[data-automation-id="contentScrollRegion"]', type: 'content_area' as const },
    ];

    for (const { selector, type } of componentSelectors) {
      const componentElements = document.querySelectorAll(selector);
      for (const element of componentElements) {
        elements.push(this.analyzeElement(element, type));
      }
    }

    return elements;
  }

  private analyzeElement(element: Element, elementType: unknown): AnalyzedElement {
    return {
      tagName: element.tagName,
      classes: Array.from(element.classList),
      id: element.id || undefined,
      textContent: element.textContent?.substring(0, 200) || '',
      attributes: this.getElementAttributes(element),
      selector: this.getElementSelector(element),
      elementType,
      relevance: this.calculateElementRelevance(element, elementType),
    };
  }

  private getElementAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (const attr of element.attributes) {
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  private getElementSelector(element: Element): string {
    if (element.id) return `#${element.id}`;

    let selector = element.tagName.toLowerCase();
    if (element.className) {
      const classes = element.className.toString().split(' ').filter(Boolean);
      if (classes.length > 0) {
        selector += `.${classes[0]}`;
      }
    }
    return selector;
  }

  private calculateElementRelevance(element: Element, elementType: string): number {
    let relevance = 0.5; // Base relevance

    const text = element.textContent?.toLowerCase() || '';
    const className = element.className.toString().toLowerCase();

    // Meeting-related keywords boost relevance
    if (text.includes('meeting') || text.includes('recording')) relevance += 0.3;
    if (className.includes('meeting') || className.includes('recording')) relevance += 0.2;

    // Element type specific adjustments
    if (elementType === 'media_player') relevance += 0.4;
    if (elementType === 'download_link') relevance += 0.3;

    return Math.min(1.0, relevance);
  }

  private getDocumentLibraryIndicators(info: DocumentLibraryInfo): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    if (info.isDocumentLibrary) {
      indicators.push({
        type: 'sharepoint_library',
        strength: 0.8,
        selector: '.ms-DetailsList',
        content: `Document Library: ${info.libraryName}`,
        priority: 'medium',
        context: {
          libraryName: info.libraryName,
          itemCount: info.itemCount,
          hasRecordings: info.hasRecordings,
        },
      });

      // Add indicators for recordings found
      for (const recording of info.recordings) {
        indicators.push({
          type: 'recording_link',
          strength: 0.9,
          selector: recording.selector,
          content: recording.name,
          priority: 'critical',
          context: {
            fileType: recording.fileType,
            size: recording.size,
          },
        });
      }
    }

    return indicators;
  }

  private getMeetingWorkspaceIndicators(info: MeetingWorkspaceInfo): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    if (info.isMeetingWorkspace) {
      indicators.push({
        type: 'meeting_metadata',
        strength: 0.9,
        selector: '.ms-meetingWorkspace',
        content: `Meeting Workspace: ${info.workspaceName}`,
        priority: 'high',
        context: {
          workspaceName: info.workspaceName,
          features: info.features,
          agendaItemCount: info.agendaItems.length,
        },
      });
    }

    return indicators;
  }

  private getStreamIndicators(info: StreamIntegrationInfo): ContentIndicator[] {
    const indicators: ContentIndicator[] = [];

    if (info.hasStreamIntegration) {
      for (const video of info.streamVideos) {
        indicators.push({
          type: 'video_player',
          strength: 0.95,
          selector: video.selector,
          content: video.title,
          priority: 'critical',
          context: {
            platform: 'stream',
            videoId: video.videoId,
            duration: video.duration,
          },
        });
      }

      for (const player of info.embeddedPlayers) {
        indicators.push({
          type: 'video_player',
          strength: 0.9,
          selector: 'iframe',
          content: player.title || 'Embedded Stream Video',
          priority: 'critical',
          context: {
            platform: 'stream',
            embedded: true,
            src: player.src,
          },
        });
      }
    }

    return indicators;
  }

  private calculateSharePointConfidence(indicators: ContentIndicator[], elements: AnalyzedElement[]): number {
    let confidence = 0.5;

    // Boost confidence for SharePoint-specific indicators
    const sharePointIndicators = indicators.filter(
      i => i.type === 'sharepoint_library' || i.context?.platform === 'sharepoint',
    );

    confidence += sharePointIndicators.length * 0.1;

    // Boost confidence for high-relevance elements
    const relevantElements = elements.filter(e => e.relevance > 0.7);
    confidence += relevantElements.length * 0.05;

    return Math.min(1.0, confidence);
  }

  private extractSharePointMetadata(document: Document): Record<string, unknown> {
    return {
      siteTitle: this.extractSiteTitle(document),
      listId: this.extractListId(document),
      webId: this.extractWebId(document),
      siteId: this.extractSiteId(document),
    };
  }

  // Additional helper methods would continue here...
  // For brevity, I'll include just the method signatures and key implementations

  private extractMeetingTitle(document: Document): string {
    // Implementation to extract meeting title from various SharePoint elements
    const titleSelectors = ['h1', '.ms-core-pageTitle', '[data-automation-id="pageTitle"]'];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    return document.title || 'Unknown Meeting';
  }

  private extractMeetingDate(_document: Document): Date | undefined {
    void _document;
    // Implementation to extract meeting date
    return undefined; // Placeholder
  }

  private extractOrganizer(_document: Document): string | undefined {
    void _document;
    // Implementation to extract meeting organizer
    return undefined; // Placeholder
  }

  private extractParticipants(_document: Document): string[] {
    void _document;
    // Implementation to extract participants
    return []; // Placeholder
  }

  private extractDuration(_document: Document): number | undefined {
    void _document;
    // Implementation to extract duration
    return undefined; // Placeholder
  }

  private extractTopics(_document: Document): string[] {
    void _document;
    // Implementation to extract topics
    return []; // Placeholder
  }

  private extractSharePointIds(_url: string, _document: Document): unknown {
    void _url;
    void _document;
    // Implementation to extract SharePoint-specific IDs
    return {}; // Placeholder
  }

  private extractLocation(_document: Document): string | undefined {
    void _document;
    // Implementation to extract location
    return undefined; // Placeholder
  }

  private extractPermissions(_document: Document): unknown {
    void _document;
    // Implementation to extract permissions
    return undefined; // Placeholder
  }

  private isDocumentLibraryPage(document: Document): boolean {
    return this.documentLibrarySelectors.some(selector => document.querySelector(selector) !== null);
  }

  private isMeetingWorkspacePage(document: Document): boolean {
    return this.meetingWorkspaceSelectors.some(selector => document.querySelector(selector) !== null);
  }

  private analyzeFolderElement(_element: Element): MeetingFolderInfo | null {
    void _element;
    // Implementation to analyze folder element
    return null; // Placeholder
  }

  private isMeetingFolder(_folderInfo: MeetingFolderInfo): boolean {
    void _folderInfo;
    // Implementation to check if folder is meeting-related
    return false; // Placeholder
  }

  private analyzeBreadcrumbFolders(_document: Document): MeetingFolderInfo[] {
    void _document;
    // Implementation to analyze breadcrumb folders
    return []; // Placeholder
  }

  // Additional methods would be implemented similarly...

  private extractSiteTitle(document: Document): string {
    return document.title || '';
  }

  private extractListId(_document: Document): string | undefined {
    void _document;
    return undefined; // Would extract from page context or data attributes
  }

  private extractWebId(_document: Document): string | undefined {
    void _document;
    return undefined; // Would extract from page context
  }

  private extractSiteId(_document: Document): string | undefined {
    void _document;
    return undefined; // Would extract from page context
  }

  // Missing methods required by document library analysis
  private extractLibraryName(document: Document): string | undefined {
    const titleElement = document.querySelector('.ms-CommandBar-title, [data-automation-id="pageTitle"]');
    return titleElement?.textContent?.trim();
  }

  private countLibraryItems(document: Document): number {
    const itemElements = document.querySelectorAll('[data-list-index], .ms-DocumentCard');
    return itemElements.length;
  }

  private detectViewType(document: Document): 'list' | 'tiles' | 'details' | 'unknown' {
    if (document.querySelector('.ms-DetailsList')) return 'list';
    if (document.querySelector('.ms-DocumentCard')) return 'tiles';
    if (document.querySelector('.ms-DetailsHeader')) return 'details';
    return 'unknown';
  }

  private findRecordingsInLibrary(document: Document): RecordingInfo[] {
    const recordings: RecordingInfo[] = [];
    const elements = document.querySelectorAll('[data-file-type]');

    elements.forEach(element => {
      const fileType = element.getAttribute('data-file-type');
      if (fileType && ['mp4', 'avi', 'wmv'].includes(fileType.toLowerCase())) {
        const nameElement = element.querySelector('.ms-DocumentCard-name, .ms-Link');
        recordings.push({
          name: nameElement?.textContent?.trim() || 'Unknown',
          selector: this.generateSelector(element),
          fileType: fileType,
          url: element.getAttribute('href') || undefined,
        });
      }
    });

    return recordings;
  }

  // Missing methods for workspace analysis
  private extractWorkspaceName(document: Document): string | undefined {
    const workspaceElement = document.querySelector('.ms-siteLogo-container .ms-HorizontalStack-child');
    return workspaceElement?.textContent?.trim();
  }

  private detectWorkspaceFeatures(document: Document): string[] {
    const features: string[] = [];
    if (document.querySelector('[data-automation-id="documentsWebPart"]')) features.push('documents');
    if (document.querySelector('[data-automation-id="tasksWebPart"]')) features.push('tasks');
    if (document.querySelector('[data-automation-id="calendarWebPart"]')) features.push('calendar');
    if (document.querySelector('[data-automation-id="linksWebPart"]')) features.push('links');
    return features;
  }

  private extractAgendaItems(document: Document): AgendaItem[] {
    const items: AgendaItem[] = [];
    const agendaElements = document.querySelectorAll('.agenda-item, [data-automation-id="agendaItem"]');

    agendaElements.forEach(element => {
      const title = element.querySelector('.title, .ms-DocumentCard-title')?.textContent?.trim();
      const description = element.querySelector('.description, .ms-DocumentCard-activity')?.textContent?.trim();
      const owner = element.querySelector('.owner, .ms-Persona-primaryText')?.textContent?.trim();

      if (title) {
        items.push({
          title,
          description,
          owner,
        });
      }
    });

    return items;
  }

  private findWorkspaceDocuments(document: Document): WorkspaceDocument[] {
    const documents: WorkspaceDocument[] = [];
    const docElements = document.querySelectorAll('.ms-DocumentCard, [data-automation-id="documentCard"]');

    docElements.forEach(element => {
      const nameElement = element.querySelector('.ms-DocumentCard-name, .ms-Link');
      const typeElement = element.querySelector('.ms-DocumentCard-type, [data-file-type]');
      const urlElement = element.querySelector('a[href]');

      if (nameElement) {
        documents.push({
          name: nameElement.textContent?.trim() || 'Unknown',
          type: typeElement?.textContent?.trim() || typeElement?.getAttribute('data-file-type') || 'unknown',
          url: urlElement?.getAttribute('href') || '',
        });
      }
    });

    return documents;
  }

  private extractDecisions(document: Document): Decision[] {
    const decisions: Decision[] = [];
    const decisionElements = document.querySelectorAll('.decision-item, [data-automation-id="decisionItem"]');

    decisionElements.forEach(element => {
      const title = element.querySelector('.title, .ms-TextField-field')?.textContent?.trim();
      const description = element.querySelector('.description, .ms-TextField-description')?.textContent?.trim();
      const owner = element.querySelector('.owner, .ms-Persona-primaryText')?.textContent?.trim();
      const dateStr = element.querySelector('.date, [data-automation-id="dateField"]')?.textContent?.trim();

      if (title && description) {
        decisions.push({
          title,
          description,
          owner,
          date: dateStr ? new Date(dateStr) : undefined,
        });
      }
    });

    return decisions;
  }

  // Missing methods for stream video analysis
  private extractStreamVideoInfo(document: Document): StreamVideo[] {
    const videos: StreamVideo[] = [];
    const videoElements = document.querySelectorAll('[data-automation-id="streamVideo"], .video-player-container');

    videoElements.forEach(element => {
      const titleElement = element.querySelector('.video-title, .ms-DocumentCard-title');
      const videoIdAttr = element.getAttribute('data-video-id') || element.getAttribute('data-item-id');
      const durationElement = element.querySelector('.duration, [data-automation-id="duration"]');
      const thumbnailElement = element.querySelector('img[src*="thumbnail"]');

      if (titleElement && videoIdAttr) {
        videos.push({
          title: titleElement.textContent?.trim() || 'Unknown Video',
          videoId: videoIdAttr,
          selector: this.generateSelector(element),
          duration: durationElement ? parseInt(durationElement.textContent || '0', 10) : undefined,
          thumbnail: thumbnailElement?.getAttribute('src') || undefined,
        });
      }
    });

    return videos;
  }

  private extractEmbeddedPlayerInfo(document: Document): EmbeddedPlayer[] {
    const players: EmbeddedPlayer[] = [];
    const iframeElements = document.querySelectorAll('iframe[src*="embed"], iframe[src*="player"]');

    iframeElements.forEach(iframe => {
      const src = iframe.getAttribute('src');
      if (src) {
        players.push({
          src,
          title: iframe.getAttribute('title') || undefined,
          width: iframe.getAttribute('width') ? parseInt(iframe.getAttribute('width')!, 10) : undefined,
          height: iframe.getAttribute('height') ? parseInt(iframe.getAttribute('height')!, 10) : undefined,
        });
      }
    });

    return players;
  }

  private generateSelector(element: Element): string {
    const selectors: string[] = [];
    let currentElement: Element | null = element;

    while (currentElement && currentElement !== document.documentElement) {
      let selector = currentElement.tagName.toLowerCase();

      if (currentElement.id) {
        selector += `#${currentElement.id}`;
        selectors.unshift(selector);
        break;
      }

      if (currentElement.className) {
        const classes = currentElement.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          selector += `.${classes[0]}`;
        }
      }

      selectors.unshift(selector);
      currentElement = currentElement.parentElement;

      if (selectors.length > 5) break;
    }

    return selectors.join(' > ');
  }
}

// Supporting interfaces

interface DocumentLibraryInfo {
  isDocumentLibrary: boolean;
  libraryName?: string | undefined;
  itemCount: number;
  hasRecordings: boolean;
  recordings: RecordingInfo[];
  folders: MeetingFolderInfo[];
  viewType: 'list' | 'tiles' | 'details' | 'unknown';
}

interface MeetingWorkspaceInfo {
  isMeetingWorkspace: boolean;
  workspaceName?: string | undefined;
  features: string[];
  agendaItems: AgendaItem[];
  documents: WorkspaceDocument[];
  decisions: Decision[];
}

interface StreamIntegrationInfo {
  hasStreamIntegration: boolean;
  streamVideos: StreamVideo[];
  streamChannels: StreamChannel[];
  embeddedPlayers: EmbeddedPlayer[];
}

interface MeetingFolderInfo {
  name: string;
  path: string;
  selector: string;
  confidence: number;
}

interface RecordingInfo {
  name: string;
  selector: string;
  fileType: string;
  size?: number | undefined;
  url?: string | undefined;
}

interface AgendaItem {
  title: string;
  description?: string | undefined;
  owner?: string | undefined;
}

interface WorkspaceDocument {
  name: string;
  type: string;
  url: string;
}

interface Decision {
  title: string;
  description: string;
  owner?: string | undefined;
  date?: Date | undefined;
}

interface StreamVideo {
  title: string;
  videoId: string;
  selector: string;
  duration?: number | undefined;
  thumbnail?: string | undefined;
}

interface StreamChannel {
  name: string;
  id: string;
  videoCount: number;
}

interface EmbeddedPlayer {
  src: string;
  title?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

// Create singleton instance
export const sharePointAnalyzer = new SharePointAnalyzer();
