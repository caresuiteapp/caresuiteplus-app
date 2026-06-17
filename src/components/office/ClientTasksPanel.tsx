import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { DetailInfoRow } from '@/components/detail';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  addAssistCatalogTaskToClient,
  addAssistPackageToClient,
  getAssistTaskPackages,
  groupPackagesByLeistungsbereich,
} from '@/lib/assist/assistTaskCatalogService';
import { validateAssistTaskTitle } from '@/lib/assist/assistTaskGuardService';
import {
  createClientTask,
  deleteClientTask,
  fetchClientTasks,
  updateClientTask,
  type ClientTaskInput,
} from '@/lib/clients/clientTasksService';
import { fetchEmployeeList } from '@/lib/office/employeeListService';
import {
  ASSIST_LEISTUNGSBEREICH_LABELS,
  ASSIST_MODULE_DISCLAIMER,
  ASSIST_SUBCATEGORY_LABELS,
  type AssistLeistungsbereichKey,
} from '@/types/modules/assist/assistTaskCatalog';
import type { ClientFullDetail, ClientTask, TaskCategory, TaskFrequency } from '@/types/modules/client';
import {
  TASK_CATEGORY_LABELS,
  TASK_FREQUENCY_LABELS,
} from '@/types/modules/client';
import { getAssistTasksByPackage } from '@/data/assist/assistTaskCatalog';
import { colors, spacing, typography } from '@/theme';

type ClientTasksPanelProps = {
  clientId: string;
  fullClient?: ClientFullDetail | null;
  showShiftPreferences?: boolean;
  onRecordRefresh?: () => void;
};

type TaskFormState = {
  title: string;
  description: string;
  category: TaskCategory;
  frequency: TaskFrequency;
  isActive: boolean;
  assignedEmployeeId: string;
  durationMinutes: string;
};

const CATEGORY_OPTIONS = (Object.keys(TASK_CATEGORY_LABELS) as TaskCategory[]).map((key) => ({
  key,
  label: TASK_CATEGORY_LABELS[key],
}));

const FREQUENCY_OPTIONS = (Object.keys(TASK_FREQUENCY_LABELS) as TaskFrequency[]).map((key) => ({
  key,
  label: TASK_FREQUENCY_LABELS[key],
}));

const STATUS_OPTIONS = [
  { key: 'aktiv', label: 'Aktiv' },
  { key: 'inaktiv', label: 'Inaktiv' },
];

const EMPTY_FORM: TaskFormState = {
  title: '',
  description: '',
  category: 'sonstige',
  frequency: 'woechentlich',
  isActive: true,
  assignedEmployeeId: '',
  durationMinutes: '',
};

