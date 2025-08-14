/**
 * Media URL Scanner
 * Detects and extracts audio/video URLs from page content
 */

import type { AudioUrlInfo, MediaFormat, MediaQuality } from '../types/index';

/**
 * Audio/video URL detection and extraction from page content
 */
export class MediaUrlScanner {
  private supportedFormats: Map<string, MediaFormat> = new Map();
  private urlPatterns: RegExp[] = [];
  private scannedUrls = new Set<string>();

  constructor() {
    this.initializeSupportedFormats();
    this.initializeUrlPatterns();
  }

  /**
   * Scan page for media URLs
   */
  scanPageForMediaUrls(document: Document): AudioUrlInfo[] {
    const mediaUrls: AudioUrlInfo[] = [];

    try {
      // Clear previously scanned URLs for this scan
      this.scannedUrls.clear();

      // Scan HTML5 media elements
      mediaUrls.push(...this.scanHtml5MediaElements(document));

      // Scan link elements for media files
      mediaUrls.push(...this.scanLinkElements(document));

      // Scan source elements in media containers
      mediaUrls.push(...this.scanSourceElements(document));

      // Scan data attributes for media URLs
      mediaUrls.push(...this.scanDataAttributes(document));

      // Scan iframe sources for embedded media
      mediaUrls.push(...this.scanIframeElements(document));

      // Scan script elements for dynamic media URLs
      mediaUrls.push(...this.scanScriptElements(document));

      // Remove duplicates and invalid URLs
      return this.deduplicateAndValidate(mediaUrls);
    } catch (error) {
      console.error('Media URL scanning error:', error);
      return [];
    }
  }

