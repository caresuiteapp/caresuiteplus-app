import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/** Inventar & Rückgabe — Live nach Migration 0051 und Supabase-Modus. */
export function isInventoryLiveReady(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}

export const INVENTORY_PREPARED_MESSAGE =
  'Inventar, Ausgabe und Rückgabe sind vorbereitet. Live-Persistenz folgt nach Migration 0051 und Freigabe.';

export const INVENTORY_MDM_PREPARED_MESSAGE =
  'MDM/Geräteverwaltung ist vorbereitet — Remote Lock/Wipe erst nach Anbindung eines MDM-Providers.';

export const INVENTORY_MIGRATION = '0051_inventory_prepared.sql';

export const INVENTORY_RETURN_PROTOCOL_PDF_PREPARED = true;

export type InventoryLiveFlipBlocker = {
  id: string;
  label: string;
  resolved: boolean;
};

export function getInventoryLiveFlipBlockers(): InventoryLiveFlipBlocker[] {
  const live = isInventoryLiveReady();
  return [
    {
      id: 'migration-0051',
      label: `Remote-Migration ${INVENTORY_MIGRATION} angewendet`,
      resolved: live,
    },
    {
      id: 'service-mode-supabase',
      label: 'Inventar-Services nutzen Supabase statt Demo-Puffer',
      resolved: live && getServiceMode() === 'supabase',
    },
    {
      id: 'return-protocol-pdf',
      label: 'Rückgabeprotokoll-PDF über Vorlagen-Engine produktiv',
      resolved: false,
    },
    {
      id: 'mdm-provider',
      label: 'MDM-Provider konfiguriert (keine falschen Remote-Claims)',
      resolved: false,
    },
  ];
}

/** Kategorien mit vorbereiteter aber noch nicht live Anbindung. */
export const INVENTORY_PREPARED_CATEGORY_GROUPS = ['vehicles', 'software_access'] as const;

export function isInventoryCategoryLive(group: string): boolean {
  return !INVENTORY_PREPARED_CATEGORY_GROUPS.includes(group as (typeof INVENTORY_PREPARED_CATEGORY_GROUPS)[number]);
}
