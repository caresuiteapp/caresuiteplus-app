// Generated native presentation from src/screens/pflege/PflegeberichtErstellenScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CareDocumentationWorkspacePanel } from "../../components/pflege/CareDocumentationWorkspacePanel.native.tsx";
import { BasicCareWorkspacePanel } from "../../components/pflege/BasicCareWorkspacePanel.native.tsx";
import { NutritionEliminationWorkspacePanel } from "../../components/pflege/NutritionEliminationWorkspacePanel.native.tsx";
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, LoadingState, PremiumButton } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareDocumentationScope } from "../../hooks/pflege/useCareDocumentationScope.native.ts";
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { CarePermissionStatus } from "./CarePermissionStatus.native.tsx";
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { spacing } from '@/theme';
export function PflegeberichtErstellenScreen() {
    const params = useLocalSearchParams<{
        clientId?: string | string[];
    }>(), scope = useCareDocumentationScope('pflege.documentation.create');
    const linked = typeof params.clientId === 'string' && woundUuid(params.clientId) ? params.clientId : '';
    if (!scope.ready)
        return <ScreenShell title="Pflegedokumentation erfassen"><CarePermissionStatus state={scope.permissions} deniedMessage="Für einen neuen Dokumentationsvorgang fehlt die aktuelle Schreibberechtigung."/></ScreenShell>;
    return <CareDocumentationCreate key={`${scope.revision}:${linked}`} scope={scope} linked={linked} invalidLink={params.clientId !== undefined && !linked}/>;
}
function CareDocumentationCreate({ scope, linked, invalidLink }: {
    scope: ReturnType<typeof useCareDocumentationScope>;
    linked: string;
    invalidLink: boolean;
}) {
    const router = useRouter(), { permissions, profile, tenantId, actorId, isCurrent, can } = scope;
    const clients = useAsyncQuery(async () => {
        if (!isCurrent())
            return { ok: false as const, error: 'Der Dokumentationszugriff wurde geändert.' };
        const result = await fetchEligibleCareClients(tenantId, permissions.roleKey);
        if (!isCurrent() || result.ok && (result.usedDemoFallback || result.tableMissing))
            return { ok: false as const, error: 'Die aktuelle Pflegefallliste konnte nicht bestätigt werden.' };
        return result;
    }, [scope.revision], { queryKey: `pflege-doku-erfassen:${scope.revision}`, retryCount: 0 });
    const options = useMemo(() => (!clients.error && !clients.refreshError && !clients.cacheMeta.fromCache && !clients.tableMissing && !clients.previewData ? clients.data ?? [] : []).map(client => ({ key: client.id, label: `${client.lastName}, ${client.firstName}` })), [clients.data, clients.error, clients.refreshError, clients.cacheMeta.fromCache, clients.tableMissing, clients.previewData]);
    const [clientId, setClientId] = useState(linked), [workspace, setWorkspace] = useState<'documentation' | 'basic-care' | 'nutrition-elimination'>('documentation');
    const basicLeave = useRef<(() => Promise<boolean>) | null>(null), nutritionLeave = useRef<(() => Promise<boolean>) | null>(null), selectionFlight = useRef(false), selection = useRef({ tenantId, actorId, clientId, workspace });
    selection.current = { tenantId, actorId, clientId, workspace };
    const registerBasicLeave = useCallback((guard: (() => Promise<boolean>) | null) => { basicLeave.current = guard; }, []), registerNutritionLeave = useCallback((guard: (() => Promise<boolean>) | null) => { nutritionLeave.current = guard; }, []), isLeavingSelection = useCallback(() => selectionFlight.current, []);
    const changeSelection = async (kind: 'client' | 'workspace', value: string) => { if (selectionFlight.current || !isCurrent())
        return; const before = { ...selection.current }, ref = before.workspace === 'basic-care' ? basicLeave : before.workspace === 'nutrition-elimination' ? nutritionLeave : null, guard = ref?.current ?? null; selectionFlight.current = true; try {
        if (guard && await guard() !== true)
            return;
        const now = selection.current;
        if (!isCurrent() || now.tenantId !== before.tenantId || now.actorId !== before.actorId || now.clientId !== before.clientId || now.workspace !== before.workspace || (ref?.current ?? null) !== guard)
            return;
        if (kind === 'client')
            setClientId(value);
        else
            setWorkspace(value as typeof workspace);
    }
    finally {
        selectionFlight.current = false;
    } };
    return <ScreenShell title="Pflegedokumentation erfassen" subtitle="Bericht, Grundpflege sowie Ernährung und Ausscheidung verbunden dokumentieren">
  <View style={{ gap: spacing.md }}>
   {invalidLink ? <ErrorState presentation="inline" message="Der Pflegefall aus dem Link ist nicht eindeutig. Wählen Sie den aktiven Fall aus der Liste."/> : null}
   {clients.loading ? <LoadingState message="Aktive eigene Pflegefälle werden geladen…"/> : clients.error || clients.refreshError ? <ErrorState message={clients.error ?? clients.refreshError ?? 'Pflegefälle nicht verfügbar.'} onRetry={clients.refresh}/> : null}
   <FilterChipGroup wrap options={options} value={clientId} onChange={value => { if (isCurrent() && woundUuid(value) && options.some(option => option.key === value))
        void changeSelection('client', value); }}/>
   {clientId ? <FilterChipGroup wrap options={[{ key: 'documentation', label: 'Allgemeine Pflegedokumentation' }, { key: 'basic-care', label: 'Grundpflege und Prophylaxen' }, { key: 'nutrition-elimination', label: 'Ernährung und Ausscheidung' }]} value={workspace} onChange={value => { if (isCurrent())
        void changeSelection('workspace', value); }}/> : null}
   {clientId && tenantId && actorId && workspace === 'documentation' ? <CareDocumentationWorkspacePanel key={`documentation:${tenantId}:${clientId}:${actorId}`} tenantId={tenantId} clientId={clientId} actorId={actorId} actorName={profile?.displayName ?? profile?.email ?? 'Aktuelle Person'} canCreate={can('pflege.documentation.create')} canConfirm={false} isOwnerCurrent={() => isCurrent() && selection.current.clientId === clientId && selection.current.workspace === 'documentation' && !selectionFlight.current} canWriteNow={action => action === 'create' && selection.current.clientId === clientId && selection.current.workspace === 'documentation' && can('pflege.documentation.create')} onSaved={() => { if (isCurrent() && selection.current.clientId === clientId)
        router.replace(`/pflege/dokumentation?clientId=${encodeURIComponent(clientId)}` as never); }}/> : null}
   {clientId && tenantId && actorId && workspace === 'basic-care' ? <BasicCareWorkspacePanel key={`basic-care:${tenantId}:${clientId}:${actorId}:${permissions.permissions.join('|')}`} tenantId={tenantId} clientId={clientId} actorId={actorId} actorName={profile?.displayName ?? profile?.email ?? 'Aktuelle Person'} canView={can('pflege.plans.view') && can('pflege.documentation.view')} canCreate={can('pflege.plans.view') && can('pflege.documentation.create')} canReview={can('pflege.documentation.sign')} canPlan={can('pflege.plans.manage') && can('pflege.documentation.create')} isOwnerCurrent={() => selection.current.clientId === clientId && selection.current.workspace === workspace && can('pflege.plans.view') && can('pflege.documentation.view')} isLeaving={isLeavingSelection} registerLeave={registerBasicLeave} onSaved={() => undefined}/> : null}
   {clientId && tenantId && actorId && workspace === 'nutrition-elimination' ? <NutritionEliminationWorkspacePanel key={`nutrition-elimination:${tenantId}:${clientId}:${actorId}:${permissions.permissions.join('|')}`} tenantId={tenantId} clientId={clientId} actorId={actorId} actorName={profile?.displayName ?? profile?.email ?? 'Aktuelle Person'} canView={can('pflege.plans.view') && can('pflege.documentation.view') && can('pflege.vitals.view')} canCreate={can('pflege.plans.view') && can('pflege.documentation.view') && can('pflege.vitals.view') && can('pflege.documentation.create')} canCaptureBinding={can('pflege.plans.view') && can('pflege.documentation.view') && can('pflege.vitals.view') && can('pflege.plans.manage') && can('pflege.documentation.create')} canReview={can('pflege.documentation.sign')} isOwnerCurrent={() => selection.current.clientId === clientId && selection.current.workspace === workspace && can('pflege.plans.view') && can('pflege.documentation.view') && can('pflege.vitals.view')} isLeaving={isLeavingSelection} registerLeave={registerNutritionLeave} onSaved={() => undefined}/> : null}
   <PremiumButton title="Zur vollständigen Dokumentation" variant="secondary" onPress={() => { if (isCurrent())
        router.replace(`/pflege/dokumentation${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}` as never); }}/>
  </View>
 </ScreenShell>;
}
export const CareReportCreateScreen = PflegeberichtErstellenScreen;
