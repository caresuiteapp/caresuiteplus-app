import type { ServiceResult } from '@/types';
import { APP_START_ENTRIES, DEMO_START_PATH } from '@/data/landing/appStartEntries';

export type AppStartEntry = (typeof APP_START_ENTRIES)[number];

/** Public start page — four main entry actions (demo via footer only). */
export async function fetchAppStartSnapshot(): Promise<ServiceResult<AppStartEntry[]>> {
  await new Promise((r) => setTimeout(r, 120));
  const entries = APP_START_ENTRIES.filter((entry) => entry.path !== DEMO_START_PATH);
  return { ok: true, data: entries };
}
