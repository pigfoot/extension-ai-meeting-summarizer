/**
 * Meeting domain types for the Meeting Summarizer Chrome Extension
 * Provides comprehensive type definitions for meeting data structures,
 * transcription results, and meeting metadata management.
 */

/**
 * Represents the status of a meeting recording
 */
export type MeetingStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'processing';

/**
 * Represents the source platform of the meeting
 */
export type MeetingSource = 'sharepoint' | 'teams' | 'zoom' | 'other';

/**
 * Represents the confidence level of transcription
 */
export type TranscriptionConfidence = 'high' | 'medium' | 'low';

/**
 * Represents the priority level of an action item
 */
export type ActionItemPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Represents the status of an action item
 */
export type ActionItemStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

/**
 * Core meeting record interface containing all essential meeting information
 */
export interface MeetingRecord {
  /** Unique identifier for the meeting */
  id: string;
  /** Meeting title or subject */
  title: string;
  /** Meeting description or agenda */
  description?: string;
  /** Meeting start timestamp (ISO 8601) */
  startTime: string;
  /** Meeting end timestamp (ISO 8601) */
  endTime?: string;
  /** Current status of the meeting */
  status: MeetingStatus;
  /** Source platform where the meeting originated */
  source: MeetingSource;
  /** List of meeting participants */
  participants: MeetingParticipant[];
  /** Meeting organizer information */
  organizer: MeetingParticipant;
  /** SharePoint or platform-specific meeting URL */
  meetingUrl?: string;
  /** Video recording URL or manifest URL */
  recordingUrl?: string;
  /** Meeting metadata */
  metadata: MeetingMetadata;
  /** Transcription result if available */
  transcription?: TranscriptionResult;
  /** AI-generated meeting summary */
  summary?: MeetingSummary;
  /** Extracted action items */
  actionItems?: ActionItem[];
  /** Timestamp when record was created (ISO 8601) */
  createdAt: string;
  /** Timestamp when record was last updated (ISO 8601) */
  updatedAt: string;
}

/**
 * Meeting participant information
 */
export interface MeetingParticipant {
  /** Participant unique identifier */
  id: string;
  /** Participant display name */
  name: string;
  /** Participant email address */
  email: string;
  /** Participant role in the meeting */
  role?: 'organizer' | 'presenter' | 'attendee';
  /** Whether participant joined the meeting */
  attended?: boolean;
}

/**
 * Meeting metadata containing platform-specific and technical information
 */
export interface MeetingMetadata {
  /** Meeting duration in seconds */
  duration?: number;
  /** Recording file size in bytes */
  recordingSize?: number;
  /** Recording format (mp4, webm, etc.) */
  recordingFormat?: string;
  /** SharePoint site ID where meeting is hosted */
  siteId?: string;
  /** SharePoint list ID containing the meeting */
  listId?: string;
  /** SharePoint item ID for the meeting record */
  itemId?: string;
  /** Meeting room or location information */
  location?: string;
  /** Meeting timezone */
  timezone?: string;
  /** Language code for transcription (e.g., 'en-US', 'zh-TW') */
  language?: string;
  /** Custom tags or labels */
  tags?: string[];
  /** Additional platform-specific properties */
  customProperties?: Record<string, unknown>;
}

/**
 * Transcription result containing speech-to-text output and metadata
 */
export interface TranscriptionResult {
  /** Unique identifier for the transcription */
  id: string;
  /** Associated meeting ID */
  meetingId: string;
  /** Full transcription text */
  fullText: string;
  /** Timestamped transcript segments */
  segments: TranscriptionSegment[];
  /** Overall transcription confidence level */
  confidence: TranscriptionConfidence;
  /** Language detected/used for transcription */
  language: string;
  /** Transcription processing status */
  status: 'processing' | 'completed' | 'failed';
  /** Processing start timestamp (ISO 8601) */
  processedAt: string;
  /** Processing duration in milliseconds */
  processingDuration?: number;
  /** Error message if transcription failed */
  error?: string;
  /** Azure Speech service job ID */
  azureJobId?: string;
}

/**
 * Individual segment of transcribed speech with timing and speaker information
 */
