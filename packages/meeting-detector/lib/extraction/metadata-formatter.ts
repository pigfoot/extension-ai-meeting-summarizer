/**
 * Metadata Formatter
 * Formats and standardizes extracted metadata for consistent output
 */

import type { AgendaInfo } from './agenda-extractor';
import type { ParticipantInfo, ParticipantCount } from './participant-parser';
import type { MeetingMetadata } from '../types/index';

/**
 * Comprehensive metadata formatting and standardization
 */
export class MetadataFormatter {
  private formatters: Map<string, MetadataFieldFormatter> = new Map();
  private validators: Map<string, MetadataValidator> = new Map();

  constructor() {
    this.initializeFormatters();
    this.initializeValidators();
  }

  /**
   * Format and standardize meeting metadata
   */
  formatMeetingMetadata(
    rawMetadata: Partial<MeetingMetadata>,
    agenda?: AgendaInfo,
    participants?: ParticipantInfo[],
    participantCount?: ParticipantCount,
  ): FormattedMeetingMetadata {
    const formatted: FormattedMeetingMetadata = {
      basic: this.formatBasicInfo(rawMetadata),
      participants: this.formatParticipantInfo(participants, participantCount),
      agenda: this.formatAgendaInfo(agenda),
      technical: this.formatTechnicalInfo(rawMetadata),
      timestamps: this.formatTimestamps(rawMetadata),
      permissions: this.formatPermissions(rawMetadata.permissions),
      quality: this.assessMetadataQuality(rawMetadata, agenda, participants),
    };

    // Apply post-processing
    return this.applyPostProcessing(formatted);
  }

  /**
   * Format basic meeting information
   */
  formatBasicInfo(metadata: Partial<MeetingMetadata>): BasicMeetingInfo {
    return {
      title: this.formatTitle(metadata.title),
      description: this.formatDescription((metadata as unknown as { description?: string }).description),
      organizer: this.formatOrganizer(metadata.organizer),
      location: this.formatLocation(metadata.location),
      platform: this.detectPlatform(metadata),
      type: this.detectMeetingType(metadata),
      language: this.detectLanguage(metadata),
      timezone: this.detectTimezone(metadata),
    };
  }

  /**
   * Format participant information
   */
  formatParticipantInfo(participants?: ParticipantInfo[], count?: ParticipantCount): FormattedParticipantInfo {
    const formatted: FormattedParticipantInfo = {
      count: this.formatParticipantCount(count),
      list: this.formatParticipantList(participants),
      roles: this.formatParticipantRoles(participants),
      attendance: this.formatAttendanceInfo(participants),
      summary: this.generateParticipantSummary(participants, count),
    };

    return formatted;
  }

  /**
   * Format agenda information
   */
  formatAgendaInfo(agenda?: AgendaInfo): FormattedAgendaInfo {
    if (!agenda) {
      return {
        available: false,
        structure: 'none',
        itemCount: 0,
        estimatedDuration: 0,
        topics: [],
        objectives: [],
      };
    }

    return {
      available: true,
      title: this.formatTitle(agenda.title),
      structure: agenda.structure,
      itemCount: agenda.items.length,
      estimatedDuration: agenda.estimatedDuration || this.estimateDurationFromItems(agenda.items),
      topics: this.formatTopics(agenda.topics),
      objectives: this.formatObjectives(agenda.objectives),
      items: this.formatAgendaItems(agenda.items),
      priority: agenda.priority || 'medium',
    };
  }

  /**
   * Format technical metadata
   */
  formatTechnicalInfo(metadata: Partial<MeetingMetadata>): TechnicalInfo {
    return {
      platformIds: this.formatPlatformIds(metadata.platformIds),
      urls: this.formatUrls(metadata),
      mediaInfo: this.formatMediaInfo(metadata),
      integrations: this.detectIntegrations(metadata),
      apiEndpoints: this.extractApiEndpoints(metadata),
    };
  }

  /**
   * Format timestamp information
   */
  formatTimestamps(metadata: Partial<MeetingMetadata>): TimestampInfo {
    const now = new Date();

    return {
      scheduled: this.formatDate(metadata.date),
      started: this.formatDate((metadata as unknown as { startTime?: Date }).startTime),
      ended: this.formatDate((metadata as unknown as { endTime?: Date }).endTime),
      duration: this.formatDuration(metadata.duration),
      recorded: this.formatDate((metadata as unknown as { recordedDate?: Date }).recordedDate),
      lastModified: this.formatDate((metadata as unknown as { lastModified?: Date }).lastModified),
      timezone: this.detectTimezone(metadata),
      isUpcoming: metadata.date ? metadata.date > now : false,
      isPast: metadata.date ? metadata.date < now : false,
    };
  }

