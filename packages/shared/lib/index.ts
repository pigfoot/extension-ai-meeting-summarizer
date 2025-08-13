/**
 * Shared library barrel export for the Meeting Summarizer Chrome Extension
 * Provides centralized access to all shared utilities, types, and components.
 */

// Export all types
export type * from './types/index.js';

// Export utilities
export * from './utils/index.js';

// Export React utilities
export * from './hoc/index.js';
export * from './hooks/index.js';
