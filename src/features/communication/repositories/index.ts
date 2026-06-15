export { threadsSupabaseRepository } from './threads.supabase';
export { messagesSupabaseRepository } from './messages.supabase';
export { participantsSupabaseRepository } from './participants.supabase';
export { attachmentsSupabaseRepository } from './attachments.supabase';
export { reactionsSupabaseRepository } from './reactions.supabase';
export { assignmentsSupabaseRepository } from './assignments.supabase';
export { readReceiptsSupabaseRepository } from './readReceipts.supabase';
export { notificationsSupabaseRepository } from './notifications.supabase';
export { auditEventsSupabaseRepository } from './auditEvents.supabase';
export { settingsSupabaseRepository } from './settings.supabase';

import { getServiceMode } from '@/lib/services/mode';

/** Lazy-Load Supabase-Repos (Vitest/Demo ohne React-Native-Import). */
export function getCommunicationSupabaseRepos() {
  if (getServiceMode() !== 'supabase') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./index') as typeof import('./index');
}