  /**
   * Format permissions and access control
   */
  formatPermissions(permissions?: unknown): PermissionInfo {
    return {
      canView: permissions?.canView ?? true,
      canDownload: permissions?.canDownload ?? false,
      canShare: permissions?.canShare ?? false,
      canEdit: permissions?.canEdit ?? false,
      requiresAuth: permissions?.requiresAuth ?? true,
      accessLevel: this.determineAccessLevel(permissions),
      restrictions: this.formatRestrictions(permissions?.restrictions),
    };
  }

  /**
   * Assess overall metadata quality
   */
  assessMetadataQuality(
    metadata: Partial<MeetingMetadata>,
    agenda?: AgendaInfo,
    participants?: ParticipantInfo[],
  ): MetadataQuality {
    const scores = {
      completeness: this.assessCompleteness(metadata, agenda, participants),
      accuracy: this.assessAccuracy(metadata),
      consistency: this.assessConsistency(metadata),
      reliability: this.assessReliability(metadata),
    };

    const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / 4;

    return {
      overall: this.scoreToGrade(overallScore),
      scores,
      issues: this.identifyQualityIssues(metadata, agenda, participants),
      suggestions: this.generateImprovementSuggestions(scores),
    };
  }

  // Private formatting methods

  private initializeFormatters(): void {
    this.formatters.set('title', {
      format: (value: string) => this.cleanAndCapitalize(value),
      validate: (value: string) => value.length >= 3 && value.length <= 200,
    });

    this.formatters.set('name', {
      format: (value: string) => this.formatPersonName(value),
      validate: (value: string) => /^[A-Za-z\s,.-]+$/.test(value),
    });

    this.formatters.set('email', {
      format: (value: string) => value.toLowerCase().trim(),
      validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    });

    this.formatters.set('duration', {
      format: (value: number) => Math.max(0, Math.round(value)),
      validate: (value: number) => value >= 0 && value <= 86400, // Max 24 hours
    });
  }

  private initializeValidators(): void {
    this.validators.set('meeting', {
      required: ['title'],
      optional: ['description', 'organizer', 'date', 'duration'],
      validate: (metadata: unknown) => this.validateMeetingMetadata(metadata),
    });
  }

  private formatTitle(title?: string): string {
    if (!title) return 'Unknown Meeting';

    const formatter = this.formatters.get('title')!;
    const cleaned = this.removeCommonPrefixes(title.trim());

    return formatter.format(cleaned);
  }

  private formatDescription(description?: string): string {
    if (!description) return '';

    return description.trim().replace(/\s+/g, ' ').substring(0, 1000);
  }

  private formatOrganizer(organizer?: string): string {
    if (!organizer) return '';

    const formatter = this.formatters.get('name')!;
    return formatter.format(organizer);
  }

  private formatLocation(location?: string): string {
    if (!location) return '';

    // Clean up common location formats
    return location.replace(/^(Location:|Venue:|At:)\s*/i, '').trim();
  }

  private detectPlatform(metadata: Partial<MeetingMetadata>): MeetingPlatform {
    const indicators = [
      { platform: 'teams' as const, patterns: [/teams\.microsoft/i, /msteams/i] },
      { platform: 'sharepoint' as const, patterns: [/sharepoint/i, /\.sharepoint\./i] },
      { platform: 'zoom' as const, patterns: [/zoom\.us/i, /zoom/i] },
      { platform: 'webex' as const, patterns: [/webex/i, /cisco/i] },
      { platform: 'meet' as const, patterns: [/meet\.google/i, /google.*meet/i] },
    ];

    const content = JSON.stringify(metadata).toLowerCase();

    for (const indicator of indicators) {
      if (indicator.patterns.some(pattern => pattern.test(content))) {
        return indicator.platform;
      }
    }

    return 'unknown';
  }

