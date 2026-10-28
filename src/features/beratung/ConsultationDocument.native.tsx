// Generated native presentation from src/features/beratung/ConsultationDocument.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeArticle,NativeP,NativeH2,NativeH3,NativeUl,NativeLi,NativeStrong,NativeDl,NativeDiv,NativeDt,NativeDd,NativeSection,NativeH4,NativeImg,NativeSmall} from '@/components/layout/NativeWorkspaceElements.native';
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
    return <NativeArticle className="cw-document"><NativeP className="cw-kicker">{KIND_LABELS[kind]} · Dokumentation</NativeP><NativeH2>{client.name}</NativeH2><NativeP>{client.address}</NativeP>
  <NativeH3>Teilnehmende</NativeH3><NativeUl>{a.participants.map(p => <NativeLi key={p.id}>{p.name} · {p.role}{p.authority ? ` · ${p.authority}` : ''}</NativeLi>)}</NativeUl>
  {a.topics.length > 0 && <NativeP><NativeStrong>Themen:</NativeStrong> {a.topics.join(', ')}</NativeP>}
  <NativeDl>{rows.filter(([, v]) => v).map(([label, value]) => <NativeDiv key={label}><NativeDt>{label}</NativeDt><NativeDd>{value}</NativeDd></NativeDiv>)}</NativeDl>
  {a.goals.length > 0 && <><NativeH3>Lernziele und Durchführung</NativeH3>{a.goals.map((g, i) => <NativeSection key={g.id}><NativeH4>{i + 1}. {g.title}</NativeH4><NativeP><NativeStrong>Anleitung:</NativeStrong> {g.method}</NativeP><NativeP><NativeStrong>Übung:</NativeStrong> {g.practice}</NativeP><NativeP><NativeStrong>Lernergebnis:</NativeStrong> {LEARNING_LABELS[g.result]}</NativeP>{g.nextStep && <NativeP><NativeStrong>Weiteres Vorgehen:</NativeStrong> {g.nextStep}</NativeP>}</NativeSection>)}</>}
  {a.measures.length > 0 && <><NativeH3>Empfehlungen</NativeH3><NativeUl>{a.measures.map(m => <NativeLi key={m.id}><NativeStrong>{m.title}</NativeStrong> · {m.owner} · bis {m.due} · {m.status === 'done' ? 'erledigt' : 'offen'}{m.outcome && ` · ${m.outcome}`}</NativeLi>)}</NativeUl></>}
  {revision && <><NativeH3>Bestätigte Fassung {revision.version}</NativeH3><NativeP>{new Date(revision.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} · Besuch {new Date(revision.snapshot.actual_start).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} bis {new Date(revision.snapshot.actual_end).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })}</NativeP><NativeDiv className="cw-form-grid">{revision.snapshot.signatures.map(s => <NativeDiv key={s.role}><NativeImg className="cw-signature-image" src={s.image} alt={`Unterschrift ${s.name}`}/><NativeP>{s.name} · {s.role === 'counselor' ? 'Beratungsperson' : s.role === 'client' ? 'Pflegebedürftige Person' : s.role === 'participant' ? 'Teilnehmende Pflegeperson' : 'Vertretung'}{s.authority && ` · ${s.authority}`}</NativeP></NativeDiv>)}</NativeDiv><NativeSmall className="cw-hash">Inhaltsprüfsumme (SHA-256): {revision.content_hash}</NativeSmall></>}
 </NativeArticle>;
}
