import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCompanyAccess } from '@/hooks/useCompanyAccess';
import { ScreenShell } from '@/components/layout/ScreenShell';
import { MobileState } from '@/components/mobile/MobileWorkspace';
import { CompanyInventoryWorkspace } from '@/components/company/CompanyInventoryWorkspace.native';
import { COMPANY_INVENTORY_VIEWS, type CompanyInventoryView } from '@/components/company/companyInventoryModel';

export function CompanyInventoryScreen({ view = 'stock' }: { view?: CompanyInventoryView }) {
  const tenantId = useServiceTenantId() ?? ''; const { profile } = useAuth(); const { roleKey } = usePermissions();
  const access = useCompanyAccess(tenantId, profile?.id, roleKey);
  const params = useLocalSearchParams<{ ansicht?: string; employeeId?: string; itemId?: string }>();
  const initialView = COMPANY_INVENTORY_VIEWS.find(row => row.id === params.ansicht)?.id ?? view;
  return <ScreenShell title="Inventar" contentOwnsHeader scroll={false} showBack={false}>{access.loading ? <MobileState loading title="Inventarzugriff wird geprüft" /> : !access.data ? <MobileState title="Inventarzugriff nicht verfügbar" message={access.error ?? undefined} onRetry={access.refresh} /> : <CompanyInventoryWorkspace key={`${tenantId}:${profile?.id}:${roleKey}:${JSON.stringify(access.data)}`} tenantId={tenantId} roleKey={roleKey} actorProfileId={profile?.id} effectivePermissions={access.data.permissions} scopeLimited={access.data.scopeLimited} initialView={initialView} initialEmployeeId={params.employeeId} initialItemId={params.itemId} />}</ScreenShell>;
}
