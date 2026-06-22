import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { SHIFT_LOCATIONS, SHIFT_STAFF } from '@/data/demo/generators/pflegeDemoGenerators';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isShiftScheduleLiveReady } from '@/lib/pflege/pflegeModuleConfig';
import { createShiftScheduleEntry } from '@/lib/pflege/shiftScheduleService';
import { colors, spacing } from '@/theme';

/** Arbeitsplan — /pflege/dienstplaene/new */
export function ShiftScheduleCreateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const writeReady = isShiftScheduleLiveReady();

  const defaultStaff = SHIFT_STAFF[0]!;
  const [employeeName, setEmployeeName] = useState(defaultStaff.name);
  const [roleLabelField, setRoleLabelField] = useState(defaultStaff.role);
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [location, setLocation] = useState(SHIFT_LOCATIONS[0] ?? 'Ambulant Nord');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function handleSave() {
    if (!writeReady || isReadOnly || !tenantId || !employeeName.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createShiftScheduleEntry(
      tenantId,
      {
        employeeName: employeeName.trim(),
        roleLabel: roleLabelField.trim(),
        shiftDate,
        startTime,
        endTime,
        location: location.trim(),
      },
      profile?.roleKey,
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreatedId(result.data.id);
    setTimeout(() => router.replace('/pflege/dienstplaene' as never), 900);
  }

  if (saving) {
    return (
      <ScreenShell title="Schicht anlegen" subtitle="Speichern…">
        <LoadingState message="Dienstplan-Eintrag wird gespeichert…" />
      </ScreenShell>
    );
  }

  if (createdId) {
    return (
      <ScreenShell title="Schicht angelegt" showBack={false}>
        <SuccessState message="Dienstplan-Eintrag gespeichert — Liste wird aktualisiert." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Schicht anlegen"
      subtitle={`Dienstplan · ${roleLabel ?? 'Demo'}`}
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroWrap}>
          <FormScreenHero
            eyebrow="PFLEGE · DIENSTPLAN"
            title="Neue Schicht"
            meta="Mitarbeitende, Zeitfenster und Einsatzort"
            icon="📅"
            formMode="create"
            accentColor={colors.cyan}
          />
        </View>

        <InfoBanner variant="info" title="Demo-funktional" message="Schicht wird im Demo-Dienstplan gespeichert." />

        <PremiumCard>
          {!employeeName ? (
            <EmptyState title="Neue Schicht" message="Mitarbeitende und Zeitfenster eingeben." />
          ) : null}

          <SectionPanel title="Schicht" subtitle="Pflichtfelder">
            <PremiumInput
              label="Mitarbeitende *"
              value={employeeName}
              onChangeText={setEmployeeName}
              editable={!isReadOnly && writeReady}
            />
            <PremiumInput
              label="Funktion / Rolle"
              value={roleLabelField}
              onChangeText={setRoleLabelField}
              editable={!isReadOnly && writeReady}
            />
            <PremiumInput
              label="Datum (YYYY-MM-DD)"
              value={shiftDate}
              onChangeText={setShiftDate}
              editable={!isReadOnly && writeReady}
            />
            <PremiumInput label="Beginn" value={startTime} onChangeText={setStartTime} editable={!isReadOnly && writeReady} />
            <PremiumInput label="Ende" value={endTime} onChangeText={setEndTime} editable={!isReadOnly && writeReady} />
            <PremiumInput
              label="Einsatzort"
              value={location}
              onChangeText={setLocation}
              editable={!isReadOnly && writeReady}
            />
          </SectionPanel>

          {error ? <ErrorState message={error} /> : null}

          <PremiumButton
            title="Schicht speichern"
            fullWidth
            disabled={!writeReady || isReadOnly || !employeeName.trim()}
            onPress={handleSave}
          />
          <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
        </PremiumCard>
      </ScrollView>
    </ScreenShell>
  );
}

/** Alias für Sprint-Nomenklatur */
export const CareShiftCreateScreen = ShiftScheduleCreateScreen;

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  heroWrap: { marginBottom: spacing.md },
});