  private detectMeetingType(metadata: Partial<MeetingMetadata>): MeetingType {
    const title = metadata.title?.toLowerCase() || '';
    const description = (metadata as unknown as { description?: string }).description?.toLowerCase() || '';
    const content = `${title} ${description}`;

    const typeIndicators = [
      { type: 'standup' as const, patterns: [/standup/i, /daily.*meeting/i, /scrum/i] },
      { type: 'review' as const, patterns: [/review/i, /retrospective/i, /post.*mortem/i] },
      { type: 'planning' as const, patterns: [/planning/i, /roadmap/i, /strategy/i] },
      { type: 'presentation' as const, patterns: [/presentation/i, /demo/i, /showcase/i] },
      { type: 'training' as const, patterns: [/training/i, /workshop/i, /learning/i] },
      { type: 'interview' as const, patterns: [/interview/i, /hiring/i, /candidate/i] },
    ];

    for (const indicator of typeIndicators) {
      if (indicator.patterns.some(pattern => pattern.test(content))) {
        return indicator.type;
      }
    }

    return 'general';
  }

  private detectLanguage(metadata: Partial<MeetingMetadata>): string {
    // Simple language detection based on common words
    const content =
      `${metadata.title || ''} ${(metadata as unknown as { description?: string }).description || ''}`.toLowerCase();

    const languageIndicators = [
      { lang: 'zh-TW', patterns: [/[\u4e00-\u9fff]/] }, // Chinese characters
      { lang: 'ja', patterns: [/[\u3040-\u309f\u30a0-\u30ff]/] }, // Japanese
      { lang: 'ko', patterns: [/[\uac00-\ud7af]/] }, // Korean
      { lang: 'es', patterns: [/\b(el|la|de|en|con|para|por)\b/] },
      { lang: 'fr', patterns: [/\b(le|la|de|du|avec|pour|dans)\b/] },
      { lang: 'de', patterns: [/\b(der|die|das|und|mit|für|in)\b/] },
    ];

    for (const indicator of languageIndicators) {
      if (indicator.patterns.some(pattern => pattern.test(content))) {
        return indicator.lang;
      }
    }

    return 'en'; // Default to English
  }

