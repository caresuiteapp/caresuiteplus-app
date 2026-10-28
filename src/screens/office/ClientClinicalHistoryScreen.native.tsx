// Generated native presentation from src/screens/office/ClientClinicalHistoryScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CareDateInput } from '@/components/inputs';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { readClientClinicalHistory } from "../../lib/clients/clientClinicalHistoryRepository.supabase.native.ts";
import { recoverClientClinicalHistoryJournal, recordClientClinicalHistoryDurably } from "../../lib/clients/clientClinicalHistoryWorkflow.native.ts";
import type { ClientClinicalDateMeaning, ClientClinicalEntryKind, ClientClinicalHistoryEntry, ClientClinicalHistorySummary, ClientClinicalLegacyCandidate, ClientClinicalRecordState, ClientClinicalVerification, } from '@/types/modules/clientClinicalHistory';
import { radius, spacing, typography } from '@/theme';
const kindLabels: Record<ClientClinicalEntryKind, string> = {
    diagnosis: 'Diagnose', allergy: 'Allergie', intolerance: 'Unverträglichkeit', unresolved_hint: 'Ungeklärter Hinweis',
};
const dateLabels: Record<ClientClinicalDateMeaning, string> = {
    diagnosed_on: 'Diagnosedatum', onset_on: 'Beginn', reported_on: 'Mitteilungsdatum', unknown: 'Datum unbekannt',
};
const verificationLabels: Record<ClientClinicalVerification, string> = {
    unconfirmed: 'nicht bestätigt', provisional: 'vorläufig', confirmed: 'fachlich bestätigt', refuted: 'widerlegt',
};
const stateLabels: Record<ClientClinicalRecordState, string> = { active: 'aktiv', resolved: 'erledigt/abgeklungen', entered_in_error: 'irrtümlich erfasst' };
export function ClientClinicalHistoryScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>();
    const router = useRouter();
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can, check, roleLabel } = usePermissions();
    const [summary, setSummary] = useState<ClientClinicalHistorySummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [superseded, setSuperseded] = useState<ClientClinicalHistoryEntry | null>(null);
    const [legacyOrigin, setLegacyOrigin] = useState<ClientClinicalLegacyCandidate | null>(null);
    const [kind, setKind] = useState<ClientClinicalEntryKind>('diagnosis');
    const [clinicalCode, setClinicalCode] = useState('');
    const [clinicalText, setClinicalText] = useState('');
    const [sourceType, setSourceType] = useState('');
    const [sourceReference, setSourceReference] = useState('');
    const [clinicalDate, setClinicalDate] = useState('');
    const [dateMeaning, setDateMeaning] = useState<ClientClinicalDateMeaning>('unknown');
    const [verification, setVerification] = useState<ClientClinicalVerification>('unconfirmed');
    const [recordState, setRecordState] = useState<ClientClinicalRecordState>('active');
    const scope = useMemo(() => tenantId && id && profile?.id ? { tenantId, clientId: id, actorId: profile.id } : null, [tenantId, id, profile?.id]);
    const allowed = can('office.clients.view') && can('office.clients.view_sensitive') && can('pflege.diagnoses.view');
    const mayWrite = allowed && can('pflege.diagnoses.manage');
    const reload = async () => {
        if (!scope)
            return;
        setLoading(true);
        setError(null);
        const recovery = await recoverClientClinicalHistoryJournal(scope.tenantId, scope.clientId, scope.actorId);
        if (recovery && !recovery.ok)
            setError(`${recovery.error} Der Vorgang wird nicht automatisch wiederholt.`);
        const result = await readClientClinicalHistory(scope.tenantId, scope.clientId, scope.actorId);
        if (result.ok)
            setSummary(result.data);
        else
            setError(result.error);
        setLoading(false);
    };
    useEffect(() => { if (scope && allowed)
        void reload();
    else
        setLoading(false); }, [scope, allowed]);
    if (!allowed)
        return <ScreenShell title="Diagnosen, Allergien und Unverträglichkeiten" showBack onBack={() => router.back()}><LockedActionBanner message={check('pflege.diagnoses.view').reason ?? 'Sensible Leserechte fehlen.'} roleLabel={roleLabel}/></ScreenShell>;
    if (loading && !summary)
        return <ScreenShell title="Diagnosen, Allergien und Unverträglichkeiten" showBack><LoadingState message="Strukturierte Originalhistorie wird geladen…"/></ScreenShell>;
    if (!summary)
        return <ScreenShell title="Diagnosen, Allergien und Unverträglichkeiten" showBack><ErrorState message={error ?? 'Der native klinische Verlauf ist nicht verfügbar.'} onRetry={reload}/></ScreenShell>;
    const selectRevision = (entry: ClientClinicalHistoryEntry) => {
        setLegacyOrigin(null);
        setSuperseded(entry);
        setKind(entry.kind);
        setClinicalCode(entry.clinicalCode ?? '');
        setClinicalText(entry.clinicalText);
        setSourceType(entry.sourceType);
        setSourceReference(entry.sourceReference);
        setClinicalDate(entry.clinicalDate ?? '');
        setDateMeaning(entry.dateMeaning);
        setVerification(entry.verification);
        setRecordState(entry.recordState);
    };
    const selectLegacy = (candidate: ClientClinicalLegacyCandidate) => {
        setSuperseded(null);
        setLegacyOrigin(candidate);
        setKind('unresolved_hint');
        setClinicalCode('');
        setClinicalText(candidate.displayText);
        setSourceType('Geprüftes Legacyoriginal');
        setSourceReference(`${candidate.displayLabel} · ${candidate.originId} · ${candidate.originUpdatedAt}`);
        setClinicalDate('');
        setDateMeaning('unknown');
        setVerification('unconfirmed');
        setRecordState('active');
    };
    const reset = () => { setLegacyOrigin(null); setSuperseded(null); setClinicalCode(''); setClinicalText(''); setSourceType(''); setSourceReference(''); setClinicalDate(''); setDateMeaning('unknown'); setVerification('unconfirmed'); setRecordState('active'); };
    const save = async () => {
        if (!scope || !mayWrite)
            return;
        setBusy(true);
        setError(null);
        const result = await recordClientClinicalHistoryDurably({ ...scope, requestId: crypto.randomUUID(), expectedClientUpdatedAt: summary.clientUpdatedAt,
            supersedesId: superseded?.id ?? null, expectedSupersededUpdatedAt: superseded?.updatedAt ?? null, kind, clinicalCode: clinicalCode.trim() || null,
            clinicalText, sourceType, sourceReference, clinicalDate: dateMeaning === 'unknown' ? null : clinicalDate, dateMeaning, verification, recordState,
            recordedByName: profile?.displayName ?? '', legacyOrigin });
        if (!result.ok)
            setError(`${result.error} Bei unklarem Ausgang wird kein Ersatzdatensatz erzeugt.`);
        else
            reset();
        await reload();
        setBusy(false);
    };
    return <ScreenShell title="Diagnosen, Allergien und Unverträglichkeiten" subtitle={summary.clientName} showBack onBack={() => router.back()} scroll>
    <InfoBanner title="Unbekannt bleibt unbekannt" message="Ein leerer strukturierter Bestand bestätigt weder Diagnosenfreiheit noch Allergiefreiheit. Ältere Freitexthinweise bleiben getrennte Originale und werden nicht automatisch in klinische Datensätze umgedeutet." variant="info" presentation="inline"/>
    {error ? <InfoBanner title="Vorgang gesperrt" message={error} variant="danger" presentation="inline"/> : null}
    <SectionPanel title="Aktueller strukturierter Stand" subtitle="Native Kennungen, Revisionen und Quellen bleiben erhalten">
      {summary.diagnosesState === 'unknown' ? <InfoBanner message="Diagnosen: unbekannt – kein aktueller strukturierter Datensatz bestätigt." variant="info"/> : null}
      {summary.allergiesState === 'unknown' ? <InfoBanner message="Allergien/Unverträglichkeiten: unbekannt – kein aktueller strukturierter Datensatz bestätigt." variant="info"/> : null}
      {summary.current.map((entry) => <Entry key={entry.id} entry={entry} onRevise={mayWrite ? () => selectRevision(entry) : undefined}/>)}
    </SectionPanel>
    <SectionPanel title="Unveränderte Altoriginale zur ausdrücklichen Prüfung" subtitle="Kein Original wird automatisch aufgeteilt, zusammengeführt oder klinisch bestätigt">
      {summary.legacyCandidates.length ? summary.legacyCandidates.map((candidate) => <View key={`${candidate.originKind}:${candidate.originId}:${candidate.originUpdatedAt}`} style={styles.entry}>
        <Text style={styles.entryTitle}>{candidate.displayLabel}</Text><Text selectable style={styles.value}>{candidate.displayText}</Text>
        <Text selectable style={styles.meta}>Original {candidate.originKind} · {candidate.originId} · Mikrosekundenstand {candidate.originUpdatedAt}</Text>
        {candidate.linkedEntryId ? <InfoBanner message={`Bereits ausdrücklich mit strukturiertem Datensatz ${candidate.linkedEntryId} verknüpft. Das ist keine fachliche Bestätigung.`} variant="info"/>
                : mayWrite ? <PremiumButton title="Original in Prüfmaske übernehmen" size="sm" variant="secondary" disabled={busy} onPress={() => selectLegacy(candidate)}/>
                    : null}
      </View>) : <Text style={styles.value}>Keine nichtleeren Altoriginale geliefert. Das bestätigt keine klinische Abwesenheit.</Text>}
    </SectionPanel>
    {mayWrite ? <SectionPanel title={superseded ? 'Neue unveränderliche Fassung' : legacyOrigin ? 'Altoriginal ausdrücklich prüfen und zuordnen' : 'Strukturierten Datensatz erfassen'} subtitle={superseded ? `Vorgänger ${superseded.id} bleibt vollständig erhalten` : legacyOrigin ? 'Die Zuordnung wird nur bei unverändertem vollständigem nativen Original gespeichert' : 'Keine Ableitung aus Freitext oder leerem Bestand'}>
      {legacyOrigin ? <InfoBanner title="Noch keine klinische Bestätigung" message="Art, Text, Datumsbedeutung, Bestätigungsstand und Quelle müssen fachlich geprüft werden. Die Originalverknüpfung verhindert keine spätere Widerlegung oder Korrekturfassung." variant="warning" presentation="inline"/> : null}
      <Text style={styles.label}>Art</Text><Choices values={kindLabels} selected={kind} onSelect={setKind}/>
      <PremiumInput label="Klinischer Code (optional, System im Quellbeleg benennen)" value={clinicalCode} onChangeText={setClinicalCode} onLightSurface viewContext="form"/>
      <PremiumInput label="Klinischer Originaltext" value={clinicalText} onChangeText={setClinicalText} multiline onLightSurface viewContext="form"/>
      <PremiumInput label="Quellenart" value={sourceType} onChangeText={setSourceType} onLightSurface viewContext="form"/>
      <PremiumInput label="Originalbeleg / Quellenreferenz" value={sourceReference} onChangeText={setSourceReference} multiline onLightSurface viewContext="form"/>
      <Text style={styles.label}>Datumsbedeutung</Text><Choices values={dateLabels} selected={dateMeaning} onSelect={setDateMeaning}/>
      {dateMeaning !== 'unknown' ? <CareDateInput label={dateLabels[dateMeaning]} value={clinicalDate} onChange={setClinicalDate} viewContext="form"/> : null}
      <Text style={styles.label}>Fachlicher Bestätigungsstand</Text><Choices values={verificationLabels} selected={verification} onSelect={setVerification}/>
      <Text style={styles.label}>Datensatzstatus</Text><Choices values={stateLabels} selected={recordState} onSelect={setRecordState}/>
      <View style={styles.actions}><PremiumButton title={superseded ? 'Neue Fassung sicher speichern' : legacyOrigin ? 'Geprüfte Zuordnung sicher speichern' : 'Datensatz sicher speichern'} loading={busy} disabled={clinicalText.trim().length < 3 || sourceType.trim().length < 3 || sourceReference.trim().length < 3 || dateMeaning !== 'unknown' && !clinicalDate} onPress={save}/>{superseded || legacyOrigin ? <PremiumButton title="Änderung verwerfen" variant="secondary" disabled={busy} onPress={reset}/> : null}</View>
    </SectionPanel> : <LockedActionBanner message={check('pflege.diagnoses.manage').reason ?? 'Keine aktuelle Berechtigung zum Fortschreiben.'} roleLabel={roleLabel}/>}
    <SectionPanel title="Vollständige unveränderliche Historie" subtitle="Alte Fassungen werden nicht überschrieben oder zusammengeführt">
      {summary.history.length ? summary.history.map((entry) => <Entry key={entry.id} entry={entry}/>) : <Text style={styles.value}>Keine strukturierte Historie geliefert. Das bestätigt keine klinische Abwesenheit.</Text>}
    </SectionPanel>
  </ScreenShell>;
}
function Choices<T extends string>({ values, selected, onSelect }: {
    values: Record<T, string>;
    selected: T;
    onSelect: (value: T) => void;
}) {
    return <View style={styles.choices}>{(Object.entries(values) as [
        T,
        string
    ][]).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: value === selected }} onPress={() => onSelect(value)} style={[styles.choice, value === selected && styles.choiceSelected]}><Text style={[styles.choiceText, value === selected && styles.choiceTextSelected]}>{value === selected ? '✓ ' : ''}{label}</Text></Pressable>)}</View>;
}
function Entry({ entry, onRevise }: {
    entry: ClientClinicalHistoryEntry;
    onRevise?: () => void;
}) {
    return <View style={styles.entry}><Text style={styles.entryTitle}>{kindLabels[entry.kind]} · Revision {entry.revision} · {stateLabels[entry.recordState]}</Text>
    <Text selectable style={styles.value}>{entry.clinicalCode ? `${entry.clinicalCode} · ` : ''}{entry.clinicalText}</Text>
    <Text selectable style={styles.meta}>Quelle: {entry.sourceType} · {entry.sourceReference}</Text>
    <Text style={styles.meta}>{dateLabels[entry.dateMeaning]}: {entry.clinicalDate ?? 'unbekannt'} · Bestätigung: {verificationLabels[entry.verification]}</Text>
    <Text style={styles.meta}>Native ID {entry.id} · Autor: {entry.recordedByName} · Originalzeit {entry.createdAt}</Text>
    {entry.legacyOrigin ? <Text selectable style={styles.meta}>Legacyoriginal: {entry.legacyOrigin.originKind} · {entry.legacyOrigin.originId} · {entry.legacyOrigin.originUpdatedAt}</Text> : null}
    {onRevise ? <PremiumButton title="Neue Fassung erfassen" size="sm" variant="secondary" onPress={onRevise}/> : null}
  </View>;
}
const styles = StyleSheet.create({
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }, choice: { borderWidth: 1, borderColor: '#9CC8F7', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#F5FAFF' },
    choiceSelected: { borderColor: '#056CE8', backgroundColor: '#DCEEFF' }, choiceText: { ...typography.caption, color: '#395571', fontWeight: '700' }, choiceTextSelected: { color: '#045BBF' },
    label: { ...typography.label, color: '#09213F', marginTop: spacing.sm, marginBottom: spacing.xs }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    entry: { gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#BBD5EE', paddingVertical: spacing.md }, entryTitle: { ...typography.bodyStrong, color: '#09213F' }, value: { ...typography.body, color: '#274967' }, meta: { ...typography.caption, color: '#55718E' },
});
