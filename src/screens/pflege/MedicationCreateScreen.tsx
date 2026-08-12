import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareMedicationScheduleInput } from '@/components/inputs/CareMedicationScheduleInput';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { formatIntakeSchemaShort } from '@/lib/formatters/unitFormatters';
import { createLiveMedication, fetchMedicationClientOptions } from '@/lib/pflege/medicationLiveService';
import { colors, spacing, typography } from '@/theme';

const yesNo = [{ key: 'no', label: 'Nein' }, { key: 'yes', label: 'Ja' }];

export function MedicationCreateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const [clientSearch, setClientSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [strength, setStrength] = useState('');
  const [form, setForm] = useState('Tablette');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState('oral');
  const [prescribedBy, setPrescribedBy] = useState('');
  const [indication, setIndication] = useState('');
  const [notes, setNotes] = useState('');
  const [schedule, setSchedule] = useState({ morning: 0, noon: 0, evening: 0, night: 0 });
  const [schemaKey, setSchemaKey] = useState('individuell');
  const [isPrn, setIsPrn] = useState(false);
  const [prnReason, setPrnReason] = useState('');
  const [isHighAlert, setIsHighAlert] = useState(false);
  const [isControlled, setIsControlled] = useState(false);
  const [intensive, setIntensive] = useState(false);
  const [pumpRequired, setPumpRequired] = useState(false);
  const [infusionRate, setInfusionRate] = useState('');
  const [dilution, setDilution] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const clientsQuery = useAsyncQuery(
    () => tenantId ? fetchMedicationClientOptions(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );
  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);
  const filteredClients = useMemo(() => {
    const needle = clientSearch.trim().toLocaleLowerCase('de-DE');
    return clients.filter((client) => !needle || client.label.toLocaleLowerCase('de-DE').includes(needle)).slice(0, 40);
  }, [clients, clientSearch]);
  const selectedClient = clients.find((client) => client.id === clientId);

  async function handleSave() {
    if (!tenantId || isReadOnly || saving) return;
    setSaving(true); setError(null);
    const scheduleLabel = isPrn ? 'Bei Bedarf' : formatIntakeSchemaShort(schedule.morning, schedule.noon, schedule.evening, schedule.night);
    const result = await createLiveMedication(tenantId, profile?.id ?? null, {
      clientId, name, activeIngredient, strength, form, dosage, route, prescribedBy, indication, notes,
      schedule: scheduleLabel, morningDose: String(schedule.morning || ''), noonDose: String(schedule.noon || ''),
      eveningDose: String(schedule.evening || ''), nightDose: String(schedule.night || ''), isPrn, prnReason,
      isHighAlert, isControlledSubstance: isControlled, intensiveCareRelevant: intensive,
      infusionRate, dilution, pumpRequired,
    }, profile?.roleKey);
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setCreatedId(result.data.id);
    setTimeout(() => router.replace(`/pflege/medikation/${result.data.id}` as never), 500);
  }

  if (clientsQuery.loading && clients.length === 0) return <ScreenShell title="Medikation anlegen"><LoadingState message="Aktive Klient:innen werden geladen…" /></ScreenShell>;
  if (createdId) return <ScreenShell title="Verordnung angelegt" showBack={false}><SuccessState message="Die Verordnung wurde produktiv gespeichert." /></ScreenShell>;

  return (
    <ScreenShell title="Medikation anlegen" subtitle={`Ambulante Pflege und Intensivpflege · ${roleLabel ?? 'Pflegefachkraft'}`} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoBanner variant="info" title="Produktive Verordnung" message="Alle Angaben werden mandantengetrennt gespeichert. Hochrisiko-, BtM-, Bedarfs- und Pumpenmedikation werden gesondert gekennzeichnet." />
        {error ? <ErrorState message={error} /> : null}
        <SectionPanel title="Klient:in" subtitle="Aktiver Versorgungsfall">
          <PremiumInput label="Klient:in suchen" placeholder="Name eingeben" value={clientSearch} onChangeText={setClientSearch} />
          <FilterChipGroup options={filteredClients.map((client) => ({ key: client.id, label: client.label }))} value={clientId} onChange={setClientId} />
          {selectedClient?.allergies ? <InfoBanner variant="warning" title="Allergien / Unverträglichkeiten" message={selectedClient.allergies} /> : null}
        </SectionPanel>
        <SectionPanel title="Ärztliche Verordnung" subtitle="Präparat, Wirkstoff und Indikation">
          <PremiumInput label="Präparat *" value={name} onChangeText={setName} editable={!isReadOnly} />
          <View style={styles.twoCols}><PremiumInput label="Wirkstoff" value={activeIngredient} onChangeText={setActiveIngredient} /><PremiumInput label="Stärke" placeholder="z. B. 5 mg" value={strength} onChangeText={setStrength} /></View>
          <View style={styles.twoCols}><PremiumInput label="Darreichungsform" value={form} onChangeText={setForm} /><PremiumInput label="Applikationsweg" value={route} onChangeText={setRoute} /></View>
          <PremiumInput label="Dosierung" placeholder="eindeutige Einzeldosis" value={dosage} onChangeText={setDosage} />
          <PremiumInput label="Verordnet durch" placeholder="Ärztin / Arzt" value={prescribedBy} onChangeText={setPrescribedBy} />
          <PremiumInput label="Indikation" value={indication} onChangeText={setIndication} />
          <PremiumInput label="Einnahme- und Pflegehinweise" value={notes} onChangeText={setNotes} multiline />
        </SectionPanel>
        <SectionPanel title="Gabeplan" subtitle="Morgens · mittags · abends · nachts">
          <CareMedicationScheduleInput label="Regelmedikation" value={schedule} onChange={setSchedule} schemaKey={schemaKey} onSchemaKeyChange={setSchemaKey} />
          <Text style={styles.fieldLabel}>Bedarfsmedikation</Text><FilterChipGroup options={yesNo} value={isPrn ? 'yes' : 'no'} onChange={(value) => setIsPrn(value === 'yes')} />
          {isPrn ? <PremiumInput label="Bedarfsindikation / Grenzwert *" placeholder="z. B. Schmerz NRS ≥ 4; max. Tagesdosis beachten" value={prnReason} onChangeText={setPrnReason} multiline /> : null}
        </SectionPanel>
        <SectionPanel title="Medikationssicherheit" subtitle="Kennzeichnung und Gegenkontrolle">
          <Text style={styles.fieldLabel}>Hochrisikomedikament</Text><FilterChipGroup options={yesNo} value={isHighAlert ? 'yes' : 'no'} onChange={(value) => setIsHighAlert(value === 'yes')} />
          <Text style={styles.fieldLabel}>Betäubungsmittel (BtM)</Text><FilterChipGroup options={yesNo} value={isControlled ? 'yes' : 'no'} onChange={(value) => setIsControlled(value === 'yes')} />
          <Text style={styles.fieldLabel}>Intensivpflegerelevant</Text><FilterChipGroup options={yesNo} value={intensive ? 'yes' : 'no'} onChange={(value) => setIntensive(value === 'yes')} />
          {intensive ? <><Text style={styles.fieldLabel}>Pumpengabe</Text><FilterChipGroup options={yesNo} value={pumpRequired ? 'yes' : 'no'} onChange={(value) => setPumpRequired(value === 'yes')} /><View style={styles.twoCols}><PremiumInput label="Laufgeschwindigkeit" placeholder="z. B. 2 ml/h" value={infusionRate} onChangeText={setInfusionRate} /><PremiumInput label="Verdünnung / Trägerlösung" value={dilution} onChangeText={setDilution} /></View></> : null}
        </SectionPanel>
        <View style={styles.actions}><PremiumButton title={saving ? 'Wird gespeichert…' : 'Verordnung produktiv speichern'} disabled={isReadOnly || saving || !tenantId || !clientId || !name.trim()} onPress={handleSave} /><PremiumButton title="Abbrechen" variant="secondary" onPress={() => router.back()} /></View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  fieldLabel: { ...typography.label, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs },
  twoCols: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