export interface TranscriptionSegment {
  /** Segment unique identifier */
  id: string;
  /** Transcribed text for this segment */
  text: string;
  /** Segment start time in seconds from meeting start */
  startTime: number;
  /** Segment end time in seconds from meeting start */
  endTime: number;
  /** Speaker identification (if available) */
  speakerId?: string;
  /** Speaker name (if identified) */
  speakerName?: string;
  /** Confidence score for this segment (0-1) */
  confidence: number;
  /** Word-level timing information */
  words?: TranscriptionWord[];
}

/**
 * Individual word with precise timing information
 */
export interface TranscriptionWord {
  /** The transcribed word */
  word: string;
  /** Word start time in seconds */
  startTime: number;
  /** Word end time in seconds */
  endTime: number;
  /** Confidence score for this word (0-1) */
  confidence: number;
}

/**
 * AI-generated meeting summary with key insights
 */
export interface MeetingSummary {
  /** Unique identifier for the summary */
  id: string;
  /** Associated meeting ID */
  meetingId: string;
  /** Brief meeting overview */
  overview: string;
  /** Key discussion points */
  keyPoints: string[];
  /** Important decisions made */
  decisions: string[];
  /** Identified next steps */
  nextSteps: string[];
  /** Meeting participants summary */
  participantsSummary?: string;
  /** AI model used for summary generation */
  aiModel?: string;
  /** Summary generation timestamp (ISO 8601) */
  generatedAt: string;
  /** Quality score of the summary (0-1) */
  qualityScore?: number;
}

/**
 * Action item extracted from meeting discussion
 */
export interface ActionItem {
  /** Unique identifier for the action item */
  id: string;
  /** Associated meeting ID */
  meetingId: string;
  /** Action item title or description */
  title: string;
  /** Detailed description of the action */
  description?: string;
  /** Person responsible for the action */
  assignee?: MeetingParticipant;
  /** Action item due date (ISO 8601) */
  dueDate?: string;
  /** Priority level of the action */
  priority: ActionItemPriority;
  /** Current status of the action item */
  status: ActionItemStatus;
  /** Tags or categories for the action item */
  tags?: string[];
  /** Reference to transcript segment where action was mentioned */
  sourceSegmentId?: string;
  /** Timestamp when action item was created (ISO 8601) */
  createdAt: string;
  /** Timestamp when action item was last updated (ISO 8601) */
  updatedAt: string;
}

/**
 * Meeting search and filter criteria
 */
export interface MeetingSearchCriteria {
  /** Search query for meeting title, description, or content */
  query?: string;
  /** Filter by meeting status */
  status?: MeetingStatus[];
  /** Filter by meeting source platform */
  source?: MeetingSource[];
  /** Filter by date range - start date (ISO 8601) */
  startDate?: string;
  /** Filter by date range - end date (ISO 8601) */
  endDate?: string;
  /** Filter by participant email or name */
  participant?: string;
  /** Filter by organizer */
  organizer?: string;
  /** Filter by tags */
  tags?: string[];
  /** Pagination - page number (1-based) */
  page?: number;
  /** Pagination - items per page */
  limit?: number;
  /** Sort field */
  sortBy?: 'startTime' | 'title' | 'createdAt' | 'updatedAt';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Meeting search results with pagination information
 */
export interface MeetingSearchResults {
  /** Array of matching meeting records */
  meetings: MeetingRecord[];
  /** Total number of matching meetings */
  total: number;
  /** Current page number */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there are more results available */
  hasMore: boolean;
}

/**
 * Meeting statistics and analytics data
 */
export interface MeetingAnalytics {
  /** Total number of meetings */
  totalMeetings: number;
  /** Number of meetings by status */
  byStatus: Record<MeetingStatus, number>;
  /** Number of meetings by source platform */
  bySource: Record<MeetingSource, number>;
  /** Average meeting duration in minutes */
  averageDuration: number;
  /** Total recorded meeting time in minutes */
  totalRecordedTime: number;
  /** Number of meetings with transcriptions */
  transcribedMeetings: number;
  /** Number of meetings with summaries */
  summarizedMeetings: number;
  /** Total number of action items */
  totalActionItems: number;
  /** Number of completed action items */
  completedActionItems: number;
  /** Most active participants */
  topParticipants: Array<{
    participant: MeetingParticipant;
    meetingCount: number;
  }>;
}
