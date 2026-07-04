import { useEffect, useState } from 'react';
import {
  getTimeOfDayGreeting,
  HYDRATION_SAFE_GREETING,
} from '@/lib/dashboard/timeOfDayGreeting';
import { useHydrated } from '@/hooks/useHydrated';

/**
 * Time-of-day greeting that matches SSR HTML during hydration, then updates on the client.
 */
export function useClientGreeting(snapshotGreeting?: string): string {
  const hydrated = useHydrated();
  const [greeting, setGreeting] = useState(HYDRATION_SAFE_GREETING);

  useEffect(() => {
    if (!hydrated) return;
    setGreeting(snapshotGreeting ?? getTimeOfDayGreeting());
  }, [hydrated, snapshotGreeting]);

  return greeting;
}

export function useClientGreetingLine(displayName: string, snapshotGreeting?: string): string {
  const greeting = useClientGreeting(snapshotGreeting);
  return `${greeting}, ${displayName}`;
}
