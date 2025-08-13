/**
 * Participant Parser
 * Extracts attendee and participant list with role identification
 */

/**
 * Meeting participant parsing and role identification
 */
export class ParticipantParser {
  private rolePatterns: Map<string, RegExp[]> = new Map();
  private namePatterns: RegExp[] = [];
  private emailPatterns: RegExp[] = [];

  constructor() {
    this.initializeRolePatterns();
    this.initializeNamePatterns();
    this.initializeEmailPatterns();
  }

  /**
   * Extract participant information from page content
   */
  extractParticipants(document: Document): ParticipantInfo[] {
    const participants: ParticipantInfo[] = [];

    try {
      // Extract from dedicated participant lists
      participants.push(...this.extractFromParticipantLists(document));

      // Extract from user profile elements
      participants.push(...this.extractFromUserProfiles(document));

      // Extract from avatar/image elements
      participants.push(...this.extractFromAvatars(document));

      // Extract from text mentions
      participants.push(...this.extractFromTextMentions(document));

      // Extract from message/chat authors
      participants.push(...this.extractFromMessageAuthors(document));

      // Extract from structured data
      participants.push(...this.extractFromStructuredData(document));

      // Remove duplicates and merge information
      return this.deduplicateAndMerge(participants);
    } catch (error) {
      console.error('Participant extraction error:', error);
      return [];
    }
  }

  /**
   * Identify participant roles from context
   */
  identifyParticipantRoles(participants: ParticipantInfo[], document: Document): ParticipantInfo[] {
    void document;
    return participants.map(participant => {
      const role = this.determineParticipantRole(participant, document);
      return {
        ...participant,
        role: role || participant.role || 'participant',
      };
    });
  }

  /**
   * Extract organizer information specifically
   */
  extractOrganizer(document: Document): ParticipantInfo | null {
    const organizerSources = [
      // Specific organizer elements
      () => this.extractFromOrganizerElements(document),

      // Meeting creator elements
      () => this.extractFromCreatorElements(document),

      // Host indicators
      () => this.extractFromHostElements(document),

      // Author/owner elements
      () => this.extractFromAuthorElements(document),
    ];

    for (const source of organizerSources) {
      const organizer = source();
      if (organizer) {
        return {
          ...organizer,
          role: 'organizer',
        };
      }
    }

    return null;
  }

  /**
   * Parse participant count from page
   */
  extractParticipantCount(document: Document): ParticipantCount {
    const count: ParticipantCount = {
      total: 0,
      present: 0,
      absent: 0,
      invited: 0,
    };

    try {
      // Extract from count elements
      count.total = this.extractCountFromElements(document, [
        '[data-participant-count]',
        '.participant-count',
        '.attendee-count',
      ]);

      // Extract present count
      count.present = this.extractCountFromElements(document, [
        '[data-present-count]',
        '.present-count',
        '.online-count',
      ]);

      // Extract invited count
      count.invited = this.extractCountFromElements(document, [
        '[data-invited-count]',
        '.invited-count',
        '.total-invitees',
      ]);

      // Calculate absent if not directly available
      if (count.invited > 0 && count.present > 0) {
        count.absent = count.invited - count.present;
      }

      // Use total as fallback
      if (count.total === 0 && count.present > 0) {
        count.total = count.present;
      }
    } catch (error) {
      console.error('Participant count extraction error:', error);
    }

    return count;
  }

  /**
   * Extract participation timeline
   */
  extractParticipationTimeline(document: Document): ParticipationEvent[] {
    const events: ParticipationEvent[] = [];

    try {
      // Extract from timeline elements
      events.push(...this.extractFromTimelineElements(document));

      // Extract from chat/message timestamps
      events.push(...this.extractFromChatEvents(document));

      // Extract from activity logs
      events.push(...this.extractFromActivityLogs(document));

      // Sort by timestamp
      return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      console.error('Timeline extraction error:', error);
      return [];
    }
  }

  // Private methods

