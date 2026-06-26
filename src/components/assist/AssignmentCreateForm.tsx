import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlatformModal } from '@/components/layout/platform';
import {
  FilterChipGroup,
  InfoBanner,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { CareDateInput } from '@/components/inputs';
import { DocumentModuleTemplatesPanel } from '@/components/documents/DocumentModuleTemplatesPanel';
import { AssistCatalogGroupedChipSelect } from '@/components/office/assistCatalog/AssistCatalogGroupedChipSelect';
import { AssistCatalogMultiSelect } from '@/components/office/assistCatalog/AssistCatalogMultiSelect';
import {
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useAuroraGlassChipStyles,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { useAssistAssignmentOptions } from '@/hooks/assistCatalog/useAssistCatalog';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchAssignmentEmployeeList } from '@/lib/assist/assignmentEmployeeListService';
import { fetchTenantServiceCatalog } from '@/lib/tenant/tenantServiceCatalogService';
import { createVisitFromWizard } from '@/lib/assist/visitService';
import { ClientBillingProfileSummary } from '@/components/office/ClientAssistBillingPanels';
import { AssignmentBillingBudgetPanel } from '@/components/assist/AssignmentBillingBudgetPanel';
import type { AssistBudgetAllocationResult, ManualBudgetAllocationOverride } from '@/types/assist/assignmentBudgetAllocation';
import { loadTaskPackageItems, mergeTaskDrafts } from '@/lib/assistCatalog';
import {
  ASSIGNMENT_CREATE_SECTIONS,
  EMPTY_VISIT_WIZARD_DATA,
  VISIT_RECURRENCE_PATTERN_LABELS,
  VISIT_RECURRENCE_PATTERN_OPTIONS,
  VISIT_WEEKDAY_OPTIONS,
  type AssignmentCreateSectionKey,
  type VisitCreateWizardData,
  type VisitRecurrencePattern,
  type VisitWeekdayKey,
} from '@/lib/assist/visitTypes';
import type { AssistAssignmentTaskDraft, CatalogItem } from '@/types/assistCatalog';
import { spacing, typography } from '@/theme';

type AssignmentCreateFormProps = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
};

type SelectOption = { value: string; label: string };

const FORM_CTX = { viewContext: 'form' as const };

