/** Neutral greeting for SSR and the hydration pass — avoids timezone/hour mismatches. */
export const HYDRATION_SAFE_GREETING = 'Guten Tag';

export function getTimeOfDayGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}
