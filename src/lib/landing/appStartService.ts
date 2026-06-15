import type { ServiceResult } from '@/types';
import { APP_START_ENTRIES } from '@/data/landing/appStartEntries';

export type AppStartEntry = (typeof APP_START_ENTRIES)[number];

/** Demo snapshot für App-Startseite — Einträge und Modul-Karten */
export async function fetchAppStartSnapshot(): Promise<ServiceResult<AppStartEntry[]>> {
  await new Promise((r) => setTimeout(r, 120));
  return { ok: true, data: APP_START_ENTRIES.filter((e) => !e.path.includes('demo')) };
}
