// Generated native presentation from src/components/pflege/WoundAssessmentComparison.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorState, FilterChip, InfoBanner, PremiumButton, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { captureWoundComparisonOriginals, compareWoundAssessments, sameWoundComparisonOriginal, type WoundComparisonOriginals } from "../../lib/pflege/woundAssessmentComparison.native.ts";
type Props = {
    source: WoundComparisonOriginals;
    tenantId: string;
    profileId: string;
    profileRole: string | null;
    runtimeTenantId: string | null;
    runtimeRole: string | null;
    woundId: string;
    canRead: boolean;
    readBlocked: boolean;
    readTicket: symbol | null;
    isCurrentReceipt: (ticket: symbol, source: WoundComparisonOriginals) => boolean;
};
const display = (v: unknown) => v === undefined ? 'Nicht im Original enthalten' : v === null ? 'Original: null' : typeof v === 'string' ? (v || 'Original: leere Angabe') : JSON.stringify(v);
const issue: Record<string, string> = { unknown: 'Angaben nicht bestätigt', not_measurable: 'Nicht messbar / nicht beurteilbar', inconsistent: 'Originalangaben widersprechen sich', different_method: 'Unterschiedliche Messmethoden', corrected: 'Berichtigung betrifft diesen Vergleich' };
const named = { length: 'Länge', width: 'Breite', depth: 'Tiefe' };
export function WoundAssessmentComparison(props: Props) {
    const { c } = useCareLightPalette(), styles = StyleSheet.create({ body: { ...typography.body, color: c.text }, note: { ...typography.caption, color: c.muted }, raw: { ...typography.caption, color: c.text }, group: { gap: spacing.sm, minWidth: 0 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 }, pair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, minWidth: 0 }, column: { flexBasis: 280, flexGrow: 1, minWidth: 0 }, line: { gap: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: c.border } });
    const [owner] = useState(() => ({ tenantId: props.tenantId, profileId: props.profileId, profileRole: props.profileRole, woundId: props.woundId, clientId: props.source.row.client_id }));
    const alive = useRef(true), latest = useRef(props);
    latest.current = props;
    const [selection, setSelection] = useState<{
        ticket: symbol;
        left: string;
        right: string;
        showRaw: boolean;
    } | null>(null), [error, setError] = useState<string | null>(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    function current() { const p = latest.current; if (!alive.current || ![owner.tenantId, owner.profileId, owner.woundId, owner.clientId].every(woundUuid) || !owner.profileRole || p.tenantId !== owner.tenantId || p.profileId !== owner.profileId || p.profileRole !== owner.profileRole || p.runtimeRole !== owner.profileRole || p.runtimeTenantId !== owner.tenantId || p.woundId !== owner.woundId || p.source.row.client_id !== owner.clientId || p.canRead !== true || p.readBlocked || !p.readTicket || !p.isCurrentReceipt(p.readTicket, p.source))
        throw Error('Aktueller eigener vollständiger Wund-Lesestand ist nicht verfügbar.'); return p; }
    const scope = { tenantId: owner.tenantId, clientId: String(owner.clientId), woundId: owner.woundId };
    let originals: WoundComparisonOriginals | null = null, readError: string | null = null;
    try {
        originals = captureWoundComparisonOriginals(current().source, scope);
    }
    catch (e) {
        readError = e instanceof Error ? e.message : 'Originalbefunde erneut vollständig laden.';
    }
    const renderOriginals = originals, renderTicket = props.readTicket;
    function active() { const p = current(); if (!renderOriginals || renderTicket !== p.readTicket || !sameWoundComparisonOriginal(renderOriginals, p.source))
        throw Error('Originalstand für diese Auswahl geändert. Vergleich neu auswählen.'); return captureWoundComparisonOriginals(p.source, scope); }
    function select(side: 'left' | 'right', id: string) { try {
        const source = active();
        if (!source.assessments.some(a => a.id === id))
            throw Error('Native Befundkennung fehlt.');
        setSelection(s => ({ ticket: renderTicket!, left: s?.ticket === renderTicket ? s.left : '', right: s?.ticket === renderTicket ? s.right : '', showRaw: false, [side]: id }));
        setError(null);
    }
    catch (e) {
        if (alive.current)
            setError(e instanceof Error ? e.message : 'Originalbefunde neu auswählen.');
    } }
    function toggleRaw() { try {
        active();
        setSelection(s => s?.ticket === renderTicket ? { ...s, showRaw: !s.showRaw } : s);
    }
    catch { } }
    const selected = selection?.ticket === renderTicket && originals ? selection : null;
    let comparison: ReturnType<typeof compareWoundAssessments> | null = null;
    if (selected?.left && selected.right && originals)
        try {
            comparison = compareWoundAssessments(originals, selected.left, selected.right, scope);
        }
        catch (e) {
            readError = e instanceof Error ? e.message : 'Befundpaar prüfen.';
        }
    return <SectionPanel title="Zwei Originalbefunde gegenüberstellen" subtitle="Technischer Vergleich ohne Verlaufsbewertung oder fachliche Freigabe"><View style={styles.group}>
  <InfoBanner variant="info" message="Befunde ausdrücklich auswählen. Gleiche Zahlen oder Texte bestätigen keine Heilung, Diagnose, Infektion, Behandlung oder Erledigung. Berichtigungen bleiben eigenständige Originalbelege. Bilder werden nicht geladen; vorhandene Referenzen sind nur Originalmetadaten."/>
  {readError || error ? <ErrorState message={readError ?? error ?? 'Originalstand prüfen.'}/> : null}
  {originals ? <>
   {originals.assessments.length < 2 ? <InfoBanner variant="info" message="Für einen Vergleich fehlen zwei eigenständige tatsächlich dokumentierte Originalbefunde."/> : null}
   {(['left', 'right'] as const).map(side => <View key={side} style={styles.group}><Text style={styles.body}>{side === 'left' ? 'Befund A ausdrücklich auswählen' : 'Befund B ausdrücklich auswählen'}</Text><View style={styles.choices}>{originals.assessments.map(a => <FilterChip key={String(a.id)} style={{ maxWidth: '100%', flexShrink: 1 }} label={`${String(a.id)} · Beobachtet ${display(a.observed_at)} · Erfasst ${display(a.created_at)}`} selected={selected?.[side] === a.id} onPress={() => select(side, String(a.id))}/>)}</View></View>)}
  </> : null}
  {comparison ? <>
   <Text style={styles.note}>Beobachtungsreihenfolge: {comparison.observation.order === 'same_instant' ? 'Gleicher exakter Zeitpunkt – keine Reihenfolge aus Kennungen abgeleitet' : comparison.observation.order === 'left_before_right' ? 'A vor B' : comparison.observation.order === 'right_before_left' ? 'B vor A' : 'Nicht bestätigt'}{comparison.observation.issues.length ? ` · ${comparison.observation.issues.map(i => issue[i]).join('; ')}` : ''}</Text>
   <View style={styles.pair}>{([['A', comparison.left, comparison.leftCorrections], ['B', comparison.right, comparison.rightCorrections]] as const).map(([label, a, corrections]) => <View key={label} style={styles.column}><Text style={styles.body}>Befund {label}: {String(a.id)}</Text><Text style={styles.note}>Mandant: {String(a.tenant_id)} · Pflegefall: {String(a.client_id)} · Wundfall: {String(a.wound_case_id)}</Text><Text style={styles.body}>Beobachtet: {display(a.observed_at)}</Text><Text style={styles.body}>Erfasst: {display(a.created_at)} · ursprüngliches assessed_at: {display(a.assessed_at)}</Text><Text style={styles.body}>Originalautor: {display(a.recorded_by_name)} ({display(a.recorded_by)})</Text><Text style={styles.body}>Messmethode: {display((a.documentation_details as Record<string, unknown> | null)?.measurementMethod)}</Text><Text style={styles.note}>Weitere geplante Kontrolle: {display((a.documentation_details as Record<string, unknown> | null)?.nextReviewAt)} · Abstimmung: {display((a.documentation_details as Record<string, unknown> | null)?.reviewStatus)}</Text><Text style={styles.note}>{corrections.length} eigenständige Berichtigungsvermerke; keine Ersetzung des Originalbefunds.</Text></View>)}</View>
   {comparison.measures.map(m => <View key={m.key} style={styles.line}><Text style={styles.body}>{named[m.key]} · {m.state === 'not_comparable' ? m.issues.map(i => issue[i]).join('; ') : m.state === 'same_values' ? 'Gleiche gespeicherte Messwerte – keine Verlaufsbewertung' : 'Unterschiedliche gespeicherte Messwerte – fachlich ungeklärt'}</Text>{([['A', m.left], ['B', m.right]] as const).map(([label, v]) => <Text key={label} style={styles.body}>{label}: {display(v.value)} cm · Originaleingabe {display(v.raw)} · Messbarkeit {display(v.state)} · Begründung {display(v.reason)}</Text>)}</View>)}
   <View style={styles.line}><Text style={styles.body}>Schmerzerhebung · {comparison.pain.state === 'not_comparable' ? comparison.pain.issues.map(i => issue[i]).join('; ') : comparison.pain.state === 'same_values' ? 'Gleiche gespeicherte NRS-Werte' : 'Unterschiedliche gespeicherte NRS-Werte – keine Wirkungsbewertung'}</Text>{([['A', comparison.pain.left], ['B', comparison.pain.right]] as const).map(([label, v]) => <Text key={label} style={styles.body}>{label}: {display(v.value)} · Skala / Erhebung {display(v.state)} · Originaleingabe {display(v.raw)} · Begründung {display(v.reason)}</Text>)}</View>
   {(['infectionObservation', 'actualAction', 'response', 'reviewPendingReason', 'personalImpact', 'preferences', 'selfManagement'] as const).map(k => <View key={k} style={styles.line}><Text style={styles.body}>{({ infectionObservation: 'Infektionsbeobachtung', actualAction: 'Dokumentierte tatsächliche Reaktion', response: 'Dokumentiertes Ergebnis', reviewPendingReason: 'Offene Kontrollabstimmung', personalImpact: 'Persönliche Auswirkungen', preferences: 'Wünsche und Entscheidungen', selfManagement: 'Ressourcen und Unterstützungsbedarf' } as Record<string, string>)[k]}</Text><Text style={styles.body}>A strukturiert: {display((comparison.left.documentation_details as Record<string, unknown> | null)?.[k])}</Text><Text style={styles.body}>B strukturiert: {display((comparison.right.documentation_details as Record<string, unknown> | null)?.[k])}</Text>{k === 'infectionObservation' || k === 'actualAction' || k === 'response' ? <><Text style={styles.note}>A ursprüngliches Tabellenfeld: {display(comparison.left[({ infectionObservation: 'infection_signs', actualAction: 'intervention', response: 'response' } as Record<string, string>)[k]])}</Text><Text style={styles.note}>B ursprüngliches Tabellenfeld: {display(comparison.right[({ infectionObservation: 'infection_signs', actualAction: 'intervention', response: 'response' } as Record<string, string>)[k]])}</Text></> : null}</View>)}
   {[...comparison.leftCorrections, ...comparison.rightCorrections].map(correction => <View key={String(correction.id)} style={styles.line}><Text style={styles.body}>Berichtigung {String(correction.id)} · Befund {String(correction.assessment_id)} · Fassung {String(correction.version)} · Abschnitt {String(correction.section)}</Text><Text style={styles.note}>{String(correction.created_at)} · {String(correction.recorded_by_name)} ({String(correction.recorded_by)})</Text><Text style={styles.body}>{String(correction.corrected_statement)}</Text><Text style={styles.body}>Grund: {String(correction.reason)} · Grundlage: {String(correction.evidence_basis)}</Text><Text style={styles.body}>Auswirkung: {String(correction.clinical_impact)} · Rücksprache: {String(correction.communication)} · Person: {String(correction.person_decision)}</Text></View>)}
   <Text style={styles.note}>Geplanter Fall-Kontrolltermin: {display(comparison.originals.row.next_review_at)}. Ein Plantermin ist kein tatsächliches Ereignis oder Aufgabenabschluss.</Text>
   <PremiumButton variant="secondary" title={selected?.showRaw ? 'Vollständige Originalbelege ausblenden' : 'Vollständige Originalbelege anzeigen'} onPress={toggleRaw}/>
   {selected?.showRaw ? <Text selectable style={styles.raw}>{JSON.stringify({ woundCase: comparison.originals.row, befundA: comparison.left, befundB: comparison.right, berichtigungenA: comparison.leftCorrections, berichtigungenB: comparison.rightCorrections }, null, 2)}</Text> : null}
  </> : null}
 </View></SectionPanel>;
}
