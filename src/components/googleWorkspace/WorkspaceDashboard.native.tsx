// Generated native presentation from src/components/googleWorkspace/WorkspaceDashboard.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStyle,NativeStrong,NativeP,NativeButton,NativeSection,NativeSpan,NativeH2,NativeA,NativeH3,NativeNav,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useState } from 'react';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import { useGoogleWorkspace, useWorkspacePage } from "../../hooks/useGoogleWorkspace.native.ts";
import { googleTime, serviceDefinition, WORKSPACE_SERVICES, workspaceTab, type WorkspaceTab, type WorkspaceService } from '@/lib/googleWorkspace/workspaceModel';
import type { GoogleWorkspaceConnection } from '@/lib/googleWorkspace/googleWorkspaceService';
import { WorkspaceServicePanel } from "./WorkspaceServicePanel.native.tsx";
import { workspaceCss } from "./workspaceCss.native.ts";
export function WorkspaceDashboard({ initialTab, callbackResult, fontScale = 1 }: {
    initialTab?: string;
    callbackResult?: string;
    fontScale?: number;
}) {
    const state = useGoogleWorkspace();
    const refreshStatus = state.refresh;
    useEffect(() => { if (callbackResult)
        void refreshStatus(); }, [callbackResult, refreshStatus]);
    const [tab, setTab] = useState<WorkspaceTab>(workspaceTab(initialTab));
    const [disconnectPrompt, setDisconnectPrompt] = useState(false);
    useEffect(() => { setTab(workspaceTab(initialTab)); }, [initialTab]);
    const connection = state.connection;
    const connected = connection?.status === 'connected';
    const count = Object.values(connection?.capabilities ?? {}).filter(Boolean).length;
    return <NativeWorkspaceStyleScope css={[workspaceCss, workspaceCss]}>{<NativeDiv className="cs-workspace cs-w-stack" style={{ fontSize: 16 * fontScale }}><NativeStyle>{workspaceCss}</NativeStyle>
    {callbackResult === 'error' && <NativeDiv role="alert" className="cs-w-notice error"><NativeStrong>Google-Freigabe nicht abgeschlossen</NativeStrong><NativeP>Die Anmeldung wurde abgebrochen oder konnte nicht gespeichert werden. Starten Sie die Kontoverbindung erneut und erteilen Sie die benötigten Freigaben.</NativeP></NativeDiv>}
    {callbackResult === 'connected' && connected && <NativeDiv role="status" className="cs-w-notice success">{`Google-Konto erfolgreich verbunden. ${count} Dienste sind freigegeben.`}</NativeDiv>}
    {state.error && <NativeDiv className="cs-w-notice error" role="alert">{state.error} <NativeButton className="cs-w-button small" onClick={() => void state.refresh()}>Erneut laden</NativeButton></NativeDiv>}
    <NativeSection className="cs-w-hero">
      <NativeDiv className="cs-w-stack"><NativeDiv><NativeSpan className="cs-w-eyebrow">CareSuite · Zusammenarbeit</NativeSpan><NativeH2 className="cs-w-title">Ihr Google-Arbeitsplatz</NativeH2><NativeP>E-Mails, Termine, Dateien und Aufgaben an einem Ort.</NativeP></NativeDiv><NativeDiv className="cs-w-row"><NativeSpan className={`cs-w-pill ${connected ? 'good' : state.error ? 'bad' : 'warn'}`}>{state.loading ? 'Status wird geladen …' : state.error ? 'Status nicht bestätigt' : connected ? '● Verbunden' : '○ Nicht verbunden'}</NativeSpan>{connected && <NativeSpan className="cs-w-pill">{`${count} von 10 Diensten freigegeben`}</NativeSpan>}</NativeDiv>{connected && <NativeStrong className="cs-w-account">{connection?.email || 'Google-Konto'}{connection?.domain && <NativeSpan className="cs-w-muted"> · {connection.domain}</NativeSpan>}</NativeStrong>}</NativeDiv>
      <NativeDiv className="cs-w-hero-actions">{connected ? <><NativeButton className="cs-w-button primary" disabled={state.actionLoading} onClick={() => void state.connect()}>Freigaben verwalten / Konto wechseln</NativeButton><NativeButton className="cs-w-button" disabled={state.loading} onClick={() => void state.refresh()}>Status aktualisieren</NativeButton><NativeButton className="cs-w-button danger" disabled={state.actionLoading} onClick={() => setDisconnectPrompt(true)}>Verbindung trennen</NativeButton></> : <NativeButton className="cs-w-button primary" disabled={state.loading || state.actionLoading} onClick={() => void state.connect()}>{state.actionLoading ? 'Google wird geöffnet …' : 'Google-Konto verbinden'}</NativeButton>}</NativeDiv>
    </NativeSection>
    <NativeP className="cs-w-muted" style={{ fontSize: '0.9em', lineHeight: 1.65 }}>Die Verbindung ist freiwillig. Google-Daten werden für die freigegebenen Workspace-Funktionen verarbeitet. <NativeA href="https://www.caresuiteplus.app/datenschutz#google-workspace" target="_blank" rel="noopener noreferrer" style={{ color: '#0869d4' }}>Datenschutz zur Google-Verbindung</NativeA> · <NativeA href="https://www.caresuiteplus.app/nutzungsbedingungen#abschnitt-6" target="_blank" rel="noopener noreferrer" style={{ color: '#0869d4' }}>Nutzungsbedingungen</NativeA></NativeP>
    {disconnectPrompt && <NativeDiv className="cs-w-notice cs-w-stack" role="alert"><NativeStrong>Verbindung für diesen Betrieb trennen?</NativeStrong><NativeP>CareSuite kann danach nicht mehr auf dieses Google-Konto zugreifen. Dateien und Nachrichten bleiben bei Google erhalten.</NativeP><NativeDiv className="cs-w-row"><NativeButton className="cs-w-button danger" disabled={state.actionLoading} onClick={async () => { await state.disconnect(); setDisconnectPrompt(false); }}>Jetzt trennen</NativeButton><NativeButton className="cs-w-button" disabled={state.actionLoading} onClick={() => setDisconnectPrompt(false)}>Abbrechen</NativeButton></NativeDiv></NativeDiv>}
    {!connected && !state.loading && !state.error && <NativeDiv className="cs-w-card cs-w-stack"><NativeH3>Einmal verbinden, direkt arbeiten</NativeH3><NativeP>Wählen Sie Ihr betriebliches Google-Konto aus und geben Sie die gewünschten Dienste frei. Die Google-Adresse darf von Ihrer CareSuite-Anmeldung abweichen.</NativeP><NativeP className="cs-w-muted">Das verbundene Konto wird von der Geschäftsführung und Verwaltung dieses Betriebs genutzt. Ohne Freigabe werden keine Google-Inhalte geladen.</NativeP></NativeDiv>}
    <NativeNav className="cs-w-nav" aria-label="Google-Dienste"><NativeButton className="cs-w-tab" aria-pressed={tab === 'overview'} onClick={() => setTab('overview')}>Übersicht</NativeButton>{WORKSPACE_SERVICES.map(s => <NativeButton className="cs-w-tab" key={s.key} aria-pressed={tab === s.key} onClick={() => setTab(s.key)}>{s.title.replace('Google ', '')}</NativeButton>)}<NativeButton className="cs-w-tab" aria-pressed={tab === 'activity'} onClick={() => setTab('activity')}>Aktivitäten</NativeButton></NativeNav>
    {tab === 'overview' ? <>
      {connected && connection && <NativeDiv className="cs-w-metrics">{(['gmail', 'calendar', 'drive', 'tasks'] as const).map(service => <OverviewCard key={`${state.scope}:${connection.connectedAt}:${service}`} service={service} connection={connection} onOpen={() => setTab(service)}/>)}</NativeDiv>}
      <NativeDiv className="cs-w-row cs-w-between"><NativeH2>Ihre Dienste</NativeH2><NativeSpan className="cs-w-muted">Für jeden Dienst ist eine Google-Freigabe erforderlich.</NativeSpan></NativeDiv>
      <NativeDiv className="cs-w-service-grid">{WORKSPACE_SERVICES.map(s => <NativeButton className="cs-w-service-card" key={s.key} onClick={() => setTab(s.key)}><NativeDiv className="cs-w-row cs-w-between"><NativeSpan className="cs-w-icon" style={{ color: s.color }} aria-hidden="true">{s.glyph}</NativeSpan><NativeSpan className={`cs-w-pill ${connected && connection?.capabilities[s.key] ? 'good' : ''}`}>{connected ? connection?.capabilities[s.key] ? 'Freigegeben' : 'Freigabe fehlt' : 'Nicht verbunden'}</NativeSpan></NativeDiv><NativeH3>{s.title}</NativeH3><NativeP className="cs-w-muted">{s.description}</NativeP><NativeSpan style={{ color: '#0869d4', fontSize: '.85em', fontWeight: 650 }}>Arbeitsbereich öffnen →</NativeSpan></NativeButton>)}</NativeDiv>
      <NativeDiv className="cs-w-card cs-w-stack"><NativeH3>Desktop-Widgets</NativeH3><NativeP>Unter „Apps & Widgets“ auf Ihrem Desktop finden Sie Google Workspace, Gmail, Google-Kalender, Google Drive und Google Tasks. Mit „Zum Desktop“ fügen Sie die gewünschten Widgets hinzu.</NativeP><NativeDiv className="cs-w-split-info"><NativeDiv><NativeDiv className="cs-w-muted">Letzter erfolgreicher Google-Abruf</NativeDiv><NativeStrong>{googleTime(connection?.lastSyncAt)}</NativeStrong></NativeDiv><NativeDiv><NativeDiv className="cs-w-muted">Verbunden seit</NativeDiv><NativeStrong>{connection?.connectedAt ? googleTime(connection.connectedAt) : 'Noch nicht verbunden'}</NativeStrong></NativeDiv></NativeDiv><NativeP className="cs-w-muted">Daten werden beim Öffnen und über „Aktualisieren“ abgerufen. Sichtbare Widgets prüfen ungefähr alle zwei Minuten auf neue Inhalte. Es werden keine Google-Daten automatisch in Klientenakten oder CareSuite-Einsätze übernommen.</NativeP></NativeDiv>
    </> : tab === 'activity' ? <WorkspaceActivity /> : connected && connection ? <WorkspaceServicePanel key={`${state.scope}:${connection.connectedAt}:${tab}`} service={tab} connection={connection} scope={state.scope}/> : <NativeDiv className="cs-w-empty"><NativeH3>{serviceDefinition(tab).title} verbinden</NativeH3><NativeP>Verbinden Sie oben Ihr Google-Konto, um diesen Dienst in CareSuite zu verwenden.</NativeP></NativeDiv>}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
function OverviewCard({ service, connection, onOpen }: {
    service: WorkspaceService;
    connection: GoogleWorkspaceConnection;
    onOpen: () => void;
}) {
    const def = serviceDefinition(service);
    const page = useWorkspacePage(service, {}, connection.capabilities[service], connection.connectedAt ?? '');
    return <NativeWorkspaceStyleScope css={[workspaceCss]}>{<NativeSection className="cs-w-metric"><NativeDiv className="cs-w-row cs-w-between"><NativeH3>{def.title}</NativeH3><NativeButton className="cs-w-button small" onClick={onOpen}>Öffnen →</NativeButton></NativeDiv>{!connection.capabilities[service] ? <NativeP className="cs-w-muted">Google-Freigabe fehlt.</NativeP> : page.error ? <NativeP role="alert" className="cs-w-muted">Abruf fehlgeschlagen. Öffnen Sie den Dienst, um es erneut zu versuchen.</NativeP> : page.loading && !page.data ? <NativeP role="status" className="cs-w-muted">Wird geladen …</NativeP> : <NativeDiv className="cs-w-preview-list">{page.data?.items.length ? page.data.items.slice(0, 3).map(item => <NativeDiv key={item.id} className="cs-w-preview-item"><NativeStrong>{item.unread ? '● ' : ''}{item.title}</NativeStrong><NativeSpan>{item.when ? googleTime(item.when) : item.subtitle}</NativeSpan></NativeDiv>) : <NativeP className="cs-w-muted">Keine Einträge vorhanden.</NativeP>}</NativeDiv>}<NativeSpan className="cs-w-muted">Abruf: {googleTime(page.data?.fetchedAt)}</NativeSpan></NativeSection>}</NativeWorkspaceStyleScope>;
}
function WorkspaceActivity() {
    const [events, setEvents] = useState<any[] | null>(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => { let active = true; setError(''); setEvents(null); void invokeEdgeFunction<{
        events: any[];
    }>('google-workspace-auth', { action: 'activity' }).then(result => { if (!active)
        return; if (result.ok)
        setEvents(result.data.events);
    else
        setError(result.error); }).catch(() => { if (active)
        setError('Aktivitäten konnten nicht geladen werden.'); }); return () => { active = false; }; }, [attempt]);
    const labels: Record<string, string> = { connect: 'Konto verbunden', disconnect: 'Verbindung getrennt', gmail_send: 'E-Mail gesendet', gmail_draft: 'Entwurf gespeichert', gmail_modify: 'E-Mail aktualisiert', calendar_create: 'Termin erstellt', tasks_create: 'Aufgabe erstellt', tasks_update: 'Aufgabenstatus geändert', contacts_create: 'Kontakt erstellt', chat_send: 'Chat-Nachricht gesendet', drive_upload: 'Datei hochgeladen', drive_create_folder: 'Ordner erstellt', docs_create: 'Dokument erstellt', sheets_create: 'Tabelle erstellt', slides_create: 'Präsentation erstellt' };
    return <NativeWorkspaceStyleScope css={[workspaceCss]}>{<NativeSection className="cs-w-card cs-w-stack"><NativeDiv className="cs-w-row cs-w-between"><NativeH2>Letzte Aktivitäten</NativeH2><NativeButton className="cs-w-button small" onClick={() => setAttempt(n => n + 1)}>Aktualisieren</NativeButton></NativeDiv><NativeP className="cs-w-muted">Die letzten 30 Anfragen dieses Betriebs mit Ergebnis und Zeitpunkt.</NativeP>{error ? <NativeDiv role="alert" className="cs-w-notice error">{error}</NativeDiv> : events === null ? <NativeP role="status">Aktivitäten werden geladen …</NativeP> : !events.length ? <NativeP>Noch keine Google-Aktivitäten vorhanden.</NativeP> : events.map(event => <NativeDiv className="cs-w-audit" key={event.id}><NativeDiv><NativeStrong>{labels[event.action_key] || `${WORKSPACE_SERVICES.find(s => s.key === event.service_key)?.title || 'Google'} · Datenabruf`}</NativeStrong><NativeDiv className="cs-w-muted">{googleTime(event.created_at)}</NativeDiv></NativeDiv><NativeSpan className={`cs-w-pill ${event.result_status === 'success' ? 'good' : 'bad'}`}>{event.result_status === 'success' ? 'Erfolgreich' : event.result_status === 'blocked' ? 'Nicht ausgeführt' : 'Fehlgeschlagen'}</NativeSpan></NativeDiv>)}</NativeSection>}</NativeWorkspaceStyleScope>;
}
