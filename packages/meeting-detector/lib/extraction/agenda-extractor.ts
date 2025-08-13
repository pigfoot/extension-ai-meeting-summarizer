/**
 * Agenda Extractor
 * Extracts meeting agenda, topics, and agenda items from page content
 */

/**
 * Meeting agenda and topic extraction from page content
 */
export class AgendaExtractor {
  private topicPatterns: RegExp[] = [];
  private agendaPatterns: RegExp[] = [];
  private exclusionPatterns: RegExp[] = [];

  constructor() {
    this.initializeTopicPatterns();
    this.initializeAgendaPatterns();
    this.initializeExclusionPatterns();
  }

  /**
   * Extract comprehensive agenda information from page
   */
  extractAgenda(document: Document): AgendaInfo {
    const agenda: AgendaInfo = {
      title: '',
      items: [],
      topics: [],
      objectives: [],
      structure: 'unstructured',
    };

    try {
      // Extract agenda title
      agenda.title = this.extractAgendaTitle(document);

      // Extract structured agenda items
      agenda.items = this.extractAgendaItems(document);

      // Extract meeting topics
      agenda.topics = this.extractMeetingTopics(document);

      // Extract meeting objectives
      agenda.objectives = this.extractMeetingObjectives(document);

      // Determine agenda structure
      agenda.structure = this.determineAgendaStructure(agenda.items);

      // Extract additional metadata
      agenda.estimatedDuration = this.extractEstimatedDuration(document) || 0;
      agenda.priority = this.extractAgendaPriority(document);
    } catch (error) {
      console.error('Agenda extraction error:', error);
    }

    return agenda;
  }

  /**
   * Extract agenda items with time allocation
   */
  extractAgendaItems(document: Document): AgendaItem[] {
    const items: AgendaItem[] = [];

    try {
      // Extract from structured lists
      items.push(...this.extractFromStructuredLists(document));

      // Extract from agenda sections
      items.push(...this.extractFromAgendaSections(document));

      // Extract from heading structures
      items.push(...this.extractFromHeadingStructure(document));

      // Extract from numbered items
      items.push(...this.extractFromNumberedItems(document));

      // Extract from bullet points
      items.push(...this.extractFromBulletPoints(document));

      // Extract from table structures
      items.push(...this.extractFromTableStructures(document));

      // Sort by order and remove duplicates
      return this.deduplicateAndSort(items);
    } catch (error) {
      console.error('Agenda items extraction error:', error);
      return [];
    }
  }

  /**
   * Extract meeting topics and subjects
   */
  extractMeetingTopics(document: Document): string[] {
    const topics: string[] = [];

    try {
      const topicSources = [
        // Topic-specific elements
        () => this.extractFromTopicElements(document),

        // Subject lines
        () => this.extractFromSubjectElements(document),

        // Discussion points
        () => this.extractFromDiscussionElements(document),

        // Content headings analysis
        () => this.extractTopicsFromHeadings(document),

        // Text content analysis
        () => this.extractTopicsFromContent(document),

        // Tag and category elements
        () => this.extractFromCategoryElements(document),
      ];

      for (const source of topicSources) {
        const sourceTopics = source();
        topics.push(...sourceTopics);
      }

      // Filter and clean topics
      const cleanTopics = topics
        .filter(topic => this.isValidTopic(topic))
        .map(topic => this.cleanTopic(topic))
        .filter((topic, index, array) => array.indexOf(topic) === index); // Remove duplicates

      return cleanTopics.slice(0, 15); // Limit to 15 most relevant topics
    } catch (error) {
      console.error('Topic extraction error:', error);
      return [];
    }
  }

  /**
   * Extract meeting objectives and goals
   */
  extractMeetingObjectives(document: Document): string[] {
    const objectives: string[] = [];

    try {
      const objectiveSources = [
        // Objective-specific elements
        () => this.extractFromObjectiveElements(document),

        // Goals and outcomes
        () => this.extractFromGoalElements(document),

        // Purpose statements
        () => this.extractFromPurposeElements(document),

        // Description analysis
        () => this.extractObjectivesFromDescription(document),
      ];

      for (const source of objectiveSources) {
        const sourceObjectives = source();
        objectives.push(...sourceObjectives);
      }

      // Filter and clean objectives
      return objectives
        .filter(objective => this.isValidObjective(objective))
        .map(objective => this.cleanObjective(objective))
        .filter((objective, index, array) => array.indexOf(objective) === index)
        .slice(0, 10);
    } catch (error) {
      console.error('Objectives extraction error:', error);
      return [];
    }
  }

