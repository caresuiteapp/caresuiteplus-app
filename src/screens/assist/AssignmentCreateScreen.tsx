import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScreenHero } from '@/components/forms';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useAsyncQuery } from '@/hooks/core';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchEmployeeList } from '@/lib/office/employeeListService';
import {
  createAssignment,
  type AssignmentCreateFormData,
} from '@/lib/assist/assignmentCreateService';
import {
  hasAssignmentProductionErrors,
  validateAssignmentCreateForm,
} from '@/lib/assist/assignmentProductionValidation';
import { colors, spacing, typography } from '@/theme';

const EMPTY_FORM: AssignmentCreateFormData = {
  clientId: '',
  employeeId: '',
  assignmentDate: new Date().toISOString().slice(0, 10),
  plannedStartTime: '09:00',
  plannedEndTime: '10:00',
  title: '',
  tasks: [''],
};

/** WP246 — Einsatz anlegen (Produktion) */
export function AssignmentCreateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const canCreate = can('assist.assignments.manage');

  const [form, setForm] = useState<AssignmentCreateFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<ReturnType<typeof validateAssignmentCreateForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const clientsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientList(tenantId, profile?.roleKey, { lifecycleFilter: 'active' });
    },
    [tenantId, profile?.roleKey],
    { enabled: Boolean(tenantId) && canCreate },
  );

  const employeesQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchEmployeeList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: Boolean(tenantId) && canCreate },
  );

  useEffect(() => {
    if (!form.clientId && clientsQuery.data?.length) {
      setForm((prev) => ({ ...prev, clientId: clientsQuery.data![0]!.id }));
    }
  }, [form.clientId, clientsQuery.data]);

  useEffect(() => {
    if (!form.employeeId && employeesQuery.data?.length) {
      setForm((prev) => ({ ...prev, employeeId: employeesQuery.data![0]!.id }));
    }
  }, [form.employeeId, employeesQuery.data]);

  if (!canCreate) {
    return (
      <ScreenShell title="Einsatz anlegen" subtitle={roleLabel ?? 'Assist'}>
        <LockedActionBanner
          message={check('assist.assignments.manage').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (clientsQuery.loading || employeesQuery.loading) {
    return (
      <ScreenShell title="Einsatz anlegen" subtitle="Wird geladen…">
        <LoadingState message="Klient:innen und Mitarbeitende werden geladen…" />
      </ScreenShell>
    );
  }

  if (submitting) {
    return (
      <ScreenShell title="Einsatz anlegen" subtitle="Speichern…">
        <LoadingState message="Einsatz wird gespeichert…" />
      </ScreenShell>
    );
  }

  if (createdId) {
    return (
      <ScreenShell title="Einsatz anlegen" subtitle="Erstellt">
        <SuccessState message="Einsatz wurde erfolgreich geplant." />
        <PremiumButton
          title="Zum Einsatz"
          fullWidth
          onPress={() => router.replace(`/assist/einsaetze/${createdId}` as never)}
        />
      </ScreenShell>
    );
  }

  const clientOptions =
    clientsQuery.data?.map((c) => ({
      key: c.id,
      label: `${c.firstName} ${c.lastName}`,
    })) ?? [];

  const employeeOptions =
    employeesQuery.data?.map((e) => ({
      key: e.id,
      label: `${e.firstName} ${e.lastName}`,
    })) ?? [];

  const handleSubmit = async () => {
    if (!tenantId) {
      setSubmitError('Kein Mandant am Profil hinterlegt.');
      return;
    }

    const nextErrors = validateAssignmentCreateForm(form);
    setErrors(nextErrors);
    if (hasAssignmentProductionErrors(nextErrors)) return;

    setSubmitting(true);
    setSubmitError(null);

    const result = await createAssignment(
      tenantId,
      form,
      profile?.roleKey,
      {
        actorProfileId: profile?.id,
        actorDisplayName: profile?.displayName ?? undefined,
      },
    );

    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setCreatedId(result.data.id);
  };

  const updateTask = (index: number, value: string) => {
    setForm((prev) => {
      const tasks = [...prev.tasks];
      tasks[index] = value;
      return { ...prev, tasks };
    });
  };

  const addTask = () => setForm((prev) => ({ ...prev, tasks: [...prev.tasks, ''] }));

  const isEmpty =
    !form.title.trim() && !form.clientId && !form.employeeId && form.tasks.every((t) => !t.trim());

  return (
    <ScreenShell title="Einsatz anlegen" subtitle="WP 246">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <FormScreenHero
          eyebrow="ASSIST · EINSATZ"
          title="Einsatz planen"
          meta="Klient:in, Mitarbeitende:r, Zeitfenster und Aufgaben — mandantengebunden"
          icon="🚗"
          accentColor={colors.success}
          formMode="create"
          wpNumber={246}
        />

        {isEmpty ? (
          <EmptyState title="Neuer Einsatz" message="Pflichtfelder ausfüllen und speichern." />
        ) : null}

        <PremiumCard>
          <Text style={styles.sectionLabel}>Klient:in *</Text>
          {clientOptions.length === 0 ? (
            <Text style={styles.hint}>Keine aktiven Klient:innen gefunden.</Text>
          ) : (
            <FilterChipGroup
              options={clientOptions}
              value={form.clientId}
              onChange={(value) => setForm((prev) => ({ ...prev, clientId: value }))}
            />
          )}
          {errors.clientId ? <Text style={styles.error}>{errors.clientId}</Text> : null}

          <Text style={styles.sectionLabel}>Mitarbeitende:r *</Text>
          {employeeOptions.length === 0 ? (
            <Text style={styles.hint}>Keine Mitarbeitende gefunden.</Text>
          ) : (
            <FilterChipGroup
              options={employeeOptions}
              value={form.employeeId}
              onChange={(value) => setForm((prev) => ({ ...prev, employeeId: value }))}
            />
          )}
          {errors.employeeId ? <Text style={styles.error}>{errors.employeeId}</Text> : null}

          <PremiumInput
            label="Bezeichnung *"
            value={form.title}
            onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
            error={errors.title}
          />
          <PremiumInput
            label="Datum (JJJJ-MM-TT) *"
            value={form.assignmentDate}
            onChangeText={(assignmentDate) => setForm((prev) => ({ ...prev, assignmentDate }))}
            error={errors.assignmentDate}
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <PremiumInput
                label="Start (HH:MM) *"
                value={form.plannedStartTime}
                onChangeText={(plannedStartTime) =>
                  setForm((prev) => ({ ...prev, plannedStartTime }))
                }
                error={errors.plannedStartTime}
              />
            </View>
            <View style={styles.half}>
              <PremiumInput
                label="Ende (HH:MM) *"
                value={form.plannedEndTime}
                onChangeText={(plannedEndTime) =>
                  setForm((prev) => ({ ...prev, plannedEndTime }))
                }
                error={errors.plannedEndTime}
              />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Aufgaben *</Text>
          {form.tasks.map((task, index) => (
            <PremiumInput
              key={`task-${index}`}
              label={`Aufgabe ${index + 1}`}
              value={task}
              onChangeText={(value) => updateTask(index, value)}
            />
          ))}
          {errors.tasks ? <Text style={styles.error}>{errors.tasks}</Text> : null}
          <PremiumButton title="Weitere Aufgabe" variant="ghost" onPress={addTask} />

          {submitError ? <ErrorState title="Speichern" message={submitError} /> : null}
          <PremiumButton title="Einsatz anlegen" fullWidth onPress={handleSubmit} />
        </PremiumCard>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  sectionLabel: { ...typography.label, marginTop: spacing.sm, marginBottom: spacing.xs },
  hint: { ...typography.caption, marginBottom: spacing.sm },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
});
