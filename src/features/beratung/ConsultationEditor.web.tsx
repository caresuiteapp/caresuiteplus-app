import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EVENT_LABELS, consultationIssues, emptyConsultationAnswers, isEncounterEditable, normalizeConsultationAnswers, SECTION_LABELS, TOPICS, LEARNING_LABELS, type ConsultationAnswers, type ConsultationEncounter, type ConsultationMutation, type ConsultationSection, type ConsultationWorkspace } from '../../lib/beratung/workspaceModel';
import { readConsultationDraft, keepConsultationDraft, clearConsultationDraft } from '../../lib/beratung/workspaceDrafts';
import { Dialog, Field, SelectField, SignatureDialog, TextField } from './ConsultationControls.web';
import { ConsultationDocument } from './ConsultationDocument.web';
export type MutationResult = {
    case_id: string;
    encounter_id: string;
    version: number;
};
export type WorkspaceCommand = (action: ConsultationMutation, data: Record<string, unknown>, encounter?: Pick<ConsultationEncounter, 'id' | 'version'>) => Promise<MutationResult | null>;
const uid = () => crypto.randomUUID();
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Noch offen';
export function ConsultationEditor({ encounter: e, workspace, busy, error, onCommand, onBack, onRefresh, draftScope }: {
    draftScope: string;
    encounter: ConsultationEncounter;
    workspace: ConsultationWorkspace;
    busy: boolean;
    error: string | null;
    onCommand: WorkspaceCommand;
    onBack: () => void;
    onRefresh: () => void;
}) {
    const [recovered] = useState(() => readConsultationDraft(draftScope, e.id));
    const [answers, setAnswers] = useState(() => recovered?.answers ?? normalizeConsultationAnswers(e.answers));
    const [dirty, setDirty] = useState(Boolean(recovered));
    const dirtyRef = useRef(Boolean(recovered));
    const [baseVersion, setBaseVersion] = useState(recovered?.version ?? e.version);
    const versionRef = useRef(recovered?.version ?? e.version);
    const base = useRef(recovered?.base ?? normalizeConsultationAnswers(e.answers));
    const [section, setSection] = useState<ConsultationSection>(e.status === 'returned' && e.review_section ? e.review_section : 'preparation');
    const [signatureContent, setSignatureContent] = useState<{
        answers: ConsultationAnswers;
        version: number;
    } | null>(null);
    const [reasonAction, setReasonAction] = useState<'return' | 'cancel' | 'no_show' | null>(null);
    const [reason, setReason] = useState('');
    const [reviewSection, setReviewSection] = useState<ConsultationSection>('situation');
    const [message, setMessage] = useState('');
    const [discardOpen, setDiscardOpen] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [choices, setChoices] = useState<Record<string, 'local' | 'remote'>>({});
    const [revisionId, setRevisionId] = useState<string | null>(null);
    const editable = e.can_execute && isEncounterEditable(e.status);
    const conflict = dirty && baseVersion !== e.version;
    const sections: ConsultationSection[] = e.service_kind === '45' ? ['preparation', 'situation', 'training', 'measures', 'confirmation'] : ['preparation', 'situation', 'measures', 'confirmation'];
    useEffect(() => { if (dirty)
        keepConsultationDraft(draftScope, e.id, { answers, base: base.current, version: baseVersion }); }, [draftScope, e.id, answers, dirty, baseVersion]);
    const issues = consultationIssues(e.service_kind, answers);
    const revisions = workspace.revisions.filter(r => r.encounter_id === e.id);
    const revision = revisions.find(r => r.id === revisionId);
    useLayoutEffect(() => { if (!dirtyRef.current) {
        const next = normalizeConsultationAnswers(e.answers);
        setAnswers(next);
        base.current = next;
        versionRef.current = e.version;
        setBaseVersion(e.version);
    } }, [e.version, e.answers]);
    useEffect(() => { function prevent(event: BeforeUnloadEvent) { if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = '';
    } } window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent); }, []);
    function update<K extends keyof ConsultationAnswers>(key: K, value: ConsultationAnswers[K]) { setAnswers(a => ({ ...a, [key]: value })); setDirty(true); dirtyRef.current = true; }
    async function run(action: ConsultationMutation, data: Record<string, unknown> = {}, expectedVersion?: number) {
        if (conflict && action !== 'comment')
            return null;
        if (dirtyRef.current && !['save', 'submit'].includes(action)) {
            const saved = await run('save', { answers });
            if (!saved)
                return null;
        }
        const result = await onCommand(action, data, { id: e.id, version: expectedVersion ?? versionRef.current });
        if (result) {
            versionRef.current = result.version;
            setBaseVersion(result.version);
            if (action === 'save' || action === 'submit') {
                dirtyRef.current = false;
                setDirty(false);
                base.current = answers;
                clearConsultationDraft(draftScope, e.id);
            }
        }
        return result;
    }
    const remote = normalizeConsultationAnswers(e.answers);
    const conflicts = (Object.keys(emptyConsultationAnswers()) as (keyof ConsultationAnswers)[]).filter(k => JSON.stringify(answers[k]) !== JSON.stringify(base.current[k]) && JSON.stringify(remote[k]) !== JSON.stringify(base.current[k]) && JSON.stringify(answers[k]) !== JSON.stringify(remote[k]));
    function merge() { const merged = { ...remote }; for (const key of Object.keys(merged) as (keyof ConsultationAnswers)[]) {
        if (JSON.stringify(answers[key]) !== JSON.stringify(base.current[key]) && (!conflicts.includes(key) || choices[key] === 'local'))
            Object.assign(merged, { [key]: answers[key] });
    } base.current = remote; versionRef.current = e.version; setBaseVersion(e.version); setAnswers(merged); setDirty(true); dirtyRef.current = true; setMergeOpen(false); }
    const field = (label: string, key: keyof ConsultationAnswers, multiline = true) => <TextField label={label} value={String(answers[key])} onChange={v => update(key, v as never)} multiline={multiline}/>;
    return <>
  <div className="cw-detail-toolbar"><button className="cw-link" onClick={() => dirty ? setDiscardOpen(true) : onBack()}>← Alle Besuche</button><span className="cw-save-state" role="status">{busy ? 'Übertragung läuft …' : dirty ? 'Entwurf noch nicht gespeichert' : `Serverstand · Fassung ${e.version} · ${formatDate(e.updated_at)}`}</span><button className="cw-link" onClick={onRefresh} disabled={busy}>Aktualisieren</button></div>
  {e.status === 'returned' && <div className="cw-alert cw-alert-warning"><strong>Rückfrage zur Dokumentation</strong><p>{e.review_note}</p><button className="cw-link" onClick={() => setSection(e.review_section ?? 'situation')}>Betroffenen Abschnitt öffnen →</button></div>}
  {conflict && <div role="alert" className="cw-alert cw-alert-warning"><strong>Es gibt einen neueren Serverstand.</strong><p>Ihr Entwurf ist weiterhin geöffnet. Vergleichen Sie beide Fassungen, bevor Sie speichern.</p><button className="cw-button" onClick={() => { setChoices({}); setMergeOpen(true); }}>Änderungen abgleichen</button></div>}
  <div className="cw-editor-grid"><aside className="cw-context">
   <div className="cw-panel cw-client"><span className="cw-avatar">{e.client_snapshot.name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}</span><h2>{e.client_snapshot.name}</h2><p>{e.client_snapshot.address || 'Adresse noch nicht hinterlegt'}</p><div className="cw-tags">{e.client_snapshot.care_grade && <span className="cw-tag">Pflegegrad {e.client_snapshot.care_grade}</span>}<span className="cw-tag">{e.service_kind === '45' ? 'Schulung § 45' : 'Beratung § 37.3'}</span></div>
    <details className="cw-client-details"><summary>Termin & Versorgung</summary><dl className="cw-facts"><div><dt>Beratungsperson</dt><dd>{e.employee_name || 'Noch nicht zugewiesen'}</dd></div><div><dt>Geplanter Beginn</dt><dd>{formatDate(e.scheduled_start)}</dd></div><div><dt>Geplantes Ende</dt><dd>{formatDate(e.scheduled_end)}</dd></div><div><dt>Tatsächlicher Beginn</dt><dd>{formatDate(e.actual_start)}</dd></div><div><dt>Tatsächliches Ende</dt><dd>{formatDate(e.actual_end)}</dd></div><div><dt>Pflegekasse</dt><dd>{e.client_snapshot.payer || 'Noch nicht hinterlegt'}</dd></div></dl></details>
    {e.client_snapshot.phone && <a className="cw-button" href={`tel:${e.client_snapshot.phone.replace(/[^+\d]/g, '')}`}>Telefonieren</a>}
   </div>
   <nav className="cw-section-nav" aria-label="Dokumentationsabschnitte">{sections.map((s, i) => <button key={s} aria-current={section === s ? 'step' : undefined} onClick={() => setSection(s)}><span className="cw-step">{i + 1}</span><span>{SECTION_LABELS[s]}</span>{issues.some(x => x.section === s) && <span className="cw-step-dot" aria-label="Noch zu vervollständigen"/>}</button>)}</nav>
   <div className="cw-panel cw-small"><strong>Verbindlich verbunden</strong><p>Planung, Dokumentation und Rückfragen werden in derselben Besuchsakte geführt.</p></div>
  </aside>
  <div className="cw-editor-main">
   {workspace.canManage && ['draft', 'scheduled'].includes(e.status) && <Planning encounter={e} workspace={workspace} busy={busy} run={run}/>}
   <section className="cw-panel cw-form-panel"><div className="cw-section-heading"><div><p className="cw-kicker">{e.service_kind === '45' ? 'Häusliche Schulung' : 'Beratungsbesuch'}</p><h2>{SECTION_LABELS[section]}</h2></div><span className="cw-tag">{sections.indexOf(section) + 1} / {sections.length}</span></div>
    {section === 'preparation' && <><div className="cw-handover"><h3>Übergabe der Verwaltung</h3><p>{e.preparation || 'Es wurden keine zusätzlichen Hinweise hinterlegt.'}</p>{e.client_snapshot.access_notes && <p><strong>Zugang:</strong> {e.client_snapshot.access_notes}</p>}{e.client_snapshot.notes && <p><strong>Hinweise:</strong> {e.client_snapshot.notes}</p>}<small>{e.last_read_at ? `Gelesen am ${formatDate(e.last_read_at)}` : 'Lesebestätigung ausstehend'}</small></div>
     {e.can_execute && ['scheduled', 'returned'].includes(e.status) && !e.last_read_at && <button className="cw-button" disabled={busy} onClick={() => void run('read')}>Übergabe gelesen</button>}
     {e.can_execute && e.status === 'scheduled' && <div className="cw-actions"><button className="cw-button cw-primary" disabled={busy || !e.last_read_at} onClick={() => void run('start').then(r => { if (r)
            setSection('preparation'); })}>Besuch jetzt beginnen</button><button className="cw-button" disabled={busy} onClick={() => { setReason(''); setReasonAction('no_show'); }}>Nicht angetroffen</button></div>}
     <h3>Teilnehmende Personen</h3><fieldset disabled={!editable || busy} className="cw-reset-fieldset"><div className="cw-repeat-list">{answers.participants.map((p, i) => <div className="cw-repeat-item" key={p.id}><div className="cw-between"><strong>Person {i + 1}</strong><button className="cw-link" onClick={() => update('participants', answers.participants.filter(x => x.id !== p.id))}>Entfernen</button></div><div className="cw-form-grid"><TextField label="Name" value={p.name} onChange={v => update('participants', answers.participants.map(x => x.id === p.id ? { ...x, name: v } : x))}/><TextField label="Rolle / Beziehung" value={p.role} onChange={v => update('participants', answers.participants.map(x => x.id === p.id ? { ...x, role: v } : x))}/></div><TextField label="Vertretung / Beteiligung, falls relevant" value={p.authority} onChange={v => update('participants', answers.participants.map(x => x.id === p.id ? { ...x, authority: v } : x))}/></div>)}</div><button className="cw-button" onClick={() => update('participants', [...answers.participants, { id: uid(), name: answers.participants.length || e.service_kind === '45' ? '' : e.client_snapshot.name, role: answers.participants.length ? '' : e.service_kind === '45' ? 'Pflegende Person' : 'Pflegebedürftige Person', authority: '' }])}>+ Person ergänzen</button></fieldset>
    </>}
    {section === 'situation' && <fieldset disabled={!editable || busy} className="cw-reset-fieldset">
     {field('Aktuelle Pflegesituation', 'situation')}{e.service_kind === '37_3' && <div className="cw-form-grid">{field('Sicht der pflegebedürftigen Person', 'clientPerspective')}{field('Sicht der Pflegeperson', 'caregiverPerspective')}</div>}{field('Belastung, Ressourcen und Entlastungsbedarf', 'burden')}
     <Field label="Besprochene Themen"><div className="cw-topic-grid">{TOPICS.map(topic => <label key={topic} className="cw-topic"><input type="checkbox" checked={answers.topics.includes(topic)} onChange={ev => update('topics', ev.target.checked ? [...answers.topics, topic] : answers.topics.filter(t => t !== topic))}/>{topic}</label>)}</div></Field>
     {field('Tatsächlich gegebene Beratung und Hinweise', 'guidance')}
     {e.service_kind === '37_3' && <SelectField label="Ist die Pflege aus fachlicher Sicht sichergestellt?" value={answers.careSecured} onChange={v => update('careSecured', v as ConsultationAnswers['careSecured'])}><option value="">Bitte einschätzen</option><option value="yes">Ja, sichergestellt</option><option value="partly">Teilweise sichergestellt</option><option value="no">Nicht sichergestellt</option></SelectField>}
     <SelectField label="Handlungsbedarf" value={answers.risk} onChange={v => update('risk', v as ConsultationAnswers['risk'])}><option value="">Bitte einschätzen</option><option value="none">Kein akuter Handlungsbedarf</option><option value="clarify">Klärung erforderlich</option><option value="urgent">Dringender Handlungsbedarf</option></SelectField>
     {answers.risk === 'urgent' && <p className="cw-alert cw-alert-error">Bei einer akuten Gefährdung Hilfe unmittelbar veranlassen. Die Einreichung der Dokumentation ersetzt keine Hilfe vor Ort.</p>}
     {['clarify', 'urgent'].includes(answers.risk) && <>{field('Welche Auffälligkeit wurde festgestellt?', 'riskNotes')}{field('Welche Hilfe wurde veranlasst? Durch wen und wann?', 'riskAction')}</>}
    </fieldset>}
    {section === 'training' && <fieldset disabled={!editable || busy} className="cw-reset-fieldset"><p className="cw-muted">Konkrete Lernziele vereinbaren, Handgriffe anleiten und die Anwendung gemeinsam überprüfen.</p><div className="cw-repeat-list">{answers.goals.map((g, i) => <section key={g.id} className="cw-repeat-item"><div className="cw-between"><h3>Lernziel {i + 1}</h3><button className="cw-link" onClick={() => update('goals', answers.goals.filter(x => x.id !== g.id))}>Entfernen</button></div>{(['title', 'method', 'practice', 'nextStep'] as const).map(k => <TextField key={k} label={{ title: 'Was soll die Pflegeperson danach können?', method: 'Anleitung und verwendete Methode', practice: 'Gemeinsam durchgeführte Übung', nextStep: 'Weiteres Vorgehen / Übungsbedarf' }[k]} value={g[k]} onChange={v => update('goals', answers.goals.map(x => x.id === g.id ? { ...x, [k]: v } : x))} multiline={k !== 'title'}/>)}<SelectField label="Lernergebnis" value={g.result} onChange={v => update('goals', answers.goals.map(x => x.id === g.id ? { ...x, result: v as typeof g.result } : x))}>{Object.entries(LEARNING_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectField></section>)}</div><button className="cw-button" onClick={() => update('goals', [...answers.goals, { id: uid(), title: '', method: '', practice: '', result: '', nextStep: '' }])}>+ Lernziel hinzufügen</button>{field('Übergebene Materialien und Hilfsmittel', 'materials')}</fieldset>}
    {section === 'measures' && <fieldset disabled={!editable || busy} className="cw-reset-fieldset">{field('Gemeinsames Ergebnis des Besuchs', 'summary')}<h3>Empfehlungen und Verantwortlichkeiten</h3><div className="cw-repeat-list">{answers.measures.map((m, i) => <div key={m.id} className="cw-repeat-item"><div className="cw-between"><strong>Empfehlung {i + 1}</strong><button className="cw-link" onClick={() => update('measures', answers.measures.filter(x => x.id !== m.id))}>Entfernen</button></div><TextField label="Was ist zu tun?" value={m.title} onChange={v => update('measures', answers.measures.map(x => x.id === m.id ? { ...x, title: v } : x))}/><div className="cw-form-grid"><TextField label="Verantwortlich" value={m.owner} onChange={v => update('measures', answers.measures.map(x => x.id === m.id ? { ...x, owner: v } : x))}/><TextField label="Bis wann?" type="date" value={m.due} onChange={v => update('measures', answers.measures.map(x => x.id === m.id ? { ...x, due: v } : x))}/></div><SelectField label="Bearbeitungsstand" value={m.status} onChange={v => update('measures', answers.measures.map(x => x.id === m.id ? { ...x, status: v as typeof m.status } : x))}><option value="open">Offen</option><option value="done">Erledigt</option></SelectField><TextField label="Ergebnis / Rückmeldung" value={m.outcome} onChange={v => update('measures', answers.measures.map(x => x.id === m.id ? { ...x, outcome: v } : x))}/></div>)}</div><button className="cw-button" onClick={() => update('measures', [...answers.measures, { id: uid(), title: '', owner: '', due: '', status: 'open', outcome: '' }])}>+ Empfehlung hinzufügen</button><h3>Wiedervorlage</h3><TextField label="Wiedervorlage am" type="date" value={answers.followUpDate} onChange={v => update('followUpDate', v)}/>{field('Anlass und nächster Kontakt', 'followUpNote')}</fieldset>}
    {section === 'confirmation' && <>
     {e.service_kind === '37_3' && <fieldset disabled={!editable || busy} className="cw-reset-fieldset"><SelectField label="Weitergabe von Erkenntnissen an die Pflegekasse" value={answers.findingsConsent} onChange={v => update('findingsConsent', v as ConsultationAnswers['findingsConsent'])}><option value="">Entscheidung dokumentieren</option><option value="yes">Einwilligung liegt vor</option><option value="no">Keine Einwilligung</option></SelectField><p className="cw-muted">Die Entscheidung betrifft die Weitergabe von Erkenntnissen. Die Besuchsbestätigung wird davon getrennt behandelt. Hier wird noch nichts an die Pflegekasse versendet.</p></fieldset>}
     {issues.length > 0 && <div className="cw-checklist"><h3>Noch zu vervollständigen</h3>{issues.map((x, i) => <button key={i} className="cw-checklist-row" onClick={() => setSection(x.section)}><span className="cw-step-dot"/>{x.message}<span>→</span></button>)}</div>}
     {issues.length === 0 && <p className="cw-alert cw-alert-success">Die erforderlichen Angaben sind vollständig. Bitte den Inhalt gemeinsam prüfen.</p>}
     <details className="cw-summary"><summary>Vollständige Dokumentation ansehen</summary><ConsultationDocument answers={answers} client={e.client_snapshot} kind={e.service_kind}/></details>
     {e.can_execute && e.status === 'in_progress' && <button className="cw-button cw-primary" disabled={busy || conflict} onClick={() => void run('finish')}>Besuch jetzt beenden</button>}
     {editable && ['documentation_pending', 'returned'].includes(e.status) && <button className="cw-button cw-primary" disabled={busy || conflict || issues.length > 0} onClick={() => setSignatureContent({ answers: structuredClone(answers), version: versionRef.current })}>Unterschreiben & einreichen</button>}
     {['submitted', 'approved'].includes(e.status) && <p className="cw-alert cw-alert-success">{e.status === 'approved' ? 'Die fachliche Prüfung ist abgeschlossen.' : 'Die Dokumentation wurde zur fachlichen Prüfung eingereicht.'}</p>}
     {revisions.length > 0 && <><h3>Bestätigte Fassungen</h3><div className="cw-revisions">{revisions.map(r => <button className="cw-button" key={r.id} onClick={() => setRevisionId(r.id)}>Fassung {r.version} · {formatDate(r.created_at)}</button>)}</div></>}
    </>}
    <div className="cw-form-footer"><button className="cw-button" disabled={sections.indexOf(section) === 0} onClick={() => setSection(sections[sections.indexOf(section) - 1])}>Zurück</button><div className="cw-actions">{editable && <button className="cw-button" disabled={busy || !dirty || conflict} onClick={() => void run('save', { answers })}>Zwischenspeichern</button>}{section !== 'confirmation' && <button className="cw-button cw-primary" onClick={() => setSection(sections[sections.indexOf(section) + 1])}>Weiter →</button>}</div></div>
   </section>
   {workspace.canReview && e.status === 'submitted' && <section className="cw-panel"><p className="cw-kicker">Fachliche Prüfung</p><h2>Dokumentation beurteilen</h2><p>Die bestätigte Fassung öffnen und auf Vollständigkeit sowie nachvollziehbare Empfehlungen prüfen.</p><div className="cw-actions"><button className="cw-button" onClick={() => setRevisionId(revisions[0]?.id ?? null)} disabled={!revisions.length}>Bestätigte Fassung öffnen</button><button className="cw-button" disabled={busy} onClick={() => { setReason(''); setReasonAction('return'); }}>Rückfrage stellen</button><button className="cw-button cw-primary" disabled={busy} onClick={() => void run('approve')}>Fachlich freigeben</button></div><p className="cw-muted">Eine fachliche Freigabe ist keine Versand- oder Abrechnungsbestätigung.</p></section>}
   <section className="cw-panel"><div className="cw-between"><h2>Verlauf & Rückfragen</h2>{workspace.canManage && ['draft', 'scheduled'].includes(e.status) && <button className="cw-link" disabled={busy} onClick={() => { setReason(''); setReasonAction('cancel'); }}>Termin absagen</button>}</div><div className="cw-message-form"><TextField label="Nachricht zur Besuchsakte" value={message} onChange={setMessage} multiline/><button className="cw-button" disabled={busy || !message.trim() || conflict} onClick={() => void run('comment', { note: message }).then(r => { if (r)
        setMessage(''); })}>In der Akte hinterlegen</button></div><ol className="cw-timeline">{workspace.events.filter(x => x.encounter_id === e.id).map(x => <li key={x.id}><div className="cw-between"><strong>{eventLabel(x.action)}</strong><time>{formatDate(x.created_at)}</time></div><small>{x.actor_label}</small>{x.note && <p>{x.note}</p>}</li>)}</ol></section>
  </div></div>
  {signatureContent && <SignatureDialog key={signatureContent.version} training={e.service_kind === '45'} clientName={e.service_kind === '45' ? (signatureContent.answers.participants[0]?.name ?? '') : e.client_snapshot.name} counselorName={e.employee_name ?? ''} summary={<ConsultationDocument answers={signatureContent.answers} client={e.client_snapshot} kind={e.service_kind}/>} busy={busy} error={error} onClose={() => setSignatureContent(null)} onSubmit={async (signatures) => { const result = await onCommand('submit', { answers: signatureContent.answers, signatures }, { id: e.id, version: signatureContent.version }); if (result) {
        versionRef.current = result.version;
        setBaseVersion(result.version);
        dirtyRef.current = false;
        setDirty(false);
        base.current = signatureContent.answers;
        setAnswers(signatureContent.answers);
        clearConsultationDraft(draftScope, e.id);
        setSignatureContent(null);
    } }}/>}
  {reasonAction && <Dialog title={reasonAction === 'return' ? 'Gezielte Rückfrage' : reasonAction === 'cancel' ? 'Termin absagen' : 'Nicht angetroffen'} onClose={() => setReasonAction(null)} busy={busy}>{reasonAction === 'return' && <SelectField label="Betroffener Abschnitt" value={reviewSection} onChange={v => setReviewSection(v as ConsultationSection)}>{sections.map(s => <option value={s} key={s}>{SECTION_LABELS[s]}</option>)}</SelectField>}<TextField label={reasonAction === 'return' ? 'Was muss ergänzt oder geklärt werden?' : 'Begründung und weiterer Kontakt'} value={reason} onChange={setReason} multiline/>{error && <p className="cw-alert cw-alert-error" role="alert">{error}</p>}<div className="cw-actions"><button className="cw-button" onClick={() => setReasonAction(null)} disabled={busy}>Abbrechen</button><button className="cw-button cw-primary" disabled={busy || !reason.trim()} onClick={() => void run(reasonAction, { note: reason, section: reviewSection }).then(r => { if (r)
        setReasonAction(null); })}>Bestätigen</button></div></Dialog>}
  {discardOpen && <Dialog title="Entwurf noch nicht gespeichert" onClose={() => setDiscardOpen(false)} busy={busy}><p>Speichern Sie Ihre Änderungen vor dem Verlassen der Besuchsakte.</p><div className="cw-actions"><button className="cw-button" onClick={() => setDiscardOpen(false)}>Weiter bearbeiten</button><button className="cw-button cw-primary" disabled={busy || conflict} onClick={() => void run('save', { answers }).then(r => { if (r)
        onBack(); })}>Speichern & zurück</button></div></Dialog>}
  {mergeOpen && <Dialog title="Änderungen abgleichen" onClose={() => setMergeOpen(false)} wide><p>Unabhängige Änderungen werden zusammengeführt. Bei demselben geänderten Feld wählen Sie den Inhalt aus, der übernommen werden soll.</p>{conflicts.map(k => <div className="cw-conflict-field" key={k}><h3>{answerLabel(k)}</h3><div className="cw-form-grid">{(['local', 'remote'] as const).map(source => <label key={source}><input type="radio" name={`conflict-${k}`} checked={choices[k] === source} onChange={() => setChoices(c => ({ ...c, [k]: source }))}/>{source === 'local' ? 'Mein Entwurf' : 'Serverstand'}<pre>{typeof answers[k] === 'string' ? String((source === 'local' ? answers : remote)[k]) : JSON.stringify((source === 'local' ? answers : remote)[k], null, 2)}</pre></label>)}</div></div>)}{conflicts.length === 0 && <p>Es gibt keine widersprüchlichen Feldänderungen.</p>}<button className="cw-button cw-primary" disabled={conflicts.some(k => !choices[k])} onClick={merge}>Auswahl als Entwurf übernehmen</button></Dialog>}
  {revision && <Dialog title={`Bestätigte Fassung ${revision.version}`} onClose={() => setRevisionId(null)} wide><ConsultationDocument answers={normalizeConsultationAnswers(revision.snapshot.answers)} client={revision.snapshot.client} kind={revision.snapshot.service_kind} revision={revision}/><p className="cw-muted">Interne Besuchsdokumentation. Der kassenspezifische Nachweis und dessen Übermittlung sind gesondert zu bearbeiten.</p><button className="cw-button" onClick={() => window.print()}>Drucken / als PDF speichern</button></Dialog>}
 </>;
}
function eventLabel(action: string) { return EVENT_LABELS[action] ?? action; }
function answerLabel(key: string) { return ({ participants: 'Teilnehmende', clientPerspective: 'Sicht der pflegebedürftigen Person', caregiverPerspective: 'Sicht der Pflegeperson', situation: 'Pflegesituation', burden: 'Belastung', topics: 'Themen', guidance: 'Beratung', careSecured: 'Sicherstellung', risk: 'Handlungsbedarf', riskNotes: 'Auffälligkeit', riskAction: 'Veranlasste Hilfe', findingsConsent: 'Weitergabe', goals: 'Lernziele', materials: 'Materialien', measures: 'Empfehlungen', summary: 'Ergebnis', followUpDate: 'Wiedervorlage', followUpNote: 'Anlass' } as Record<string, string>)[key] ?? key; }
function localDate(iso: string | null) { if (!iso)
    return ''; const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function Planning({ encounter: e, workspace, busy, run }: {
    encounter: ConsultationEncounter;
    workspace: ConsultationWorkspace;
    busy: boolean;
    run: (a: ConsultationMutation, d: Record<string, unknown>, version?: number) => Promise<MutationResult | null>;
}) {
    const [planVersion, setPlanVersion] = useState(e.version);
    const [employee, setEmployee] = useState(e.assigned_employee_id ?? '');
    const [start, setStart] = useState(localDate(e.scheduled_start));
    const [end, setEnd] = useState(localDate(e.scheduled_end));
    const [preparation, setPreparation] = useState(e.preparation);
    const [open, setOpen] = useState(e.status === 'draft');
    return <section className="cw-panel"><div className="cw-between"><h2>Termin & Zuweisung</h2><button className="cw-link" aria-expanded={open} onClick={() => { if (!open) {
        setPlanVersion(e.version);
        setEmployee(e.assigned_employee_id ?? '');
        setStart(localDate(e.scheduled_start));
        setEnd(localDate(e.scheduled_end));
        setPreparation(e.preparation);
    } setOpen(v => !v); }}>{open ? 'Schließen' : 'Bearbeiten'}</button></div>{open && <form onSubmit={ev => { ev.preventDefault(); void run('plan', { employee_id: employee, scheduled_start: new Date(start).toISOString(), scheduled_end: new Date(end).toISOString(), preparation }, planVersion).then(r => { if (r)
        setOpen(false); }); }}><fieldset disabled={busy} className="cw-reset-fieldset"><SelectField label="Beratungsperson" value={employee} onChange={setEmployee}><option value="">Bitte auswählen</option>{workspace.employees.map(s => <option value={s.id} key={s.id}>{s.name}{s.qualifications.some(q => q.service_kind === e.service_kind && q.active) ? ' · Freigabe hinterlegt' : ' · Freigabe fehlt'}</option>)}</SelectField><div className="cw-form-grid"><TextField label="Beginn (Ortszeit des Geräts)" type="datetime-local" value={start} onChange={setStart} required/><TextField label="Ende (Ortszeit des Geräts)" type="datetime-local" value={end} onChange={setEnd} required/></div><TextField label="Vorbereitung und Übergabe" value={preparation} onChange={setPreparation} multiline/><p className="cw-muted">Die gültige Freigabe für diese Leistungsart und Terminüberschneidungen werden beim Speichern geprüft.</p><button className="cw-button cw-primary" type="submit" disabled={!employee || !start || !end || busy}>Termin zuweisen</button></fieldset></form>}</section>;
}
