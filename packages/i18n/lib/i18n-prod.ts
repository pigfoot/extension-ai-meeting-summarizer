import type { MessageKeyType } from './types';

export const t = (key: MessageKeyType, substitutions?: string | string[]) => chrome.i18n.getMessage(key, substitutions);
