import { useEffect, useRef, useState } from 'react';
import { ClientPortalAccessPanel } from '@/components/clients/ClientPortalAccessPanel.web';
import { ClientPortalEmployeeVisibility } from '@/components/office/ClientPortalEmployeeVisibility.web';
import { OfficePortalApprovalsInbox } from '@/components/office/OfficePortalApprovalsInbox';
import { PortalSyncChainPanel } from '@/components/office/PortalSyncChainPanel.web';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchClientPortalSettingsResolved, listClientPortalAccessRequests, listVisiblePortalFeatures, reviewClientPortalAccessRequest, upsertClientPortalSettings } from '@/lib/client/clientPortalSettingsService';
import { listPortalSyncRowsForClient } from '@/lib/portal/portalSyncChainService';
import { syncClientDocumentPortalReleaseIfEnabled } from '@/lib/clients/clientDocumentsService';
import { useAuth } from '@/lib/auth/context';
import type { ClientFullDetail } from '@/types/modules/client';
import { portalExperienceCss } from './portalExperienceCss.web';

type Props = { clientId: string; fullClient?: ClientFullDetail | null; onRecordRefresh?: () => void };
type SettingsPatch = Partial<{ portalEnabled: boolean; inheritTenantDefaults: boolean; showAppointments: boolean; showMessages: boolean; showDocuments: boolean; showProofs: boolean }>;
const FEATURE_LABELS: Record<string, string> = { appointments: 'Einsätze & Termine', messages: 'Nachrichten', documents: 'Dokumente', proofs: 'Leistungsnachweise', budget: 'Budget' };
const FEATURE_TOGGLES = [
  { key: 'showAppointments', label: 'Einsätze & Termine', description: 'Geplante und freigegebene Besuche im eigenen Portal sehen.' },
  { key: 'showMessages', label: 'Nachrichten', description: 'Die Kommunikation mit der Verwaltung im Portal nutzen.' },
  { key: 'showDocuments', label: 'Dokumente', description: 'Für das Portal bereitgestellte Unterlagen ansehen.' },
  { key: 'showProofs', label: 'Leistungsnachweise', description: 'Freigegebene Nachweise zu den eigenen Einsätzen aufrufen.' },
] as const;
const REQUEST_STATUSES: Record<string, string> = { pending: 'Offen', approved: 'Genehmigt', rejected: 'Abgelehnt', cancelled: 'Zurückgezogen' };
const REQUEST_TYPES: Record<string, string> = { access: 'Portalzugang', portal_access: 'Portalzugang', client_access: 'Persönlicher Zugang', relative_access: 'Angehörigenzugang', family_access: 'Angehörigenzugang' };

export function ClientPortalCorePanel(props: Props) {
  const tenantId = useServiceTenantId();
  return <ClientPortalCoreContent key={`${tenantId}:${props.clientId}`} {...props} tenantId={tenantId} />;
}

