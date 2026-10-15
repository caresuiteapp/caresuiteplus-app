import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { LiquidCommandShell } from '../shell/LiquidCommandShell';
import { LiquidState } from '../components/LiquidPrimitives';
import { CompanyWorkspace } from './CompanyWorkspace.web';

/** The company route loads its own data, without the unrelated client/visit dashboard queries. */
export function CompanyWorkspaceScreen() {
  const tenantId = useServiceTenantId();
  const { roleKey } = usePermissions();
  return <LiquidCommandShell activeModule="office" activeArea="company" title="Unternehmen" subtitle="Ihre Unternehmensakte" contentMode="fill" showPageHeader={false} showContextBar={false}>
    <div style={{ width: '100%', height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin', scrollbarColor: '#44668b #102038' }} data-testid="company-workspace-scroll">
      {tenantId ? <CompanyWorkspace tenantId={tenantId} roleKey={roleKey} /> : <LiquidState kind="error" title="Unternehmenszugang nicht zugeordnet" message="Ihre Unternehmensdaten können erst nach erfolgreicher Zuordnung geladen werden." />}
    </div>
  </LiquidCommandShell>;
}
