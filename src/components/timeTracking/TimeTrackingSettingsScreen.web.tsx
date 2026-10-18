import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { loadOfficeWorktimeSettings, saveOfficeWorktimeSettings, type OfficeWorktimeSettings } from '@/lib/wfm/wfmOfficeSettings.web';
import { WfmCheckinQrPanel } from '@/components/wfm/WfmCheckinQrPanel.web';
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from '@/components/wfm/WfmSecondaryWorkspace.web';

const defaults: OfficeWorktimeSettings = { moduleEnabled: true, requirePrivacyConsent: true };

export function TimeTrackingSettingsScreen() {
  const tenantId = useServiceTenantId(); const { user, profile } = useAuth();
  const userId = user?.id ?? profile?.id ?? ''; const { can, check, roleKey } = usePermissions(); const router = useRouter();
  const canManage = can('time.settings.manage'); const scope = `${tenantId}:${userId}:${roleKey}:${canManage}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const [draft, setDraft] = useState<OfficeWorktimeSettings>(defaults); const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useWfmUnsavedChanges(dirty, busy);
  const query = useAsyncQuery(useCallback(async () => tenantId && canManage ? loadOfficeWorktimeSettings(tenantId, roleKey) : { ok: true as const, data: null }, [tenantId, roleKey, canManage]), [tenantId, roleKey, canManage], { enabled: !!tenantId && !!userId && canManage, queryKey: scope });
  useEffect(() => { setDraft(defaults); setDirty(false); setError(''); setMessage(''); setBusy(false); lock.current = false; }, [scope]);
  useEffect(() => { if (!dirty && query.data) setDraft(query.data); }, [query.data, dirty]);
  const save = async () => {
    if (lock.current || !tenantId || !userId || !canManage || query.loading || query.error || query.refreshError) return;
    lock.current = true; setBusy(true); setError(''); setMessage(''); const requestedScope = scope;
    try {
      const result = await saveOfficeWorktimeSettings(tenantId, roleKey, draft);
      if (scopeRef.current !== requestedScope) return;
      if (!result.ok) { setError(result.error); return; }
      query.setData(result.data); setDraft(result.data); setDirty(false); setMessage('Arbeitszeiteinstellungen gespeichert.');
    } catch (cause) { if (scopeRef.current === requestedScope) setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen.'); }
    finally { if (scopeRef.current === requestedScope) { lock.current = false; setBusy(false); } }
  };
  return <WfmSecondaryWorkspace title="Einstellungen" description="Zeiterfassung und Büro-Check-in für Ihr Unternehmen.">
    {!canManage ? <WfmWebNotice>{check('time.settings.manage').reason ?? 'Keine Berechtigung für Arbeitszeiteinstellungen.'}</WfmWebNotice> : <>
      {(query.error || query.refreshError) && <WfmWebNotice tone="error">{query.error || query.refreshError}<button onClick={() => void query.refresh()}>Erneut laden</button></WfmWebNotice>}
      {query.loading ? <WfmWebNotice>Einstellungen werden geladen…</WfmWebNotice> : !query.error && <section className="wts-panel"><h3>Eigene Zeiterfassung</h3>
        {!query.data && <WfmWebNotice>Für Ihr Unternehmen sind noch keine Einstellungen gespeichert. Prüfen und speichern Sie die gewünschten Werte.</WfmWebNotice>}
        <fieldset disabled={busy || !!query.refreshError} style={{ border: 0, padding: 0, margin: 0 }}><div className="wts-stack">
          <label className="wts-check"><input type="checkbox" checked={draft.moduleEnabled} onChange={e => { setDirty(true); setDraft(v => ({ ...v, moduleEnabled: e.target.checked })); }} />Eigene Zeiterfassung aktivieren</label>
          <p>Steuert den Start eines Arbeitstages. Laufende Arbeitstage können weiterhin beendet werden.</p>
          <label className="wts-check"><input type="checkbox" checked={draft.requirePrivacyConsent} onChange={e => { setDirty(true); setDraft(v => ({ ...v, requirePrivacyConsent: e.target.checked })); }} />Datenschutzhinweis vor Arbeitsbeginn bestätigen lassen</label>
        </div></fieldset>
        <div className="wts-actions"><button className="wts-primary" disabled={busy || !!query.refreshError || (!dirty && !!query.data)} onClick={() => void save()}>{busy ? 'Wird gespeichert…' : 'Einstellungen speichern'}</button>{dirty && <button disabled={busy} onClick={() => { setDraft(query.data ?? defaults); setDirty(false); }}>Änderungen verwerfen</button>}</div>
      </section>}
      {error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}
      {tenantId && userId && <WfmCheckinQrPanel key={scope} tenantId={tenantId} userId={userId} />}
      <section className="wts-panel"><h3>Weitere Arbeitszeitregeln</h3><p>Fahrtvergütung und Besprechungen werden direkt in den jeweiligen Bereichen verwaltet.</p><div className="wts-actions"><button onClick={() => router.push('/business/office/time-tracking/fahrzeitregeln')}>Fahrzeitregeln</button><button onClick={() => router.push('/business/office/time-tracking/team-meetings')}>Team-Meetings</button></div></section>
    </>}
  </WfmSecondaryWorkspace>;
}
