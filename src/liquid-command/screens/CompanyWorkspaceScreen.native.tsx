// Generated native presentation from src/liquid-command/screens/CompanyWorkspaceScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv} from '@/components/layout/NativeWorkspaceElements.native';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { LiquidCommandShell } from '../shell/LiquidCommandShell';
import { LiquidState } from '../components/LiquidPrimitives';
import { CompanyWorkspace } from "./CompanyWorkspace.native.tsx";
import { useAuth } from '@/lib/auth/context';
import type { CompanyTab } from "../../lib/tenant/companyWorkspaceModel.ts";
/** The company route loads its own data, without the unrelated client/visit dashboard queries. */
export function CompanyWorkspaceScreen({ initialTab = 'overview', initialView }: {
    initialTab?: CompanyTab;
    initialView?: string;
} = {}) {
    const tenantId = useServiceTenantId();
    const { roleKey } = usePermissions();
    const { profile } = useAuth();
    return <LiquidCommandShell activeModule="office" activeArea="company" title="Unternehmen" subtitle="Ihre Unternehmensakte" contentMode="fill" showPageHeader={false} showContextBar={false}>
    <NativeDiv style={{ width: '100%', height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin', scrollbarColor: '#9bb3ce #f4f8fd' }} data-testid="company-workspace-scroll">
      {tenantId ? <CompanyWorkspace tenantId={tenantId} roleKey={roleKey} initialTab={initialTab} initialView={initialView} actorProfileId={profile?.id}/> : <LiquidState kind="error" title="Unternehmenszugang nicht zugeordnet" message="Ihre Unternehmensdaten können erst nach erfolgreicher Zuordnung geladen werden."/>}
    </NativeDiv>
  </LiquidCommandShell>;
}
