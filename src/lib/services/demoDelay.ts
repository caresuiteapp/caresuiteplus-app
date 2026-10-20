import { getServiceMode } from './mode';

/** Simulated latency for demo/in-memory services only — skipped in live Supabase mode. */
export async function demoOnlyDelay(ms: number): Promise<void> {
  if (getServiceMode() === 'supabase') return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}
