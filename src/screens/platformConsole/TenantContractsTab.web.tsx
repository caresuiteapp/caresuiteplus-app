// Compatibility exports: the current product has no contract or package workflow.
import { PlatformFreeUsagePanel } from '@/components/platformConsole/PlatformFreeUsagePanel.web';
type LegacyProps = { tenantId?: string; role?: unknown; detail?: unknown; onReload?: () => Promise<void> };
function RetiredTenantCommercialTab(props: LegacyProps) { void props; return <PlatformFreeUsagePanel />; }
export const TenantContractTab = RetiredTenantCommercialTab;
export const TenantAddonsTab = RetiredTenantCommercialTab;