  /**
   * Extract agenda title from page content
   */
  extractAgendaTitle(document: Document): string {
    const titleSources = [
      // Agenda-specific titles
      () =>
        this.extractFromSelectors(document, [
          '[data-tid="agenda-title"]',
          '.agenda-title',
          '.meeting-agenda h1',
          '.agenda-header h1',
        ]),

      // Meeting titles that might indicate agenda
      () =>
        this.extractFromSelectors(document, [
          '.meeting-title',
          '[data-tid="meeting-title"]',
          'h1[data-automation-id*="meeting"]',
        ]),

      // General page titles
      () => this.extractFromSelectors(document, ['h1', '.page-title', '.content-title']),
    ];

    for (const source of titleSources) {
      const title = source();
      if (title && this.isValidAgendaTitle(title)) {
        return this.cleanTitle(title);
      }
    }

    return '';
  }

  // Private methods

  private initializeTopicPatterns(): void {
    this.topicPatterns = [
      // Action-oriented topics
      /^(discuss|review|present|update|plan|decide|approve|analyze)/i,

      // Question patterns
      /^(how|what|when|where|why|which)/i,

      // Status patterns
      /status|progress|update|report/i,

      // Planning patterns
      /plan|strategy|roadmap|timeline|schedule/i,

      // Decision patterns
      /decision|approve|vote|choose|select/i,

      // Review patterns
      /review|feedback|assessment|evaluation/i,
    ];
  }

  private initializeAgendaPatterns(): void {
    this.agendaPatterns = [
      // Numbered items
      /^\d+\.\s*(.+)/,

      // Lettered items
      /^[a-z]\.\s*(.+)/i,

      // Roman numerals
      /^[ivx]+\.\s*(.+)/i,

      // Bullet points
      /^[-•*]\s*(.+)/,

      // Time-based items
      /^(\d{1,2}:\d{2})\s*-?\s*(.+)/,

      // Duration-based items
      /^(\d+\s*(?:min|minutes?))\s*-?\s*(.+)/i,
    ];
  }

  private initializeExclusionPatterns(): void {
    this.exclusionPatterns = [
      // Navigation elements
      /^(home|back|next|previous|continue)$/i,

      // Common UI elements
      /^(login|logout|sign in|sign out|settings|help|about)$/i,

      // Generic terms
      /^(item|topic|agenda|meeting|discussion)$/i,

      // Short meaningless text
      /^.{1,2}$/,

      // Very long text (likely not agenda items)
      /.{200,}/,
    ];
  }

  private extractFromStructuredLists(document: Document): AgendaItem[] {
    const items: AgendaItem[] = [];

    const listSelectors = [
      '.agenda ol li',
      '.agenda ul li',
      '.agenda-items li',
      '.meeting-agenda li',
      '[data-automation-id="agenda"] li',
    ];

    for (const selector of listSelectors) {
      const elements = document.querySelectorAll(selector);

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (element) {
          const item = this.parseAgendaItemElement(element, i + 1);
          if (item) {
            items.push(item);
          }
        }
      }
    }

