// Generated native presentation from src/components/pflege/MedicationSourceComparison.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorState, FilterChip, InfoBanner, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import type { RoleKey } from '@/types';
import type { MedicationDocumentation } from '@/lib/pflege/medicationAdministrationService';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { sameMedicationListOriginal } from "../../lib/pflege/medicationListOriginal.native.ts";
import { compareMedicationSourceOriginal, type MedicationComparisonOriginals } from "../../lib/pflege/medicationSourceComparison.native.ts";
import { readMedicationComparisonOriginals } from "../../lib/pflege/medicationSourceComparisonRead.native.ts";
type Props = {
    order: MedicationDocumentation;
    tenantId: string;
    actorId: string;
    role: RoleKey | null;
    profileRole: RoleKey | null;
    canView: boolean;
    canSources: boolean;
    readBlocked: boolean;
};
const display = (v: unknown) => v === undefined ? 'Feld nicht im Original enthalten' : v === null ? 'Original: null' : typeof v === 'string' ? (v || 'Original: leere Angabe') : typeof v === 'boolean' ? (v ? 'Ja' : 'Nein') : JSON.stringify(v);
export function MedicationSourceComparison(props: Props) {
    const { c: palette } = useCareLightPalette(), styles = StyleSheet.create({ body: { ...typography.body, color: palette.text }, note: { ...typography.caption, color: palette.muted }, row: { gap: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: palette.border }, original: { ...typography.caption, color: palette.text }, actions: { gap: spacing.sm, minWidth: 0 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 } });
    const [owner] = useState(() => ({ tenantId: props.tenantId, actorId: props.actorId, profileRole: props.profileRole, id: props.order.id, clientId: props.order.clientId }));
    const alive = useRef(true), flight = useRef(false), boundary = useRef({ scope: '', ticket: Symbol('original read') });
    const latest = useRef(props);
    latest.current = props;
    const key = JSON.stringify([props.tenantId, props.actorId, props.role, props.profileRole, props.order.id, props.order.clientId, props.order.updatedAt, props.canView, props.canSources, props.readBlocked]);
    if (boundary.current.scope !== key)
        boundary.current = { scope: key, ticket: Symbol('original read') };
    const [loaded, setLoaded] = useState<{
        ticket: symbol;
        context: Props;
        originals: MedicationComparisonOriginals;
    } | null>(null), [selectedId, setSelectedId] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [showRaw, setShowRaw] = useState(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; boundary.current = { scope: 'disposed', ticket: Symbol('disposed') }; }; }, []);
    function current() { const p = latest.current; if (!alive.current || ![owner.tenantId, owner.actorId, owner.id, owner.clientId].every(woundUuid) || !owner.profileRole || p.tenantId !== owner.tenantId || p.actorId !== owner.actorId || p.profileRole !== owner.profileRole || p.role !== owner.profileRole || p.order.tenantId !== owner.tenantId || p.order.id !== owner.id || p.order.clientId !== owner.clientId || !p.canView || !p.canSources || p.readBlocked)
        throw Error('Aktuellen eigenen Quellenlesebezug bestätigen.'); return p; }
    function visible() { try {
        const p = current();
        return loaded && loaded.ticket === boundary.current.ticket && sameMedicationListOriginal(loaded.context, p) && loaded.originals.currentOrder.updated_at === p.order.updatedAt ? loaded.originals : null;
    }
    catch {
        return null;
    } }
    async function read() {
        if (flight.current)
            return;
        let captured: Props;
        try {
            captured = current();
        }
        catch {
            return;
        }
        const originalProps = structuredClone(captured);
        const ticket = Symbol('explicit original read');
        boundary.current = { scope: key, ticket };
        flight.current = true;
        setBusy(true);
        setError(null);
        setLoaded(null);
        setSelectedId('');
        setShowRaw(false);
        const isCurrent = () => { try {
            return boundary.current.ticket === ticket && sameMedicationListOriginal(originalProps, current());
        }
        catch {
            return false;
        } };
        try {
            const originals = await readMedicationComparisonOriginals({ tenantId: captured.tenantId, clientId: captured.order.clientId, medicationId: captured.order.id }, captured.role, isCurrent);
            if (!isCurrent())
                return;
            if (originals.currentOrder.updated_at !== captured.order.updatedAt)
                throw Error('Der aktuelle Verordnungsstand wurde geändert. Die Medikationsansicht zuerst aktualisieren.');
            setLoaded({ ticket, context: originalProps, originals });
        }
        catch (e) {
            if (isCurrent())
                setError(e instanceof Error ? e.message : 'Originalstände erneut lesen.');
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    function selectSource(id: string) { const originals = visible(); if (!originals || flight.current)
        return; try {
        compareMedicationSourceOriginal(originals, id, { tenantId: owner.tenantId, clientId: owner.clientId, medicationId: owner.id });
        setSelectedId(id);
        setShowRaw(false);
        setError(null);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Native Quelle erneut auswählen.');
    } }
    const originals = visible();
    let comparison: ReturnType<typeof compareMedicationSourceOriginal> | null = null, comparisonError: string | null = null;
    if (originals && selectedId) {
        try {
            comparison = compareMedicationSourceOriginal(originals, selectedId, { tenantId: owner.tenantId, clientId: owner.clientId, medicationId: owner.id });
        }
        catch (e) {
            comparisonError = e instanceof Error ? e.message : 'Originalbeleg nicht vergleichbar.';
        }
    }
    return <SectionPanel title="Gespeicherte Verordnungsstände vergleichen" subtitle="Lesende Gegenüberstellung als Vorbereitung des Medikationsabgleichs">
  <View style={styles.actions}>
   <InfoBanner variant="info" message="Eine Quellenzuordnung und gleiche Versionszeiten bestätigen keinen fachlich durchgeführten Medikationsabgleich. Unterschiede bleiben ungeklärt; es wird keine Verordnung übernommen oder freigegeben. Der historische Allergiestand ist nicht nachgewiesen."/>
   <PremiumButton title={busy ? 'Originalstände werden gelesen…' : 'Originalstände für den Vergleich lesen'} disabled={busy || !props.canView || !props.canSources || props.readBlocked} onPress={read}/>
   {busy ? <LoadingState message="Aktuelle Verordnung und vollständige native Quellenzuordnungen werden gelesen…"/> : null}
   {error || comparisonError ? <ErrorState message={error ?? comparisonError ?? 'Originalstände prüfen.'}/> : null}
   {originals ? originals.sources.length ? <View style={styles.choices}>{originals.sources.map(s => <FilterChip key={String(s.id)} label={`${String((s.document_snapshot as Record<string, unknown>).title)} · ${String((s.order_snapshot as Record<string, unknown>).updated_at)} · ${String(s.id)}`} selected={selectedId === s.id} style={{ maxWidth: '100%', flexShrink: 1 }} onPress={() => selectSource(String(s.id))}/>)}</View> : <Text style={styles.note}>Im vollständig gelesenen Quellenbestand dieser Verordnung sind keine Zuordnungen enthalten. Ein Medikationsabgleich ist dadurch nicht nachgewiesen.</Text> : null}
   {comparison ? <View style={styles.actions}>
    <Text style={styles.note}>Verordnung: {String(comparison.currentOrder.id)} · aktueller Stand {String(comparison.currentOrder.updated_at)}</Text>
    <Text style={styles.note}>Ausgewählte Zuordnung: {String(comparison.selected.id)} · Dokument {String(comparison.selected.document_id)} · damaliger Verordnungsstand {String((comparison.selected.order_snapshot as Record<string, unknown>).updated_at)}</Text>
    <Text style={styles.note}>Originalautor: {String(comparison.selected.recorded_by_name)} ({String(comparison.selected.recorded_by)}) · Erfasst {String(comparison.selected.created_at)}</Text>
    <InfoBanner variant={comparison.changedFields.length || comparison.unknownFields.length ? 'warning' : 'info'} message={`${comparison.changedFields.length} unterschiedliche Fachangaben, ${comparison.unknownFields.length} beidseitig nicht vollständig vorhandene Felder. ${comparison.sameRawVersion ? 'Die rohen Versionszeiten sind gleich.' : 'Die rohen Versionszeiten unterscheiden sich.'} Fachliche Klärung und Abgleich sind nicht dokumentiert.`}/>
    {comparison.fields.map(f => <View key={f.key} style={styles.row}><Text style={styles.body}>{f.label} · {f.state === 'different' ? 'Unterschied ungeklärt' : f.state === 'unknown' ? 'Originalfeld nicht vollständig vorhanden' : 'Gleiche gespeicherte Angabe'}</Text><Text style={styles.body}>Aktuell: {display(f.current)}</Text><Text style={styles.body}>Damals: {display(f.historical)}</Text></View>)}
    <PremiumButton title={showRaw ? 'Vollständige Originalbelege ausblenden' : 'Vollständige Originalbelege anzeigen'} variant="secondary" onPress={() => { if (visible() && !flight.current)
            setShowRaw(v => !v); }}/>
    {showRaw ? <><Text selectable style={styles.original}>{JSON.stringify(comparison.currentOrder, null, 2)}</Text><Text selectable style={styles.original}>{JSON.stringify(comparison.selected, null, 2)}</Text></> : null}
   </View> : null}
  </View>
 </SectionPanel>;
}
