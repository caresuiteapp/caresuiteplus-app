import { getServiceMode } from '@/lib/services/mode';

/** PDL-Cockpit Live via Migration 0029 — Demo liefert getDemoPdlCockpit(). */
export function isPdlCockpitLiveReady(): boolean {
  return getServiceMode() === 'supabase';
}

/** Reporting-Listen Live via Migration 0027/0028 — Demo-Fallback bei fehlender Remote-Migration. */
export function isReportsListLiveReady(): boolean {
  return getServiceMode() === 'supabase';
}

export const PDL_COCKPIT_PREPARED_MESSAGE =
  'PDL-Cockpit nutzt Demo-KPIs. Live-Snapshot aus reporting_pdl_cockpit folgt nach Remote-Migration 0029.';

export const REPORTS_LIST_PREPARED_MESSAGE =
  'Berichte-Liste nutzt Demo-Daten. Live-Reports aus Supabase folgen nach Remote-Migration 0027/0028.';
