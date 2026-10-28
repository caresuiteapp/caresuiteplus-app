// Generated native presentation from src/features/beratung/ConsultationWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeNavigator as navigator,nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeStyle,NativeMain,NativeHeader,NativeP,NativeSpan,NativeH1,NativeButton,NativeStrong,NativeH2,NativeSmall,NativeSection,NativeOption,NativeDetails,NativeSummary,NativeH3,NativeForm,NativeFieldset,NativeA,NativeLabel,NativeInput,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useMemo, useState } from 'react';
import { KIND_LABELS, STATUS_LABELS, nextEncounterAction, consultationPeriod, type ConsultationClient, type ConsultationEncounter, type ConsultationKind, type ConsultationWorkspace as Workspace } from '../../lib/beratung/workspaceModel';
import { Dialog, SelectField, TextField } from "./ConsultationControls.native.tsx";
import { ConsultationEditor, type WorkspaceCommand } from "./ConsultationEditor.native.tsx";
import { consultationStyles } from './consultationStyles';
import { ConsultationIcon } from "./ConsultationIcon.native.tsx";
import { EvidenceBuilder, PreparationPicker, TemplateLibrary } from "./ConsultationTemplates.native.tsx";
import { berlinDate, consultationTemplateCatalog, type ConsultationTemplate } from '../../lib/beratung/workspaceTemplates';
import { ConsultationFollowUps } from "./ConsultationFollowUps.native.tsx";
import { ConsultationTeamTemplates } from "./ConsultationTeamTemplates.native.tsx";
import { filterConsultationVisits, matchesVisitStatus, nextConsultationFollowUp } from '../../lib/beratung/workspaceFilters';
import { ConsultationFirstContact } from "./ConsultationFirstContact.native.tsx";
import { clientIntakeResumeRoute } from '@/lib/navigation/clientRoutes';
export type ConsultationWorkspaceProps = {
    workspace: Workspace | null;
    loading: boolean;
    busy: boolean;
    error: string | null;
    notice: string | null;
    employeeView: boolean;
    caseId?: string | null;
    encounterId?: string | null;
    initialKind?: ConsultationKind;
    createInitially?: boolean;
    draftScope?: string;
    tenantId?: string | null;
    canCreateClient?: boolean;
    onCommand: WorkspaceCommand;
    onReload: () => void;
    onOpenCase: (id: string | null, encounterId?: string) => void;
};
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Termin offen';
function visitPeriod(e: ConsultationEncounter) {
    if (e.service_kind !== '37_3' || !e.scheduled_start)
        return null;
    const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(e.scheduled_start));
    return consultationPeriod(date, Number(e.client_snapshot.care_grade)).label;
}
export function ConsultationWorkspaceView({ workspace: w, loading, busy, error, notice, employeeView, caseId, encounterId, initialKind, createInitially = false, draftScope = '', tenantId, canCreateClient = false, onCommand, onReload, onOpenCase }: ConsultationWorkspaceProps) {
    const window = useNativeWorkflowWindow();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [kind, setKind] = useState(initialKind ?? 'all');
    const [create, setCreate] = useState(createInitially);
    const [qualify, setQualify] = useState(false);
    const [followUp, setFollowUp] = useState(false);
    const [library, setLibrary] = useState(false);
    const [teamLibrary, setTeamLibrary] = useState(false);
    const catalog = consultationTemplateCatalog(w?.teamTemplates);
    const [createTemplate, setCreateTemplate] = useState<ConsultationTemplate | null>(null);
    const [employee, setEmployee] = useState('all');
    const [sort, setSort] = useState('priority');
    const [from, setFrom] = useState('');
    const [until, setUntil] = useState('');
    const today = berlinDate();
    const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
    useEffect(() => { const change = () => setOnline(navigator.onLine); window.addEventListener('online', change); window.addEventListener('offline', change); return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); }; }, []);
    const selected = caseId ? w?.encounters.find(e => e.case_id === caseId && (!encounterId || e.id === encounterId)) : null;
    const visible = useMemo(() => filterConsultationVisits(w, { search, kind, status: filter, employee, sort, from, until }, today), [w, search, filter, kind, employee, sort, from, until, today]);
    const counts = { open: w?.encounters.filter(e => matchesVisitStatus(e, 'open', today, w)).length ?? 0, review: w?.encounters.filter(e => e.status === 'submitted').length ?? 0, returned: w?.encounters.filter(e => e.status === 'returned').length ?? 0, done: w?.encounters.filter(e => e.status === 'approved').length ?? 0 };
    return <NativeWorkspaceStyleScope css={[consultationStyles, consultationStyles]}>{<NativeDiv className="cw-root"><NativeStyle>{consultationStyles}</NativeStyle><NativeMain className="cw-workspace" aria-label={employeeView ? 'Meine Beratung und Schulungen' : 'Beratung und Schulungen'}>
  <NativeHeader className="cw-header"><NativeDiv><NativeP className="cw-kicker">CARESUITE HEALTHOS <NativeSpan>/</NativeSpan> {employeeView ? 'MEIN ARBEITSPLATZ' : 'BERATUNG'}</NativeP><NativeH1>{selected ? selected.client_snapshot.name : employeeView ? 'Meine Beratung & Schulungen' : 'Beratung. Persönlich begleitet.'}</NativeH1><NativeP className="cw-subtitle">{selected ? `${KIND_LABELS[selected.service_kind]} · ${STATUS_LABELS[selected.status]}` : employeeView ? 'Ihre Besuche, die nächsten Schritte und alle Rückfragen an einem Ort.' : 'Beratungsbesuche nach § 37.3 und häusliche Schulungen nach § 45.'}</NativeP></NativeDiv><NativeDiv className="cw-header-actions">{!caseId && <NativeButton className="cw-button" onClick={() => setLibrary(true)}>Vorlagenbibliothek</NativeButton>}{w?.capabilities?.teamTemplates && (w.canManage || w.canReview) && !caseId && <NativeButton className="cw-button" onClick={() => setTeamLibrary(true)}>Teamvorlagen</NativeButton>}{w?.canQualify && !caseId && <NativeButton className="cw-button" onClick={() => setQualify(true)}>Qualifikationen</NativeButton>}{w?.canManage && <NativeButton className="cw-button cw-primary" onClick={() => { setCreateTemplate(null); caseId ? setFollowUp(true) : setCreate(true); }}>{caseId ? '+ Weiteren Besuch planen' : '+ Neuen Fall anlegen'}</NativeButton>}</NativeDiv></NativeHeader>
  {!online && <NativeDiv role="status" className="cw-alert cw-alert-warning"><NativeStrong>Keine Netzverbindung.</NativeStrong> Ihr geöffneter Entwurf kann weiter bearbeitet werden. Speichern und Statusänderungen benötigen eine Verbindung. Lassen Sie diese Seite geöffnet.</NativeDiv>}
  {error && <NativeDiv role="alert" className="cw-alert cw-alert-error"><NativeStrong>Bitte prüfen</NativeStrong><NativeP>{error}</NativeP><NativeButton className="cw-button" disabled={busy || loading || !online} onClick={onReload}>Serverstand erneut laden</NativeButton></NativeDiv>}
  {notice && <NativeP className="cw-alert cw-alert-success cw-notice" role="status">{notice}</NativeP>}
  {loading && !w && <NativeDiv className="cw-loading" role="status" aria-live="polite"><NativeSpan className="cw-spinner"/>Beratungsarbeitsplatz wird geladen …</NativeDiv>}
  {!loading && !w && !error && <NativeDiv className="cw-empty"><NativeH2>Arbeitsplatz wird vorbereitet</NativeH2><NativeP>Die Anmeldung und Zuordnung zum Unternehmen werden geprüft.</NativeP></NativeDiv>}
  {w && !caseId && <>
   <NativeDiv className="cw-metrics" aria-label="Besuchsübersicht">{([{ label: employeeView ? 'Meine offenen Besuche' : 'Offene Besuche', value: counts.open, filter: 'open', tone: 'blue', hint: 'Planen & durchführen' }, { label: 'Zur fachlichen Prüfung', value: counts.review, filter: 'review', tone: 'violet', hint: 'Dokumentation eingereicht' }, { label: 'Rückfragen', value: counts.returned, filter: 'returned', tone: 'amber', hint: 'Gemeinsam vervollständigen' }, { label: 'Fachlich freigegeben', value: counts.done, filter: 'done', tone: 'green', hint: 'Prüfung abgeschlossen' }]).map(m => <NativeButton key={m.filter} className={`cw-metric cw-tone-${m.tone}`} onClick={() => setFilter(m.filter)} aria-pressed={filter === m.filter}><NativeSpan>{m.label}</NativeSpan><NativeSpan className="cw-metric-icon"><ConsultationIcon name={m.filter as 'open' | 'review' | 'returned' | 'done'}/></NativeSpan><NativeStrong>{m.value}</NativeStrong><NativeSmall>{m.hint}<NativeSpan aria-hidden>↗</NativeSpan></NativeSmall></NativeButton>)}</NativeDiv>
   <NativeDiv className="cw-workspace-intro"><NativeDiv><NativeSpan className="cw-kicker">GUT VORBEREITET</NativeSpan><NativeStrong>Passende Bausteine für Ihren nächsten Besuch</NativeStrong><NativeP>Beratung, Entlastung, Mobilität und Alltag – individuell kombinierbar.</NativeP></NativeDiv><NativeButton className="cw-button" onClick={() => setLibrary(true)}>{catalog.length} Vorlagen entdecken →</NativeButton></NativeDiv>
   <ConsultationFollowUps workspace={w} busy={busy || !online} error={error} onCommand={onCommand} onReload={onReload} onOpenCase={onOpenCase}/>
   <NativeSection className="cw-panel cw-list-panel"><NativeDiv className="cw-list-heading"><NativeDiv><NativeP className="cw-kicker">{employeeView ? 'PERSÖNLICH ZUGEWIESEN' : 'GEMEINSAME FALLAKTE'}</NativeP><NativeH2>{filter === 'review' ? 'Bereit für die Prüfung' : filter === 'returned' ? 'Rückfragen bearbeiten' : filter === 'followup' ? 'Wiedervorlagen' : 'Alle Besuche im Blick'}</NativeH2></NativeDiv><NativeButton className="cw-button" onClick={onReload} disabled={busy || loading || !online}>{loading ? 'Wird geladen …' : 'Aktualisieren'}</NativeButton></NativeDiv>
    <NativeDiv className="cw-filter-chips" role="group" aria-label="Schnellfilter">{[["all", "Alle"], ["today", "Heute"], ["draft", "Noch zu planen"], ["documentation_pending", "Dokumentation offen"], ["due", "Wiedervorlage fällig"]].map(([key, label]) => <NativeButton className="cw-choice" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<NativeSpan>{w.encounters.filter(e => matchesVisitStatus(e, key, today, w)).length}</NativeSpan></NativeButton>)}</NativeDiv>
    <NativeDiv className="cw-filter-row"><TextField label="Besuche suchen" value={search} onChange={setSearch} placeholder="Name, Beratungsperson oder Ort …"/><SelectField label="Leistungsart" value={kind} onChange={setKind}><NativeOption value="all">Alle Leistungsarten</NativeOption><NativeOption value="37_3">Beratung § 37.3</NativeOption><NativeOption value="45">Häusliche Schulung § 45</NativeOption></SelectField><SelectField label="Bearbeitungsstand" value={filter} onChange={setFilter}><NativeOption value="all">Alle Besuche</NativeOption><NativeOption value="open">Offene Besuche</NativeOption><NativeOption value="review">Zur Prüfung</NativeOption><NativeOption value="returned">Rückfragen</NativeOption><NativeOption value="done">Fachlich freigegeben</NativeOption><NativeOption value="followup">Mit Wiedervorlage</NativeOption><NativeOption value="today">Heute</NativeOption><NativeOption value="draft">Noch zu planen</NativeOption><NativeOption value="scheduled">Geplant</NativeOption><NativeOption value="in_progress">In Durchführung</NativeOption><NativeOption value="documentation_pending">Dokumentation offen</NativeOption><NativeOption value="due">Wiedervorlage fällig</NativeOption><NativeOption value="cancelled">Abgesagt</NativeOption><NativeOption value="no_show">Nicht angetroffen</NativeOption></SelectField></NativeDiv>
    <NativeDetails className="cw-advanced-filters"><NativeSummary>Person, Zeitraum & Sortierung</NativeSummary><NativeDiv className="cw-filter-details">{!employeeView && <SelectField label="Zugewiesene Person" value={employee} onChange={setEmployee}><NativeOption value="all">Alle Personen</NativeOption><NativeOption value="unassigned">Ohne Zuweisung</NativeOption>{w.employees.map(p => <NativeOption key={p.id} value={p.id}>{p.name}</NativeOption>)}</SelectField>}<TextField label="Termin ab" type="date" value={from} onChange={setFrom}/><TextField label="Termin bis" type="date" value={until} onChange={setUntil}/><SelectField label="Sortierung" value={sort} onChange={setSort}><NativeOption value="priority">Handlungsbedarf zuerst</NativeOption><NativeOption value="date">Nächster Termin zuerst</NativeOption><NativeOption value="name">Name A–Z</NativeOption><NativeOption value="followup">Nächste Wiedervorlage</NativeOption></SelectField></NativeDiv>{from && until && from > until && <NativeP role="alert" className="cw-muted">Das Enddatum liegt vor dem Anfangsdatum.</NativeP>}</NativeDetails>
    <NativeDiv className="cw-list-meta"><NativeSpan>{visible.length} {visible.length === 1 ? 'Besuch' : 'Besuche'}</NativeSpan><NativeButton className="cw-link" onClick={() => { setSearch(''); setKind('all'); setFilter('all'); setEmployee('all'); setFrom(''); setUntil(''); setSort('priority'); }}>Filter zurücksetzen</NativeButton></NativeDiv>
    <NativeDiv className="cw-visits">{visible.map(e => <NativeButton className="cw-visit" key={e.id} onClick={() => onOpenCase(e.case_id, e.id)}><NativeSpan className={`cw-visit-icon ${e.service_kind === '45' ? 'cw-training' : ''}`} aria-hidden>{e.service_kind === '45' ? '45' : '37.3'}</NativeSpan><NativeSpan className="cw-visit-person"><NativeStrong>{e.client_snapshot.name}</NativeStrong><NativeSpan>{KIND_LABELS[e.service_kind]}</NativeSpan><NativeSmall>{e.employee_name ?? 'Beratungsperson noch offen'}</NativeSmall></NativeSpan><NativeSpan className="cw-visit-date"><NativeStrong>{dateTime(e.scheduled_start)}</NativeStrong><NativeSmall>{e.client_snapshot.address || 'Adresse offen'}</NativeSmall>{['followup', 'due'].includes(filter) && <NativeSmall>Nächster Schritt: {nextConsultationFollowUp(e, w)}</NativeSmall>}</NativeSpan><NativeSpan className="cw-visit-progress"><NativeSpan className={`cw-status cw-status-${e.status}`}>{STATUS_LABELS[e.status]}</NativeSpan><NativeSmall>{nextEncounterAction(e)}</NativeSmall></NativeSpan><NativeSpan className="cw-visit-arrow" aria-hidden>↗</NativeSpan></NativeButton>)}</NativeDiv>
    {!visible.length && <NativeDiv className="cw-empty"><NativeSpan className="cw-empty-icon" aria-hidden>◎</NativeSpan><NativeH3>{w.encounters.length ? 'Keine passenden Besuche' : 'Noch keine Besuche vorhanden'}</NativeH3><NativeP>{w.encounters.length ? 'Passen Sie die Suche oder Filter an.' : employeeView ? 'Sobald Ihnen ein Besuch zugewiesen wurde, finden Sie hier Vorbereitung und Durchführung.' : canCreateClient && w.capabilities?.centralContact ? 'Wählen Sie eine vorhandene Person oder erfassen Sie zuerst die Eckdaten für einen neuen Erstkontakt.' : 'Legen Sie einen Fall für einen bestehenden Klienten an und weisen Sie eine qualifizierte Beratungsperson zu.'}</NativeP>{w.canManage && !w.encounters.length && <NativeButton className="cw-button cw-primary" onClick={() => setCreate(true)}>Ersten Fall anlegen</NativeButton>}</NativeDiv>}
   </NativeSection>
   <NativeDiv className="cw-bottom-notes"><NativeDiv><NativeSpan className="cw-dot"/><NativeSpan>Ein gemeinsamer Stand für Verwaltung und Mitarbeitende</NativeSpan></NativeDiv><NativeP>Fachliche Freigaben, Kassenversand und Abrechnung werden getrennt geführt.</NativeP></NativeDiv>
  </>}
  {w && caseId && selected && <><NativeDiv className="cw-case-visits"><NativeSpan className={`cw-status cw-status-${selected.status}`}>{STATUS_LABELS[selected.status]}</NativeSpan>{visitPeriod(selected) && <NativeSpan className="cw-tag">{visitPeriod(selected)}</NativeSpan>}{w.encounters.filter(e => e.case_id === caseId).length > 1 && <SelectField label="Besuch in dieser Fallakte" value={selected.id} onChange={id => onOpenCase(caseId, id)}>{w.encounters.filter(e => e.case_id === caseId).map(e => <NativeOption key={e.id} value={e.id}>{dateTime(e.scheduled_start)} · {KIND_LABELS[e.service_kind]} · {STATUS_LABELS[e.status]}</NativeOption>)}</SelectField>}</NativeDiv><ConsultationEditor key={selected.id} draftScope={draftScope} encounter={selected} workspace={w} busy={busy || !online} error={error} onCommand={onCommand} onBack={() => onOpenCase(null)} onRefresh={onReload}/></>}
  {w && caseId && !selected && <NativeDiv className="cw-empty"><NativeH2>Besuch nicht verfügbar</NativeH2><NativeP>Der Besuch ist nicht vorhanden oder wurde Ihnen nicht mehr zugewiesen.</NativeP><NativeButton className="cw-button" onClick={() => onOpenCase(null)}>Zur Übersicht</NativeButton></NativeDiv>}
  {create && w?.canManage && <CreateCase template={createTemplate} initialKind={initialKind} busy={busy || !online} error={error} workspace={w} tenantId={tenantId} draftScope={draftScope} canCreateClient={canCreateClient && !employeeView} onContactSaved={onReload} onClose={() => setCreate(false)} onCommand={onCommand} onCreated={(id, e) => { setCreate(false); onOpenCase(id, e); }}/>}
  {library && <TemplateLibrary catalog={catalog} initialKind={initialKind} onClose={() => setLibrary(false)} onUse={w?.canManage ? t => { setCreateTemplate(t); setLibrary(false); setCreate(true); } : undefined}/>}
  {teamLibrary && w?.capabilities?.teamTemplates && (w.canManage || w.canReview) && <ConsultationTeamTemplates workspace={w} busy={busy || !online} error={error} onCommand={onCommand} onClose={() => setTeamLibrary(false)} onReload={onReload}/>}
  {qualify && w?.canQualify && <QualificationDialog busy={busy || !online} error={error} workspace={w} onClose={() => setQualify(false)} onCommand={onCommand}/>}
  {followUp && w?.canManage && caseId && <AddVisit workspace={w} initialKind={selected?.service_kind} caseId={caseId} busy={busy || !online} error={error} onClose={() => setFollowUp(false)} onCommand={onCommand} onCreated={(id, e) => { setFollowUp(false); onOpenCase(id, e); }}/>}
 </NativeMain></NativeDiv>}</NativeWorkspaceStyleScope>;
}
function CreateCase({ workspace, busy, error, onClose, onCommand, onCreated, template, initialKind, tenantId, draftScope, canCreateClient, onContactSaved }: {
    template?: ConsultationTemplate | null;
    initialKind?: ConsultationKind;
    workspace: Workspace;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onCommand: WorkspaceCommand;
    onCreated: (id: string, e: string) => void;
    tenantId?: string | null;
    draftScope: string;
    canCreateClient: boolean;
    onContactSaved: () => void;
}) {
    const [client, setClient] = useState('');
    const [kind, setKind] = useState<ConsultationKind>(template?.kind ?? initialKind ?? '37_3');
    const [title, setTitle] = useState(template?.title ?? 'Beratung und Begleitung');
    const [preparation, setPreparation] = useState(template?.preparation ?? '');
    const [contactBusy, setContactBusy] = useState(false);
    const [savedClients, setSavedClients] = useState<ConsultationClient[]>([]);
    const contactAvailable = canCreateClient && workspace.capabilities?.centralContact === true;
    const newContact = client === '__new__' && Boolean(tenantId) && contactAvailable;
    const clients = [...workspace.clients, ...savedClients.filter(c => !workspace.clients.some(existing => existing.id === c.id))];
    return <NativeWorkspaceStyleScope css={[consultationStyles]}>{<Dialog title="Neuen Beratungsfall anlegen" busy={busy || contactBusy} onClose={onClose} wide={newContact}>
      <SelectField label="Klientin / Klient" value={client} disabled={busy || contactBusy} onChange={setClient}>
        <NativeOption value="">Aus den Klientenstammdaten auswählen</NativeOption>
        <NativeOption value="__new__" disabled={!contactAvailable || !tenantId}>+ Neu anlegen · Eckdaten erfassen</NativeOption>
        {clients.map(c => <NativeOption value={c.id} key={c.id}>{c.name}{c.address ? ` · ${c.address}` : ''}</NativeOption>)}
      </SelectField>
      {!canCreateClient && <NativeP className="cw-muted">Zum Anlegen einer neuen Person benötigen Sie die Berechtigung zur Klientenaufnahme.</NativeP>}
      {canCreateClient && !contactAvailable && <NativeP className="cw-muted">Die direkte Klientenaufnahme wird für diesen Arbeitsplatz noch bereitgestellt.</NativeP>}
      {newContact ? <ConsultationFirstContact tenantId={tenantId!} draftScope={draftScope} clients={clients} onBusyChange={setContactBusy} onBack={() => setClient('')} onSelect={c => setClient(c.id)} onSaved={(c, notes) => {
                setSavedClients(previous => [...previous.filter(existing => existing.id !== c.id), c]);
                setClient(c.id);
                if (notes.trim())
                    setPreparation(previous => [previous.trim(), notes.trim()].filter(Boolean).join('\n\n'));
                onContactSaved();
            }}/> : <NativeForm onSubmit={e => {
                e.preventDefault();
                if (!client || client === '__new__')
                    return;
                void onCommand('create', { client_id: client, title, service_kind: kind, preparation }).then(r => { if (r)
                    onCreated(r.case_id, r.encounter_id); });
            }}><NativeFieldset className="cw-reset-fieldset" disabled={busy}>
          {savedClients.some(c => c.id === client) && <NativeDiv className="cw-contact-saved" role="status"><NativeSpan>✓ Eckdaten unter „Klienten“ gespeichert</NativeSpan><NativeA href={clientIntakeResumeRoute(client)} target="_blank" rel="noopener noreferrer">Aufnahme öffnen ↗</NativeA></NativeDiv>}
          <TextField label="Bezeichnung der Fallakte" maxLength={200} value={title} onChange={setTitle} required/><KindSelect value={kind} onChange={setKind}/>
          <PreparationPicker templates={consultationTemplateCatalog(workspace.teamTemplates)} kind={kind} value={preparation} onChange={setPreparation}/>
          <TextField label="Anlass und Hinweise für die Beratungsperson" value={preparation} onChange={setPreparation} multiline/>
          <NativeP className="cw-muted">Im nächsten Schritt legen Sie den Termin und die persönliche Zuweisung fest.</NativeP>
          {error && <NativeP role="alert" className="cw-alert cw-alert-error">{error}</NativeP>}
          <NativeDiv className="cw-actions"><NativeButton type="button" className="cw-button" onClick={onClose}>Abbrechen</NativeButton><NativeButton type="submit" className="cw-button cw-primary" disabled={!client || client === '__new__' || !title.trim() || busy}>Fallakte anlegen</NativeButton></NativeDiv>
        </NativeFieldset></NativeForm>}
    </Dialog>}</NativeWorkspaceStyleScope>;
}
function KindSelect({ value, onChange }: {
    value: ConsultationKind;
    onChange: (v: ConsultationKind) => void;
}) { return <NativeWorkspaceStyleScope css={[consultationStyles]}>{<SelectField label="Leistungsart" value={value} onChange={v => onChange(v as ConsultationKind)}>{Object.entries(KIND_LABELS).map(([k, l]) => <NativeOption value={k} key={k}>{l}</NativeOption>)}</SelectField>}</NativeWorkspaceStyleScope>; }
function AddVisit({ workspace, caseId, busy, error, onClose, onCommand, onCreated, initialKind }: {
    initialKind?: ConsultationKind;
    workspace: Workspace;
    caseId: string;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onCommand: WorkspaceCommand;
    onCreated: (id: string, e: string) => void;
}) {
    const [kind, setKind] = useState<ConsultationKind>(initialKind ?? '37_3');
    const [preparation, setPreparation] = useState('');
    return <NativeWorkspaceStyleScope css={[consultationStyles]}>{<Dialog title="Weiteren Besuch planen" busy={busy} onClose={onClose}><KindSelect value={kind} onChange={setKind}/><PreparationPicker templates={consultationTemplateCatalog(workspace.teamTemplates)} kind={kind} value={preparation} onChange={setPreparation}/><TextField label="Vorbereitung und Übergabe" value={preparation} onChange={setPreparation} multiline/><NativeP>Ein neuer Besuch wird in derselben Fallakte angelegt. Dokumentation und Unterschriften werden für jeden Besuch gesondert geführt.</NativeP>{error && <NativeP role="alert" className="cw-alert cw-alert-error">{error}</NativeP>}<NativeButton className="cw-button cw-primary" disabled={busy} onClick={() => void onCommand('add_visit', { case_id: caseId, service_kind: kind, preparation }).then(r => {
            if (r)
                onCreated(r.case_id, r.encounter_id);
        })}>Besuch anlegen</NativeButton></Dialog>}</NativeWorkspaceStyleScope>;
}
function QualificationDialog({ workspace, busy, error, onClose, onCommand }: {
    workspace: Workspace;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onCommand: WorkspaceCommand;
}) {
    const [employee, setEmployee] = useState('');
    const [kind, setKind] = useState<ConsultationKind>('37_3');
    const [from, setFrom] = useState('');
    const [until, setUntil] = useState('');
    const [evidence, setEvidence] = useState('');
    const [active, setActive] = useState(false);
    const [saved, setSaved] = useState(false);
    function choose(person: string, service: ConsultationKind) { const q = workspace.employees.find(e => e.id === person)?.qualifications.find(q => q.service_kind === service); setEmployee(person); setKind(service); setFrom(q?.valid_from ?? ''); setUntil(q?.valid_until ?? ''); setEvidence(q?.evidence ?? ''); setActive(q?.active ?? false); setSaved(false); }
    return <NativeWorkspaceStyleScope css={[consultationStyles]}>{<Dialog title="Qualifikationsfreigaben" busy={busy} onClose={onClose}><NativeP>Die fachliche Befähigung und die vertragsbezogenen Voraussetzungen werden je Leistungsart geprüft und dokumentiert.</NativeP><NativeForm onSubmit={e => {
            e.preventDefault();
            if (evidence.length > 2000 || until && until < from)
                return;
            void onCommand('qualify', { employee_id: employee, service_kind: kind, valid_from: from, valid_until: until, evidence, active }).then(r => {
                if (r)
                    setSaved(true);
            });
        }}><NativeFieldset disabled={busy} className="cw-reset-fieldset"><SelectField label="Mitarbeitende Person" value={employee} onChange={v => choose(v, kind)}><NativeOption value="">Bitte auswählen</NativeOption>{workspace.employees.map(e => <NativeOption key={e.id} value={e.id}>{e.name}</NativeOption>)}</SelectField><KindSelect value={kind} onChange={v => choose(employee, v)}/><NativeDiv className="cw-form-grid"><TextField label="Gültig ab" type="date" value={from} onChange={setFrom} required/><TextField label="Gültig bis (optional)" type="date" value={until} onChange={setUntil}/></NativeDiv><EvidenceBuilder key={`${employee}:${kind}`} value={evidence} onChange={setEvidence}/><TextField label="Geprüfte Nachweise / Vertragsgrundlage" maxLength={2000} value={evidence} onChange={setEvidence} multiline required/><NativeP className="cw-muted">{evidence.length} / 2.000 Zeichen</NativeP>{until && from && until < from && <NativeP className="cw-alert cw-alert-warning" role="alert">Das Gültigkeitsende liegt vor dem Beginn.</NativeP>}<NativeP className="cw-muted">Eine neue Freigabe wird erst mit Ihrer ausdrücklichen Bestätigung aktiv. Prüfen Sie Befähigung und Leistungsberechtigung für die gewählte Leistung.</NativeP><NativeLabel className="cw-check"><NativeInput type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}/>Für diese Leistungsart freigegeben</NativeLabel>{error && <NativeP role="alert" className="cw-alert cw-alert-error">{error}</NativeP>}{saved && <NativeP role="status" className="cw-alert cw-alert-success">Qualifikationsfreigabe gespeichert.</NativeP>}<NativeButton type="submit" className="cw-button cw-primary" disabled={!employee || !from || !evidence.trim() || evidence.length > 2000 || Boolean(until && until < from) || busy}>Freigabe speichern</NativeButton></NativeFieldset></NativeForm></Dialog>}</NativeWorkspaceStyleScope>;
}
