import type { AuthChangeEvent } from '@supabase/supabase-js';

/** Only explicit sign-out should drop a committed Supabase session from React state. */
export function shouldClearAuthOnNullSessionEvent(
  event: AuthChangeEvent,
  signOutRequested: boolean,
): boolean {
  if (signOutRequested) return true;
  return event === 'SIGNED_OUT';
}
