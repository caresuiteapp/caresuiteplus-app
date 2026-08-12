import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createWoundAssessment, recordMedicationAdministration } from '@/lib/pflege/clinicalWorkflowService';
import { colors, spacing, typography } from '@/theme';

export function MedicationAdministrationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter(); const tenantId = useServiceTenantId(); const { profile } = useAuth();
  const [outcome, setOutcome] = useState('administered'); const [dose, setDose] = useState(''); const [reason, setReason] = useState('');
  const [effect, setEffect] = useState(''); const [escalation, setEscalation] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
  async function save() { if (!tenantId || !id) return; setBusy(true); setError(null); const exceptional = outcome !== 'administered' && outcome !== 'prn_administered';
    const result = await recordMedicationAdministration(tenantId, id, { outcome, doseGiven: dose, reason, effectObservation: effect, anomaly: exceptional, escalation }, profile?.roleKey);
    setBusy(false); if (!result.ok) return setError(result.error); setSaved(true); setTimeout(() => router.back(), 700); }
  return <ScreenShell title="Medikamentengabe" subtitle="Append-only · Zeit und Fachkraft serverseitig"><ScrollView contentContainerStyle={styles.content}><SectionPanel title="Gabe dokumentieren" subtitle="Ergebnis, Abweichung und Wirkung">
    <Text style={styles.label}>Ergebnis *</Text><FilterChipGroup wrap options={[{ key: 'administered', label: 'Gegeben' }, { key: 'prn_administered', label: 'Bedarfsgabe' }, { key: 'omitted', label: 'Ausgelassen' }, { key: 'refused', label: 'Abgelehnt' }, { key: 'held', label: 'Zurückgestellt' }, { key: 'not_available', label: 'Nicht verfügbar' }]} value={outcome} onChange={setOutcome} />
    <PremiumInput label="Verabreichte Dosis *" value={dose} onChangeText={setDose} /><PremiumInput label="Begründung / Indikation" value={reason} onChangeText={setReason} multiline /><PremiumInput label="Wirkungsbeobachtung" value={effect} onChangeText={setEffect} multiline /><PremiumInput label="Eskalation / ärztliche Rücksprache" value={escalation} onChangeText={setEscalation} multiline />
    {error ? <ErrorState message={error} /> : null}{saved ? <SuccessState message="Medikamentengabe wurde unveränderbar dokumentiert." /> : null}
    <PremiumButton title="Gabe verbindlich dokumentieren" fullWidth loading={busy} disabled={busy || !dose.trim() || ((outcome !== 'administered' && outcome !== 'prn_administered') && !reason.trim())} onPress={save} />
  </SectionPanel></ScrollView></ScreenShell>;
}

export function WoundAssessmentCreateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter(); const tenantId = useServiceTenantId(); const { profile } = useAuth();
  const [length, setLength] = useState(''); const [width, setWidth] = useState(''); const [depth, setDepth] = useState('');
  const [bed, setBed] = useState(''); const [exudate, setExudate] = useState(''); const [pain, setPain] = useState(''); const [infection, setInfection] = useState('');
  const [intervention, setIntervention] = useState(''); const [response, setResponse] = useState(''); const [status, setStatus] = useState('active');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
  async function save() { if (!tenantId || !id) return; setBusy(true); setError(null); const result = await createWoundAssessment(tenantId, id, { lengthCm: length.replace(',', '.'), widthCm: width.replace(',', '.'), depthCm: depth.replace(',', '.'), woundBed: bed, exudate, painScore: pain, infectionSigns: infection, intervention, response, caseStatus: status }, profile?.roleKey);
    setBusy(false); if (!result.ok) return setError(result.error); setSaved(true); setTimeout(() => router.back(), 700); }
  return <ScreenShell title="Wundverlauf" subtitle="Standardisiertes Verlaufassessment"><ScrollView contentContainerStyle={styles.content}><SectionPanel title="Wundassessment" subtitle="Maße, Wundbett, Exsudat, Schmerz und Infektionszeichen">
    <Text style={styles.label}>Fallstatus</Text><FilterChipGroup wrap options={[{ key: 'active', label: 'Aktiv' }, { key: 'healing', label: 'Heilend' }, { key: 'deteriorated', label: 'Verschlechtert' }, { key: 'healed', label: 'Abgeheilt' }]} value={status} onChange={setStatus} />
    <PremiumInput label="Länge (cm)" value={length} onChangeText={setLength} keyboardType="decimal-pad" /><PremiumInput label="Breite (cm)" value={width} onChangeText={setWidth} keyboardType="decimal-pad" /><PremiumInput label="Tiefe (cm)" value={depth} onChangeText={setDepth} keyboardType="decimal-pad" />
    <PremiumInput label="Wundbett *" value={bed} onChangeText={setBed} multiline /><PremiumInput label="Exsudat" value={exudate} onChangeText={setExudate} /><PremiumInput label="Schmerz 0–10" value={pain} onChangeText={setPain} keyboardType="number-pad" /><PremiumInput label="Infektionszeichen" value={infection} onChangeText={setInfection} multiline /><PremiumInput label="Maßnahme *" value={intervention} onChangeText={setIntervention} multiline /><PremiumInput label="Reaktion / Ergebnis" value={response} onChangeText={setResponse} multiline />
    {error ? <ErrorState message={error} /> : null}{saved ? <SuccessState message="Wundverlauf wurde unveränderbar dokumentiert." /> : null}
    <PremiumButton title="Verlauf live speichern" fullWidth loading={busy} disabled={busy || !bed.trim() || !intervention.trim()} onPress={save} />
  </SectionPanel></ScrollView></ScreenShell>;
}
const styles = StyleSheet.create({ content: { gap: spacing.md, paddingBottom: spacing.xxl }, label: { ...typography.label, color: colors.textMuted } });
