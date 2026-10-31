// Generated native presentation from src/components/platformConsole/PlatformOperationsPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeButton,NativeP,NativeNav,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeSmall,NativeLabel,NativeSelect,NativeOption,NativeSpan,NativeB,NativeDl,NativeDt,NativeDd,NativeDetails,NativeSummary,NativeForm,NativeTextarea} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ConsoleBadge, ConsoleDialog, ConsolePanel, ConsoleStats } from "./ConsoleWorkspaceUi.native.tsx";
import { consoleDate, consoleLabel } from "../../lib/platformConsole/consoleWorkspaceModel.native.ts";
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { platformRoleHasCapability } from "../../lib/platformConsole/platformCapabilities.native.ts";
import { getPlatformOperationsPage, setIncidentResolution, OBSERVATION_AREAS, OBSERVATION_ISSUES, OBSERVATION_OPERATIONS, REGISTRATION_STAGES, REGISTRATION_STATES, PLATFORM_OPERATIONS_RELEASE, type OperationsSummary, type RegistrationActivity, type RuntimeIncident } from "../../lib/platformConsole/platformOperationsService.native.ts";
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
type Tab = 'inventory' | 'live' | 'registrations' | 'errors';
const tabNames: Record<Tab, string> = { inventory: 'Bestände', live: 'Live-Nutzung', registrations: 'Registrierungen', errors: 'Fehler' };
const number = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('de-DE').format(value);
const issue = (value: string | null) => value ? OBSERVATION_ISSUES[value] ?? 'Ergebnis muss geprüft werden' : 'Keine Störung gemeldet';
export function PlatformOperationsPanel({ full = false }: {
    full?: boolean;
}) {
    const router = useRouter();
    const { platformUser } = usePlatformAuth();
    const role = platformUser?.role;
    const canRead = platformRoleHasCapability(role, 'tenants.read');
    const canMonitor = platformRoleHasCapability(role, 'system.read');
    const canResolve = platformRoleHasCapability(role, 'system.write');
    const [summary, setSummary] = useState<OperationsSummary | null>(null);
    const [tab, setTab] = useState<Tab>('inventory');
    const [registrationState, setRegistrationState] = useState('');
    const [incidentStatus, setIncidentStatus] = useState('open');
    const [offset, setOffset] = useState(0);
    const [registrations, setRegistrations] = useState<RegistrationActivity[]>([]);
    const [incidents, setIncidents] = useState<RuntimeIncident[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState<RegistrationActivity | null>(null);
    const [selectedIncident, setSelectedIncident] = useState<RuntimeIncident | null>(null);
    const [revision, setRevision] = useState(0);
    const refresh = useCallback(() => setRevision(n => n + 1), []);
    useEffect(() => {
        if (!canRead)
            return;
        let alive = true;
        let loading = false;
        async function poll() {
            if (loading || document.visibilityState === 'hidden')
                return;
            loading = true;
            setBusy(true);
            try {
                const results = await getPlatformOperationsPage({ full, canMonitor, tab, registrationState, incidentStatus, offset });
                if (!alive)
                    return;
                setSummary(results.summary);
                setError('');
                setRegistrations(results.registrations?.items.slice(0, 50) ?? []);
                setIncidents(results.incidents?.items.slice(0, 50) ?? []);
                setHasMore((results.registrations?.items.length ?? results.incidents?.items.length ?? 0) > 50);
            }
            catch (cause) {
                if (alive)
                    setError(cause instanceof Error ? cause.message : 'Die Betriebsübersicht konnte nicht aktualisiert werden.');
            }
            finally {
                loading = false;
                if (alive)
                    setBusy(false);
            }
        }
        void poll();
        const timer = setInterval(() => void poll(), 15000);
        const visibility = () => { if (document.visibilityState === 'visible')
            void poll(); };
        document.addEventListener('visibilitychange', visibility);
        return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
    }, [canRead, canMonitor, full, role, tab, registrationState, incidentStatus, offset, revision]);
    if (!canRead)
        return null;
    const t = summary?.telemetry;
    const activated = Boolean(t);
    const measured = Boolean(t?.firstEventAt);
    const live = (value: number | undefined) => measured ? number(value) : '—';
    const selectTab = (next: Tab) => { setTab(next); setOffset(0); setHasMore(false); setRegistrations([]); setIncidents([]); };
    const openCompany = (id: string) => router.push(`/platform/tenants/${encodeURIComponent(id)}` as never);
    return <ConsolePanel title={full ? 'Betrieb & Nutzung' : 'Die gesamte Plattform'} description={summary ? `Serverstand: ${consoleDate(summary.checkedAt)} · Aktualisierung alle 15 Sekunden` : 'Zentrale Betriebsdaten werden geladen'} actions={<NativeDiv className="cs-actions"><NativeButton className="cs-btn" disabled={busy} onClick={refresh}>↻ Aktualisieren</NativeButton>{!full && canMonitor && <NativeButton className="cs-btn" onClick={() => router.push('/platform/system' as never)}>Betriebszentrale öffnen</NativeButton>}</NativeDiv>}>
    <NativeDiv className="cs-panel-body" data-platform-operations={PLATFORM_OPERATIONS_RELEASE}>
      {error && <NativeDiv className="cs-notice error" role="alert">{error}{summary && <NativeP>Die angezeigten Zahlen stammen vom {consoleDate(summary.checkedAt)}.</NativeP>}<NativeButton className="cs-link" disabled={busy} onClick={refresh}>Erneut versuchen</NativeButton></NativeDiv>}
      {!summary && <NativeP role="status">{busy ? 'Bestände und Betriebsdaten werden abgefragt.' : 'Noch keine bestätigten Betriebsdaten verfügbar.'}</NativeP>}
      {full && <NativeNav className="cs-tabs" aria-label="Betriebsbereiche">{(Object.keys(tabNames) as Tab[]).filter(key => key === 'inventory' || canMonitor).map(key => <NativeButton className="cs-tab" key={key} aria-pressed={tab === key} onClick={() => selectTab(key)}>{tabNames[key]}</NativeButton>)}</NativeNav>}
      {summary && (!full || tab === 'inventory') && <>
        <ConsoleStats items={[
                { label: 'Klienten im Bestand', value: number(summary.inventory.clients), hint: 'Systemweit, ohne gelöschte Klienten' },
                { label: 'Mitarbeitende im Bestand', value: number(summary.inventory.employees), hint: 'Systemweit, ohne gelöschte Mitarbeitende' },
                ...(full ? [{ label: 'Unternehmen gesamt', value: number(summary.inventory.companies), hint: 'Einschließlich gelöschter Unternehmensakten' },
                    { label: 'Aktive Unternehmen', value: number(summary.inventory.activeCompanies) }, { label: 'Gesperrt oder blockiert', value: number(summary.inventory.suspendedCompanies) },
                    { label: 'Deaktivierte Unternehmen', value: number(summary.inventory.deactivatedCompanies) }, { label: 'Gelöschte Unternehmen', value: number(summary.inventory.deletedCompanies) },
                    { label: 'Klientendatensätze gesamt', value: number(summary.inventory.clients + summary.inventory.deletedClients), hint: 'Einschließlich gelöschter Datensätze' },
                    { label: 'Mitarbeitendendatensätze gesamt', value: number(summary.inventory.employees + summary.inventory.deletedEmployees), hint: 'Einschließlich gelöschter Datensätze' },
                    { label: 'Gelöschte Klienten', value: number(summary.inventory.deletedClients) }, { label: 'Gelöschte Mitarbeitende', value: number(summary.inventory.deletedEmployees) }] : []),
            ]}/>
        <NativeP>Der Bestand enthält erhaltene Datensätze aller Unternehmen. Test- und Produktivdaten stehen getrennt in der folgenden Übersicht. Bereits endgültig entfernte Datensätze lassen sich daraus nicht rekonstruieren.</NativeP>
        <NativeDiv className="cs-table-scroll"><NativeTable className="cs-table"><NativeThead><NativeTr><NativeTh scope="col">Datenumgebung</NativeTh><NativeTh scope="col">Unternehmen</NativeTh><NativeTh scope="col">Klienten</NativeTh><NativeTh scope="col">Mitarbeitende</NativeTh></NativeTr></NativeThead><NativeTbody>{summary.inventory.environments.map(row => <NativeTr key={row.mode}><NativeTd>{consoleLabel(row.mode)}</NativeTd><NativeTd>{number(row.companies)}</NativeTd><NativeTd>{number(row.clients)}</NativeTd><NativeTd>{number(row.employees)}</NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv>
      </>}
      {summary && canMonitor && (!full || tab === 'live') && <>
        <ConsoleStats items={[
                { label: 'Website: aktive Ansichten', value: live(t?.websiteViews), hint: 'Einschließlich Firmenregistrierung' },
                { label: 'Software: aktive Konten', value: live(t?.softwareAccounts), hint: 'Bestätigte Anmeldungen, jedes Konto einmal' },
                { label: 'Unternehmen gerade aktiv', value: live(t?.softwareCompanies) },
                { label: 'Registrierungen gerade aktiv', value: live(t?.registrationsLive) },
                ...(full ? [{ label: 'Plattformkonten gerade aktiv', value: live(t?.platformAccounts) }] : []),
            ]}/>
        {!activated && <NativeP className="cs-notice" role="status">Erfassung noch nicht aktiviert. Es liegen keine gemessenen Live-Zahlen vor.</NativeP>}
        {activated && !measured && <NativeP className="cs-notice" role="status">Es wurden noch keine Betriebsmeldungen empfangen. Live-Werte werden erst nach Beginn der Erfassung angezeigt.</NativeP>}
        <NativeP>„Live“ bedeutet: eine sichtbare Seite hat innerhalb der letzten 90 Sekunden eine Meldung gesendet. Offene Websiteansichten können mehrere Fenster derselben Person enthalten. Softwarekonten werden anhand der bestätigten Anmeldung zusammengefasst.</NativeP>
        <NativeP>Erfasst werden Web und Desktop auf caresuiteplus.app. Die unveränderte Android-App, blockierte Meldungen und Browser mit ausgeschalteter Erfassung sind nicht enthalten. Die Werte beginnen mit der Bereitstellung dieser Erfassung; frühere Besuche und Abbrüche werden nicht nachträglich erfunden.</NativeP>
        {t?.lastEventAt && <NativeSmall>Letzte empfangene Meldung: {consoleDate(t.lastEventAt)}</NativeSmall>}
      </>}
      {summary && full && tab === 'inventory' && <ConsoleStats items={[
                { label: 'Offene Supporttickets', value: number(summary.operations.openSupportTickets) },
                { label: 'Genehmigte Datenzugriffe', value: number(summary.operations.approvedSupportAccess) },
                { label: 'Willkommensmail ausstehend', value: number(summary.operations.welcomePending) },
                { label: 'Mailversand zu prüfen', value: number(summary.operations.welcomeNeedsReview) },
                { label: 'Kontovorgänge zu prüfen', value: number(summary.operations.accountOperationsNeedReview) },
            ]}/>}
      {summary && full && canMonitor && !activated && ['registrations', 'errors'].includes(tab) && <NativeP className="cs-notice" role="status">Erfassung noch nicht aktiviert. Die Bestandsübersicht funktioniert bereits; Registrierungsverläufe und automatische Fehlermeldungen benötigen die gesonderte Freigabe ihrer Erfassung.</NativeP>}
      {summary && full && canMonitor && activated && tab === 'registrations' && <>
        <ConsoleStats items={[{ label: 'Begonnen, letzte 24 Stunden', value: measured ? number(t?.registrationsToday) : '—' },
                { label: 'Abgeschlossen, letzte 24 Stunden', value: measured ? number(t?.registrationsCompletedToday) : '—' },
                { label: 'Aktuell mit Hinweis', value: measured ? number(t?.registrationsWithIssue) : '—' }]}/>
        <NativeP>Vor der abgeschlossenen Kontoanlage zeigt der Verlauf keine Namen aus dem Registrierungsformular. Erfasst werden nur Schritte und Ergebnisse. Ein verlassener oder inaktiver Versuch zeigt einen möglichen Abbruch; sein persönlicher Grund ist dadurch nicht bekannt.</NativeP>
        <NativeLabel className="cs-field">Registrierungsstand<NativeSelect value={registrationState} onChange={e => { setRegistrationState(e.target.value); setOffset(0); setRegistrations([]); }}><NativeOption value="">Alle Versuche</NativeOption>{['active', 'recent', 'completed', 'failed', 'left', 'inactive', 'uncertain'].map(key => <NativeOption key={key} value={key}>{REGISTRATION_STATES[key]}</NativeOption>)}</NativeSelect></NativeLabel>
        <NativeDiv className="cs-table-scroll"><NativeTable className="cs-table"><NativeThead><NativeTr><NativeTh scope="col">Unternehmen / Versuch</NativeTh><NativeTh scope="col">Stand</NativeTh><NativeTh scope="col">Letzter Schritt</NativeTh><NativeTh scope="col">Letzte Meldung</NativeTh><NativeTh scope="col">Hinweis</NativeTh></NativeTr></NativeThead><NativeTbody>{registrations.map(row => <NativeTr key={row.id}><NativeTd><NativeButton className="cs-link" onClick={() => setSelectedRegistration(row)}>{row.company_name ?? `Versuch ${row.id.slice(0, 8)}`}</NativeButton>{row.owner_name && <NativeSmall>{row.owner_name}</NativeSmall>}</NativeTd><NativeTd><ConsoleBadge value={row.state === 'completed' ? 'active' : row.state === 'failed' ? 'failed' : 'pending'} label={REGISTRATION_STATES[row.state] ?? 'Zu prüfen'}/></NativeTd><NativeTd>{REGISTRATION_STAGES[row.stage] ?? 'Noch nicht erfasst'}</NativeTd><NativeTd>{consoleDate(row.last_seen_at)}</NativeTd><NativeTd>{issue(row.issue)}</NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv>
        {!busy && !error && !registrations.length && <NativeP>Keine Registrierungsversuche für diese Auswahl erfasst.</NativeP>}
        <NativeP><NativeSmall>Verlauf der letzten 14 Tage. Jede Seite enthält bis zu 50 Versuche.</NativeSmall></NativeP>
      </>}
      {summary && full && canMonitor && activated && tab === 'errors' && <>
        <ConsoleStats items={[{ label: 'Offene Fehlergruppen', value: measured ? number(t?.openIncidents) : '—' },
                { label: 'Letzte Fehlermeldung', value: consoleDate(t?.latestIncidentAt) }]}/>
        <NativeP>Automatisch erfasste Verbindungs-, Server- und Seitenfehler sowie abgewiesene Anfragen. Eine verweigerte Berechtigung kann gewollt sein. Die Übersicht enthält keine Formulareingaben, Passwörter oder persönlichen Falldetails; solche Details bleiben an die Supportfreigabe gebunden.</NativeP>
        <NativeLabel className="cs-field">Bearbeitungsstand<NativeSelect value={incidentStatus} onChange={e => { setIncidentStatus(e.target.value); setOffset(0); setIncidents([]); }}><NativeOption value="open">Offen</NativeOption><NativeOption value="resolved">Erledigt</NativeOption><NativeOption value="">Alle Meldungen</NativeOption></NativeSelect></NativeLabel>
        <NativeDiv className="cs-table-scroll"><NativeTable className="cs-table"><NativeThead><NativeTr><NativeTh scope="col">Fehler / Hinweis</NativeTh><NativeTh scope="col">Bereich</NativeTh><NativeTh scope="col">Unternehmen</NativeTh><NativeTh scope="col">Meldungen</NativeTh><NativeTh scope="col">Zuletzt</NativeTh><NativeTh scope="col">Stand</NativeTh></NativeTr></NativeThead><NativeTbody>{incidents.map(row => <NativeTr key={row.id}><NativeTd><NativeButton className="cs-link" onClick={() => setSelectedIncident(row)}>{issue(row.category)}</NativeButton><NativeSmall>{OBSERVATION_OPERATIONS[row.operation] ?? 'Betriebsvorgang'}</NativeSmall></NativeTd><NativeTd>{OBSERVATION_AREAS[row.area] ?? 'Weiterer Bereich'}</NativeTd><NativeTd>{row.company_name ?? 'Ohne Unternehmenszuordnung'}</NativeTd><NativeTd>{number(row.occurrences)}</NativeTd><NativeTd>{consoleDate(row.last_seen_at)}</NativeTd><NativeTd>{row.resolved ? 'Erledigt' : 'Offen'}</NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv>
        {!busy && !error && !incidents.length && <NativeP>Keine erfassten Meldungen für diese Auswahl. Das belegt keine Fehlerfreiheit der gesamten Software.</NativeP>}
        <NativeP><NativeSmall>Erfasste Meldungen der letzten 30 Tage. Wiederkehrende Meldungen werden zusammengefasst; erneutes Auftreten öffnet einen erledigten Fehler wieder.</NativeSmall></NativeP>
      </>}
      {full && activated && ['registrations', 'errors'].includes(tab) && <NativeDiv className="cs-pager"><NativeSpan>Datenseite {Math.floor(offset / 50) + 1}</NativeSpan><NativeDiv className="cs-actions"><NativeButton className="cs-btn" disabled={busy || offset === 0} onClick={() => setOffset(n => Math.max(0, n - 50))}>Zurück</NativeButton><NativeButton className="cs-btn" disabled={busy || !hasMore} onClick={() => setOffset(n => n + 50)}>Weiter</NativeButton></NativeDiv></NativeDiv>}
      {selectedRegistration && <ConsoleDialog title="Registrierungsverlauf" description={selectedRegistration.company_name ?? 'Noch keinem Unternehmen zugeordneter Versuch'} onClose={() => setSelectedRegistration(null)}>
        <NativeP>Begonnen: {consoleDate(selectedRegistration.started_at)} · Letzter Stand: {REGISTRATION_STATES[selectedRegistration.state] ?? 'Zu prüfen'}</NativeP>
        <NativeP>Weitester Schritt: {REGISTRATION_STAGES[selectedRegistration.furthest_stage]} · {issue(selectedRegistration.issue)}</NativeP>
        {selectedRegistration.events.map((event, i) => <NativeDiv className="cs-task" key={i}><NativeDiv><NativeB>{REGISTRATION_STAGES[event.stage]} · {REGISTRATION_STATES[event.state] ?? 'Zu prüfen'}</NativeB><NativeP>{consoleDate(event.created_at)}{event.issue ? ` · ${issue(event.issue)}` : ''}</NativeP></NativeDiv></NativeDiv>)}
        {selectedRegistration.tenant_id && <NativeButton className="cs-btn" onClick={() => openCompany(selectedRegistration.tenant_id!)}>Unternehmensakte öffnen</NativeButton>}
      </ConsoleDialog>}
      {selectedIncident && <IncidentEditor row={selectedIncident} canResolve={canResolve} onClose={() => setSelectedIncident(null)} onSaved={() => { setSelectedIncident(null); refresh(); }}/>}
    </NativeDiv>
  </ConsolePanel>;
}
function IncidentEditor({ row, canResolve, onClose, onSaved }: {
    row: RuntimeIncident;
    canResolve: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const confirmLeave = useUnsavedWebChanges(Boolean(reason.trim()), busy);
    const close = async () => { if (await confirmLeave())
        onClose(); };
    async function save() {
        if (lock.current)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            await setIncidentResolution(row, !row.resolved, reason);
            onSaved();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Der Bearbeitungsstand konnte nicht bestätigt werden.');
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return <ConsoleDialog title={issue(row.category)} description={OBSERVATION_AREAS[row.area] ?? 'Softwarebetrieb'} busy={busy} onClose={() => void close()}>
    <NativeDl className="cs-kv"><NativeDt>Vorgang</NativeDt><NativeDd>{OBSERVATION_OPERATIONS[row.operation]}</NativeDd><NativeDt>Unternehmen</NativeDt><NativeDd>{row.company_name ?? 'Ohne Unternehmenszuordnung'}</NativeDd>
      <NativeDt>Erstmals</NativeDt><NativeDd>{consoleDate(row.first_seen_at)}</NativeDd><NativeDt>Zuletzt</NativeDt><NativeDd>{consoleDate(row.last_seen_at)}</NativeDd><NativeDt>Meldungen</NativeDt><NativeDd>{number(row.occurrences)}</NativeDd>
      <NativeDt>Stand</NativeDt><NativeDd>{row.resolved ? 'Erledigt' : 'Offen'}</NativeDd><NativeDt>Letzte Bearbeitung</NativeDt><NativeDd>{row.resolution ?? 'Noch keine Bearbeitung dokumentiert'}</NativeDd></NativeDl>
    <NativeDetails><NativeSummary>Technische Referenz anzeigen</NativeSummary><NativeP>Fehlerreferenz: {row.id} · Serverantwort: {row.http_status ?? 'Keine Antwort erfasst'}</NativeP></NativeDetails>
    {canResolve && <NativeForm onSubmit={e => { e.preventDefault(); void save(); }}><NativeLabel className="cs-field">Begründung *<NativeTextarea required minLength={5} maxLength={1000} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ursache, Bearbeitung und Ergebnis dokumentieren"/></NativeLabel><NativeButton className="cs-btn primary" disabled={busy || reason.trim().length < 5}>{busy ? 'Wird gespeichert…' : row.resolved ? 'Wieder öffnen' : 'Als erledigt markieren'}</NativeButton></NativeForm>}
    {error && <NativeP className="cs-notice error" role="alert">{error}</NativeP>}
  </ConsoleDialog>;
}
