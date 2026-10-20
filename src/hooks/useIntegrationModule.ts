import { fetchIntegrationModuleSnapshot } from '@/lib/integrations/integrationsModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP488 — Integration Modul-Hook */
export function useIntegrationModule() {
  return useTenantModuleSnapshot(488, fetchIntegrationModuleSnapshot);
}
