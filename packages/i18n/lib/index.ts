import { t as t_dev_or_prod } from './i18n';
import type { t as t_dev } from './i18n-dev';

export const t = t_dev_or_prod as unknown as typeof t_dev;