function formatEmployeeLabel(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function toFormState(task: ClientTask): TaskFormState {
  return {
    title: task.title,
    description: task.description ?? '',
    category: task.category,
    frequency: task.frequency,
    isActive: task.isActive,
    assignedEmployeeId: task.assignedEmployeeIds[0] ?? '',
    durationMinutes: task.durationMinutes != null ? String(task.durationMinutes) : '',
  };
}

function toTaskInput(form: TaskFormState): ClientTaskInput {
  const duration = form.durationMinutes.trim();
  return {
    category: form.category,
    title: form.title.trim(),
    description: form.description.trim() || null,
    frequency: form.frequency,
    durationMinutes: duration ? Number.parseInt(duration, 10) || null : null,
    isActive: form.isActive,
    catalogTaskId: null,
    assignedEmployeeIds: form.assignedEmployeeId ? [form.assignedEmployeeId] : [],
    moduleKey: 'assist',
    leistungsbereich: null,
    subcategory: null,
    packageId: null,
    leistungsart: null,
    isMandatory: false,
    proofRequired: false,
    documentationRequired: true,
    billingRelevant: true,
    visibleToClient: true,
  };
}

function groupTasksByLeistungsbereich(tasks: ClientTask[]): Map<string, ClientTask[]> {
  const map = new Map<string, ClientTask[]>();
  for (const task of tasks) {
    const key = task.leistungsbereich ?? 'sonstige';
    const list = map.get(key) ?? [];
    list.push(task);
    map.set(key, list);
  }
  return map;
}

export function ClientTasksPanel({
  clientId,
  fullClient,
  showShiftPreferences = false,
  onRecordRefresh,
}: ClientTasksPanelProps) {
  const { isReadOnly } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const packagesByBereich = useMemo(() => groupPackagesByLeistungsbereich(), []);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientTasks(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: Boolean(tenantId && clientId) },
  );

  const employeesQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchEmployeeList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: Boolean(tenantId) && (showForm || showCatalog) && !isReadOnly },
  );

  const employeeOptions = useMemo(() => {
    const options = [{ key: '', label: 'Keine Zuordnung' }];
    for (const employee of employeesQuery.data ?? []) {
      options.push({
        key: employee.id,
        label: formatEmployeeLabel(employee.firstName, employee.lastName),
      });
    }
    return options;
  }, [employeesQuery.data]);

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of employeesQuery.data ?? []) {
      map.set(employee.id, formatEmployeeLabel(employee.firstName, employee.lastName));
    }
    return map;
  }, [employeesQuery.data]);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setFormError(null);
  }, []);

  useEffect(() => {
    resetForm();
    setShowCatalog(false);
    setCatalogError(null);
  }, [clientId, resetForm]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setShowCatalog(false);
    setFormError(null);
  }

  function startEdit(task: ClientTask) {
    setEditingId(task.id);
    setForm(toFormState(task));
    setShowForm(true);
    setFormError(null);
  }

  async function handleSave() {
    if (!tenantId || isReadOnly || !form.title.trim()) {
      setFormError('Bitte einen Titel eingeben.');
      return;
    }

    const validation = validateAssistTaskTitle(form.title, form.description);
    if (!validation.ok) {
      setFormError(validation.error);
      return;
    }

    setSaving(true);
    setFormError(null);
    const input = toTaskInput(form);
    const result = editingId
      ? await updateClientTask(tenantId, clientId, editingId, input)
      : await createClientTask(tenantId, clientId, input);

    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    resetForm();
    await query.refresh();
    onRecordRefresh?.();
  }

  async function handleDelete(taskId: string) {
    if (!tenantId || isReadOnly) return;
    const result = await deleteClientTask(tenantId, clientId, taskId);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    if (editingId === taskId) resetForm();
    await query.refresh();
    onRecordRefresh?.();
  }

  async function handleAddPackage(packageId: string) {
    if (!tenantId || isReadOnly) return;
    setSaving(true);
    setCatalogError(null);
    const result = await addAssistPackageToClient(tenantId, clientId, packageId);
    setSaving(false);
    if (!result.ok) {
      setCatalogError(result.error);
      return;
    }
    await query.refresh();
    onRecordRefresh?.();
  }

  async function handleAddCatalogTask(catalogTaskId: string) {
    if (!tenantId || isReadOnly) return;
    setSaving(true);
    setCatalogError(null);
    const result = await addAssistCatalogTaskToClient(tenantId, clientId, catalogTaskId);
    setSaving(false);
    if (!result.ok) {
      setCatalogError(result.error);
      return;
    }
    await query.refresh();
    onRecordRefresh?.();
  }

  if (query.loading && !query.data) {
    return <LoadingState message="Aufgaben werden geladen…" />;
  }

  if (query.error && !query.data) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  const tasks = query.data ?? [];
  const groupedTasks = groupTasksByLeistungsbereich(tasks);
  const bereichOrder = Object.keys(ASSIST_LEISTUNGSBEREICH_LABELS) as AssistLeistungsbereichKey[];

  return (
    <View style={styles.panel}>
      <PremiumCard style={styles.disclaimerCard}>
        <Text style={styles.disclaimerTitle}>CareSuite+ Assist</Text>
        <Text style={styles.disclaimerText}>{ASSIST_MODULE_DISCLAIMER}</Text>
      </PremiumCard>

      {showShiftPreferences && fullClient?.preferences ? (
        <SectionPanel title="Einsatzpräferenzen">
          <DetailInfoRow
            label="Bevorzugte Zeiten"
            value={fullClient.preferences.preferredShifts.join(', ') || null}
          />
          <DetailInfoRow label="Mobilität" value={fullClient.preferences.mobilityNotes} />
          <DetailInfoRow label="Zugang" value={fullClient.preferences.accessInstructions} />
        </SectionPanel>
      ) : null}

      {!isReadOnly ? (
        <SectionPanel title="Assist-Katalog" subtitle={`${getAssistTaskPackages().length} Aufgabenpakete`}>
          {!showCatalog ? (
            <PremiumButton
              title="Aus Katalog hinzufügen"
              variant="secondary"
              onPress={() => setShowCatalog(true)}
            />
          ) : (
            <View style={styles.catalogPanel}>
              {catalogError ? <Text style={styles.error}>{catalogError}</Text> : null}
              {bereichOrder.map((bereich) => {
                const packages = packagesByBereich[bereich];
                if (!packages?.length) return null;
                return (
                  <View key={bereich} style={styles.catalogGroup}>
                    <Text style={styles.catalogGroupTitle}>
                      {ASSIST_LEISTUNGSBEREICH_LABELS[bereich]}
                    </Text>
                    {packages.map((pkg) => (
                      <PremiumCard key={pkg.id} style={styles.catalogCard}>
                        <View style={styles.packageHeader}>
                          <View style={styles.packageInfo}>
                            <Text style={styles.packageTitle}>{pkg.title}</Text>
                            <Text style={styles.secondary}>{pkg.description}</Text>
                            <Text style={styles.meta}>
                              {pkg.taskIds.length} Einzelaufgabe{pkg.taskIds.length === 1 ? '' : 'n'}
                            </Text>
                          </View>
                          <View style={styles.packageActions}>
                            <PremiumButton
                              title="Paket übernehmen"
                              variant="secondary"
                              loading={saving}
                              onPress={() => handleAddPackage(pkg.id)}
                            />
                            <Pressable
                              onPress={() =>
                                setExpandedPackageId((current) => (current === pkg.id ? null : pkg.id))
                              }
                              accessibilityRole="button"
                            >
                              <Text style={styles.linkAction}>
                                {expandedPackageId === pkg.id ? 'Ausblenden' : 'Einzelaufgaben'}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                        {expandedPackageId === pkg.id ? (
                          <View style={styles.taskList}>
                            {getAssistTasksByPackage(pkg.id).map((template) => (
                              <View key={template.id} style={styles.catalogTaskRow}>
                                <View style={styles.catalogTaskInfo}>
                                  <Text style={styles.catalogTaskTitle}>{template.title}</Text>
                                  <Text style={styles.meta}>
                                    {ASSIST_SUBCATEGORY_LABELS[template.subcategory]} ·{' '}
                                    {template.plannedDurationMinutes} Min.
                                  </Text>
                                </View>
                                <PremiumButton
                                  title="+"
                                  variant="secondary"
                                  loading={saving}
                                  onPress={() => handleAddCatalogTask(template.id)}
                                />
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </PremiumCard>
                    ))}
                  </View>
                );
              })}
              <PremiumButton title="Katalog schließen" variant="secondary" onPress={() => setShowCatalog(false)} />
            </View>
          )}
        </SectionPanel>
      ) : null}

      <SectionPanel
        title="Aufgaben & Wünsche"
        subtitle={tasks.length > 0 ? `${tasks.length} Aufgabe${tasks.length === 1 ? '' : 'n'}` : undefined}
      >
        {tasks.length === 0 ? (
          <EmptyState
            title="Noch keine Aufgaben"
            message="Übernehmen Sie ein Aufgabenpaket aus dem Assist-Katalog oder legen Sie eine Aufgabe manuell an."
          />
        ) : (
          bereichOrder.map((bereich) => {
            const bereichTasks = groupedTasks.get(bereich);
            if (!bereichTasks?.length) return null;
            return (
              <View key={bereich} style={styles.taskGroup}>
                <Text style={styles.taskGroupTitle}>{ASSIST_LEISTUNGSBEREICH_LABELS[bereich]}</Text>
                {bereichTasks.map((task) => (
                  <PremiumCard key={task.id} style={styles.card}>
                    <View style={styles.taskHeader}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      {!isReadOnly ? (
                        <View style={styles.taskActions}>
                          <Pressable onPress={() => startEdit(task)} accessibilityRole="button">
                            <Text style={styles.linkAction}>Bearbeiten</Text>
                          </Pressable>
                          <Pressable onPress={() => handleDelete(task.id)} accessibilityRole="button">
                            <Text style={styles.deleteAction}>Löschen</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                    {task.description ? <Text style={styles.secondary}>{task.description}</Text> : null}
                    <View style={styles.badgeRow}>
                      {task.subcategory ? (
                        <PremiumBadge
                          label={ASSIST_SUBCATEGORY_LABELS[task.subcategory]}
                          variant="cyan"
                        />
                      ) : (
                        <PremiumBadge label={TASK_CATEGORY_LABELS[task.category]} variant="cyan" />
                      )}
                      <PremiumBadge label={TASK_FREQUENCY_LABELS[task.frequency]} variant="muted" />
                      {task.isMandatory ? <PremiumBadge label="Pflicht" variant="orange" /> : null}
                      {task.proofRequired ? <PremiumBadge label="Nachweis" variant="muted" /> : null}
                      {task.isActive ? (
                        <PremiumBadge label="Aktiv" variant="green" dot />
                      ) : (
                        <PremiumBadge label="Inaktiv" variant="muted" />
                      )}
                      {task.moduleKey === 'pflege' ? (
                        <PremiumBadge label="Pflege" variant="muted" />
                      ) : (
                        <PremiumBadge label="Assist" variant="muted" />
                      )}
                    </View>
                    {task.durationMinutes ? (
                      <Text style={styles.meta}>{task.durationMinutes} Min.</Text>
                    ) : null}
                    {task.assignedEmployeeIds[0] ? (
                      <Text style={styles.meta}>
                        Zuständig: {employeeNameById.get(task.assignedEmployeeIds[0]) ?? 'Mitarbeiter:in'}
                      </Text>
                    ) : null}
                  </PremiumCard>
                ))}
              </View>
            );
          }).concat(
            groupedTasks.has('sonstige')
              ? [
                  <View key="sonstige" style={styles.taskGroup}>
                    <Text style={styles.taskGroupTitle}>Sonstige</Text>
                    {(groupedTasks.get('sonstige') ?? []).map((task) => (
                      <PremiumCard key={task.id} style={styles.card}>
                        <View style={styles.taskHeader}>
                          <Text style={styles.taskTitle}>{task.title}</Text>
                          {!isReadOnly ? (
                            <View style={styles.taskActions}>
                              <Pressable onPress={() => startEdit(task)} accessibilityRole="button">
                                <Text style={styles.linkAction}>Bearbeiten</Text>
                              </Pressable>
                              <Pressable onPress={() => handleDelete(task.id)} accessibilityRole="button">
                                <Text style={styles.deleteAction}>Löschen</Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                        {task.description ? <Text style={styles.secondary}>{task.description}</Text> : null}
                        <View style={styles.badgeRow}>
                          <PremiumBadge label={TASK_CATEGORY_LABELS[task.category]} variant="cyan" />
                          <PremiumBadge label={TASK_FREQUENCY_LABELS[task.frequency]} variant="muted" />
                        </View>
                      </PremiumCard>
                    ))}
                  </View>,
                ]
              : [],
          )
        )}

        {!isReadOnly && !showForm ? (
          <PremiumButton title="Aufgabe manuell hinzufügen" onPress={startCreate} style={styles.addButton} />
        ) : null}
      </SectionPanel>

      {!isReadOnly && showForm ? (
        <SectionPanel title={editingId ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}>
          <Text style={styles.fieldHint}>
            Manuelle Aufgaben werden dem Assist-Modul zugeordnet. Medizinische Leistungen sind nicht erlaubt.
          </Text>
          <PremiumInput
            label="Titel *"
            value={form.title}
            onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
          />
          <PremiumInput
            label="Beschreibung"
            value={form.description}
            onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
            multiline
          />
          <Text style={styles.fieldLabel}>Kategorie</Text>
          <FilterChipGroup
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(value) => setForm((current) => ({ ...current, category: value as TaskCategory }))}
          />
          <Text style={styles.fieldLabel}>Wiederholung</Text>
          <FilterChipGroup
            options={FREQUENCY_OPTIONS}
            value={form.frequency}
            onChange={(value) => setForm((current) => ({ ...current, frequency: value as TaskFrequency }))}
          />
          <Text style={styles.fieldLabel}>Status</Text>
          <FilterChipGroup
            options={STATUS_OPTIONS}
            value={form.isActive ? 'aktiv' : 'inaktiv'}
            onChange={(value) => setForm((current) => ({ ...current, isActive: value === 'aktiv' }))}
          />
          <Text style={styles.fieldLabel}>Zuständige:r Mitarbeiter:in (optional)</Text>
          {employeesQuery.loading ? (
            <Text style={styles.meta}>Mitarbeitende werden geladen…</Text>
          ) : (
            <FilterChipGroup
              options={employeeOptions.slice(0, 8)}
              value={form.assignedEmployeeId}
              onChange={(value) => setForm((current) => ({ ...current, assignedEmployeeId: value }))}
            />
          )}
          <PremiumInput
            label="Dauer (Minuten, optional)"
            value={form.durationMinutes}
            onChangeText={(value) => setForm((current) => ({ ...current, durationMinutes: value }))}
            keyboardType="number-pad"
          />
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <View style={styles.formActions}>
            <PremiumButton
              title={editingId ? 'Änderungen speichern' : 'Aufgabe speichern'}
              onPress={handleSave}
              loading={saving}
            />
            <PremiumButton title="Abbrechen" variant="secondary" onPress={resetForm} />
          </View>
        </SectionPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingBottom: spacing.lg },
  disclaimerCard: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.border,
  },
  disclaimerTitle: { ...typography.bodyStrong, marginBottom: spacing.xs },
  disclaimerText: { ...typography.caption, color: colors.textSecondary },
  catalogPanel: { gap: spacing.sm },
  catalogGroup: { gap: spacing.sm, marginBottom: spacing.sm },
  catalogGroupTitle: { ...typography.label, marginBottom: spacing.xs },
  catalogCard: { marginBottom: spacing.xs },
  packageHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  packageInfo: { flex: 1 },
  packageTitle: { ...typography.bodyStrong },
  packageActions: { gap: spacing.xs, alignItems: 'flex-end' },
  taskList: { marginTop: spacing.sm, gap: spacing.xs },
  catalogTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  catalogTaskInfo: { flex: 1 },
  catalogTaskTitle: { ...typography.body },
  taskGroup: { marginBottom: spacing.md },
  taskGroupTitle: { ...typography.label, marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  taskTitle: { ...typography.bodyStrong, flex: 1 },
  taskActions: { flexDirection: 'row', gap: spacing.sm },
  linkAction: { ...typography.caption, color: colors.orange, fontWeight: '600' },
  deleteAction: { ...typography.caption, color: colors.danger, fontWeight: '600' },
  secondary: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  addButton: { marginTop: spacing.sm },
  fieldLabel: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.sm },
  fieldHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
});
