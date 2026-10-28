// Generated native presentation from src/screens/pflege/PflegeberichtErstellenScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareDocumentationWorkspacePanel } from "../../components/pflege/CareDocumentationWorkspacePanel.native.tsx";
import { BasicCareWorkspacePanel } from "../../components/pflege/BasicCareWorkspacePanel.native.tsx";
import { NutritionEliminationWorkspacePanel } from "../../components/pflege/NutritionEliminationWorkspacePanel.native.tsx";
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, LoadingState, PremiumButton } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareRuntimePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useAuth } from '@/lib/auth/context';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { spacing } from '@/theme';
export function PflegeberichtErstellenScreen() {
    const router = useRouter(), permissions = useCareRuntimePermissions(), { profile } = useAuth();
    const tenantId = permissions.tenantId ?? '', actorId = profile?.id ?? '';
    const clients = useAsyncQuery(() => tenantId ? fetchEligibleCareClients(tenantId, permissions.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, permissions.roleKey], { enabled: !!tenantId && !!actorId });
    const options = useMemo(() => (clients.data ?? []).map(client => ({ key: client.id, label: `${client.lastName}, ${client.firstName}` })), [clients.data]);
    const [clientId, setClientId] = useState(''), [workspace, setWorkspace] = useState<'documentation' | 'basic-care' | 'nutrition-elimination'>('documentation');
    return <ScreenShell title="Pflegedokumentation erfassen" subtitle="Bericht, Grundpflege sowie Ernährung und Ausscheidung verbunden dokumentieren">
  <View style={{ gap: spacing.md }}>
   {permissions.loading ? <LoadingState message="Aktuelle Dokumentationsrechte werden bestätigt…"/> : permissions.error ? <ErrorState message={permissions.error} onRetry={permissions.refreshPermissions}/> : null}
   {clients.loading ? <LoadingState message="Aktive eigene Pflegefälle werden geladen…"/> : clients.error ? <ErrorState message={clients.error} onRetry={clients.refresh}/> : null}
   <FilterChipGroup wrap options={options} value={clientId} onChange={setClientId}/>
   {clientId ? <FilterChipGroup wrap options={[{ key: 'documentation', label: 'Allgemeine Pflegedokumentation' }, { key: 'basic-care', label: 'Grundpflege und Prophylaxen' }, { key: 'nutrition-elimination', label: 'Ernährung und Ausscheidung' }]} value={workspace} onChange={value => setWorkspace(value as typeof workspace)}/> : null}
   {clientId && tenantId && actorId && workspace === 'documentation' ? <CareDocumentationWorkspacePanel key={`documentation:${tenantId}:${clientId}:${actorId}`} tenantId={tenantId} clientId={clientId} actorId={actorId} actorName={profile?.displayName ?? profile?.email ?? 'Aktuelle Person'} canCreate={permissions.can('pflege.documentation.create')} canConfirm={permissions.can('pflege.documentation.sign')} onSaved={() => router.replace(`/pflege/dokumentation?clientId=${clientId}` as never)}/> : null}
   {clientId && tenantId && actorId && workspace === 'basic-care' ? <BasicCareWorkspacePanel key={`basic-care:${tenantId}:${clientId}:${actorId}:${permissions.permissions.join('|')}`} tenantId={tenantId} clientId={clientId} actorId={actorId} actorName={profile?.displayName ?? profile?.email ?? 'Aktuelle Person'} canView={permissions.can('pflege.plans.view') && permissions.can('pflege.documentation.view')} canCreate={permissions.can('pflege.plans.view') && permissions.can('pflege.documentation.create')} canReview={permissions.can('pflege.documentation.sign')} onSaved={() => undefined}/> : null}
   {clientId && tenantId && actorId && workspace === 'nutrition-elimination' ? <NutritionEliminationWorkspacePanel key={`nutrition-elimination:${tenantId}:${clientId}:${actorId}:${permissions.permissions.join('|')}`} tenantId={tenantId} clientId={clientId} actorId={actorId} actorName={profile?.displayName ?? profile?.email ?? 'Aktuelle Person'} canView={permissions.can('pflege.plans.view') && permissions.can('pflege.documentation.view')} canCreate={permissions.can('pflege.plans.view') && permissions.can('pflege.documentation.create')} canReview={permissions.can('pflege.documentation.sign')} onSaved={() => undefined}/> : null}
   <PremiumButton title="Zur vollständigen Dokumentation" variant="secondary" onPress={() => router.replace(`/pflege/dokumentation${clientId ? `?clientId=${clientId}` : ''}` as never)}/>
  </View>
 </ScreenShell>;
}
export const CareReportCreateScreen = PflegeberichtErstellenScreen;
