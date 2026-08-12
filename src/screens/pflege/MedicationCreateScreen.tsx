import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { createMedicationOrder } from '@/lib/pflege/medicationListService';
import { spacing, typography, colors } from '@/theme';

const today = () => new Date().toISOString().slice(0, 10);
export function MedicationCreateScreen() {
  const router = useRouter(); const tenantId = useServiceTenantId(); const { profile } = useAuth();
  const clients = useAsyncQuery(() => tenantId ? fetchEligibleCareClients(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) });
  const options = useMemo(() => (clients.data ?? []).map((c) => ({ key: c.id, label: `${c.lastName}, ${c.firstName}` })), [clients.data]);
  const [clientId, setClientId] = useState(''); const [name, setName] = useState(''); const [ingredient, setIngredient] = useState('');
  const [dosage, setDosage] = useState(''); const [route, setRoute] = useState('oral'); const [schedule, setSchedule] = useState('1-0-0-0');
  const [physician, setPhysician] = useState(''); const [indication, setIndication] = useState(''); const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState(false);
  const save = async () => {
    if (!tenantId) return; setBusy(true); setError(null); setSuccess(false);
    const result = await createMedicationOrder(tenantId, clientId, { medicationName: name, activeIngredient: ingredient, dosage, route,
      schedule: { schema: schedule }, physician, prescribedAt: today(), validFrom: today(), indication, instructions }, profile?.roleKey);
    setBusy(false); if (!result.ok) return setError(result.error); setSuccess(true); setTimeout(() => router.replace(`/pflege/medikation/${result.data.id}` as never), 700);
  };
  if (clients.loading) return <ScreenShell title="Medikation"><LoadingState message="Aktive Pflegefälle werden geladen…" /></ScreenShell>;
  return <ScreenShell title="Medikation anlegen" subtitle="Ärztliche Verordnung · Vier-Zeiten-Schema · Live-Audit">
    <ScrollView contentContainerStyle={styles.scroll}><SectionPanel title="Medikationsverordnung" subtitle="Nur nach vorliegender ärztlicher Anordnung dokumentieren">
      <Text style={styles.label}>Aktiver Pflegefall *</Text><FilterChipGroup wrap options={options} value={clientId} onChange={setClientId} />
      <PremiumInput label="Präparat *" value={name} onChangeText={setName} /><PremiumInput label="Wirkstoff" value={ingredient} onChangeText={setIngredient} />
      <PremiumInput label="Dosierung *" value={dosage} onChangeText={setDosage} /><PremiumInput label="Applikationsweg *" value={route} onChangeText={setRoute} />
      <PremiumInput label="Schema morgens-mittags-abends-nachts" value={schedule} onChangeText={setSchedule} /><PremiumInput label="Verordnende Ärztin/Arzt *" value={physician} onChangeText={setPhysician} />
      <PremiumInput label="Indikation" value={indication} onChangeText={setIndication} multiline /><PremiumInput label="Durchführungshinweise" value={instructions} onChangeText={setInstructions} multiline />
      {error ? <ErrorState message={error} /> : null}{success ? <SuccessState message="Medikationsverordnung wurde live gespeichert und zurückgelesen." /> : null}
      <PremiumButton title="Verordnung live speichern" fullWidth loading={busy} disabled={busy || !clientId || !name || !dosage || !physician} onPress={save} />
    </SectionPanel></ScrollView></ScreenShell>;
}
const styles = StyleSheet.create({ scroll: { paddingBottom: spacing.xxl }, label: { ...typography.label, color: colors.textMuted } });