  private initializeRolePatterns(): void {
    this.rolePatterns.set('organizer', [/organizer/i, /host/i, /creator/i, /owner/i, /moderator/i]);

    this.rolePatterns.set('presenter', [/presenter/i, /speaker/i, /facilitator/i, /leader/i]);

    this.rolePatterns.set('attendee', [/attendee/i, /participant/i, /member/i, /guest/i]);

    this.rolePatterns.set('optional', [/optional/i, /cc/i, /carbon.?copy/i]);
  }

  private initializeNamePatterns(): void {
    this.namePatterns = [
      // Full names with various formats
      /^[A-Z][a-z]+\s+[A-Z][a-z]+$/, // John Smith
      /^[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+$/, // John A. Smith
      /^[A-Z][a-z]+,\s+[A-Z][a-z]+$/, // Smith, John
      /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+$/, // John Michael Smith

      // Names with initials
      /^[A-Z]\.\s+[A-Z][a-z]+$/, // J. Smith
      /^[A-Z][a-z]+\s+[A-Z]\.$/, // John S.

      // International names
      /^[A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]+)+$/, // International characters
    ];
  }

  private initializeEmailPatterns(): void {
    this.emailPatterns = [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g];
  }

  private extractFromParticipantLists(document: Document): ParticipantInfo[] {
    const participants: ParticipantInfo[] = [];

    const listSelectors = [
      '.participant-list .participant',
      '.attendee-list .attendee',
      '.member-list .member',
      '[data-automation-id="participants"] .participant-item',
      '.roster .roster-item',
      '.people-list .person',
    ];

    for (const selector of listSelectors) {
      const elements = document.querySelectorAll(selector);

      for (const element of elements) {
        const participant = this.parseParticipantElement(element);
        if (participant) {
          participants.push(participant);
        }
      }
    }

    return participants;
  }

  private extractFromUserProfiles(document: Document): ParticipantInfo[] {
    const participants: ParticipantInfo[] = [];

    const profileSelectors = ['.user-profile', '.profile-card', '.person-card', '.contact-card'];

    for (const selector of profileSelectors) {
      const elements = document.querySelectorAll(selector);

      for (const element of elements) {
        const participant = this.parseProfileElement(element);
        if (participant) {
          participants.push(participant);
        }
      }
    }

    return participants;
  }

  private extractFromAvatars(document: Document): ParticipantInfo[] {
    const participants: ParticipantInfo[] = [];

    const avatarSelectors = [
      '.avatar[title]',
      '.user-avatar[alt]',
      '.profile-picture[title]',
      'img.participant-avatar[alt]',
    ];

    for (const selector of avatarSelectors) {
      const elements = document.querySelectorAll(selector);

      for (const element of elements) {
        const name = element.getAttribute('title') || element.getAttribute('alt');
        if (name && this.isValidPersonName(name)) {
          participants.push({
            name: this.cleanPersonName(name),
            email: undefined,
            id: undefined,
            role: 'participant',
            status: 'unknown',
            joinTime: undefined,
            leaveTime: undefined,
          });
        }
      }
    }

    return participants;
  }

  private extractFromTextMentions(document: Document): ParticipantInfo[] {
    const participants: ParticipantInfo[] = [];
    const textContent = document.body.textContent || '';

    // Extract @mentions
    const mentionPattern = /@([A-Za-z\s]+)(?:\s|$)/g;
    const mentions = textContent.matchAll(mentionPattern);

    for (const match of mentions) {
      const name = match[1]?.trim();
      if (name && this.isValidPersonName(name)) {
        participants.push({
          name: this.cleanPersonName(name),
          email: undefined,
          id: undefined,
          role: 'participant',
          status: 'mentioned',
          joinTime: undefined,
          leaveTime: undefined,
        });
      }
    }

    // Extract email addresses
    for (const emailPattern of this.emailPatterns) {
      const emails = textContent.matchAll(emailPattern);

      for (const match of emails) {
        const email = match[0];
        const name = this.extractNameFromEmail(email);

        participants.push({
          name: name || email.split('@')[0] || 'Unknown',
          email: email,
          id: undefined,
          role: 'participant',
          status: 'unknown',
          joinTime: undefined,
          leaveTime: undefined,
        });
      }
    }

    return participants;
  }