  /**
   * Extract media URLs from text content
   */
  extractUrlsFromText(text: string): AudioUrlInfo[] {
    const mediaUrls: AudioUrlInfo[] = [];

    try {
      // URL regex patterns for different media formats
      const urlRegex = /https?:\/\/[^\s<>"]+/g;
      const matches = text.match(urlRegex) || [];

      for (const match of matches) {
        if (this.isMediaUrl(match)) {
          const audioInfo = this.createAudioUrlInfo(match, 'text_extraction');
          if (audioInfo) {
            mediaUrls.push(audioInfo);
          }
        }
      }
    } catch (error) {
      console.error('Text URL extraction error:', error);
    }

    return mediaUrls;
  }

  /**
   * Validate media URL format and accessibility
   */
  async validateMediaUrl(url: string): Promise<MediaUrlValidation> {
    const validation: MediaUrlValidation = {
      url,
      isValid: false,
      format: 'unknown',
      accessible: false,
      fileSize: undefined,
      duration: undefined,
      error: undefined,
    };

    try {
      // Basic URL validation
      const urlObj = new URL(url);
      void urlObj; // URL validation successful
      validation.isValid = true;

      // Determine format
      validation.format = this.determineMediaFormat(url);

      // Check accessibility
      const accessibilityCheck = await this.checkUrlAccessibility(url);
      validation.accessible = accessibilityCheck.accessible;
      validation.statusCode = accessibilityCheck.statusCode;
      validation.contentType = accessibilityCheck.contentType;

      // Extract file information if accessible
      if (validation.accessible && accessibilityCheck.headers) {
        validation.fileSize = this.extractFileSize(accessibilityCheck.headers);
        validation.lastModified = accessibilityCheck.headers.get('last-modified');
      }
    } catch (error) {
      validation.error = error instanceof Error ? error.message : 'Unknown validation error';
    }

    return validation;
  }

  /**
   * Check if URL points to supported media format
   */
  isMediaUrl(url: string): boolean {
    try {
      const urlLower = url.toLowerCase();

      // Check file extensions
      for (const [extension] of this.supportedFormats) {
        if (urlLower.includes(`.${extension}`)) {
          return true;
        }
      }

      // Check URL patterns
      return this.urlPatterns.some(pattern => pattern.test(url));
    } catch {
      return false;
    }
  }

  /**
   * Determine media format from URL
   */
  determineMediaFormat(url: string): MediaFormat {
    try {
      const urlLower = url.toLowerCase();

      // Check for specific formats
      for (const [extension, format] of this.supportedFormats) {
        if (urlLower.includes(`.${extension}`)) {
          return format;
        }
      }

      // Check for streaming formats
      if (urlLower.includes('m3u8') || urlLower.includes('hls')) {
        return 'hls';
      }

      if (urlLower.includes('mpd') || urlLower.includes('dash')) {
        return 'dash';
      }

      // Check for platform-specific patterns
      if (urlLower.includes('microsoftstream.com')) {
        return 'mp4'; // Stream typically serves MP4
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // Private methods

  private initializeSupportedFormats(): void {
    this.supportedFormats.set('mp4', 'mp4');
    this.supportedFormats.set('mp3', 'mp3');
    this.supportedFormats.set('wav', 'wav');
    this.supportedFormats.set('m4a', 'm4a');
    this.supportedFormats.set('webm', 'webm');
    this.supportedFormats.set('ogg', 'webm'); // Map OGG to webm for compatibility
    this.supportedFormats.set('oga', 'webm');
    this.supportedFormats.set('flac', 'wav'); // Map FLAC to wav for compatibility
  }

  private initializeUrlPatterns(): void {
    this.urlPatterns = [
      // Direct media file patterns
      /\.(mp4|mp3|wav|m4a|webm|ogg|oga|flac)(\?.*)?$/i,

      // Streaming media patterns
      /\.m3u8(\?.*)?$/i, // HLS
      /\.mpd(\?.*)?$/i, // DASH

      // Platform-specific patterns
      /microsoftstream\.com.*\/video/i,
      /sharepoint\.com.*\.(mp4|mp3|wav|m4a)/i,
      /teams\.microsoft\.com.*recording/i,

      // Generic streaming patterns
      /\/stream\/.*\.(mp4|mp3)/i,
      /\/media\/.*\.(mp4|mp3|wav)/i,
      /\/recordings?\/.*\.(mp4|mp3|wav)/i,
    ];
  }

  private scanHtml5MediaElements(document: Document): AudioUrlInfo[] {
    const mediaUrls: AudioUrlInfo[] = [];

    // Scan audio elements
    const audioElements = document.querySelectorAll('audio');
    for (const audio of audioElements) {
      const src = audio.src || audio.currentSrc;
      if (src && !this.scannedUrls.has(src)) {
        this.scannedUrls.add(src);
        const audioInfo = this.createAudioUrlInfoFromElement(audio, src, 'audio_element');
        if (audioInfo) {
          mediaUrls.push(audioInfo);
        }
      }
    }

    // Scan video elements
    const videoElements = document.querySelectorAll('video');
    for (const video of videoElements) {
      const src = video.src || video.currentSrc;
      if (src && !this.scannedUrls.has(src)) {
        this.scannedUrls.add(src);
        const audioInfo = this.createAudioUrlInfoFromElement(video, src, 'video_element');
        if (audioInfo) {
          mediaUrls.push(audioInfo);
        }
      }
    }

    return mediaUrls;
  }

  private scanLinkElements(document: Document): AudioUrlInfo[] {
    const mediaUrls: AudioUrlInfo[] = [];

    const links = document.querySelectorAll('a[href]');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && this.isMediaUrl(href) && !this.scannedUrls.has(href)) {
        this.scannedUrls.add(href);
        const audioInfo = this.createAudioUrlInfo(href, 'link_element', {
          linkText: link.textContent || undefined,
          downloadAttribute: link.hasAttribute('download'),
        });
        if (audioInfo) {
          mediaUrls.push(audioInfo);
        }
      }
    }

    return mediaUrls;
  }

  private scanSourceElements(document: Document): AudioUrlInfo[] {
    const mediaUrls: AudioUrlInfo[] = [];

    const sourceElements = document.querySelectorAll('source[src]');
    for (const source of sourceElements) {
      const src = source.getAttribute('src');
      if (src && this.isMediaUrl(src) && !this.scannedUrls.has(src)) {
        this.scannedUrls.add(src);
        const audioInfo = this.createAudioUrlInfo(src, 'source_element', {
          type: source.getAttribute('type') || undefined,
          media: source.getAttribute('media') || undefined,
        });
        if (audioInfo) {
          mediaUrls.push(audioInfo);
        }
      }
    }

    return mediaUrls;
  }

  private scanDataAttributes(document: Document): AudioUrlInfo[] {
    const mediaUrls: AudioUrlInfo[] = [];

    // Common data attributes for media URLs
    const dataAttributes = [
      'data-src',
      'data-url',
      'data-media-url',
      'data-audio-url',
      'data-video-url',
      'data-recording-url',
      'data-stream-url',
    ];

    for (const attr of dataAttributes) {
      const elements = document.querySelectorAll(`[${attr}]`);
      for (const element of elements) {
        const url = element.getAttribute(attr);
        if (url && this.isMediaUrl(url) && !this.scannedUrls.has(url)) {
          this.scannedUrls.add(url);
          const audioInfo = this.createAudioUrlInfo(url, 'data_attribute', {
            attribute: attr,
            elementTag: element.tagName.toLowerCase(),
          });
          if (audioInfo) {
            mediaUrls.push(audioInfo);
          }
        }
      }
    }

    return mediaUrls;
  }

  private scanIframeElements(document: Document): AudioUrlInfo[] {
    const mediaUrls: AudioUrlInfo[] = [];

    const iframes = document.querySelectorAll('iframe[src]');
    for (const iframe of iframes) {
      const src = iframe.getAttribute('src');
      if (src && this.isEmbeddedMediaUrl(src) && !this.scannedUrls.has(src)) {
        this.scannedUrls.add(src);
        const audioInfo = this.createAudioUrlInfo(src, 'iframe_element', {
          title: iframe.getAttribute('title') || undefined,
          width: iframe.getAttribute('width') || undefined,
          height: iframe.getAttribute('height') || undefined,
        });
        if (audioInfo) {
          mediaUrls.push(audioInfo);
        }
      }
    }

    return mediaUrls;
  }

  private scanScriptElements(document: Document): AudioUrlInfo[] {
    const mediaUrls: AudioUrlInfo[] = [];

    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const scriptContent = script.textContent || '';
      if (scriptContent.length > 0) {
        const extractedUrls = this.extractUrlsFromText(scriptContent);
        mediaUrls.push(...extractedUrls);
      }
    }

    return mediaUrls;
  }

  private createAudioUrlInfoFromElement(element: HTMLMediaElement, url: string, source: string): AudioUrlInfo | null {
    void source;
    try {
      return {
        url,
        format: this.determineMediaFormat(url),
        size: undefined,
        duration: element.duration && !isNaN(element.duration) ? element.duration : undefined,
        authTokens: [],
        accessibility: 'unknown',
        quality: this.extractQualityFromElement(element),
      };
    } catch (error) {
      console.error('Error creating AudioUrlInfo from element:', error);
      return null;
    }
  }

  private createAudioUrlInfo(url: string, source: string, metadata?: Record<string, unknown>): AudioUrlInfo | null {
    void source;
    void metadata;
    try {
      return {
        url,
        format: this.determineMediaFormat(url),
        size: undefined,
        duration: undefined,
        authTokens: [],
        accessibility: 'unknown',
        quality: undefined,
      };
    } catch (error) {
      console.error('Error creating AudioUrlInfo:', error);
      return null;
    }
  }

  private extractQualityFromElement(element: HTMLMediaElement): MediaQuality | undefined {
    const quality: Partial<MediaQuality> = {};

    if (element instanceof HTMLVideoElement) {
      quality.resolution = `${element.videoWidth}x${element.videoHeight}`;
      quality.videoBitrate = undefined; // Not directly available
    }

    // Audio quality information is not directly available from HTML5 elements
    quality.audioBitrate = undefined;
    quality.sampleRate = undefined;
    quality.codec = undefined;

    return Object.keys(quality).length > 0 ? (quality as MediaQuality) : undefined;
  }

  private isEmbeddedMediaUrl(url: string): boolean {
    const embeddedMediaPatterns = [
      /microsoftstream\.com/i,
      /youtube\.com\/embed/i,
      /vimeo\.com\/video/i,
      /teams\.microsoft\.com.*embed/i,
    ];

    return embeddedMediaPatterns.some(pattern => pattern.test(url));
  }

  private async checkUrlAccessibility(url: string): Promise<AccessibilityCheck> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors', // Avoid CORS issues for basic accessibility check
      });

      return {
        accessible: response.ok || response.type === 'opaque',
        statusCode: response.status,
        contentType: response.headers.get('content-type'),
        headers: response.headers,
      };
    } catch (error) {
      return {
        accessible: false,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private extractFileSize(headers: Headers): number | undefined {
    const contentLength = headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : undefined;
  }

  private deduplicateAndValidate(mediaUrls: AudioUrlInfo[]): AudioUrlInfo[] {
    const urlMap = new Map<string, AudioUrlInfo>();

    // Deduplicate by URL
    for (const audioInfo of mediaUrls) {
      if (!urlMap.has(audioInfo.url)) {
        urlMap.set(audioInfo.url, audioInfo);
      }
    }

    // Validate and filter
    return Array.from(urlMap.values()).filter(audioInfo => {
      try {
        new URL(audioInfo.url);
        return true;
      } catch {
        return false;
      }
    });
  }
}

// Supporting interfaces

export interface MediaUrlValidation {
  url: string;
  isValid: boolean;
  format: MediaFormat;
  accessible: boolean;
  fileSize?: number | undefined;
  duration?: number | undefined;
  statusCode?: number | undefined;
  contentType?: string | null | undefined;
  lastModified?: string | null | undefined;
  error?: string | undefined;
}

interface AccessibilityCheck {
  accessible: boolean;
  statusCode: number;
  contentType?: string | null;
  headers?: Headers;
  error?: string;
}

// Create singleton instance
export const mediaUrlScanner = new MediaUrlScanner();
