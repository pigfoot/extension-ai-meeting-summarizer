/**
 * Manifest Resolver
 * Resolves streaming manifest URLs to direct media URLs
 */

import type { AudioUrlInfo } from '../types/index';

/**
 * Streaming manifest URL resolution for HLS and DASH content
 */
export class ManifestResolver {
  private manifestCache = new Map<string, ResolvedManifest>();
  private resolutionTimeouts = new Map<string, number>();

  constructor() {}

  /**
   * Resolve streaming manifest to direct media URLs
   */
  async resolveManifest(manifestUrl: string): Promise<ResolvedManifest | null> {
    try {
      // Check cache first
      if (this.manifestCache.has(manifestUrl)) {
        const cached = this.manifestCache.get(manifestUrl)!;
        if (this.isCacheValid(cached)) {
          return cached;
        }
      }

      // Determine manifest type
      const manifestType = this.determineManifestType(manifestUrl);
      if (manifestType === 'unknown') {
        return null;
      }

      // Fetch and parse manifest
      const manifest = await this.fetchAndParseManifest(manifestUrl, manifestType);
      if (manifest) {
        // Cache the result
        this.manifestCache.set(manifestUrl, manifest);

        // Set cache timeout
        this.setCacheTimeout(manifestUrl);
      }

      return manifest;
    } catch (error) {
      console.error('Manifest resolution error:', error);
      return null;
    }
  }

