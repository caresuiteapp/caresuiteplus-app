// Generated native presentation from src/components/timeTracking/TimeTrackingSettingsScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeSection,NativeH3,NativeFieldset,NativeDiv,NativeLabel,NativeInput,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { loadOfficeWorktimeSettings, saveOfficeWorktimeSettings, type OfficeWorktimeSettings } from "../../lib/wfm/wfmOfficeSettings.native.ts";
import { WfmCheckinQrPanel } from "../wfm/WfmCheckinQrPanel.native.tsx";
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from "../wfm/WfmSecondaryWorkspace.native.tsx";
const defaults: OfficeWorktimeSettings = { moduleEnabled: true, requirePrivacyConsent: true };
export function TimeTrackingSettingsScreen() {
    const tenantId = useServiceTenantId();
    const { user, profile } = useAuth();
    const userId = user?.id ?? profile?.id ?? '';
    const { can, check, roleKey } = usePermissions();
    const router = useRouter();
    const canManage = can('time.settings.manage');
    const scope = `${tenantId}:${userId}:${roleKey}:${canManage}`;
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const [draft, setDraft] = useState<OfficeWorktimeSettings>(defaults);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    useWfmUnsavedChanges(dirty, busy);
    const query = useAsyncQuery(useCallback(async () => tenantId && canManage ? loadOfficeWorktimeSettings(tenantId, roleKey) : { ok: true as const, data: null }, [tenantId, roleKey, canManage]), [tenantId, roleKey, canManage], { enabled: !!tenantId && !!userId && canManage, queryKey: scope });
    useEffect(() => { setDraft(defaults); setDirty(false); setError(''); setMessage(''); setBusy(false); lock.current = false; }, [scope]);
    useEffect(() => { if (!dirty && query.data)
        setDraft(query.data); }, [query.data, dirty]);
    const save = async () => {
        if (lock.current || !tenantId || !userId || !canManage || query.loading || query.error || query.refreshError)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        const requestedScope = scope;
        try {
            const result = await saveOfficeWorktimeSettings(tenantId, roleKey, draft);
            if (scopeRef.current !== requestedScope)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            query.setData(result.data);
            setDraft(result.data);
            setDirty(false);
            setMessage('Arbeitszeiteinstellungen gespeichert.');
        }
        catch (cause) {
            if (scopeRef.current === requestedScope)
                setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen.');
        }
        finally {
            if (scopeRef.current === requestedScope) {
                lock.current = false;
                setBusy(false);
            }
        }
    };
    return <WfmSecondaryWorkspace title="Einstellungen" description="Zeiterfassung und Büro-Check-in für Ihr Unternehmen.">
    {!canManage ? <WfmWebNotice>{check('time.settings.manage').reason ?? 'Keine Berechtigung für Arbeitszeiteinstellungen.'}</WfmWebNotice> : <>
      {(query.error || query.refreshError) && <WfmWebNotice tone="error">{query.error || query.refreshError}<NativeButton onClick={() => void query.refresh()}>Erneut laden</NativeButton></WfmWebNotice>}
      {query.loading ? <WfmWebNotice>Einstellungen werden geladen…</WfmWebNotice> : !query.error && <NativeSection className="wts-panel"><NativeH3>Eigene Zeiterfassung</NativeH3>
        {!query.data && <WfmWebNotice>Für Ihr Unternehmen sind noch keine Einstellungen gespeichert. Prüfen und speichern Sie die gewünschten Werte.</WfmWebNotice>}
        <NativeFieldset disabled={busy || !!query.refreshError} style={{ border: 0, padding: 0, margin: 0 }}><NativeDiv className="wts-stack">
          <NativeLabel className="wts-check"><NativeInput type="checkbox" checked={draft.moduleEnabled} onChange={e => { setDirty(true); setDraft(v => ({ ...v, moduleEnabled: e.target.checked })); }}/>Eigene Zeiterfassung aktivieren</NativeLabel>
          <NativeP>Steuert den Start eines Arbeitstages. Laufende Arbeitstage können weiterhin beendet werden.</NativeP>
          <NativeLabel className="wts-check"><NativeInput type="checkbox" checked={draft.requirePrivacyConsent} onChange={e => { setDirty(true); setDraft(v => ({ ...v, requirePrivacyConsent: e.target.checked })); }}/>Datenschutzhinweis vor Arbeitsbeginn bestätigen lassen</NativeLabel>
        </NativeDiv></NativeFieldset>
        <NativeDiv className="wts-actions"><NativeButton className="wts-primary" disabled={busy || !!query.refreshError || (!dirty && !!query.data)} onClick={() => void save()}>{busy ? 'Wird gespeichert…' : 'Einstellungen speichern'}</NativeButton>{dirty && <NativeButton disabled={busy} onClick={() => { setDraft(query.data ?? defaults); setDirty(false); }}>Änderungen verwerfen</NativeButton>}</NativeDiv>
      </NativeSection>}
      {error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}
      {tenantId && userId && <WfmCheckinQrPanel key={scope} tenantId={tenantId} userId={userId}/>}
      <NativeSection className="wts-panel"><NativeH3>Weitere Arbeitszeitregeln</NativeH3><NativeP>Fahrtvergütung und Besprechungen werden direkt in den jeweiligen Bereichen verwaltet.</NativeP><NativeDiv className="wts-actions"><NativeButton onClick={() => router.push('/business/office/time-tracking/fahrzeitregeln')}>Fahrzeitregeln</NativeButton><NativeButton onClick={() => router.push('/business/office/time-tracking/team-meetings')}>Team-Meetings</NativeButton></NativeDiv></NativeSection>
    </>}
  </WfmSecondaryWorkspace>;
}
