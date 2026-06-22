import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { CareMedicationScheduleInput } from '@/components/inputs/CareMedicationScheduleInput';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { createDemoMedication } from '@/data/demo/medications';
import { demoClients } from '@/data/demo/clients';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { formatIntakeSchemaShort } from '@/lib/formatters/unitFormatters';
import { isMedicationLiveReady } from '@/lib/pflege/pflegeModuleConfig';
import { colors, spacing, typography } from '@/theme';

export function MedicationCreateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { isReadOnly, roleLabel } = usePermissions();
  const writeReady = isMedicationLiveReady();

  const [clientId, setClientId] = useState(demoClients[0]?.id ?? 'client-001');
  const [medicationName, setMedicationName] = useState('');
  const [dosage, setDosage] = useState('');
  const [routeKey, setRouteKey] = useState('oral');
  const [schedule, setSchedule] = useState({ morning: 1, noon: 0, evening: 1, night: 0 });
  const [schemaKey, setSchemaKey] = useState('1-0-1-0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const client = demoClients.find((c) => c.id === clientId);
  const clientName = client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
  const isFormEmpty = !medicationName.trim() && !dosage.trim();

  async function handleSave() {
    if (!writeReady || isReadOnly || !medicationName.trim() || !clientId) return;
    setSaving(true);
    setError(null);
    const scheduleLabel = formatIntakeSchemaShort(
      schedule.morning,
      schedule.noon,
      schedule.evening,
      schedule.night,
    );
    const item = createDemoMedication({
      clientId,
      clientName,
      medicationName: medicationName.trim(),
      dosage: dosage.trim() || '—',
      schedule: scheduleLabel,
    });
    setSaving(false);
    setCreatedId(item.id);
    setTimeout(() => router.replace(`/pflege/medikation/${item.id}` as never), 900);
  }

  if (saving) {
    return (
      <ScreenShell title="Medikation anlegen" subtitle="Speichern…">
        <LoadingState message="Verordnung wird gespeichert…" />
      </ScreenShell>
    );
  }

  if (createdId) {
    return (
      <ScreenShell title="Verordnung angelegt" showBack={false}>
        <SuccessState message="Medikationsplan gespeichert — Weiterleitung zum Detail…" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Medikation anlegen"
      subtitle={`Einnahmeschema morgens/mittags/abends/nachts · ${roleLabel ?? 'Demo'}`}
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoBanner
          variant="info"
          title="Medikationsplan"
          message="Verordnung mit Tageszeit-Schema — Demo-Persistenz im Mandanten."
        />
        {isFormEmpty ? (
          <EmptyState
            title="Neue Verordnung"
            message="Klient:in und Präparat eingeben — Einnahmeschema optional anpassen."
          />
        ) : null}
        {error ? <ErrorState message={error} /> : null}

        <SectionPanel title="Verordnung" subtitle="Pflichtfelder">
          <Text style={styles.fieldLabel}>Klient:in</Text>
          <FilterChipGroup
            options={demoClients.slice(0, 8).map((c) => ({
              key: c.id,
              label: `${c.firstName} ${c.lastName}`,
            }))}
            value={clientId}
            onChange={setClientId}
          />
          <PremiumInput label="Präparat *" value={medicationName} onChangeText={setMedicationName} editable={!isReadOnly && writeReady} />
          <PremiumInput label="Dosierung" placeholder="z. B. 5 mg" value={dosage} onChangeText={setDosage} editable={!isReadOnly && writeReady} />
          <PremiumInput label="Applikationsweg" placeholder="oral" value={routeKey} onChangeText={setRouteKey} editable={!isReadOnly && writeReady} />
          <CareMedicationScheduleInput
            label="Einnahmeschema"
            value={schedule}
            onChange={setSchedule}
            schemaKey={schemaKey}
            onSchemaKeyChange={setSchemaKey}
          />
          <PremiumButton
            title={saving ? 'Speichern…' : 'Verordnung speichern'}
            disabled={!writeReady || isReadOnly || saving || !medicationName.trim() || !clientId}
            onPress={handleSave}
          />
          <PremiumButton title="Abbrechen" variant="secondary" onPress={() => router.back()} />
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  fieldLabel: { ...typography.label, color: colors.textMuted },
});