    return items;
  }

  private extractFromAgendaSections(document: Document): AgendaItem[] {
    const items: AgendaItem[] = [];

    const sectionSelectors = ['.agenda-section', '.agenda-item', '.meeting-section', '[data-section-type="agenda"]'];

    for (const selector of sectionSelectors) {
      const elements = document.querySelectorAll(selector);

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (element) {
          const item = this.parseAgendaItemElement(element, i + 1);
          if (item) {
            items.push(item);
          }
        }
      }
    }

    return items;
  }

  private extractFromHeadingStructure(document: Document): AgendaItem[] {
    const items: AgendaItem[] = [];
    const headings = document.querySelectorAll('h2, h3, h4, h5, h6');

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      if (heading) {
        const text = heading.textContent?.trim();

        if (text && this.isValidAgendaItem(text)) {
          items.push({
            order: i + 1,
            title: this.cleanAgendaItemTitle(text),
            description: this.extractItemDescription(heading),
            duration: this.extractItemDuration(heading),
            timeSlot: this.extractItemTimeSlot(heading),
            presenter: this.extractItemPresenter(heading),
            type: 'heading',
          });
        }
      }
    }

    return items;
  }

  private extractFromNumberedItems(document: Document): AgendaItem[] {
    const items: AgendaItem[] = [];
    const textContent = document.body.textContent || '';

    for (const pattern of this.agendaPatterns) {
      if (pattern.source.includes('\\d+\\.')) {
        const matches = textContent.matchAll(new RegExp(pattern.source, 'gm'));

        for (const match of matches) {
          if (match[1] && this.isValidAgendaItem(match[1])) {
            items.push({
              order: items.length + 1,
              title: this.cleanAgendaItemTitle(match[1]),
              description: '',
              type: 'numbered',
            });
          }
        }
      }
    }

    return items;
  }

  private extractFromBulletPoints(document: Document): AgendaItem[] {
    const items: AgendaItem[] = [];
    const bulletElements = document.querySelectorAll('li, p');

    for (let i = 0; i < bulletElements.length; i++) {
      const element = bulletElements[i];
      if (!element) continue;
      const text = element.textContent?.trim();

      if (text && this.isBulletPoint(text) && this.isValidAgendaItem(text)) {
        const cleanText = text.replace(/^[-•*]\s*/, '');
        items.push({
          order: i + 1,
          title: this.cleanAgendaItemTitle(cleanText),
          description: '',
          type: 'bullet',
        });
      }
    }

    return items;
  }

  private extractFromTableStructures(document: Document): AgendaItem[] {
    const items: AgendaItem[] = [];
    const tables = document.querySelectorAll('table');

    for (const table of tables) {
      const rows = table.querySelectorAll('tr');

      for (let i = 1; i < rows.length; i++) {
        // Skip header row
        const row = rows[i];
        if (!row) continue;
        const cells = row.querySelectorAll('td, th');

        if (cells.length >= 2) {
          const titleCell = cells[0];
          const descCell = cells[1];
          if (!titleCell || !descCell) continue;
          const title = titleCell.textContent?.trim();
          const description = descCell.textContent?.trim();

          if (title && this.isValidAgendaItem(title)) {
            items.push({
              order: i,
              title: this.cleanAgendaItemTitle(title),
              description: description || '',
              duration: cells ? this.extractDurationFromCells(cells) : undefined,
              presenter: cells ? this.extractPresenterFromCells(cells) : undefined,
              type: 'table',
            });
          }
        }
      }
    }

    return items;
  }

  private parseAgendaItemElement(element: Element, order: number): AgendaItem | null {
    const text = element.textContent?.trim();

    if (!text || !this.isValidAgendaItem(text)) {
      return null;
    }

    return {
      order,
      title: this.cleanAgendaItemTitle(text),
      description: this.extractItemDescription(element),
      duration: this.extractItemDuration(element),
      timeSlot: this.extractItemTimeSlot(element),
      presenter: this.extractItemPresenter(element),
      type: 'list',
    };
  }

  private extractFromTopicElements(document: Document): string[] {
    const topicSelectors = ['.topic', '.subject', '.meeting-topic', '[data-topic]', '.discussion-topic'];

    return this.extractTextFromElements(document, topicSelectors);
  }

  private extractFromSubjectElements(document: Document): string[] {
    const subjectSelectors = ['.subject', '.meeting-subject', '[data-subject]', '.subject-line'];

    return this.extractTextFromElements(document, subjectSelectors);
  }

  private extractFromDiscussionElements(document: Document): string[] {
    const discussionSelectors = ['.discussion-point', '.discussion-item', '.talking-point', '.conversation-topic'];

    return this.extractTextFromElements(document, discussionSelectors);
  }

  private extractTopicsFromHeadings(document: Document): string[] {
    const topics: string[] = [];
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

    for (const heading of headings) {
      const text = heading.textContent?.trim();
      if (text && this.isValidTopic(text)) {
        topics.push(text);
      }
    }

    return topics;
  }

  private extractTopicsFromContent(document: Document): string[] {
    const topics: string[] = [];
    const content = document.body.textContent || '';

    // Extract sentences that look like topics
    const sentences = content
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5 && s.length < 100);

    for (const sentence of sentences) {
      if (this.topicPatterns.some(pattern => pattern.test(sentence))) {
        topics.push(sentence);
      }
    }

    return topics.slice(0, 10);
  }

  private extractFromCategoryElements(document: Document): string[] {
    const categorySelectors = ['.category', '.tag', '.label', '.keyword', '.topic-tag'];

    return this.extractTextFromElements(document, categorySelectors);
  }

  private extractFromObjectiveElements(document: Document): string[] {
    const objectiveSelectors = ['.objective', '.goal', '.purpose', '.meeting-objective', '[data-objective]'];

    return this.extractTextFromElements(document, objectiveSelectors);
  }

  private extractFromGoalElements(document: Document): string[] {
    const goalSelectors = ['.goal', '.target', '.outcome', '.deliverable', '.expected-result'];

    return this.extractTextFromElements(document, goalSelectors);
  }

  private extractFromPurposeElements(document: Document): string[] {
    const purposeSelectors = ['.purpose', '.meeting-purpose', '.description', '.meeting-description'];

    return this.extractTextFromElements(document, purposeSelectors);
  }

  private extractObjectivesFromDescription(document: Document): string[] {
    const objectives: string[] = [];
    const content = document.body.textContent || '';

    // Look for objective-indicating phrases
    const objectivePatterns = [
      /purpose(?:\s+of\s+this\s+meeting)?:\s*([^.!?]+)/gi,
      /objective(?:s)?:\s*([^.!?]+)/gi,
      /goal(?:s)?:\s*([^.!?]+)/gi,
      /we\s+will\s+([^.!?]+)/gi,
      /aim\s+to\s+([^.!?]+)/gi,
    ];

    for (const pattern of objectivePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          objectives.push(match[1].trim());
        }
      }
    }

    return objectives;
  }

  private extractFromSelectors(document: Document, selectors: string[]): string {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }
    return '';
  }

  private extractTextFromElements(document: Document, selectors: string[]): string[] {
    const texts: string[] = [];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        if (text) {
          texts.push(text);
        }
      }
    }

    return texts;
  }

  private extractItemDescription(element: Element): string {
    const descElement = element.querySelector('.description, .details, .note');
    return descElement?.textContent?.trim() || '';
  }

  private extractItemDuration(element: Element): number | undefined {
    const durationElement = element.querySelector('.duration, [data-duration]');
    if (durationElement) {
      const duration = durationElement.textContent?.trim() || durationElement.getAttribute('data-duration');
      if (duration) {
        return this.parseDuration(duration);
      }
    }
    return undefined;
  }

  private extractItemTimeSlot(element: Element): string | undefined {
    const timeElement = element.querySelector('.time, [data-time]');
    if (timeElement) {
      return timeElement.textContent?.trim() || timeElement.getAttribute('data-time') || undefined;
    }
    return undefined;
  }

  private extractItemPresenter(element: Element): string | undefined {
    const presenterElement = element.querySelector('.presenter, .speaker, [data-presenter]');
    if (presenterElement) {
      return presenterElement.textContent?.trim() || presenterElement.getAttribute('data-presenter') || undefined;
    }
    return undefined;
  }

  private extractDurationFromCells(cells: NodeListOf<Element>): number | undefined {
    for (const cell of cells) {
      const text = cell.textContent?.trim();
      if (text && /\d+\s*(?:min|minutes?|hr|hours?)/i.test(text)) {
        return this.parseDuration(text);
      }
    }
    return undefined;
  }

  private extractPresenterFromCells(cells: NodeListOf<Element>): string | undefined {
    // Look for cells that might contain presenter names
    for (let i = 2; i < cells.length; i++) {
      const cell = cells[i];
      if (cell) {
        const text = cell.textContent?.trim();
        if (text && this.isValidPersonName(text)) {
          return text;
        }
      }
    }
    return undefined;
  }

  private extractEstimatedDuration(document: Document): number | undefined {
    const durationSources = [
      // Meeting duration elements
      '.meeting-duration',
      '[data-duration]',
      '.estimated-duration',
    ];

    for (const selector of durationSources) {
      const element = document.querySelector(selector);
      if (element) {
        const duration = element.textContent?.trim() || element.getAttribute('data-duration');
        if (duration) {
          const parsed = this.parseDuration(duration);
          if (parsed) return parsed;
        }
      }
    }

    return undefined;
  }

  private extractAgendaPriority(document: Document): AgendaPriority {
    const priorityElement = document.querySelector('.priority, [data-priority]');
    if (priorityElement) {
      const priority =
        priorityElement.textContent?.trim().toLowerCase() ||
        priorityElement.getAttribute('data-priority')?.toLowerCase();

      if (priority && ['high', 'medium', 'low'].includes(priority)) {
        return priority as AgendaPriority;
      }
    }

    return 'medium';
  }

  private determineAgendaStructure(items: AgendaItem[]): AgendaStructure {
    if (items.length === 0) return 'unstructured';

    const hasTimeSlots = items.some(item => item.timeSlot);
    const hasDurations = items.some(item => item.duration);
    const hasOrder = items.every(item => item.order);

    if (hasTimeSlots && hasDurations) return 'time_structured';
    if (hasOrder) return 'ordered';
    if (items.length > 0) return 'listed';

    return 'unstructured';
  }

  private deduplicateAndSort(items: AgendaItem[]): AgendaItem[] {
    // Remove duplicates based on title
    const unique = items.filter(
      (item, index, array) => array.findIndex(i => i.title.toLowerCase() === item.title.toLowerCase()) === index,
    );

    // Sort by order
    return unique.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  // Validation methods

  private isValidAgendaTitle(title: string): boolean {
    return title.length >= 3 && title.length <= 200;
  }

  private isValidAgendaItem(text: string): boolean {
    if (!text || text.length < 3 || text.length > 500) return false;

    // Check against exclusion patterns
    return !this.exclusionPatterns.some(pattern => pattern.test(text));
  }

  private isValidTopic(topic: string): boolean {
    return (
      Boolean(topic) &&
      topic.length >= 3 &&
      topic.length <= 200 &&
      !this.exclusionPatterns.some(pattern => pattern.test(topic))
    );
  }

  private isValidObjective(objective: string): boolean {
    return Boolean(objective) && objective.length >= 5 && objective.length <= 300;
  }

  private isBulletPoint(text: string): boolean {
    return /^[-•*]\s+/.test(text);
  }

  private isValidPersonName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 50) return false;
    return /^[A-Za-z\s,.-]+$/.test(name) && !name.includes('@');
  }

  // Cleaning methods

  private cleanTitle(title: string): string {
    return title.replace(/^[-•*]\s*/, '').trim();
  }

  private cleanAgendaItemTitle(title: string): string {
    return title.replace(/^(\d+\.|\w\.|[-•*])\s*/, '').trim();
  }

  private cleanTopic(topic: string): string {
    return topic
      .replace(/^[-•*]\s*/, '')
      .replace(/[.!?]+$/, '')
      .trim();
  }

  private cleanObjective(objective: string): string {
    return objective.replace(/^[-•*]\s*/, '').trim();
  }

  private parseDuration(durationStr: string): number | undefined {
    try {
      // Parse various duration formats
      const timeMatch = durationStr.match(/(\d+):\s*(\d+)/);
      if (timeMatch && timeMatch[1] && timeMatch[2]) {
        return parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      }

      const hoursMatch = durationStr.match(/(\d+)\s*(?:hr|hours?)/i);
      if (hoursMatch && hoursMatch[1]) {
        return parseInt(hoursMatch[1]) * 60;
      }

      const minutesMatch = durationStr.match(/(\d+)\s*(?:min|minutes?)/i);
      if (minutesMatch && minutesMatch[1]) {
        return parseInt(minutesMatch[1]);
      }

      // Try parsing as plain number
      const num = parseInt(durationStr);
      if (!isNaN(num) && num > 0 && num < 1440) {
        // Max 24 hours
        return num;
      }
    } catch {
      // Ignore parsing errors
    }

    return undefined;
  }
}

// Supporting interfaces

export interface AgendaInfo {
  title: string;
  items: AgendaItem[];
  topics: string[];
  objectives: string[];
  structure: AgendaStructure;
  estimatedDuration?: number;
  priority?: AgendaPriority;
}

export interface AgendaItem {
  order: number;
  title: string;
  description: string;
  duration?: number | undefined; // in minutes
  timeSlot?: string | undefined;
  presenter?: string | undefined;
  type: AgendaItemType;
}

export type AgendaStructure =
  | 'time_structured' // Has specific time slots
  | 'ordered' // Has numbered/ordered items
  | 'listed' // Has list items but no order
  | 'unstructured'; // No clear structure

export type AgendaItemType = 'heading' | 'numbered' | 'bullet' | 'list' | 'table';

export type AgendaPriority = 'high' | 'medium' | 'low';

// Create singleton instance
export const agendaExtractor = new AgendaExtractor();
