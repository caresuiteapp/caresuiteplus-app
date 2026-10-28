// Generated native presentation from src/screens/pflege/ControlSourceLaunchButton.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { controlSourcePermissions } from '@/lib/pflege/clinicalControlRuntime';
import { sameWoundJson, woundUuid } from '@/lib/pflege/woundCareDomain';
import { parseControlLaunch, type ControlLaunch } from '@/lib/pflege/clinicalControlWorklist';
export function ControlSourceLaunchButton({ clientId, sourceId, sourceKind, evaluationMeasureId, disabled = false }: ControlLaunch & {
    disabled?: boolean;
}) {
    const router = useRouter(), p = usePermissions(), { profile } = useAuth(), tenantId = useServiceTenantId(), alive = useRef(true);
    const [owner] = useState(() => ({ tenantId, profileId: profile?.id ?? '', profileRole: profile?.roleKey ?? null, clientId }));
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    let launch: ControlLaunch | null = null, canRead = false;
    try {
        launch = parseControlLaunch({ clientId, sourceId, sourceKind, ...(evaluationMeasureId !== undefined ? { evaluationMeasureId } : {}) });
        canRead = !!launch && ['pflege.documentation.view', 'pflege.treatment.view', 'pflege.orders.view', ...controlSourcePermissions(sourceKind)].every(key => p.can(key as Parameters<typeof p.can>[0]) === true);
    }
    catch { }
    const current = { tenantId, profileId: profile?.id ?? '', profileRole: profile?.roleKey ?? null, runtimeTenantId: p.tenantId, runtimeRole: p.roleKey, launch, canRead, disabled }, state = useRef(current);
    state.current = current;
    function ownRead(value: typeof current) { return alive.current && [owner.tenantId, owner.profileId, owner.clientId].every(woundUuid) && !!owner.profileRole && value.tenantId === owner.tenantId && value.runtimeTenantId === owner.tenantId && value.profileId === owner.profileId && value.profileRole === owner.profileRole && value.runtimeRole === owner.profileRole && value.launch?.clientId === owner.clientId && value.canRead; }
    function open() { const latest = state.current; if (!ownRead(latest) || latest.disabled || !latest.launch || !launch || !sameWoundJson(latest.launch, launch))
        return; const native = parseControlLaunch(latest.launch); if (!native)
        return; router.push({ pathname: '/pflege/behandlungspflege', params: { view: 'controls', ...native } } as never); }
    if (!launch || !ownRead(current))
        return null;
    return <PremiumButton title={evaluationMeasureId ? 'Prüfvereinbarung dieser Maßnahme und Aufträge öffnen' : 'Kontrollvereinbarung und zugeordnete Aufträge öffnen'} variant="secondary" disabled={disabled} onPress={open}/>;
}
