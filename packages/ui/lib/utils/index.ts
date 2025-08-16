/**
 * UI Utils Index
 *
 * Exports all utility functions and classes for UI components
 */

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ClassValue } from 'clsx';

// Class name utility function
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// Accessibility utilities
export * from './accessibility';
