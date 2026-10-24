// Generated native presentation from src/features/beratung/ConsultationWorkspaceScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeDocument as document,nativeNavigator as navigator,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePermissions } from '@/hooks/usePermissions';
import { loadConsultationWorkspace, mutateConsultationWorkspace } from '@/lib/beratung/workspaceService';
import { activateConsultationDraftScope } from '@/lib/beratung/workspaceDrafts';
import { isConsultationWorkspaceEnabled } from '@/lib/beratung/workspaceRelease';
import type { ConsultationCommand, ConsultationWorkspace } from '@/lib/beratung/workspaceModel';
import { ConsultationWorkspaceView } from "./ConsultationWorkspace.native.tsx";
import type { WorkspaceCommand } from "./ConsultationEditor.native.tsx";
export function ConsultationWorkspaceScreen({ employeeView = false, createInitially = false }: {
    employeeView?: boolean;
    createInitially?: boolean;
}) {
    const auth = useAuth();
    const portal = usePortalActor();
    const params = useLocalSearchParams<{
        id?: string;
        visit?: string;
    }>();
    const tenant = employeeView ? portal.tenantId : auth.profile?.tenantId;
    const ready = Boolean(tenant && auth.user?.id && (!employeeView || portal.isLinkedReady && !portal.employeeLinkReadOnly));
    const draftScope = `${tenant ?? ''}:${auth.user?.id ?? ''}:${portal.actorId ?? ''}:${employeeView}`;
    useEffect(() => activateConsultationDraftScope(draftScope), [draftScope]);
    const identity = `${draftScope}:${params.id ?? ''}`;
    if (!isConsultationWorkspaceEnabled())
        return <ConsultationWorkspaceView workspace={null} loading={false} busy={false} error="Der neue Beratungsarbeitsplatz ist noch nicht freigeschaltet." notice={null} employeeView={employeeView} onCommand={async () => null} onReload={() => { }} onOpenCase={() => { }}/>;
    return <ConnectedWorkspace key={identity} draftScope={draftScope} tenantId={ready ? tenant! : null} employeeView={employeeView} caseId={params.id} encounterId={params.visit} createInitially={createInitially}/>;
}
function ConnectedWorkspace({ tenantId, employeeView, caseId, encounterId, createInitially, draftScope }: {
    draftScope: string;
    tenantId: string | null;
    employeeView: boolean;
    caseId?: string;
    encounterId?: string;
    createInitially: boolean;
}) {
    const router = useRouter();
    const permissions = usePermissions();
    const [workspace, setWorkspace] = useState<ConsultationWorkspace | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const sequence = useRef(0);
    const mounted = useRef(true);
    const writeLock = useRef(false);
    const retry = useRef<{
        key: string;
        command: ConsultationCommand;
    } | null>(null);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current++; retry.current = null; }; }, []);
    const reload = useCallback(async (background = false) => {
        if (!tenantId)
            return;
        const request = ++sequence.current;
        if (!background)
            setLoading(true);
        try {
            const result = await loadConsultationWorkspace(tenantId, employeeView, caseId);
            if (mounted.current && request === sequence.current) {
                setWorkspace(result);
                if (!background)
                    setError(null);
            }
        }
        catch (e) {
            if (mounted.current && request === sequence.current) {
                setError(e instanceof Error ? e.message : 'Der Beratungsarbeitsplatz konnte nicht geladen werden.');
            }
        }
        finally {
            if (mounted.current && request === sequence.current)
                setLoading(false);
        }
    }, [tenantId, employeeView, caseId]);
    useEffect(() => {
        void reload();
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible' && !writeLock.current && navigator.onLine)
                void reload(true);
        }, 30000);
        return () => clearInterval(timer);
    }, [reload]);
    const command: WorkspaceCommand = async (action, data, encounter) => {
        if (!tenantId || writeLock.current)
            return null;
        if (!navigator.onLine) {
            setError('Keine Netzverbindung. Der Entwurf bleibt geöffnet; bitte nach Wiederherstellung der Verbindung erneut speichern.');
            return null;
        }
        const body = { action, data, encounterId: encounter?.id ?? null, expectedVersion: encounter?.version ?? null };
        const key = JSON.stringify(body);
        const request = retry.current?.key === key ? retry.current.command : { ...body, requestId: crypto.randomUUID() };
        retry.current = { key, command: request };
        writeLock.current = true;
        sequence.current++;
        setBusy(true);
        setLoading(false);
        setError(null);
        setNotice(null);
        try {
            const result = await mutateConsultationWorkspace(tenantId, request);
            if (!mounted.current)
                return result;
            retry.current = null;
            // Mutation acknowledgement is authoritative even if the following read fails.
            setNotice(action === 'submit' ? 'Einreichung vom Server bestätigt.' : action === 'qualify' ? 'Qualifikationsfreigabe vom Server bestätigt.' : 'Gespeichert und vom Server bestätigt.');
            await reload(true);
            return result;
        }
        catch (e) {
            if (mounted.current)
                setError(e instanceof Error ? e.message : 'Die Übertragung konnte nicht bestätigt werden.');
            return null;
        }
        finally {
            writeLock.current = false;
            if (mounted.current)
                setBusy(false);
        }
    };
    const root = employeeView ? '/portal/employee/beratung' : '/beratung/arbeitsplatz';
    return <ConsultationWorkspaceView workspace={workspace} loading={loading} busy={busy} error={error} notice={notice} employeeView={employeeView} caseId={caseId} encounterId={encounterId} createInitially={createInitially} draftScope={draftScope} tenantId={tenantId} canCreateClient={!employeeView && permissions.canAll(['office.clients.create', 'office.clients.view', 'office.clients.view_sensitive'])} onCommand={command} onReload={() => void reload()} onOpenCase={(id, visit) => router.push((id ? `${root}/${id}${visit ? `?visit=${encodeURIComponent(visit)}` : ''}` : root) as never)}/>;
}
