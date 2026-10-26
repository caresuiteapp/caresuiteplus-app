// Generated native presentation from src/components/office/ClientPortalCorePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStyle,NativeSection,NativeSpan,NativeH2,NativeP,NativeButton,NativeStrong,NativeLabel,NativeSmall,NativeInput,NativeH3,NativeArticle,NativeDetails,NativeSummary,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useRef, useState } from 'react';
import { ClientPortalAccessPanel } from "../clients/ClientPortalAccessPanel.native.tsx";
import { ClientPortalEmployeeVisibility } from "./ClientPortalEmployeeVisibility.native.tsx";
import { OfficePortalApprovalsInbox } from '@/components/office/OfficePortalApprovalsInbox';
import { PortalSyncChainPanel } from "./PortalSyncChainPanel.native.tsx";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchClientPortalSettingsResolved, listClientPortalAccessRequests, listVisiblePortalFeatures, reviewClientPortalAccessRequest, upsertClientPortalSettings } from '@/lib/client/clientPortalSettingsService';
import { listPortalSyncRowsForClient } from '@/lib/portal/portalSyncChainService';
import { syncClientDocumentPortalReleaseIfEnabled } from '@/lib/clients/clientDocumentsService';
import { useAuth } from '@/lib/auth/context';
import type { ClientFullDetail } from '@/types/modules/client';
import { portalExperienceCss } from "./portalExperienceCss.native.ts";
type Props = {
    clientId: string;
    fullClient?: ClientFullDetail | null;
    onRecordRefresh?: () => void;
};
type SettingsPatch = Partial<{
    portalEnabled: boolean;
    inheritTenantDefaults: boolean;
    showAppointments: boolean;
    showMessages: boolean;
    showDocuments: boolean;
    showProofs: boolean;
}>;
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
    return <NativeWorkspaceStyleScope key={`${tenantId}:${props.clientId}`} css={[portalExperienceCss]}>{<ClientPortalCoreContent key={`${tenantId}:${props.clientId}`} {...props} tenantId={tenantId}/>}</NativeWorkspaceStyleScope>;
}
function ClientPortalCoreContent({ clientId, fullClient, onRecordRefresh, tenantId }: Props & {
    tenantId: string | null;
}) {
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
        if (!tenantId || !clientId || !settings?.portalEnabled || !settings.showDocuments)
            return;
        let cancelled = false;
        void syncClientDocumentPortalReleaseIfEnabled(tenantId, clientId).then((result) => {
            if (!cancelled)
                setDocumentReleaseError(!result.ok);
        }).catch(() => { if (!cancelled)
            setDocumentReleaseError(true); });
        return () => { cancelled = true; };
    }, [tenantId, clientId, settings?.portalEnabled, settings?.showDocuments]);
    async function saveSettings(patch: SettingsPatch, label: string) {
        if (!tenantId || isReadOnly || mutationLock.current)
            return;
        mutationLock.current = true;
        setSaving(label);
        setMessage('');
        setError(null);
        try {
            const result = await upsertClientPortalSettings(tenantId, clientId, { inheritTenantDefaults: false, ...patch });
            if (!mounted.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            const [settingsLoaded, featuresLoaded] = await Promise.all([settingsQuery.refreshWithResult(), featuresQuery.refreshWithResult()]);
            if (!mounted.current)
                return;
            if (settingsLoaded && featuresLoaded)
                setMessage(`${label} gespeichert.`);
            else
                setError('Die Änderung wurde gespeichert. Der aktuelle Stand konnte noch nicht vollständig geladen werden. Bitte aktualisieren Sie die Ansicht.');
            onRecordRefresh?.();
        }
        catch {
            if (mounted.current)
                setError('Die Änderung konnte nicht bestätigt werden. Bitte laden Sie die Einstellungen erneut.');
        }
        finally {
            mutationLock.current = false;
            if (mounted.current)
                setSaving(null);
        }
    }
    async function reviewRequest(id: string, decision: 'approved' | 'rejected') {
        if (!tenantId || isReadOnly || mutationLock.current)
            return;
        mutationLock.current = true;
        setSaving('Zugangsanfrage');
        setMessage('');
        setError(null);
        try {
            const result = await reviewClientPortalAccessRequest(tenantId, clientId, id, decision, { reviewedBy: profile?.id ?? null });
            if (!mounted.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            const refreshed = await requestsQuery.refreshWithResult();
            if (!mounted.current)
                return;
            if (refreshed)
                setMessage(decision === 'approved' ? 'Die Zugangsanfrage wurde genehmigt.' : 'Die Zugangsanfrage wurde abgelehnt.');
            else
                setError('Die Entscheidung wurde gespeichert. Die Anfragenliste konnte noch nicht aktualisiert werden.');
            onRecordRefresh?.();
        }
        catch {
            if (mounted.current)
                setError('Die Entscheidung konnte nicht bestätigt werden. Bitte laden Sie die Anfragen erneut.');
        }
        finally {
            mutationLock.current = false;
            if (mounted.current)
                setSaving(null);
        }
    }
    const features = featuresQuery.data ?? [];
    const requests = requestsQuery.data ?? [];
    const pending = requests.filter((request) => request.status === 'pending').length;
    const settingsError = settingsQuery.error ?? settingsQuery.refreshError;
    const featureError = featuresQuery.error ?? featuresQuery.refreshError;
    const requestError = requestsQuery.error ?? requestsQuery.refreshError;
    const proofError = syncQuery.error ?? syncQuery.refreshError;
    if (!tenantId || !clientId)
        return <NativeWorkspaceStyleScope css={[portalExperienceCss, portalExperienceCss]}>{<NativeDiv className="cs-portal"><NativeStyle>{portalExperienceCss}</NativeStyle><NativeDiv className="cs-portal-status error" role="alert">Die Portalverwaltung benötigt eine zugeordnete Klientenakte und ein Unternehmen. Öffnen Sie die Akte erneut.</NativeDiv></NativeDiv>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[portalExperienceCss, portalExperienceCss]}>{<NativeDiv className="cs-portal">
    <NativeStyle>{portalExperienceCss}</NativeStyle>
    <NativeSection className="cs-portal-section" aria-label="Inhalte im Klientenportal">
      <NativeDiv className="cs-portal-heading"><NativeDiv><NativeSpan className="cs-portal-eyebrow">Einblick & Zusammenarbeit</NativeSpan><NativeH2>Was sieht die Person in ihrem Portal?</NativeH2><NativeP>Bestimmen Sie den Zugang und die freigegebenen Inhalte dieser Akte.</NativeP></NativeDiv>{settings ? <NativeSpan className={`cs-portal-pill${settings.portalEnabled ? ' active' : ''}`}>{settings.portalEnabled ? 'Portal freigegeben' : 'Portal ausgeschaltet'}</NativeSpan> : null}</NativeDiv>
      {saving ? <NativeDiv className="cs-portal-status" role="status">{saving} wird gespeichert…</NativeDiv> : null}
      {message ? <NativeDiv className="cs-portal-status success" role="status">{message}</NativeDiv> : null}
      {error ? <NativeDiv className="cs-portal-status error" role="alert">{error}<NativeButton type="button" className="cs-portal-button" disabled={!!saving} onClick={() => { setError(null); void Promise.all([settingsQuery.refresh(), featuresQuery.refresh(), requestsQuery.refresh()]); }}>Ansicht aktualisieren</NativeButton></NativeDiv> : null}
      {settingsQuery.loading && !settings ? <NativeDiv className="cs-portal-status" role="status">Einstellungen werden geladen…</NativeDiv> : null}
      {settingsError ? <NativeDiv className="cs-portal-status error" role="alert">Einstellungen konnten nicht aktualisiert werden. {settingsError}<NativeButton type="button" className="cs-portal-button" disabled={!!saving || settingsQuery.refreshing} onClick={() => void settingsQuery.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
      {settings ? <>
        <NativeDiv className="cs-portal-summary"><NativeDiv><NativeSpan>Einstellungen</NativeSpan><NativeStrong>{settings.inheritTenantDefaults ? 'Vom Unternehmen übernommen' : 'Für diese Person angepasst'}</NativeStrong></NativeDiv><NativeDiv><NativeSpan>Inhaltsfreigaben</NativeSpan><NativeStrong>{FEATURE_TOGGLES.filter(({ key }) => settings[key]).length} von 4 ausgewählt</NativeStrong></NativeDiv><NativeDiv><NativeSpan>Zugangsanfragen</NativeSpan><NativeStrong>{requestError ? 'Nicht verfügbar' : requestsQuery.loading ? 'Wird geladen…' : `${pending} offen`}</NativeStrong></NativeDiv></NativeDiv>
        <NativeLabel className="cs-portal-toggle cs-portal-toggle-wide"><NativeSpan><NativeStrong>Portalzugang freigeben</NativeStrong><NativeSmall>{settings.portalEnabled ? 'Die ausgewählten Inhalte dürfen im persönlichen Portal erscheinen.' : 'Die Inhalte sind derzeit nicht über das Klientenportal zugänglich.'}</NativeSmall></NativeSpan><NativeInput type="checkbox" role="switch" aria-label="Portalzugang freigeben" checked={settings.portalEnabled} disabled={isReadOnly || !!saving || !!settingsError || settingsQuery.refreshing} onChange={(event) => void saveSettings({ portalEnabled: event.target.checked }, 'Portalzugang')}/></NativeLabel>
        <NativeDiv className="cs-portal-toggle-grid">{FEATURE_TOGGLES.map(({ key, label, description }) => <NativeLabel key={key} className="cs-portal-toggle"><NativeSpan><NativeStrong>{label}</NativeStrong><NativeSmall>{description}</NativeSmall><NativeSmall>{!settings.portalEnabled ? 'Portal ausgeschaltet' : settings[key] ? 'Freigegeben' : 'Ausgeblendet'}</NativeSmall></NativeSpan><NativeInput type="checkbox" role="switch" aria-label={label} checked={settings[key]} disabled={isReadOnly || !settings.portalEnabled || !!saving || !!settingsError || settingsQuery.refreshing} onChange={(event) => void saveSettings({ [key]: event.target.checked }, label)}/></NativeLabel>)}</NativeDiv>
        <NativeP className="cs-portal-help">Änderungen gelten für diese Person und werden sofort gespeichert. Dokumente und Nachweise erscheinen erst, wenn die jeweiligen Unterlagen zur Ansicht freigegeben sind.</NativeP>
        {isReadOnly ? <NativeP className="cs-portal-help">Ihr Zugang kann diese Einstellungen ansehen, aber nicht verändern.</NativeP> : null}
        {featureError ? <NativeDiv className="cs-portal-status error" role="alert">Die tatsächlich sichtbaren Inhalte konnten nicht bestätigt werden.<NativeButton className="cs-portal-button" type="button" disabled={!!saving || featuresQuery.refreshing} onClick={() => void featuresQuery.refresh()}>Erneut prüfen</NativeButton></NativeDiv> : featuresQuery.loading ? <NativeP className="cs-portal-help" role="status">Sichtbare Inhalte werden geprüft…</NativeP> : <NativeP className="cs-portal-help">Aktuell freigegeben: {features.length ? features.map((feature) => FEATURE_LABELS[feature] ?? 'Weiterer freigegebener Inhalt').join(', ') : 'Keine Inhalte'}.</NativeP>}
      </> : !settingsQuery.loading && !settingsError ? <NativeDiv className="cs-portal-empty"><NativeStrong>Noch keine Einstellungen verfügbar</NativeStrong><NativeP>Laden Sie die Akte erneut, um die Einstellungen des Unternehmens zu übernehmen.</NativeP><NativeButton type="button" className="cs-portal-button" onClick={() => void settingsQuery.refresh()}>Einstellungen laden</NativeButton></NativeDiv> : null}
      {documentReleaseError ? <NativeDiv className="cs-portal-status error" role="alert">Die Bereitstellung der Dokumente konnte nicht bestätigt werden. Prüfen Sie den Freigabestatus unter „Dokumente & Nachweise“.</NativeDiv> : null}
    </NativeSection>
    {fullClient?.id === clientId && tenantId ? <ClientPortalAccessPanel client={fullClient} tenantId={tenantId} isReadOnly={isReadOnly} onRefresh={onRecordRefresh}/> : <NativeDiv className="cs-portal-section"><NativeH3>Zugangsdaten noch nicht verfügbar</NativeH3><NativeP>Sobald die vollständige Akte geladen ist, können Sie hier den persönlichen Zugang verwalten.</NativeP></NativeDiv>}
    <NativeSection className="cs-portal-section" aria-label="Zugangsanfragen">
      <NativeDiv className="cs-portal-heading"><NativeDiv><NativeH2>Zugangsanfragen</NativeH2><NativeP>Prüfen Sie, wer einen persönlichen Zugang oder einen Angehörigenzugang angefragt hat.</NativeP></NativeDiv>{!requestsQuery.loading && !requestError ? <NativeSpan className="cs-portal-pill">{pending} offen</NativeSpan> : null}</NativeDiv>
      {requestsQuery.loading ? <NativeP role="status">Anfragen werden geladen…</NativeP> : null}
      {requestError ? <NativeDiv className="cs-portal-status error" role="alert">Anfragen konnten nicht aktualisiert werden.<NativeButton className="cs-portal-button" type="button" disabled={!!saving || requestsQuery.refreshing} onClick={() => void requestsQuery.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
      {!requestsQuery.loading && !requestError && !requests.length ? <NativeDiv className="cs-portal-empty"><NativeStrong>Keine Zugangsanfragen</NativeStrong><NativeP>Neue Anfragen erscheinen hier zur Prüfung.</NativeP></NativeDiv> : null}
      {requests.map((request) => <NativeArticle className="cs-portal-request" key={request.id}><NativeDiv className="cs-portal-row"><NativeDiv><NativeH3>{request.requesterName}</NativeH3><NativeP>{REQUEST_TYPES[request.requestType] ?? 'Zugangsanfrage'}{request.requesterEmail ? ` · ${request.requesterEmail}` : ''}</NativeP></NativeDiv><NativeSpan className={`cs-portal-pill${request.status === 'pending' ? ' warning' : ''}`}>{REQUEST_STATUSES[request.status] ?? 'Status nicht verfügbar'}</NativeSpan></NativeDiv>{request.status === 'pending' && !isReadOnly ? <NativeDiv className="cs-portal-actions"><NativeButton type="button" className="cs-portal-button primary" disabled={!!saving || !!requestError || requestsQuery.refreshing} onClick={() => void reviewRequest(request.id, 'approved')}>Zugang genehmigen</NativeButton><NativeButton type="button" className="cs-portal-button" disabled={!!saving || !!requestError || requestsQuery.refreshing} onClick={() => void reviewRequest(request.id, 'rejected')}>Anfrage ablehnen</NativeButton></NativeDiv> : null}</NativeArticle>)}
    </NativeSection>
    <NativeDetails className="cs-portal-disclosure"><NativeSummary>Nachweise, Unterschriften und Freigaben</NativeSummary><NativeDiv>{syncQuery.loading ? <NativeP role="status">Nachweise werden geladen…</NativeP> : null}{proofError ? <NativeDiv className="cs-portal-status error" role="alert">Der Freigabestatus konnte nicht geladen werden.<NativeButton className="cs-portal-button" type="button" disabled={syncQuery.refreshing} onClick={() => void syncQuery.refresh()}>Erneut laden</NativeButton></NativeDiv> : !syncQuery.loading ? <PortalSyncChainPanel rows={syncQuery.data ?? []}/> : null}<OfficePortalApprovalsInbox clientId={clientId}/></NativeDiv></NativeDetails>
    <NativeDetails className="cs-portal-disclosure"><NativeSummary>Welche Angaben sehen Mitarbeitende?</NativeSummary><NativeDiv><ClientPortalEmployeeVisibility /></NativeDiv></NativeDetails>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