function ClientPortalCoreContent({ clientId, fullClient, onRecordRefresh, tenantId }: Props & { tenantId: string | null }) {
  const { isReadOnly } = usePermissions();
  const { profile } = useAuth();
  const mounted = useRef(true);
  const mutationLock = useRef(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [documentReleaseError, setDocumentReleaseError] = useState(false);
  const scope = `${tenantId}:${clientId}`;
  const settingsQuery = useAsyncQuery(() => tenantId ? fetchClientPortalSettingsResolved(tenantId, clientId) : Promise.resolve({ ok: false as const, error: 'Die Unternehmenszuordnung fehlt.' }), [tenantId, clientId], { enabled: !!tenantId && !!clientId, queryKey: `settings:${scope}` });
  const featuresQuery = useAsyncQuery(() => tenantId ? listVisiblePortalFeatures(tenantId, clientId) : Promise.resolve({ ok: false as const, error: 'Die Unternehmenszuordnung fehlt.' }), [tenantId, clientId], { enabled: !!tenantId && !!clientId, queryKey: `features:${scope}` });
  const requestsQuery = useAsyncQuery(() => tenantId ? listClientPortalAccessRequests(tenantId, clientId) : Promise.resolve({ ok: false as const, error: 'Die Unternehmenszuordnung fehlt.' }), [tenantId, clientId], { enabled: !!tenantId && !!clientId, queryKey: `requests:${scope}` });
  const syncQuery = useAsyncQuery(() => tenantId ? listPortalSyncRowsForClient(tenantId, clientId) : Promise.resolve({ ok: false as const, error: 'Die Unternehmenszuordnung fehlt.' }), [tenantId, clientId], { enabled: !!tenantId && !!clientId, queryKey: `proofs:${scope}` });
  const settings = settingsQuery.data;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!tenantId || !clientId || !settings?.portalEnabled || !settings.showDocuments) return;
    let cancelled = false;
    void syncClientDocumentPortalReleaseIfEnabled(tenantId, clientId).then((result) => {
      if (!cancelled) setDocumentReleaseError(!result.ok);
    }).catch(() => { if (!cancelled) setDocumentReleaseError(true); });
    return () => { cancelled = true; };
  }, [tenantId, clientId, settings?.portalEnabled, settings?.showDocuments]);

  async function saveSettings(patch: SettingsPatch, label: string) {
    if (!tenantId || isReadOnly || mutationLock.current) return;
    mutationLock.current = true;
    setSaving(label);
    setMessage('');
    setError(null);
    try {
      const result = await upsertClientPortalSettings(tenantId, clientId, { inheritTenantDefaults: false, ...patch });
      if (!mounted.current) return;
      if (!result.ok) { setError(result.error); return; }
      const [settingsLoaded, featuresLoaded] = await Promise.all([settingsQuery.refreshWithResult(), featuresQuery.refreshWithResult()]);
      if (!mounted.current) return;
      if (settingsLoaded && featuresLoaded) setMessage(`${label} gespeichert.`);
      else setError('Die Änderung wurde gespeichert. Der aktuelle Stand konnte noch nicht vollständig geladen werden. Bitte aktualisieren Sie die Ansicht.');
      onRecordRefresh?.();
    } catch {
      if (mounted.current) setError('Die Änderung konnte nicht bestätigt werden. Bitte laden Sie die Einstellungen erneut.');
    } finally {
      mutationLock.current = false;
      if (mounted.current) setSaving(null);
    }
  }

  async function reviewRequest(id: string, decision: 'approved' | 'rejected') {
    if (!tenantId || isReadOnly || mutationLock.current) return;
    mutationLock.current = true;
    setSaving('Zugangsanfrage');
    setMessage('');
    setError(null);
    try {
      const result = await reviewClientPortalAccessRequest(tenantId, clientId, id, decision, { reviewedBy: profile?.id ?? null });
      if (!mounted.current) return;
      if (!result.ok) { setError(result.error); return; }
      const refreshed = await requestsQuery.refreshWithResult();
      if (!mounted.current) return;
      if (refreshed) setMessage(decision === 'approved' ? 'Die Zugangsanfrage wurde genehmigt.' : 'Die Zugangsanfrage wurde abgelehnt.');
      else setError('Die Entscheidung wurde gespeichert. Die Anfragenliste konnte noch nicht aktualisiert werden.');
      onRecordRefresh?.();
    } catch {
      if (mounted.current) setError('Die Entscheidung konnte nicht bestätigt werden. Bitte laden Sie die Anfragen erneut.');
    } finally {
      mutationLock.current = false;
      if (mounted.current) setSaving(null);
    }
  }

  const features = featuresQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const pending = requests.filter((request) => request.status === 'pending').length;
  const settingsError = settingsQuery.error ?? settingsQuery.refreshError;
  const featureError = featuresQuery.error ?? featuresQuery.refreshError;
  const requestError = requestsQuery.error ?? requestsQuery.refreshError;
  const proofError = syncQuery.error ?? syncQuery.refreshError;

  if (!tenantId || !clientId) return <div className="cs-portal"><style>{portalExperienceCss}</style><div className="cs-portal-status error" role="alert">Die Portalverwaltung benötigt eine zugeordnete Klientenakte und ein Unternehmen. Öffnen Sie die Akte erneut.</div></div>;

  return <div className="cs-portal">
    <style>{portalExperienceCss}</style>
    <section className="cs-portal-section" aria-label="Inhalte im Klientenportal">
      <div className="cs-portal-heading"><div><span className="cs-portal-eyebrow">Einblick & Zusammenarbeit</span><h2>Was sieht die Person in ihrem Portal?</h2><p>Bestimmen Sie den Zugang und die freigegebenen Inhalte dieser Akte.</p></div>{settings ? <span className={`cs-portal-pill${settings.portalEnabled ? ' active' : ''}`}>{settings.portalEnabled ? 'Portal freigegeben' : 'Portal ausgeschaltet'}</span> : null}</div>
      {saving ? <div className="cs-portal-status" role="status">{saving} wird gespeichert…</div> : null}
      {message ? <div className="cs-portal-status success" role="status">{message}</div> : null}
      {error ? <div className="cs-portal-status error" role="alert">{error}<button type="button" className="cs-portal-button" disabled={!!saving} onClick={() => { setError(null); void Promise.all([settingsQuery.refresh(), featuresQuery.refresh(), requestsQuery.refresh()]); }}>Ansicht aktualisieren</button></div> : null}
      {settingsQuery.loading && !settings ? <div className="cs-portal-status" role="status">Einstellungen werden geladen…</div> : null}
      {settingsError ? <div className="cs-portal-status error" role="alert">Einstellungen konnten nicht aktualisiert werden. {settingsError}<button type="button" className="cs-portal-button" disabled={!!saving || settingsQuery.refreshing} onClick={() => void settingsQuery.refresh()}>Erneut laden</button></div> : null}
      {settings ? <>
        <div className="cs-portal-summary"><div><span>Einstellungen</span><strong>{settings.inheritTenantDefaults ? 'Vom Unternehmen übernommen' : 'Für diese Person angepasst'}</strong></div><div><span>Inhaltsfreigaben</span><strong>{FEATURE_TOGGLES.filter(({ key }) => settings[key]).length} von 4 ausgewählt</strong></div><div><span>Zugangsanfragen</span><strong>{requestError ? 'Nicht verfügbar' : requestsQuery.loading ? 'Wird geladen…' : `${pending} offen`}</strong></div></div>
        <label className="cs-portal-toggle cs-portal-toggle-wide"><span><strong>Portalzugang freigeben</strong><small>{settings.portalEnabled ? 'Die ausgewählten Inhalte dürfen im persönlichen Portal erscheinen.' : 'Die Inhalte sind derzeit nicht über das Klientenportal zugänglich.'}</small></span><input type="checkbox" role="switch" aria-label="Portalzugang freigeben" checked={settings.portalEnabled} disabled={isReadOnly || !!saving || !!settingsError || settingsQuery.refreshing} onChange={(event) => void saveSettings({ portalEnabled: event.target.checked }, 'Portalzugang')} /></label>
        <div className="cs-portal-toggle-grid">{FEATURE_TOGGLES.map(({ key, label, description }) => <label key={key} className="cs-portal-toggle"><span><strong>{label}</strong><small>{description}</small><small>{!settings.portalEnabled ? 'Portal ausgeschaltet' : settings[key] ? 'Freigegeben' : 'Ausgeblendet'}</small></span><input type="checkbox" role="switch" aria-label={label} checked={settings[key]} disabled={isReadOnly || !settings.portalEnabled || !!saving || !!settingsError || settingsQuery.refreshing} onChange={(event) => void saveSettings({ [key]: event.target.checked }, label)} /></label>)}</div>
        <p className="cs-portal-help">Änderungen gelten für diese Person und werden sofort gespeichert. Dokumente und Nachweise erscheinen erst, wenn die jeweiligen Unterlagen zur Ansicht freigegeben sind.</p>
        {isReadOnly ? <p className="cs-portal-help">Ihr Zugang kann diese Einstellungen ansehen, aber nicht verändern.</p> : null}
        {featureError ? <div className="cs-portal-status error" role="alert">Die tatsächlich sichtbaren Inhalte konnten nicht bestätigt werden.<button className="cs-portal-button" type="button" disabled={!!saving || featuresQuery.refreshing} onClick={() => void featuresQuery.refresh()}>Erneut prüfen</button></div> : featuresQuery.loading ? <p className="cs-portal-help" role="status">Sichtbare Inhalte werden geprüft…</p> : <p className="cs-portal-help">Aktuell freigegeben: {features.length ? features.map((feature) => FEATURE_LABELS[feature] ?? 'Weiterer freigegebener Inhalt').join(', ') : 'Keine Inhalte'}.</p>}
      </> : !settingsQuery.loading && !settingsError ? <div className="cs-portal-empty"><strong>Noch keine Einstellungen verfügbar</strong><p>Laden Sie die Akte erneut, um die Einstellungen des Unternehmens zu übernehmen.</p><button type="button" className="cs-portal-button" onClick={() => void settingsQuery.refresh()}>Einstellungen laden</button></div> : null}
      {documentReleaseError ? <div className="cs-portal-status error" role="alert">Die Bereitstellung der Dokumente konnte nicht bestätigt werden. Prüfen Sie den Freigabestatus unter „Dokumente & Nachweise“.</div> : null}
    </section>
    {fullClient?.id === clientId && tenantId ? <ClientPortalAccessPanel client={fullClient} tenantId={tenantId} isReadOnly={isReadOnly} onRefresh={onRecordRefresh} /> : <div className="cs-portal-section"><h3>Zugangsdaten noch nicht verfügbar</h3><p>Sobald die vollständige Akte geladen ist, können Sie hier den persönlichen Zugang verwalten.</p></div>}
    <section className="cs-portal-section" aria-label="Zugangsanfragen">
      <div className="cs-portal-heading"><div><h2>Zugangsanfragen</h2><p>Prüfen Sie, wer einen persönlichen Zugang oder einen Angehörigenzugang angefragt hat.</p></div>{!requestsQuery.loading && !requestError ? <span className="cs-portal-pill">{pending} offen</span> : null}</div>
      {requestsQuery.loading ? <p role="status">Anfragen werden geladen…</p> : null}
      {requestError ? <div className="cs-portal-status error" role="alert">Anfragen konnten nicht aktualisiert werden.<button className="cs-portal-button" type="button" disabled={!!saving || requestsQuery.refreshing} onClick={() => void requestsQuery.refresh()}>Erneut laden</button></div> : null}
      {!requestsQuery.loading && !requestError && !requests.length ? <div className="cs-portal-empty"><strong>Keine Zugangsanfragen</strong><p>Neue Anfragen erscheinen hier zur Prüfung.</p></div> : null}
      {requests.map((request) => <article className="cs-portal-request" key={request.id}><div className="cs-portal-row"><div><h3>{request.requesterName}</h3><p>{REQUEST_TYPES[request.requestType] ?? 'Zugangsanfrage'}{request.requesterEmail ? ` · ${request.requesterEmail}` : ''}</p></div><span className={`cs-portal-pill${request.status === 'pending' ? ' warning' : ''}`}>{REQUEST_STATUSES[request.status] ?? 'Status nicht verfügbar'}</span></div>{request.status === 'pending' && !isReadOnly ? <div className="cs-portal-actions"><button type="button" className="cs-portal-button primary" disabled={!!saving || !!requestError || requestsQuery.refreshing} onClick={() => void reviewRequest(request.id, 'approved')}>Zugang genehmigen</button><button type="button" className="cs-portal-button" disabled={!!saving || !!requestError || requestsQuery.refreshing} onClick={() => void reviewRequest(request.id, 'rejected')}>Anfrage ablehnen</button></div> : null}</article>)}
    </section>
    <details className="cs-portal-disclosure"><summary>Nachweise, Unterschriften und Freigaben</summary><div>{syncQuery.loading ? <p role="status">Nachweise werden geladen…</p> : null}{proofError ? <div className="cs-portal-status error" role="alert">Der Freigabestatus konnte nicht geladen werden.<button className="cs-portal-button" type="button" disabled={syncQuery.refreshing} onClick={() => void syncQuery.refresh()}>Erneut laden</button></div> : !syncQuery.loading ? <PortalSyncChainPanel rows={syncQuery.data ?? []} /> : null}<OfficePortalApprovalsInbox clientId={clientId} /></div></details>
    <details className="cs-portal-disclosure"><summary>Welche Angaben sehen Mitarbeitende?</summary><div><ClientPortalEmployeeVisibility /></div></details>
  </div>;
}