  private detectTimezone(metadata: Partial<MeetingMetadata>): string {
    // Try to detect timezone from various sources
    if (metadata.date) {
      const timezoneOffset = metadata.date.getTimezoneOffset();
      return this.offsetToTimezone(timezoneOffset);
    }

    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  private formatParticipantCount(count?: ParticipantCount): ParticipantCountSummary {
    return {
      total: count?.total || 0,
      present: count?.present || 0,
      absent: count?.absent || 0,
      invited: count?.invited || 0,
      attendance_rate: count && count.invited > 0 ? Math.round((count.present / count.invited) * 100) : 0,
    };
  }

  private formatParticipantList(participants?: ParticipantInfo[]): FormattedParticipant[] {
    if (!participants || participants.length === 0) {
      return [];
    }

    return participants.map(participant => ({
      name: this.formatPersonName(participant.name),
      email: participant.email || undefined,
      role: this.standardizeRole(participant.role),
      status: participant.status,
      attendance: {
        joined: participant.joinTime,
        left: participant.leaveTime,
        duration: this.calculateParticipantDuration(participant),
      },
    }));
  }

  private formatParticipantRoles(participants?: ParticipantInfo[]): RoleSummary {
    const roles: RoleSummary = {
      organizers: 0,
      presenters: 0,
      attendees: 0,
      optional: 0,
      unknown: 0,
    };

    if (!participants) return roles;

    for (const participant of participants) {
      const standardRole = this.standardizeRole(participant.role);
      switch (standardRole) {
        case 'organizer':
          roles.organizers++;
          break;
        case 'presenter':
          roles.presenters++;
          break;
        case 'attendee':
          roles.attendees++;
          break;
        case 'optional':
          roles.optional++;
          break;
        default:
          roles.unknown++;
      }
    }

    return roles;
  }

  private formatAttendanceInfo(participants?: ParticipantInfo[]): AttendanceInfo {
    if (!participants || participants.length === 0) {
      return {
        on_time: 0,
        late: 0,
        early_leave: 0,
        full_attendance: 0,
        average_duration: 0,
      };
    }

    // Simplified attendance analysis
    return {
      on_time: participants.filter(p => p.status === 'online').length,
      late: participants.filter(p => p.status === 'away').length,
      early_leave: 0, // Would require more complex timing analysis
      full_attendance: participants.filter(p => p.joinTime && !p.leaveTime).length,
      average_duration: this.calculateAverageParticipantDuration(participants),
    };
  }

  private generateParticipantSummary(participants?: ParticipantInfo[], count?: ParticipantCount): string {
    if (!participants && !count) {
      return 'No participant information available';
    }

    const total = count?.total || participants?.length || 0;
    const present = count?.present || participants?.filter(p => p.status === 'online').length || 0;

    if (total === 0) {
      return 'No participants recorded';
    }

    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
    return `${present} of ${total} participants present (${attendanceRate}% attendance)`;
  }

  private formatTopics(topics: string[]): string[] {
    return topics
      .map(topic => this.cleanAndCapitalize(topic))
      .filter(topic => topic.length >= 3)
      .slice(0, 10); // Limit to 10 topics
  }

  private formatObjectives(objectives: string[]): string[] {
    return objectives
      .map(objective => this.cleanAndCapitalize(objective))
      .filter(objective => objective.length >= 5)
      .slice(0, 5); // Limit to 5 objectives
  }

  private formatAgendaItems(items: unknown[]): FormattedAgendaItem[] {
    return items.map(item => ({
      order: item.order,
      title: this.formatTitle(item.title),
      description: item.description || '',
      duration: item.duration,
      presenter: item.presenter ? this.formatPersonName(item.presenter) : undefined,
      time_slot: item.timeSlot,
    }));
  }

  private estimateDurationFromItems(items: unknown[]): number {
    const totalItemDuration = items.reduce((total, item) => total + (item.duration || 0), 0);
    return totalItemDuration || items.length * 15; // Default 15 min per item
  }

  private formatPlatformIds(platformIds?: unknown): unknown {
    if (!platformIds) return {};

    const formatted: unknown = {};

    if (platformIds.meetingId) {
      formatted.meeting_id = platformIds.meetingId;
    }
    if (platformIds.threadId) {
      formatted.thread_id = platformIds.threadId;
    }
    if (platformIds.channelId) {
      formatted.channel_id = platformIds.channelId;
    }

    return formatted;
  }

  private formatUrls(metadata: Partial<MeetingMetadata>): unknown {
    return {
      join_url: (metadata as unknown as { joinUrl?: string }).joinUrl,
      recording_url: (metadata as unknown as { recordingUrl?: string }).recordingUrl,
      share_url: (metadata as unknown as { shareUrl?: string }).shareUrl,
    };
  }

  private formatMediaInfo(metadata: Partial<MeetingMetadata>): unknown {
    return {
      has_recording: !!(metadata as unknown as { recordingUrl?: string }).recordingUrl,
      has_audio: !!(metadata as unknown as { audioUrl?: string }).audioUrl,
      has_video: !!(metadata as unknown as { videoUrl?: string }).videoUrl,
      format: (metadata as unknown as { format?: string }).format || 'unknown',
    };
  }

  private detectIntegrations(metadata: Partial<MeetingMetadata>): string[] {
    const integrations: string[] = [];
    const content = JSON.stringify(metadata).toLowerCase();

    const integrationPatterns = [
      { name: 'calendar', pattern: /calendar|outlook|ical/i },
      { name: 'chat', pattern: /chat|slack|teams.*chat/i },
      { name: 'storage', pattern: /onedrive|sharepoint|dropbox|drive/i },
      { name: 'recording', pattern: /stream|recording|video/i },
    ];

    for (const integration of integrationPatterns) {
      if (integration.pattern.test(content)) {
        integrations.push(integration.name);
      }
    }

    return integrations;
  }

  private extractApiEndpoints(metadata: Partial<MeetingMetadata>): string[] {
    // Extract potential API endpoints from metadata
    const endpoints: string[] = [];
    const content = JSON.stringify(metadata);

    const urlPattern = /https?:\/\/[^\s"'}]+(?:api|endpoint|service)[^\s"'}]*/gi;
    const matches = content.match(urlPattern);

    if (matches) {
      endpoints.push(...matches);
    }

    return endpoints;
  }

  private formatDate(date?: Date): string | undefined {
    if (!date) return undefined;
    return date.toISOString();
  }

  private formatDuration(duration?: number): number | undefined {
    if (typeof duration !== 'number') return undefined;
    const formatter = this.formatters.get('duration')!;
    return formatter.format(duration);
  }

  private determineAccessLevel(permissions?: unknown): AccessLevel {
    if (!permissions) return 'restricted';

    if (permissions.canEdit) return 'full';
    if (permissions.canDownload) return 'read_write';
    if (permissions.canView) return 'read_only';

    return 'restricted';
  }

  private formatRestrictions(restrictions?: string[]): string[] {
    if (!restrictions) return [];
    return restrictions.filter(Boolean).map(r => r.trim());
  }

  // Quality assessment methods

  private assessCompleteness(
    metadata: Partial<MeetingMetadata>,
    agenda?: AgendaInfo,
    participants?: ParticipantInfo[],
  ): number {
    const fields = {
      title: !!metadata.title,
      organizer: !!metadata.organizer,
      date: !!metadata.date,
      participants: !!(participants && participants.length > 0),
      agenda: !!(agenda && agenda.items.length > 0),
      duration: !!metadata.duration,
    };

    const completedFields = Object.values(fields).filter(Boolean).length;
    return (completedFields / Object.keys(fields).length) * 100;
  }

  private assessAccuracy(metadata: Partial<MeetingMetadata>): number {
    let score = 100;

    // Check for obviously invalid data
    if (metadata.title && metadata.title.length < 3) score -= 20;
    if (metadata.date && !this.isValidMeetingDate(metadata.date)) score -= 30;
    if (metadata.duration && metadata.duration < 0) score -= 25;
    if (metadata.organizer && metadata.organizer.includes('@')) score -= 15;

    return Math.max(0, score);
  }

  private assessConsistency(metadata: Partial<MeetingMetadata>): number {
    // Check for consistency across different metadata fields
    let score = 100;

    // Add consistency checks here
    if (
      (metadata as unknown as { startTime?: Date; endTime?: Date }).startTime &&
      (metadata as unknown as { startTime?: Date; endTime?: Date }).endTime &&
      (metadata as unknown as { startTime?: Date; endTime?: Date }).startTime! >
        (metadata as unknown as { startTime?: Date; endTime?: Date }).endTime!
    ) {
      score -= 40;
    }

    return Math.max(0, score);
  }

  private assessReliability(metadata: Partial<MeetingMetadata>): number {
    // Assess how reliable the extraction seems
    let score = 100;

    // Lower score for missing critical information
    if (!metadata.title) score -= 30;
    if (!metadata.date) score -= 20;
    if (!metadata.organizer) score -= 15;

    return Math.max(0, score);
  }

  private scoreToGrade(score: number): QualityGrade {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'fair';
    if (score >= 60) return 'poor';
    return 'very_poor';
  }

  private identifyQualityIssues(
    metadata: Partial<MeetingMetadata>,
    agenda?: AgendaInfo,
    participants?: ParticipantInfo[],
  ): string[] {
    const issues: string[] = [];

    if (!metadata.title) issues.push('Missing meeting title');
    if (!metadata.date) issues.push('Missing meeting date');
    if (!metadata.organizer) issues.push('Missing organizer information');
    if (!participants || participants.length === 0) issues.push('No participant information');
    if (!agenda || agenda.items.length === 0) issues.push('No agenda information');

    return issues;
  }

  private generateImprovementSuggestions(scores: unknown): string[] {
    const suggestions: string[] = [];

    if (scores.completeness < 80) {
      suggestions.push('Add more complete meeting information');
    }
    if (scores.accuracy < 80) {
      suggestions.push('Verify extracted data accuracy');
    }
    if (scores.consistency < 80) {
      suggestions.push('Check for data consistency issues');
    }

    return suggestions;
  }

  // Helper methods

  private applyPostProcessing(formatted: FormattedMeetingMetadata): FormattedMeetingMetadata {
    // Apply any final formatting rules
    return formatted;
  }

  private removeCommonPrefixes(title: string): string {
    const prefixes = [/^Meeting:\s*/i, /^Call:\s*/i, /^Conference:\s*/i, /^Session:\s*/i];

    for (const prefix of prefixes) {
      title = title.replace(prefix, '');
    }

    return title;
  }

  private cleanAndCapitalize(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  private formatPersonName(name: string): string {
    return name.trim().replace(/[,()]/g, '').replace(/\s+/g, ' ');
  }

  private standardizeRole(role: string): string {
    const roleMap: Record<string, string> = {
      host: 'organizer',
      moderator: 'organizer',
      speaker: 'presenter',
      facilitator: 'presenter',
      member: 'attendee',
      guest: 'attendee',
      participant: 'attendee',
    };

    const lowerRole = role.toLowerCase();
    return roleMap[lowerRole] || lowerRole;
  }

  private calculateParticipantDuration(participant: ParticipantInfo): number | undefined {
    if (participant.joinTime && participant.leaveTime) {
      return Math.round((participant.leaveTime.getTime() - participant.joinTime.getTime()) / 1000 / 60);
    }
    return undefined;
  }

  private calculateAverageParticipantDuration(participants: ParticipantInfo[]): number {
    const durations = participants
      .map(p => this.calculateParticipantDuration(p))
      .filter((d): d is number => d !== undefined);

    if (durations.length === 0) return 0;
    return Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
  }

  private offsetToTimezone(offsetMinutes: number): string {
    const hours = Math.abs(Math.floor(offsetMinutes / 60));
    const minutes = Math.abs(offsetMinutes % 60);
    const sign = offsetMinutes <= 0 ? '+' : '-';

    return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  private isValidMeetingDate(date: Date): boolean {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    return date >= oneYearAgo && date <= oneYearFromNow;
  }

  private validateMeetingMetadata(metadata: unknown): boolean {
    return !!(metadata.title && metadata.title.length >= 3);
  }
}

// Supporting interfaces and types

export interface FormattedMeetingMetadata {
  basic: BasicMeetingInfo;
  participants: FormattedParticipantInfo;
  agenda: FormattedAgendaInfo;
  technical: TechnicalInfo;
  timestamps: TimestampInfo;
  permissions: PermissionInfo;
  quality: MetadataQuality;
}

export interface BasicMeetingInfo {
  title: string;
  description: string;
  organizer: string;
  location: string;
  platform: MeetingPlatform;
  type: MeetingType;
  language: string;
  timezone: string;
}

export interface FormattedParticipantInfo {
  count: ParticipantCountSummary;
  list: FormattedParticipant[];
  roles: RoleSummary;
  attendance: AttendanceInfo;
  summary: string;
}

export interface FormattedAgendaInfo {
  available: boolean;
  title?: string;
  structure: string;
  itemCount: number;
  estimatedDuration: number;
  topics: string[];
  objectives: string[];
  items?: FormattedAgendaItem[];
  priority?: string;
}

export interface TechnicalInfo {
  platformIds: unknown;
  urls: unknown;
  mediaInfo: unknown;
  integrations: string[];
  apiEndpoints: string[];
}

export interface TimestampInfo {
  scheduled?: string | undefined;
  started?: string | undefined;
  ended?: string | undefined;
  duration?: number | undefined;
  recorded?: string | undefined;
  lastModified?: string | undefined;
  timezone: string;
  isUpcoming: boolean;
  isPast: boolean;
}

export interface PermissionInfo {
  canView: boolean;
  canDownload: boolean;
  canShare: boolean;
  canEdit: boolean;
  requiresAuth: boolean;
  accessLevel: AccessLevel;
  restrictions: string[];
}

export interface MetadataQuality {
  overall: QualityGrade;
  scores: {
    completeness: number;
    accuracy: number;
    consistency: number;
    reliability: number;
  };
  issues: string[];
  suggestions: string[];
}

export interface ParticipantCountSummary {
  total: number;
  present: number;
  absent: number;
  invited: number;
  attendance_rate: number;
}

export interface FormattedParticipant {
  name: string;
  email?: string | undefined;
  role: string;
  status: string;
  attendance: {
    joined?: Date | undefined;
    left?: Date | undefined;
    duration?: number | undefined;
  };
}

export interface RoleSummary {
  organizers: number;
  presenters: number;
  attendees: number;
  optional: number;
  unknown: number;
}

export interface AttendanceInfo {
  on_time: number;
  late: number;
  early_leave: number;
  full_attendance: number;
  average_duration: number;
}

export interface FormattedAgendaItem {
  order: number;
  title: string;
  description: string;
  duration?: number | undefined;
  presenter?: string | undefined;
  time_slot?: string | undefined;
}

export type MeetingPlatform = 'teams' | 'sharepoint' | 'zoom' | 'webex' | 'meet' | 'unknown';

export type MeetingType = 'standup' | 'review' | 'planning' | 'presentation' | 'training' | 'interview' | 'general';

export type AccessLevel = 'full' | 'read_write' | 'read_only' | 'restricted';

export type QualityGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor';

interface MetadataFieldFormatter {
  format: (value: unknown) => unknown;
  validate: (value: unknown) => boolean;
}

interface MetadataValidator {
  required: string[];
  optional: string[];
  validate: (metadata: unknown) => boolean;
}

// Create singleton instance
export const metadataFormatter = new MetadataFormatter();
