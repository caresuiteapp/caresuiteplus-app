import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MedicationDetailHero } from '@/components/pflege/MedicationDetailHero';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { DetailInfoRow } from '@/components/detail';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumBadge, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchMedicationDetail } from '@/lib/pflege/medicationDetailService';
import { fetchMedicationWitnessOptions, recordMedicationAdministration, setLiveMedicationStatus } from '@/lib/pflege/medicationLiveService';
import type { MedicationAdministrationStatus, MedicationStatus } from '@/types/modules/pflege';
import { spacing, typography, colors } from '@/theme';

const administrationStatuses = [
  { key: 'administered', label: 'Verabreicht' }, { key: 'omitted', label: 'Ausgelassen' },
  { key: 'refused', label: 'Abgelehnt' }, { key: 'held', label: 'Zurückgestellt' }, { key: 'late', label: 'Verspätet' },
];
const administrationLabels: Record<string, string> = { scheduled: 'Geplant', administered: 'Verabreicht', omitted: 'Ausgelassen', refused: 'Abgelehnt', held: 'Zurückgestellt', late: 'Verspätet' };

export function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const [administrationStatus, setAdministrationStatus] = useState<MedicationAdministrationStatus>('administered');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState('');
  const [deviationReason, setDeviationReason] = useState('');
  const [prnReason, setPrnReason] = useState('');
  const [effectEvaluation, setEffectEvaluation] = useState('');
  const [painBefore, setPainBefore] = useState('');
  const [painAfter, setPainAfter] = useState('');
  const [notes, setNotes] = useState('');
  const [witnessId, setWitnessId] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => tenantId && id ? fetchMedicationDetail(id, tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, id, profile?.roleKey], { enabled: !!tenantId && !!id },
  );
  const witnesses = useAsyncQuery(
    () => tenantId ? fetchMedicationWitnessOptions(tenantId, profile?.id ?? null, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.id, profile?.roleKey], { enabled: !!tenantId && !!query.data?.isControlledSubstance },
  );
  const detail = query.data;

  async function saveAdministration() {
    if (!tenantId || !detail || saving) return;
    setSaving(true); setActionError(null); setSuccess(null);
    const result = await recordMedicationAdministration(detail, tenantId, profile?.id ?? null, {
      status: administrationStatus === 'scheduled' ? 'administered' : administrationStatus,
      dose, route, deviationReason, prnReason, effectEvaluation,
      painScoreBefore: painBefore ? Number(painBefore) : null, painScoreAfter: painAfter ? Number(painAfter) : null,
      notes, witnessProfileId: witnessId || null,
    }, profile?.roleKey);
    setSaving(false);
    if (!result.ok) { setActionError(result.error); return; }
    setSuccess('Gabe bzw. Abweichung wurde revisionssicher dokumentiert.');
    setDeviationReason(''); setPrnReason(''); setEffectEvaluation(''); setPainBefore(''); setPainAfter(''); setNotes('');
    await query.refresh();
  }

  async function changeStatus(next: MedicationStatus) {
    if (!tenantId || !detail || saving) return;
    setSaving(true); setActionError(null); setSuccess(null);
    const result = await setLiveMedicationStatus(detail.id, tenantId, next, profile?.id ?? null, profile?.roleKey);
    setSaving(false);
    if (!result.ok) { setActionError(result.error); return; }
    setSuccess(next === 'active' ? 'Verordnung wurde aktiviert.' : next === 'paused' ? 'Verordnung wurde pausiert.' : 'Verordnung wurde beendet.');
    await query.refresh();
  }

  if (query.loading && !detail) return <ScreenShell title="Medikation"><LoadingState message="Verordnung und Gabennachweise werden geladen…" /></ScreenShell>;
  if (query.error || !detail) return <ScreenShell title="Medikation" subtitle="Fehler"><ErrorState message={query.error ?? 'Verordnung nicht gefunden.'} onRetry={query.refresh} /><PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} /></ScreenShell>;

  return (
    <ScreenShell title="Medikation" subtitle={`${detail.medicationName} · ${roleLabel ?? 'Pflegefachkraft'}`}>
      <ScrollView contentContainerStyle={styles.content}>
        <MedicationDetailHero detail={detail} roleKey={roleKey} isReadOnly={isReadOnly} />
        {detail.clientAllergies ? <InfoBanner variant="warning" title="Allergien / Unverträglichkeiten" message={detail.clientAllergies} /> : null}
        {detail.interactionNotes ? <InfoBanner variant="warning" title="Wechselwirkungen beachten" message={detail.interactionNotes} /> : null}
        {actionError ? <ErrorState message={actionError} /> : null}
        {success ? <SuccessState message={success} /> : null}

        <SectionPanel title="Verordnung" subtitle="Ärztliche Grundlage und Gabeplan">
          <DetailInfoRow label="Klient:in" value={detail.clientName} /><DetailInfoRow label="Präparat" value={detail.medicationName} />
          <DetailInfoRow label="Wirkstoff / Stärke" value={[detail.activeIngredient, detail.strength].filter(Boolean).join(' · ') || 'Nicht angegeben'} />
          <DetailInfoRow label="Dosierung" value={detail.dosage} /><DetailInfoRow label="Einnahme" value={detail.schedule} />
          <DetailInfoRow label="Applikation" value={detail.route} /><DetailInfoRow label="Indikation" value={detail.indication ?? 'Nicht angegeben'} />
          <DetailInfoRow label="Verordnet von" value={detail.prescribedBy} /><DetailInfoRow label="Gültigkeit" value={`${detail.startDate ?? 'offen'} – ${detail.endDate ?? 'unbefristet'}`} />
          <DetailInfoRow label="Tageszeiten" value={`M ${detail.morningDose ?? '–'} · Mi ${detail.noonDose ?? '–'} · A ${detail.eveningDose ?? '–'} · N ${detail.nightDose ?? '–'}`} />
          {detail.isPrn ? <DetailInfoRow label="Bedarfsindikation" value={detail.prnReason ?? 'Fehlt – Gabe nicht zulässig'} /> : null}
        </SectionPanel>

        {detail.intensiveCareRelevant ? <SectionPanel title="Intensivpflege" subtitle="Pumpen-, Infusions- und Überwachungsdaten"><DetailInfoRow label="Pumpengabe" value={detail.pumpRequired ? 'Ja' : 'Nein'} /><DetailInfoRow label="Laufgeschwindigkeit" value={detail.infusionRate ?? 'Nicht angegeben'} /><DetailInfoRow label="Verdünnung / Trägerlösung" value={detail.dilution ?? 'Nicht angegeben'} /><Text style={styles.note}>Bei invasiver oder kontinuierlicher Gabe müssen Vitalwerte und Geräteparameter im Einsatzkontext dokumentiert werden.</Text></SectionPanel> : null}

        <SectionPanel title="Hinweise und Sicherheit" subtitle="Pflegefachliche Durchführung"><Text style={styles.body}>{detail.instructions}</Text>{detail.sideEffectNotes ? <Text style={styles.note}>Nebenwirkungen: {detail.sideEffectNotes}</Text> : null}{detail.storageNotes ? <Text style={styles.note}>Lagerung: {detail.storageNotes}</Text> : null}</SectionPanel>

        {!isReadOnly ? <SectionPanel title="Gabe / Abweichung dokumentieren" subtitle="Produktiver Leistungsnachweis">
          {detail.status !== 'active' ? <InfoBanner variant="warning" title="Verordnung nicht aktiv" message="Eine Gabe kann erst nach erneuter Aktivierung dokumentiert werden." /> : null}
          <FilterChipGroup options={administrationStatuses} value={administrationStatus} onChange={(value) => setAdministrationStatus(value as MedicationAdministrationStatus)} />
          <View style={styles.twoCols}><PremiumInput label="Verabreichte Dosis" placeholder={detail.dosage} value={dose} onChangeText={setDose} /><PremiumInput label="Applikationsweg" placeholder={detail.route} value={route} onChangeText={setRoute} /></View>
          {administrationStatus !== 'administered' ? <PremiumInput label="Begründung der Abweichung *" value={deviationReason} onChangeText={setDeviationReason} multiline /> : null}
          {detail.isPrn && administrationStatus === 'administered' ? <><PremiumInput label="Aktuelle Bedarfsindikation *" value={prnReason} onChangeText={setPrnReason} multiline /><View style={styles.twoCols}><PremiumInput label="Schmerzskala vorher (0–10)" value={painBefore} onChangeText={setPainBefore} /><PremiumInput label="Schmerzskala nachher (0–10)" value={painAfter} onChangeText={setPainAfter} /></View><PremiumInput label="Wirksamkeitskontrolle" value={effectEvaluation} onChangeText={setEffectEvaluation} multiline /></> : null}
          {detail.isControlledSubstance ? <><Text style={styles.label}>Gegenkontrolle durch zweite berechtigte Person *</Text><FilterChipGroup options={(witnesses.data ?? []).map((person) => ({ key: person.id, label: person.label }))} value={witnessId} onChange={setWitnessId} /></> : null}
          <PremiumInput label="Bemerkung" value={notes} onChangeText={setNotes} multiline />
          <PremiumButton title={saving ? 'Wird dokumentiert…' : 'Dokumentation verbindlich speichern'} disabled={saving || detail.status !== 'active'} onPress={saveAdministration} />
        </SectionPanel> : null}

        <SectionPanel title="Gabenverlauf" subtitle={`${detail.administrations.length} Dokumentationen`}>
          {detail.administrations.length === 0 ? <Text style={styles.note}>Noch keine Gaben oder Abweichungen dokumentiert.</Text> : detail.administrations.map((entry) => <View key={entry.id} style={styles.historyRow}><View style={styles.historyTop}><Text style={styles.historyTitle}>{entry.administeredAt ? new Date(entry.administeredAt).toLocaleString('de-DE') : 'Zeit offen'}</Text><PremiumBadge label={administrationLabels[entry.status] ?? entry.status} variant={entry.status === 'administered' ? 'green' : entry.status === 'scheduled' ? 'muted' : 'orange'} /></View><Text style={styles.note}>{entry.administeredDose ?? 'Dosis offen'} · {entry.route ?? detail.route} · {entry.administeredByName ?? 'Bearbeitende Person'}</Text>{entry.deviationReason ? <Text style={styles.note}>Begründung: {entry.deviationReason}</Text> : null}{entry.witnessName ? <Text style={styles.note}>Gegenkontrolle: {entry.witnessName}</Text> : null}</View>)}
        </SectionPanel>

        {!isReadOnly ? <SectionPanel title="Verordnungsstatus" subtitle="Pausieren, reaktivieren oder beenden"><View style={styles.actions}>{detail.status === 'active' ? <PremiumButton title="Pausieren" variant="secondary" onPress={() => changeStatus('paused')} /> : <PremiumButton title="Wieder aktivieren" onPress={() => changeStatus('active')} />}<PremiumButton title="Verordnung beenden" variant="danger" disabled={detail.status === 'stopped'} onPress={() => changeStatus('stopped')} /></View></SectionPanel> : null}
        <PflegeCrossModuleLinksPanel context="medication" />
        <PremiumButton title="Zurück zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl }, body: { ...typography.body, marginBottom: spacing.sm },
  note: { ...typography.caption, color: colors.textMuted }, label: { ...typography.label, marginTop: spacing.sm },
  twoCols: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  historyRow: { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingVertical: spacing.sm, gap: spacing.xs },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, historyTitle: { ...typography.bodyStrong },
});
