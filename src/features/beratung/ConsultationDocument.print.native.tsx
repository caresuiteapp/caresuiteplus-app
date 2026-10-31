// Generated document markup from ConsultationDocument.web.tsx. Used only by nativePrintMarkup.
import { KIND_LABELS, LEARNING_LABELS, type ConsultationAnswers, type ConsultationClient, type ConsultationKind, type ConsultationRevision } from '../../lib/beratung/workspaceModel';
export function ConsultationDocument({ answers: a, client, kind, revision }: {
    answers: ConsultationAnswers;
    client: ConsultationClient;
    kind: ConsultationKind;
    revision?: ConsultationRevision;
}) {
    const rows: [
        string,
        string
    ][] = [['Pflegesituation', a.situation], ['Sicht der pflegebedürftigen Person', a.clientPerspective], ['Sicht der Pflegeperson', a.caregiverPerspective], ['Belastung und Ressourcen', a.burden], ['Beratung', a.guidance], ['Handlungsbedarf', ({ none: 'Kein akuter Handlungsbedarf', clarify: 'Klärung erforderlich', urgent: 'Dringender Handlungsbedarf' } as Record<string, string>)[a.risk] ?? 'Offen'], ['Auffälligkeiten', a.riskNotes], ['Veranlasste Hilfe', a.riskAction], ['Sicherstellung der Pflege', ({ yes: 'Gesichert', partly: 'Teilweise gesichert', no: 'Nicht gesichert' } as Record<string, string>)[a.careSecured] ?? ''], ['Weitergabe von Erkenntnissen', a.findingsConsent === 'yes' ? 'Einwilligung dokumentiert' : a.findingsConsent === 'no' ? 'Keine Einwilligung' : ''], ['Materialien', a.materials], ['Gemeinsames Ergebnis', a.summary], ['Wiedervorlage', [a.followUpDate, a.followUpNote].filter(Boolean).join(' · ')]];
    return <article className="cw-document"><p className="cw-kicker">{KIND_LABELS[kind]} · Dokumentation</p><h2>{client.name}</h2><p>{client.address}</p>
  <h3>Teilnehmende</h3><ul>{a.participants.map(p => <li key={p.id}>{p.name} · {p.role}{p.authority ? ` · ${p.authority}` : ''}</li>)}</ul>
  {a.topics.length > 0 && <p><strong>Themen:</strong> {a.topics.join(', ')}</p>}
  <dl>{rows.filter(([, v]) => v).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  {a.goals.length > 0 && <><h3>Lernziele und Durchführung</h3>{a.goals.map((g, i) => <section key={g.id}><h4>{i + 1}. {g.title}</h4><p><strong>Anleitung:</strong> {g.method}</p><p><strong>Übung:</strong> {g.practice}</p><p><strong>Lernergebnis:</strong> {LEARNING_LABELS[g.result]}</p>{g.nextStep && <p><strong>Weiteres Vorgehen:</strong> {g.nextStep}</p>}</section>)}</>}
  {a.measures.length > 0 && <><h3>Empfehlungen</h3><ul>{a.measures.map(m => <li key={m.id}><strong>{m.title}</strong> · {m.owner} · bis {m.due} · {m.status === 'done' ? 'erledigt' : 'offen'}{m.outcome && ` · ${m.outcome}`}</li>)}</ul></>}
  {revision && <><h3>Bestätigte Fassung {revision.version}</h3><p>{new Date(revision.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} · Besuch {new Date(revision.snapshot.actual_start).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} bis {new Date(revision.snapshot.actual_end).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })}</p><div className="cw-form-grid">{revision.snapshot.signatures.map(s => <div key={s.role}><img className="cw-signature-image" src={s.image} alt={`Unterschrift ${s.name}`}/><p>{s.name} · {s.role === 'counselor' ? 'Beratungsperson' : s.role === 'client' ? 'Pflegebedürftige Person' : s.role === 'participant' ? 'Teilnehmende Pflegeperson' : 'Vertretung'}{s.authority && ` · ${s.authority}`}</p></div>)}</div><small className="cw-hash">Inhaltsprüfsumme (SHA-256): {revision.content_hash}</small></>}
 </article>;
}