function normalizeMultiValue(value: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function syncOptionalTaskDrafts(
  selectedKeys: string[],
  currentDrafts: AssistAssignmentTaskDraft[],
  taskItems: CatalogItem[],
  removedTaskKeys: Set<string>,
): AssistAssignmentTaskDraft[] {
  const optionalKeys = new Set(taskItems.map((t) => t.itemKey));
  const packageDrafts = currentDrafts.filter((d) => !optionalKeys.has(d.itemKey));
  const optionalDrafts = selectedKeys
    .filter((k) => optionalKeys.has(k))
    .map((k, index) => {
      const existing = currentDrafts.find((d) => d.itemKey === k);
      if (existing) return existing;
      const item = taskItems.find((t) => t.itemKey === k);
      return {
        itemKey: k,
        title: item?.label ?? k,
        isRequired: false,
        isOptional: true,
        sortOrder: packageDrafts.length + index,
      };
    });
  return mergeTaskDrafts(packageDrafts, optionalDrafts, removedTaskKeys);
}

function ChipSelect({
  label,
  options,
  value,
  onChange,
  multi,
}: {
  label: string;
  options: SelectOption[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) {
  const { isLight } = useLegacyTheme();
  const auroraActive = useAuroraGlassActive();
  const glassChips = useAuroraGlassChipStyles(FORM_CTX);
  const text = useAuroraAdaptiveText();
  const useGlass = isLight && auroraActive;
  const assistAccent = moduleColor('assist');
  const selectedKeys = multi ? normalizeMultiValue(value) : null;

  return (
    <View style={chipStyles.wrap}>
      <Text style={[chipStyles.label, { color: text.primary }]}>{label}</Text>
      {options.length > 0 ? (
        <View style={chipStyles.row}>
          {options.map((opt) => {
            const selected = multi ? selectedKeys!.includes(opt.value) : value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  useGlass ? glassChips.chip : chipStyles.chip,
                  selected &&
                    (useGlass
                      ? glassChips.chipSelected
                      : { borderColor: assistAccent, backgroundColor: `${assistAccent}22` }),
                ]}
                onPress={() => {
                  if (multi) {
                    const current = normalizeMultiValue(value);
                    onChange(
                      selected
                        ? current.filter((v) => v !== opt.value)
                        : [...current, opt.value],
                    );
                  } else {
                    onChange(opt.value);
                  }
                }}
              >
                <Text
                  style={[
                    useGlass ? glassChips.label : [chipStyles.chipText, { color: text.primary }],
                    selected &&
                      (useGlass
                        ? glassChips.labelSelected
                        : { fontWeight: '600', color: assistAccent }),
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.caption, marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chipText: { ...typography.caption },
});

export function AssignmentCreateForm({ visible, onClose, onCreated }: AssignmentCreateFormProps) {
  const assistAccent = moduleColor('assist');
  const text = useAuroraAdaptiveText();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const { options, loading: optionsLoading, error: optionsError } = useAssistAssignmentOptions();
  const canManage = can('assist.assignments.manage');

  const [section, setSection] = useState<AssignmentCreateSectionKey>('basis');
  const [form, setForm] = useState<VisitCreateWizardData>(EMPTY_VISIT_WIZARD_DATA);
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [employees, setEmployees] = useState<SelectOption[]>([]);
  const [services, setServices] = useState<SelectOption[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removedTaskKeys, setRemovedTaskKeys] = useState<Set<string>>(new Set());
  const [budgetAllocation, setBudgetAllocation] = useState<AssistBudgetAllocationResult | null>(null);
  const [budgetManualOverride, setBudgetManualOverride] = useState<ManualBudgetAllocationOverride | null>(null);

  const patch = useCallback((partial: Partial<VisitCreateWizardData>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    if (!visible || !tenantId) return;
    setSection('basis');
    setForm(EMPTY_VISIT_WIZARD_DATA);
    setError(null);
    setRemovedTaskKeys(new Set());
    setBudgetAllocation(null);
    setBudgetManualOverride(null);
    setListsLoading(true);

    void (async () => {
      const [clientRes, employeeRes, catalogRes] = await Promise.all([
        fetchClientList(tenantId, profile?.roleKey, { lifecycleFilter: 'active' }),
        fetchAssignmentEmployeeList(tenantId, profile?.roleKey),
        fetchTenantServiceCatalog(tenantId, profile?.roleKey),
      ]);
      if (clientRes.ok) {
        setClients(
          clientRes.data.map((c) => ({
            value: c.id,
            label: `${c.firstName} ${c.lastName}`.trim(),
          })),
        );
      }
      if (employeeRes.ok) {
        setEmployees(
          employeeRes.data.map((e) => ({
            value: e.id,
            label: `${e.firstName} ${e.lastName}`.trim(),
          })),
        );
      }
      if (catalogRes.ok) {
        setServices(
          catalogRes.data.items
            .filter((item) => item.isActive && item.moduleKey === 'assist')
            .map((item) => ({ value: item.serviceKey, label: item.name })),
        );
      }
      setListsLoading(false);
    })();
  }, [visible, tenantId, profile?.roleKey]);

  const subjectOptions = useMemo(
    () => (options?.subjects ?? []).map((s) => ({ value: s.itemKey, label: s.label })),
    [options],
  );

  const optionalTaskItemKeys = useMemo(() => {
    const items = options?.taskItems ?? [];
    return form.taskDrafts
      .filter((d) => items.some((t) => t.itemKey === d.itemKey))
      .map((d) => d.itemKey);
  }, [form.taskDrafts, options?.taskItems]);

  const durationMinutes = useMemo(() => {
    const start = new Date(`${form.assignmentDate}T${form.plannedStartTime}:00`);
    const end = new Date(`${form.assignmentDate}T${form.plannedEndTime}:00`);
    const diff = end.getTime() - start.getTime();
    return diff > 0 ? Math.round(diff / 60000) : 0;
  }, [form.assignmentDate, form.plannedStartTime, form.plannedEndTime]);

  const handlePackageSelect = async (packageId: string) => {
    if (!tenantId) return;
    patch({ taskPackageId: packageId });
    const res = await loadTaskPackageItems(tenantId, packageId, profile?.roleKey);
    if (res.ok) {
      const merged = mergeTaskDrafts(res.data, [], new Set());
      patch({ taskDrafts: merged, tasks: merged.map((t) => t.title) });
      setRemovedTaskKeys(new Set());
    }
  };

  const showRecurrenceWeekdays =
    form.recurrencePattern === 'weekly' || form.recurrencePattern === 'biweekly';

  const handleSave = async (asDraft: boolean) => {
    if (!tenantId || !canManage) return;
    setLoading(true);
    setError(null);
    const payload: VisitCreateWizardData = {
      ...form,
      saveAsDraft: asDraft,
      title: form.title || subjectOptions.find((s) => s.value === form.subjectKey)?.label || 'Neuer Einsatz',
      catalogSnapshotJson: {
        subjectKey: form.subjectKey,
        assignmentTypeKey: form.assignmentTypeKey,
        serviceCategoryKey: form.serviceCategoryKey,
        taskPackageId: form.taskPackageId,
        riskFlagKeys: form.riskFlagKeys,
        recurrencePattern: form.recurrencePattern,
        recurrenceEndDate: form.recurrenceEndDate || null,
        recurrenceWeekdays: form.recurrenceWeekdays,
        recurrenceOccurrenceCount: form.recurrenceOccurrenceCount,
        budgetAllocation,
      },
      budgetAllocation,
      budgetManualOverride,
      budgetAmountCents: budgetAllocation?.totalAmountCents ?? form.budgetAmountCents,
      billingBudgetSourceKey: budgetAllocation?.primaryCatalogKey ?? form.billingBudgetSourceKey,
    };
    const res = await createVisitFromWizard(tenantId, payload, profile?.roleKey);
    setLoading(false);
    if (res.ok) {
      onCreated?.(res.data.id);
      onClose();
    } else {
      setError(res.error);
    }
  };

  const renderCatalogSectionHint = () => {
    if (optionsLoading) {
      return <Text style={[styles.hint, { color: text.primary }]}>Kataloge werden geladen…</Text>;
    }
    if (optionsError) {
      return <InfoBanner message={optionsError} variant="danger" />;
    }
    return null;
  };

  const renderSection = () => {
    switch (section) {
      case 'basis':
        return (
          <SectionPanel {...FORM_CTX} title="Basisdaten">
            <PremiumInput
              {...FORM_CTX}
              label="Titel (optional)"
              value={form.title}
              onChangeText={(title) => patch({ title })}
              placeholder="z. B. Hausbesuch Pflege"
            />
            <PremiumInput
              {...FORM_CTX}
              label="Beschreibung"
              value={form.description}
              onChangeText={(description) => patch({ description })}
              placeholder="Kurzbeschreibung des Einsatzes"
              multiline
            />
          </SectionPanel>
        );

      case 'people':
        return (
          <SectionPanel {...FORM_CTX} title="Klient:in & Mitarbeitende:r">
            {listsLoading ? (
              <Text style={[styles.hint, { color: text.primary }]}>Klient:innen und Mitarbeitende werden geladen…</Text>
            ) : null}
            {!listsLoading && clients.length === 0 ? (
              <InfoBanner message="Keine aktiven Klient:innen gefunden." variant="warning" />
            ) : null}
            <ChipSelect
              label="Klient:in *"
              options={clients}
              value={form.clientId}
              onChange={(v) => patch({ clientId: v as string })}
            />
            {form.clientId ? <ClientBillingProfileSummary clientId={form.clientId} /> : null}
            <ChipSelect
              label="Mitarbeitende:r"
              options={employees}
              value={form.employeeId}
              onChange={(v) => patch({ employeeId: v as string })}
            />
          </SectionPanel>
        );

      case 'schedule':
        return (
          <SectionPanel {...FORM_CTX} title="Termin & Wiederholung">
            <CareDateInput
              {...FORM_CTX}
              label="Datum *"
              value={form.assignmentDate}
              onChange={(assignmentDate) => patch({ assignmentDate })}
            />
            <PremiumInput
              {...FORM_CTX}
              label="Beginn *"
              value={form.plannedStartTime}
              onChangeText={(plannedStartTime) => patch({ plannedStartTime })}
              placeholder="HH:MM"
            />
            <PremiumInput
              {...FORM_CTX}
              label="Ende *"
              value={form.plannedEndTime}
              onChangeText={(plannedEndTime) => patch({ plannedEndTime })}
              placeholder="HH:MM"
            />
            {durationMinutes > 0 ? (
              <Text style={[styles.hint, { color: text.primary }]}>Dauer: {durationMinutes} Minuten</Text>
            ) : null}
            <ChipSelect
              label="Wiederholung"
              options={VISIT_RECURRENCE_PATTERN_OPTIONS.map((o) => ({
                value: o.key,
                label: o.label,
              }))}
              value={form.recurrencePattern}
              onChange={(v) => {
                const pattern = v as VisitRecurrencePattern;
                patch({
                  recurrencePattern: pattern,
                  recurrenceWeekdays:
                    pattern === 'weekly' || pattern === 'biweekly' ? form.recurrenceWeekdays : [],
                });
              }}
            />
            {showRecurrenceWeekdays ? (
              <ChipSelect
                label="Wochentage"
                options={VISIT_WEEKDAY_OPTIONS.map((o) => ({
                  value: o.key,
                  label: o.label,
                }))}
                value={form.recurrenceWeekdays}
                onChange={(v) => patch({ recurrenceWeekdays: v as VisitWeekdayKey[] })}
                multi
              />
            ) : null}
            {form.recurrencePattern !== 'none' ? (
              <>
                <CareDateInput
                  {...FORM_CTX}
                  label="Wiederholen bis (optional)"
                  value={form.recurrenceEndDate}
                  onChange={(recurrenceEndDate) => patch({ recurrenceEndDate })}
                  placeholder="TT.MM.JJJJ — leer = ohne Enddatum"
                />
                <PremiumInput
                  {...FORM_CTX}
                  label="Anzahl Termine (optional)"
                  value={
                    form.recurrenceOccurrenceCount != null
                      ? String(form.recurrenceOccurrenceCount)
                      : ''
                  }
                  onChangeText={(v) => {
                    const n = v.trim() ? Number(v.replace(/\D/g, '')) : null;
                    patch({
                      recurrenceOccurrenceCount:
                        n != null && Number.isFinite(n) && n > 0 ? n : null,
                    });
                  }}
                  placeholder="z. B. 12 — leer = unbegrenzt"
                  keyboardType="numeric"
                />
              </>
            ) : null}
          </SectionPanel>
        );

      case 'type':
        return (
          <SectionPanel {...FORM_CTX} title="Einsatzart & Betreff">
            {renderCatalogSectionHint()}
            <ChipSelect
              label="Einsatz-Betreff *"
              options={subjectOptions}
              value={form.subjectKey}
              onChange={(v) => {
                const key = v as string;
                const label = subjectOptions.find((s) => s.value === key)?.label ?? '';
                patch({ subjectKey: key, title: label });
              }}
            />
            {(options?.assignmentTypes?.length ?? 0) > 0 ? (
              <AssistCatalogGroupedChipSelect
                label="Einsatzart"
                items={options?.assignmentTypes ?? []}
                value={form.assignmentTypeKey}
                onChange={(assignmentTypeKey) => patch({ assignmentTypeKey })}
              />
            ) : null}
            <ChipSelect
              label="Leistungskategorie"
              options={(options?.serviceCategories ?? []).map((c) => ({
                value: c.itemKey,
                label: c.label,
              }))}
              value={form.serviceCategoryKey}
              onChange={(v) => patch({ serviceCategoryKey: v as string })}
            />
            <ChipSelect
              label="Leistung (Abrechnung)"
              options={services}
              value={form.serviceKey}
              onChange={(v) => {
                const key = v as string;
                patch({
                  serviceKey: key,
                  serviceName: services.find((s) => s.value === key)?.label ?? key,
                });
              }}
            />
          </SectionPanel>
        );

      case 'tasks':
        return (
          <SectionPanel {...FORM_CTX} title="Aufgabenpaket & Aufgaben">
            {renderCatalogSectionHint()}
            <Text style={[styles.hint, { color: text.primary }]}>
              Aufgabenpaket wählen — enthaltene Aufgaben werden automatisch geladen.
            </Text>
            {(options?.taskPackages?.length ?? 0) === 0 && !optionsLoading ? (
              <InfoBanner message="Keine Aufgabenpakete verfügbar." variant="warning" />
            ) : null}
            <View style={styles.packageGrid}>
              {(options?.taskPackages ?? []).map((pkg) => (
                <TouchableOpacity
                  key={pkg.id}
                  style={[
                    styles.packageCard,
                    { borderColor: text.muted },
                    form.taskPackageId === pkg.id && { borderColor: assistAccent },
                  ]}
                  onPress={() => void handlePackageSelect(pkg.id)}
                >
                  <Text style={[styles.packageTitle, { color: text.primary }]}>{pkg.label}</Text>
                  {pkg.defaultDurationMinutes ? (
                    <Text style={[styles.packageMeta, { color: text.primary }]}>
                      {pkg.defaultDurationMinutes} Min.
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
            <AssistCatalogMultiSelect
              items={options?.taskItems ?? []}
              label="Zusätzliche Einzelaufgaben (Mehrfachauswahl)"
              values={optionalTaskItemKeys}
              loading={optionsLoading}
              onChange={(keys) => {
                const merged = syncOptionalTaskDrafts(
                  keys,
                  form.taskDrafts,
                  options?.taskItems ?? [],
                  removedTaskKeys,
                );
                patch({ taskDrafts: merged, tasks: merged.map((t) => t.title) });
              }}
            />
            {form.taskDrafts.map((task, index) => (
              <View key={`${task.itemKey}-${index}`} style={styles.taskRow}>
                <Text style={[styles.taskTitle, { color: text.primary }]}>
                  {task.isRequired ? '★ ' : ''}
                  {task.title}
                </Text>
                <PremiumButton
                  title="Entfernen"
                  variant="secondary"
                  onPress={() => {
                    const nextRemoved = new Set(removedTaskKeys);
                    nextRemoved.add(task.itemKey);
                    setRemovedTaskKeys(nextRemoved);
                    const merged = mergeTaskDrafts(form.taskDrafts, [], nextRemoved);
                    patch({ taskDrafts: merged, tasks: merged.map((t) => t.title) });
                  }}
                />
              </View>
            ))}
          </SectionPanel>
        );

      case 'hints':
        return (
          <SectionPanel {...FORM_CTX} title="Hinweise & Risiken">
            {renderCatalogSectionHint()}
            <AssistCatalogMultiSelect
              items={options?.riskFlags ?? []}
              label="Risiken (Mehrfachauswahl)"
              values={form.riskFlagKeys}
              loading={optionsLoading}
              onChange={(riskFlagKeys) => patch({ riskFlagKeys })}
            />
            <PremiumInput
              {...FORM_CTX}
              label="Interne Hinweise"
              value={form.internalNotes}
              onChangeText={(internalNotes) => patch({ internalNotes })}
              multiline
            />
            <PremiumInput
              {...FORM_CTX}
              label="Hinweise für Mitarbeitende"
              value={form.employeeNotes}
              onChangeText={(employeeNotes) => patch({ employeeNotes })}
              multiline
            />
            <PremiumInput
              {...FORM_CTX}
              label="Hinweise für Klient:innen"
              value={form.clientVisibleNotes}
              onChangeText={(clientVisibleNotes) => patch({ clientVisibleNotes })}
              multiline
            />
          </SectionPanel>
        );

      case 'billing':
        return (
          <SectionPanel {...FORM_CTX} title="Abrechnung & Budget">
            {form.clientId ? (
              <AssignmentBillingBudgetPanel
                clientId={form.clientId}
                clientName={clients.find((c) => c.value === form.clientId)?.label}
                assignmentDate={form.assignmentDate}
                plannedStartTime={form.plannedStartTime}
                plannedEndTime={form.plannedEndTime}
                serviceKey={form.serviceKey}
                plannedMinutes={durationMinutes}
                allocation={budgetAllocation}
                manualOverride={budgetManualOverride}
                onAllocationChange={setBudgetAllocation}
                onManualOverrideChange={setBudgetManualOverride}
              />
            ) : (
              <InfoBanner message="Bitte zuerst eine:n Klient:in im Tab „Klient & Mitarbeitende“ auswählen." variant="warning" />
            )}
          </SectionPanel>
        );

      case 'documentation':
        return (
          <>
            <SectionPanel {...FORM_CTX} title="Dokumentation & Nachweis">
              <PremiumInput
                {...FORM_CTX}
                label="Dokumentationsvorlage"
                value={form.documentationTemplate}
                onChangeText={(documentationTemplate) => patch({ documentationTemplate })}
              />
              <ChipSelect
                label="Leistungsnachweis-Vorlage"
                options={[
                  { value: 'einzel', label: 'Einzel-Einsatznachweis' },
                  { value: 'monat', label: 'Monatsnachweis' },
                ]}
                value={form.proofTemplateKey}
                onChange={(v) => patch({ proofTemplateKey: v as string })}
              />
            </SectionPanel>
            <DocumentModuleTemplatesPanel
              tenantId={tenantId}
              targetModule="assist"
              targetArea="assignment"
              clientId={form.clientId || undefined}
              employeeId={form.employeeId || profile?.id}
              assistOnly
              title="Einsatz-Dokumentvorlagen"
            />
          </>
        );

      case 'review':
        return (
          <SectionPanel {...FORM_CTX} title="Prüfung & Speichern">
            <InfoBanner message={`Betreff: ${form.title || form.subjectKey || '—'}`} />
            <InfoBanner
              message={`Klient: ${clients.find((c) => c.value === form.clientId)?.label ?? '—'}`}
            />
            <InfoBanner
              message={`Termin: ${form.assignmentDate} ${form.plannedStartTime}–${form.plannedEndTime}`}
            />
            <InfoBanner
              message={`Wiederholung: ${VISIT_RECURRENCE_PATTERN_LABELS[form.recurrencePattern]}${
                form.recurrenceWeekdays.length > 0
                  ? ` (${form.recurrenceWeekdays
                      .map((d) => VISIT_WEEKDAY_OPTIONS.find((o) => o.key === d)?.label ?? d)
                      .join(', ')})`
                  : ''
              }${
                form.recurrenceEndDate ? ` bis ${form.recurrenceEndDate}` : ''
              }${
                form.recurrenceOccurrenceCount ? ` · ${form.recurrenceOccurrenceCount}×` : ''
              }`}
            />
            <InfoBanner
              message={`Aufgaben: ${form.taskDrafts.length || form.tasks.filter(Boolean).length}`}
            />
            <InfoBanner
              message={`Abrechnung: ${
                budgetAllocation
                  ? `${budgetAllocation.allocationProposal
                      .filter((l) => l.amountCents > 0)
                      .map((l) => `${l.label} ${(l.amountCents / 100).toFixed(2)} €`)
                      .join(' · ') || '—'}`
                  : 'Automatisch nach Klient:innenprofil'
              }`}
            />
            <View style={styles.actions}>
              <PremiumButton
                title="Entwurf speichern"
                variant="secondary"
                onPress={() => void handleSave(true)}
                disabled={loading}
              />
              <PremiumButton
                title="Einsatz speichern"
                onPress={() => void handleSave(false)}
                disabled={loading || !form.clientId}
              />
            </View>
          </SectionPanel>
        );

      default:
        return null;
    }
  };

  if (!canManage) {
    return (
      <PlatformModal visible={visible} onClose={onClose} title="Neuer Einsatz">
        <InfoBanner message="Keine Berechtigung zum Anlegen von Einsätzen." />
      </PlatformModal>
    );
  }

  return (
    <PlatformModal
      visible={visible}
      onClose={onClose}
      title="Neuer Einsatz"
      maxWidth={960}
      maxHeightRatio={0.92}
      glowColor={assistAccent}
      footerActions={[{ title: 'Schließen', onPress: onClose, variant: 'glass' }]}
    >
      {error ? <InfoBanner message={error} variant="danger" /> : null}
      <FilterChipGroup
        options={[...ASSIGNMENT_CREATE_SECTIONS]}
        value={section}
        onChange={(v) => setSection(v as AssignmentCreateSectionKey)}
        wrap
        style={styles.tabBar}
      />
      <ScrollView
        style={styles.sectionScroll}
        contentContainerStyle={styles.sectionBody}
        keyboardShouldPersistTaps="handled"
      >
        {renderSection()}
      </ScrollView>
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  tabBar: { marginBottom: careSpacing.sm, flexGrow: 0 },
  sectionScroll: { flexGrow: 1, flexShrink: 1, maxWidth: '100%' },
  sectionBody: { gap: careSpacing.md, paddingBottom: careSpacing.lg, minHeight: 120 },
  hint: { ...typography.caption, marginBottom: spacing.sm },
  packageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  packageCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    minWidth: 160,
    flexGrow: 1,
  },
  packageTitle: { ...typography.body, fontWeight: '600' },
  packageMeta: { ...typography.caption, marginTop: 4 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  taskTitle: { ...typography.body, flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
});