  private extractFromMessageAuthors(document: Document): ParticipantInfo[] {
    const participants: ParticipantInfo[] = [];

    const authorSelectors = ['.message-author', '.chat-author', '.comment-author', '.post-author', '[data-author]'];

    for (const selector of authorSelectors) {
      const elements = document.querySelectorAll(selector);

      for (const element of elements) {
        const name = element.textContent?.trim() || element.getAttribute('data-author');
        if (name && this.isValidPersonName(name)) {
          participants.push({
            name: this.cleanPersonName(name),
            email: undefined,
            id: element.getAttribute('data-author-id') || undefined,
            role: 'participant',
            status: 'active',
            joinTime: this.extractTimestampFromElement(element),
            leaveTime: undefined,
          });
        }
      }
    }

    return participants;
  }

  private extractFromStructuredData(document: Document): ParticipantInfo[] {
    const participants: ParticipantInfo[] = [];

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');

        // Look for attendee information
        if (data.attendee) {
          const attendees = Array.isArray(data.attendee) ? data.attendee : [data.attendee];

          for (const attendee of attendees) {
            if (typeof attendee === 'object' && attendee.name) {
              participants.push({
                name: attendee.name,
                email: attendee.email || undefined,
                id: attendee.identifier || undefined,
                role: attendee.role || 'participant',
                status: 'unknown',
                joinTime: undefined,
                leaveTime: undefined,
              });
            }
          }
        }

        // Look for organizer information
        if (data.organizer) {
          const organizer = data.organizer;
          participants.push({
            name: organizer.name || organizer,
            email: organizer.email || undefined,
            id: organizer.identifier || undefined,
            role: 'organizer',
            status: 'unknown',
            joinTime: undefined,
            leaveTime: undefined,
          });
        }
      } catch {
        // Ignore JSON parsing errors
      }
    }

    return participants;
  }

  private parseParticipantElement(element: Element): ParticipantInfo | null {
    const nameElement = element.querySelector('.name, .display-name, .participant-name') || element;
    const name = nameElement.textContent?.trim();

    if (!name || !this.isValidPersonName(name)) {
      return null;
    }

    return {
      name: this.cleanPersonName(name),
      email: this.extractEmailFromElement(element),
      id: element.getAttribute('data-participant-id') || element.getAttribute('data-user-id') || undefined,
      role: this.extractRoleFromElement(element),
      status: this.extractStatusFromElement(element),
      joinTime: this.extractTimestampFromElement(element),
      leaveTime: undefined,
    };
  }

  private parseProfileElement(element: Element): ParticipantInfo | null {
    const nameSelectors = ['.name', '.display-name', '.full-name', '.person-name'];
    let name = '';

    for (const selector of nameSelectors) {
      const nameElement = element.querySelector(selector);
      if (nameElement?.textContent?.trim()) {
        name = nameElement.textContent.trim();
        break;
      }
    }

    if (!name || !this.isValidPersonName(name)) {
      return null;
    }

    return {
      name: this.cleanPersonName(name),
      email: this.extractEmailFromElement(element),
      id: element.getAttribute('data-user-id') || undefined,
      role: this.extractRoleFromElement(element),
      status: this.extractStatusFromElement(element),
      joinTime: this.extractTimestampFromElement(element),
      leaveTime: undefined,
    };
  }

  private extractFromOrganizerElements(document: Document): ParticipantInfo | null {
    const organizerSelectors = ['[data-tid="organizer"]', '.meeting-organizer', '.organizer-info', '.event-organizer'];

    for (const selector of organizerSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const participant = this.parseParticipantElement(element);
        if (participant) {
          return { ...participant, role: 'organizer' };
        }
      }
    }

    return null;
  }

  private extractFromCreatorElements(document: Document): ParticipantInfo | null {
    const creatorSelectors = ['.created-by', '.meeting-creator', '.event-creator', '[data-creator]'];

    for (const selector of creatorSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const name = element.textContent?.trim() || element.getAttribute('data-creator');
        if (name && this.isValidPersonName(name)) {
          return {
            name: this.cleanPersonName(name),
            email: this.extractEmailFromElement(element),
            id: element.getAttribute('data-creator-id') || undefined,
            role: 'organizer',
            status: 'unknown',
            joinTime: undefined,
            leaveTime: undefined,
          };
        }
      }
    }

    return null;
  }

  private extractFromHostElements(document: Document): ParticipantInfo | null {
    const hostSelectors = ['.host', '.meeting-host', '[data-host]', '.moderator'];

    for (const selector of hostSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const participant = this.parseParticipantElement(element);
        if (participant) {
          return { ...participant, role: 'organizer' };
        }
      }
    }

    return null;
  }

  private extractFromAuthorElements(document: Document): ParticipantInfo | null {
    const authorSelectors = ['.author', '.owner', '[data-author]'];

    for (const selector of authorSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const participant = this.parseParticipantElement(element);
        if (participant) {
          return { ...participant, role: 'organizer' };
        }
      }
    }

    return null;
  }

  private extractCountFromElements(document: Document, selectors: string[]): number {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const count = element.textContent?.match(/\d+/);
        if (count) {
          return parseInt(count[0]);
        }

        const dataCount = element.getAttribute('data-count');
        if (dataCount) {
          return parseInt(dataCount);
        }
      }
    }

    return 0;
  }

  private extractFromTimelineElements(document: Document): ParticipationEvent[] {
    const events: ParticipationEvent[] = [];
    const timelineElements = document.querySelectorAll('.timeline-item, .event-item, .activity-item');

    for (const element of timelineElements) {
      const event = this.parseTimelineEvent(element);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  private extractFromChatEvents(document: Document): ParticipationEvent[] {
    const events: ParticipationEvent[] = [];
    const chatElements = document.querySelectorAll('.chat-message, .message, .comment');

    for (const element of chatElements) {
      const event = this.parseChatEvent(element);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  private extractFromActivityLogs(document: Document): ParticipationEvent[] {
    const events: ParticipationEvent[] = [];
    const logElements = document.querySelectorAll('.activity-log .entry, .audit-log .entry');

    for (const element of logElements) {
      const event = this.parseActivityEvent(element);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  private parseTimelineEvent(element: Element): ParticipationEvent | null {
    const text = element.textContent?.toLowerCase() || '';
    const timestamp = this.extractTimestampFromElement(element);

    if (!timestamp) return null;

    let eventType: ParticipationEventType = 'other';
    let participant = '';

    if (text.includes('joined')) {
      eventType = 'joined';
      participant = this.extractParticipantFromText(text, 'joined');
    } else if (text.includes('left')) {
      eventType = 'left';
      participant = this.extractParticipantFromText(text, 'left');
    } else if (text.includes('started')) {
      eventType = 'meeting_started';
    } else if (text.includes('ended')) {
      eventType = 'meeting_ended';
    }

    return {
      type: eventType,
      participant: participant || undefined,
      timestamp,
      description: element.textContent?.trim() || '',
    };
  }

  private parseChatEvent(element: Element): ParticipationEvent | null {
    const author = element.querySelector('.author, .sender, .from')?.textContent?.trim();
    const timestamp = this.extractTimestampFromElement(element);

    if (!author || !timestamp) return null;

    return {
      type: 'message_sent',
      participant: this.cleanPersonName(author),
      timestamp,
      description: `Message from ${author}`,
    };
  }

  private parseActivityEvent(element: Element): ParticipationEvent | null {
    const text = element.textContent?.toLowerCase() || '';
    const timestamp = this.extractTimestampFromElement(element);

    if (!timestamp) return null;

    // Parse activity log entries for participation events
    if (text.includes('joined') || text.includes('entered')) {
      return {
        type: 'joined',
        participant: this.extractParticipantFromText(text, 'joined'),
        timestamp,
        description: element.textContent?.trim() || '',
      };
    }

    return null;
  }

  private determineParticipantRole(participant: ParticipantInfo, document: Document): string | null {
    // Check if participant is mentioned in organizer context
    for (const [role, patterns] of this.rolePatterns) {
      for (const pattern of patterns) {
        const roleContext = document.body.textContent?.toLowerCase() || '';
        if (roleContext.includes(participant.name.toLowerCase()) && pattern.test(roleContext)) {
          return role;
        }
      }
    }

    return null;
  }

  private deduplicateAndMerge(participants: ParticipantInfo[]): ParticipantInfo[] {
    const merged = new Map<string, ParticipantInfo>();

    for (const participant of participants) {
      const key = participant.email || participant.name.toLowerCase();

      if (merged.has(key)) {
        const existing = merged.get(key)!;
        // Merge information, preferring more complete data
        merged.set(key, {
          name: existing.name || participant.name,
          email: existing.email || participant.email,
          id: existing.id || participant.id,
          role: this.preferredRole(existing.role, participant.role),
          status: existing.status !== 'unknown' ? existing.status : participant.status,
          joinTime: existing.joinTime || participant.joinTime,
          leaveTime: existing.leaveTime || participant.leaveTime,
        });
      } else {
        merged.set(key, participant);
      }
    }

    return Array.from(merged.values());
  }

  private preferredRole(role1: string, role2: string): string {
    const hierarchy = ['organizer', 'presenter', 'attendee', 'participant', 'optional'];
    const index1 = hierarchy.indexOf(role1);
    const index2 = hierarchy.indexOf(role2);

    if (index1 === -1) return role2;
    if (index2 === -1) return role1;

    return index1 < index2 ? role1 : role2;
  }

  // Helper methods

  private isValidPersonName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 100) return false;
    return this.namePatterns.some(pattern => pattern.test(name));
  }

  private cleanPersonName(name: string): string {
    return name.replace(/[,()]/g, '').trim();
  }

  private extractEmailFromElement(element: Element): string | undefined {
    const emailElement = element.querySelector('[data-email], .email');
    if (emailElement) {
      const email = emailElement.textContent?.trim() || emailElement.getAttribute('data-email');
      if (email && this.emailPatterns[0]?.test(email)) {
        return email;
      }
    }
    return undefined;
  }

  private extractRoleFromElement(element: Element): string {
    const roleElement = element.querySelector('.role, [data-role]');
    if (roleElement) {
      return roleElement.textContent?.trim().toLowerCase() || roleElement.getAttribute('data-role') || 'participant';
    }
    return 'participant';
  }

  private extractStatusFromElement(element: Element): ParticipantStatus {
    const statusElement = element.querySelector('.status, [data-status]');
    if (statusElement) {
      const status = statusElement.textContent?.trim().toLowerCase() || statusElement.getAttribute('data-status');
      if (status && ['online', 'offline', 'away', 'busy'].includes(status)) {
        return status as ParticipantStatus;
      }
    }
    return 'unknown';
  }

  private extractTimestampFromElement(element: Element): Date | undefined {
    const timeElement = element.querySelector('time[datetime]');
    if (timeElement) {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        try {
          return new Date(datetime);
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  private extractNameFromEmail(email: string): string | undefined {
    const localPart = email.split('@')[0];
    if (!localPart) return undefined;
    const nameParts = localPart.split(/[._-]/);

    if (nameParts.length >= 2) {
      return nameParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    }

    return undefined;
  }

  private extractParticipantFromText(text: string, action: string): string {
    const regex = new RegExp(`([A-Za-z\\s]+)\\s+${action}`, 'i');
    const match = text.match(regex);
    return match && match[1] ? match[1].trim() : '';
  }
}

// Supporting interfaces

export interface ParticipantInfo {
  name: string;
  email?: string | undefined;
  id?: string | undefined;
  role: string;
  status: ParticipantStatus;
  joinTime?: Date | undefined;
  leaveTime?: Date | undefined;
}

export interface ParticipantCount {
  total: number;
  present: number;
  absent: number;
  invited: number;
}

export interface ParticipationEvent {
  type: ParticipationEventType;
  participant?: string | undefined;
  timestamp: Date;
  description: string;
}

export type ParticipantStatus = 'online' | 'offline' | 'away' | 'busy' | 'unknown' | 'active' | 'mentioned';

export type ParticipationEventType = 'joined' | 'left' | 'meeting_started' | 'meeting_ended' | 'message_sent' | 'other';

// Create singleton instance
export const participantParser = new ParticipantParser();
