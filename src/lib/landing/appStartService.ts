import type { ServiceResult } from '@/types';
import { APP_START_ENTRIES } from '@/data/landing/appStartEntries';
import { demoOnlyDelay } from '@/lib/services/demoDelay';

export type AppStartEntry = (typeof APP_START_ENTRIES)[number];

/** Demo snapshot für App-Startseite — Einträge und Modul-Karten */
export async function fetchAppStartSnapshot(): Promise<ServiceResult<AppStartEntry[]>> {
  await demoOnlyDelay(120);
  return { ok: true, data: APP_START_ENTRIES.filter((e) => !e.path.includes('demo')) };
}
