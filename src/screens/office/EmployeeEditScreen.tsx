import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { CatalogValueSelect } from '@/components/templates';
import { FormScreenHero } from '@/components/forms';
import { EmployeeProfilePhotoPicker } from '@/components/office/EmployeeProfilePhotoPicker';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEmployeeDetail } from '@/lib/office/employeeDetailService';
import { updateEmployee, type EmployeeEditInput } from '@/lib/office/employeeFormService';
import { getServiceMode } from '@/lib/services/mode';
import { EMPTY_EMPLOYEE_PROFILE_PHOTO } from '@/types/forms/employeeForm';
import { spacing } from '@/theme';

export function EmployeeEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const [form, setForm] = useState<EmployeeEditInput>({
    jobTitle: '',
    phone: '',
    department: '',
    notes: '',
    profilePhoto: EMPTY_EMPLOYEE_PROFILE_PHOTO,
  });
  const [employeeStatus, setEmployeeStatus] = useState('aktiv');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!id) return Promise.resolve({ ok: false as const, error: 'Keine Mitarbeitenden-ID.' });
      return fetchEmployeeDetail(id, tenantId, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  useEffect(() => {
    if (query.data) {
      setForm({
        jobTitle: query.data.jobTitle ?? '',
        phone: query.data.phone ?? '',
        department: query.data.department ?? '',
        notes: query.data.notes ?? '',
        profilePhoto: {
          displayUri: query.data.avatarUrl,
          pending: null,
          removed: false,
        },
      });
      setEmployeeStatus(query.data.status ?? 'aktiv');
    }
  }, [query.data]);

  if (!can('office.employees.edit')) {
    return (
      <CareLightPageShell title="Bearbeiten" subtitle={roleLabel ?? 'Office'}>
        <LockedActionBanner
          message={check('office.employees.edit').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </CareLightPageShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Bearbeiten" subtitle="Wird geladen…">
        <LoadingState message="Daten werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Bearbeiten" subtitle="Fehler">
        <ErrorState title="Fehler" message={query.error} onRetry={query.refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  const employee = query.data;
  if (!employee) {
    return (
      <CareLightPageShell title="Bearbeiten" subtitle="Nicht gefunden">
        <EmptyState title="Nicht gefunden" message="Mitarbeitende:r existiert nicht." />
      </CareLightPageShell>
    );
  }

  const handleSave = async () => {
    if (!tenantId || !id) return;
    setSaving(true);
    setSaveError(null);
    const result = await updateEmployee(
      id,
      tenantId,
      form,
      profile?.roleKey,
      employee.avatarUrl,
    );
    setSaving(false);
    if (result.ok) {
      setSuccessMessage('Mitarbeitende:r gespeichert.');
      await query.refresh();
    } else {
      setSaveError(result.error);
    }
  };

  return (
    <CareLightPageShell
      title={`${employee.firstName} ${employee.lastName}`}
      subtitle="Stammdaten bearbeiten"
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero
          eyebrow="OFFICE · MITARBEITENDE"
          title={`${employee.firstName} ${employee.lastName}`}
          meta={
            getServiceMode() === 'supabase'
              ? 'Stammdaten und Profilbild bearbeiten'
              : 'Stammdaten bearbeiten — Demo-Persistenz'
          }
          icon="✏️"
          formMode="edit"
          wpNumber={187}
          preparedMessage="Live-HR-Felder folgen in Kürze — derzeit Demo-Persistenz."
        />
        <View style={styles.profileSection}>
          <EmployeeProfilePhotoPicker
            firstName={employee.firstName}
            lastName={employee.lastName}
            value={form.profilePhoto}
            onChange={(profilePhoto) => setForm((f) => ({ ...f, profilePhoto }))}
            disabled={saving}
          />
        </View>
        {successMessage ? <SuccessState message={successMessage} /> : null}
        <PremiumInput
          label="Funktion"
          value={form.jobTitle}
          onChangeText={(v) => setForm((f) => ({ ...f, jobTitle: v }))}
        />
        <PremiumInput
          label="Telefon"
          value={form.phone}
          onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
        />
        <PremiumInput
          label="Abteilung"
          value={form.department}
          onChangeText={(v) => setForm((f) => ({ ...f, department: v }))}
        />
        <CatalogValueSelect
          catalogType="employee_status"
          label="Status (Katalog)"
          value={employeeStatus}
          onChange={setEmployeeStatus}
        />
        <PremiumInput
          label="Notizen"
          value={form.notes}
          onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
          multiline
        />
        {!form.jobTitle.trim() && !form.phone.trim() && !form.department.trim() && !form.notes.trim() ? (
          <EmptyState title="Leeres Profil" message="Ergänzen Sie mindestens ein Stammdatenfeld." />
        ) : null}
        {saveError ? <ErrorState title="Speichern" message={saveError} /> : null}
        <PremiumButton title="Speichern" onPress={handleSave} loading={saving} />
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
