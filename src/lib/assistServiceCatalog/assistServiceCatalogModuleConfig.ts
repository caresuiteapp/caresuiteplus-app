import { getServiceMode } from '@/lib/services/mode';

export const ASSIST_SERVICE_CATALOG_LIVE_MIGRATION = '0053_assist_service_catalog_prepared.sql';

export const ASSIST_SERVICE_CATALOG_PREPARED_MESSAGE =
  'Assist-Leistungskatalog ist vorbereitet. Live-Persistenz erfordert Migration 0053 — ' +
  'keine Demo-Fallbacks im Produktivmodus.';

/** Live-Flip bleibt false bis Remote-Migration aktiv. */
export function isAssistServiceCatalogLiveReady(): boolean {
  return false;
}

export function isAssistServiceCatalogWiringPrepared(): boolean {
  return true;
}

export function canUseAssistServiceCatalogInCurrentMode(): boolean {
  if (getServiceMode() === 'supabase' && !isAssistServiceCatalogLiveReady()) {
    return false;
  }
  return getServiceMode() !== 'supabase';
}

export type AssistServiceCatalogLiveFlipBlocker = {
  id: string;
  label: string;
  resolved: boolean;
};

export function getAssistServiceCatalogLiveFlipBlockers(): AssistServiceCatalogLiveFlipBlocker[] {
  return [
    {
      id: 'migration-0053',
      label: `Remote-Migration ${ASSIST_SERVICE_CATALOG_LIVE_MIGRATION} angewendet`,
      resolved: false,
    },
    {
      id: 'no-demo-catalog-production',
      label: 'Produktivmodus ohne Demo-Leistungskatalog-Fallbacks',
      resolved: false,
    },
    {
      id: 'category-guard',
      label: 'Keine Fehldeklaration Pflege/Medizin als Alltagsbegleitung',
      resolved: true,
    },
    {
      id: 'tenant-service-rates-link',
      label: 'Stundensätze verknüpft mit tenant_service_rates (Prompt 64)',
      resolved: true,
    },
  ];
}

export function countAssistServiceCatalogLiveFlipBlockersRemaining(): number {
  return getAssistServiceCatalogLiveFlipBlockers().filter((blocker) => !blocker.resolved).length;
}
