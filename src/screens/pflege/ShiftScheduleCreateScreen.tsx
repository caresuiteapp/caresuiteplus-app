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
import { fetchCareTourResources } from '@/lib/pflege/careTourPlanningService';
import { useAsyncQuery } from '@/hooks/core';
import { CareClientPicker } from './AmbulatoryOperationsScreen';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { hasPermission } from '@/lib/permissions';
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

  const canManage = hasPermission(profile?.roleKey, 'pflege.plans.manage');
  const resources = useAsyncQuery(() => tenantId ? fetchCareTourResources(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.roleKey], { enabled: !!tenantId && canManage });
  const [employeeId, setEmployeeId] = useState('');
  const employee = resources.data?.employees.find((v) => v.id === employeeId);
  const employeeName = employee?.name ?? '';
  const roleLabelField = employee?.qualification ?? '';
  const [shiftDate, setShiftDate] = useState(berlinCalendarDate());
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [location, setLocation] = useState('');
  const [pause, setPause] = useState('30');
  const [pauseAt, setPauseAt] = useState('11:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function handleSave() {
    if (!writeReady || isReadOnly || !canManage || !tenantId || !employeeId || saving) return;
    setSaving(true);
    setError(null);
    const result = await createShiftScheduleEntry(
      tenantId,
      {
        employeeName: employeeName.trim(),
        employeeId,
        roleLabel: roleLabelField.trim(),
        shiftDate,
        startTime,
        endTime,
        location: location.trim(),
        breakMinutes: Number(pause),
        breakStart: pauseAt,
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

        <InfoBanner variant="info" title="Live-Dienstplan" message="Die Schicht wird mandantengetrennt im Pflege-Dienstplan gespeichert." />

        <PremiumCard>
          {!employeeName ? (
            <EmptyState title="Neue Schicht" message="Mitarbeitende und Zeitfenster eingeben." />
          ) : null}

          <SectionPanel title="Schicht" subtitle="Pflichtfelder">
            {resources.loading ? <LoadingState message="Pflegekräfte werden geladen…" /> : null}
            {resources.error ? <ErrorState message={resources.error} onRetry={resources.refresh} /> : null}
            <CareClientPicker options={(resources.data?.employees ?? []).map((v) => ({ id: v.id, label: `${v.name} · ${v.qualification}` }))} value={employeeId} onChange={setEmployeeId} disabled={isReadOnly || !writeReady || !canManage} label="Pflegekraft" />
            <PremiumInput
              label="Funktion / Rolle"
              value={roleLabelField}
              editable={false}
            />
            <PremiumInput
              label="Datum (YYYY-MM-DD)"
              value={shiftDate}
              onChangeText={setShiftDate}
              editable={!isReadOnly && writeReady}
            />
            <PremiumInput label="Beginn" value={startTime} onChangeText={setStartTime} editable={!isReadOnly && writeReady} />
            <PremiumInput label="Ende" value={endTime} onChangeText={setEndTime} editable={!isReadOnly && writeReady} />
            <PremiumInput label="Geplante Pause in Minuten" value={pause} onChangeText={setPause} keyboardType="numeric" editable={!isReadOnly && canManage} />
            <PremiumInput label="Pausenbeginn (HH:MM)" value={pauseAt} onChangeText={setPauseAt} editable={!isReadOnly && canManage} />
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
            disabled={!writeReady || isReadOnly || !canManage || !employeeId}
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