  /**
   * Extract best quality media URL from manifest
   */
  getBestQualityUrl(manifest: ResolvedManifest): AudioUrlInfo | null {
    if (manifest.streams.length === 0) {
      return null;
    }

    // Sort streams by quality (highest first)
    const sortedStreams = manifest.streams.sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));

    const bestStream = sortedStreams[0];

    if (!bestStream) {
      throw new Error('No suitable stream found in manifest');
    }

    return {
      url: bestStream.url,
      format: manifest.type === 'hls' ? 'hls' : 'dash',
      size: undefined,
      duration: manifest.duration,
      authTokens: this.extractAuthTokens(bestStream.url),
      accessibility: 'unknown',
      quality: {
        audioBitrate: bestStream.bandwidth,
        resolution: bestStream.resolution,
        codec: bestStream.codec,
      },
    };
  }

  /**
   * Get all available quality streams
   */
  getAllQualityUrls(manifest: ResolvedManifest): AudioUrlInfo[] {
    return manifest.streams.map(stream => ({
      url: stream.url,
      format: manifest.type === 'hls' ? 'hls' : 'dash',
      size: undefined,
      duration: manifest.duration,
      authTokens: this.extractAuthTokens(stream.url),
      accessibility: 'unknown',
      quality: {
        audioBitrate: stream.bandwidth,
        resolution: stream.resolution,
        codec: stream.codec,
      },
    }));
  }

  /**
   * Check if URL is a streaming manifest
   */
  isManifestUrl(url: string): boolean {
    const manifestPatterns = [
      /\.m3u8(?.*)?$/i, // HLS
      /\.mpd(?.*)?$/i, // DASH
      /\/manifest(?.*)?$/i, // Generic manifest
      /\/playlist\.m3u8/i, // HLS playlist
      /\/master\.m3u8/i, // HLS master playlist
    ];

    return manifestPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Resolve HLS playlist to segment URLs
   */
  async resolveHlsPlaylist(playlistUrl: string): Promise<HlsResolution | null> {
    try {
      const response = await fetch(playlistUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const playlistContent = await response.text();
      return this.parseHlsPlaylist(playlistContent, playlistUrl);
    } catch (error) {
      console.error('HLS playlist resolution error:', error);
      return null;
    }
  }

  /**
   * Resolve DASH manifest to segment URLs
   */
  async resolveDashManifest(manifestUrl: string): Promise<DashResolution | null> {
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const manifestContent = await response.text();
      void manifestContent; // TODO: Use for DASH manifest parsing
      // For now, return basic DASH structure
      // TODO: Implement proper DASH manifest parsing
      return {
        manifestUrl,
        type: 'dash',
        adaptationSets: [
          {
            mimeType: 'video/mp4',
            representations: [
              {
                id: 'default',
                bandwidth: 1000000,
                width: 1920,
                height: 1080,
                codecs: 'avc1.42E01E',
              },
            ],
          },
        ],
      };
    } catch (error) {
      console.error('DASH manifest resolution error:', error);
      return null;
    }
  }

  // Private methods

  private determineManifestType(url: string): ManifestType {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('.m3u8') || urlLower.includes('hls')) {
      return 'hls';
    }

    if (urlLower.includes('.mpd') || urlLower.includes('dash')) {
      return 'dash';
    }

    if (urlLower.includes('manifest')) {
      // Try to determine from context
      if (urlLower.includes('stream')) {
        return 'hls'; // Assume HLS for streaming contexts
      }
    }

    return 'unknown';
  }

  private async fetchAndParseManifest(manifestUrl: string, type: ManifestType): Promise<ResolvedManifest | null> {
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();

      switch (type) {
        case 'hls':
          return await this.parseHlsManifest(manifestUrl, content);
        case 'dash':
          return await this.parseDashManifestAsResolved(content, manifestUrl);
        default:
          return null;
      }
    } catch (error) {
      console.error(`${type.toUpperCase()} manifest fetch error:`, error);
      return null;
    }
  }

  private async parseHlsManifest(manifestUrl: string, content: string): Promise<ResolvedManifest | null> {
    try {
      const lines = content
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      const streams: MediaStream[] = [];
      const baseUrl = this.getBaseUrl(manifestUrl);

      let currentStreamInfo: Partial<MediaStream> = {};
      let duration: number | undefined;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Parse playlist header
        if (line.startsWith('#EXTM3U')) {
          continue;
        }

        // Parse target duration
        if (line.startsWith('#EXT-X-TARGETDURATION:')) {
          const parts = line.split(':');
          if (parts[1]) {
            const targetDuration = parseInt(parts[1]);
            if (!isNaN(targetDuration)) {
              duration = targetDuration;
            }
          }
          continue;
        }

        // Parse stream info
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
          currentStreamInfo = this.parseHlsStreamInfo(line);
          continue;
        }

        // Parse segment info
        if (line.startsWith('#EXTINF:')) {
          const parts = line.split(':');
          if (parts[1]) {
            const durationPart = parts[1].split(',')[0];
            if (durationPart) {
              const segmentDuration = parseFloat(durationPart);
              if (!isNaN(segmentDuration)) {
                duration = (duration || 0) + segmentDuration;
              }
            }
          }
          continue;
        }

        // Parse stream URL
        if (!line.startsWith('#') && currentStreamInfo.bandwidth !== undefined) {
          const streamUrl = this.resolveUrl(line, baseUrl);
          streams.push({
            url: streamUrl,
            bandwidth: currentStreamInfo.bandwidth,
            resolution: currentStreamInfo.resolution,
            codec: currentStreamInfo.codec,
          });
          currentStreamInfo = {};
        }

        // Parse segment URL
        if (!line.startsWith('#') && !currentStreamInfo.bandwidth) {
          // This is a media segment, not a variant stream
          const segmentUrl = this.resolveUrl(line, baseUrl);
          streams.push({
            url: segmentUrl,
            bandwidth: undefined,
            resolution: undefined,
            codec: undefined,
          });
        }
      }

      return {
        type: 'hls',
        originalUrl: manifestUrl,
        streams,
        duration,
        resolvedAt: new Date(),
      };
    } catch (error) {
      console.error('HLS parsing error:', error);
      return null;
    }
  }

  private parseHlsStreamInfo(line: string): Partial<MediaStream> {
    const streamInfo: Partial<MediaStream> = {};

    // Parse bandwidth
    const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
    if (bandwidthMatch && bandwidthMatch[1]) {
      streamInfo.bandwidth = parseInt(bandwidthMatch[1]);
    }

    // Parse resolution
    const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
    if (resolutionMatch && resolutionMatch[1]) {
      streamInfo.resolution = resolutionMatch[1];
    }

    // Parse codecs
    const codecsMatch = line.match(/CODECS="([^"]+)"/);
    if (codecsMatch && codecsMatch[1]) {
      streamInfo.codec = codecsMatch[1];
    }

    return streamInfo;
  }

  private parseDashDuration(duration: string | null | undefined): number | undefined {
    if (!duration) return undefined;

    // Parse ISO 8601 duration format: PT1H30M45S
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
    if (!match) return undefined;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseFloat(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  private resolveUrl(url: string, baseUrl: string): string {
    try {
      if (url.startsWith('http')) {
        return url;
      }

      const base = new URL(baseUrl);
      return new URL(url, base.href).href;
    } catch {
      return url;
    }
  }

  private parseHlsPlaylist(content: string, playlistUrl: string): HlsResolution | null {
    try {
      const lines = content
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      const segments: HlsSegment[] = [];
      const baseUrl = this.getBaseUrl(playlistUrl);

      let currentSegment: Partial<HlsSegment> = {};

      for (const line of lines) {
        if (line.startsWith('#EXTINF:')) {
          const parts = line.substring(8).split(',');
          currentSegment.duration = parts[0] ? parseFloat(parts[0]) : 0;
          currentSegment.title = parts[1] || undefined;
        } else if (!line.startsWith('#')) {
          // This is a segment URL
          const segmentUrl = this.resolveUrl(line, baseUrl);
          segments.push({
            url: segmentUrl,
            duration: currentSegment.duration || 0,
            title: currentSegment.title,
          });
          currentSegment = {};
        }
      }

      return {
        type: 'hls',
        playlistUrl,
        segments,
        totalDuration: segments.reduce((total, segment) => total + segment.duration, 0),
      };
    } catch (error) {
      console.error('HLS playlist parsing error:', error);
      return null;
    }
  }

  private async parseDashManifestAsResolved(content: string, manifestUrl: string): Promise<ResolvedManifest | null> {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');

      const streams: MediaStream[] = [];
      const baseUrl = this.getBaseUrl(manifestUrl);
      void baseUrl; // TODO: Use for resolving relative URLs

      const adaptationSetElements = xmlDoc.querySelectorAll('AdaptationSet');

      for (const adaptationSet of adaptationSetElements) {
        const representationElements = adaptationSet.querySelectorAll('Representation');

        for (const representation of representationElements) {
          const bandwidth = parseInt(representation.getAttribute('bandwidth') || '0');
          const width = parseInt(representation.getAttribute('width') || '0');
          const height = parseInt(representation.getAttribute('height') || '0');
          const codecs = representation.getAttribute('codecs') || undefined;

          streams.push({
            url: manifestUrl, // In DASH, the manifest URL is used to construct segment URLs
            bandwidth,
            resolution: width && height ? `${width}x${height}` : undefined,
            codec: codecs,
          });
        }
      }

      return {
        type: 'dash',
        originalUrl: manifestUrl,
        streams,
        duration: this.parseDashDuration(xmlDoc.documentElement.getAttribute('mediaPresentationDuration')),
        resolvedAt: new Date(),
      };
    } catch (error) {
      console.error('DASH manifest parsing error:', error);
      return null;
    }
  }

  private parseDashManifest(content: string, manifestUrl: string): DashResolution | null {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');

      const adaptationSets: DashAdaptationSet[] = [];
      const baseUrl = this.getBaseUrl(manifestUrl);
      void baseUrl; // TODO: Use for resolving relative URLs

      const adaptationSetElements = xmlDoc.querySelectorAll('AdaptationSet');

      for (const adaptationSet of adaptationSetElements) {
        const mimeType = adaptationSet.getAttribute('mimeType') || '';
        const representations: DashRepresentation[] = [];

        const representationElements = adaptationSet.querySelectorAll('Representation');

        for (const representation of representationElements) {
          representations.push({
            id: representation.getAttribute('id') || '',
            bandwidth: parseInt(representation.getAttribute('bandwidth') || '0'),
            width: parseInt(representation.getAttribute('width') || '0'),
            height: parseInt(representation.getAttribute('height') || '0'),
            codecs: representation.getAttribute('codecs') || '',
          });
        }

        adaptationSets.push({
          mimeType,
          representations,
        });
      }

      return {
        type: 'dash',
        manifestUrl,
        adaptationSets,
      };
    } catch (error) {
      console.error('DASH manifest parsing error:', error);
      return null;
    }
  }

  private getBaseUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/'))}/`;
    } catch {
      return '';
    }
  }

  private extractAuthTokens(url: string): unknown[] {
    // Extract authentication tokens from URL parameters
    // This is a simplified implementation
    const tokens: unknown[] = [];

    try {
      const urlObj = new URL(url);

      // Check for common token parameters
      const tokenParams = ['token', 'auth', 'access_token', 'bearer'];

      for (const param of tokenParams) {
        const value = urlObj.searchParams.get(param);
        if (value) {
          tokens.push({
            type: 'query_param',
            value,
            scope: param,
          });
        }
      }
    } catch {
      // Ignore URL parsing errors
    }

    return tokens;
  }

  private isCacheValid(manifest: ResolvedManifest): boolean {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return Date.now() - manifest.resolvedAt.getTime() < maxAge;
  }

  private setCacheTimeout(manifestUrl: string): void {
    // Clear existing timeout
    const existingTimeout = this.resolutionTimeouts.get(manifestUrl);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(
      () => {
        this.manifestCache.delete(manifestUrl);
        this.resolutionTimeouts.delete(manifestUrl);
      },
      10 * 60 * 1000,
    ); // 10 minutes

    this.resolutionTimeouts.set(manifestUrl, timeout as unknown as number);
  }
}

// Supporting interfaces

export interface ResolvedManifest {
  type: ManifestType;
  originalUrl: string;
  streams: MediaStream[];
  duration?: number | undefined;
  resolvedAt: Date;
}

export interface MediaStream {
  url: string;
  bandwidth?: number | undefined;
  resolution?: string | undefined;
  codec?: string | undefined;
}

export interface HlsResolution {
  type: 'hls';
  playlistUrl: string;
  segments: HlsSegment[];
  totalDuration: number;
}

export interface HlsSegment {
  url: string;
  duration: number;
  title?: string | undefined;
}

export interface DashResolution {
  type: 'dash';
  manifestUrl: string;
  adaptationSets: DashAdaptationSet[];
}

export interface DashAdaptationSet {
  mimeType: string;
  representations: DashRepresentation[];
}

export interface DashRepresentation {
  id: string;
  bandwidth: number;
  width: number;
  height: number;
  codecs: string;
}

export type ManifestType = 'hls' | 'dash' | 'unknown';

// Create singleton instance
export const manifestResolver = new ManifestResolver();
