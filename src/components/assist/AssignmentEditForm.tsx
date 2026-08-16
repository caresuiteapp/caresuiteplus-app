import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CareDateInput, CareTimeInput } from "@/components/inputs";
import { AssistCatalogGroupedChipSelect } from "@/components/office/assistCatalog/AssistCatalogGroupedChipSelect";
import {
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from "@/components/ui";
import { useAuroraAdaptiveText } from "@/design/tokens/auroraGlass";
import {
  AssignmentStudioScaffold,
  type AssignmentStudioStep,
} from "@/components/assist/AssignmentStudioScaffold";
import { useAssistAssignmentOptions } from "@/hooks/assistCatalog/useAssistCatalog";
import { useAuth } from "@/lib/auth/context";
import { useServiceTenantId } from "@/hooks/useTenantId";
import { usePermissions } from "@/hooks/usePermissions";
import { fetchClientList } from "@/lib/office/clientListService";
import { fetchAssignmentEmployeeList } from "@/lib/assist/assignmentEmployeeListService";
import { fetchTenantServiceCatalog } from "@/lib/tenant/tenantServiceCatalogService";
import {
  mapVisitDetailToEditForm,
  type VisitEditFormData,
} from "@/lib/assist/visitEditMappers";
import {
  updateVisitFromWizard,
  type VisitSeriesMutationScope,
} from "@/lib/assist/visitService";
import { parseVisitRecurrenceJson } from "@/lib/assist/visitRecurrenceExpansion";
import {
  hasAssignmentProductionErrors,
  validateAssignmentCreateForm,
} from "@/lib/assist/assignmentProductionValidation";
import type { VisitDispositionDetail } from "@/lib/assist/visitTypes";
import {
  ASSIGNMENT_STATUS_LABELS,
  type AssignmentStatus,
} from "@/types/modules/assignmentStatus";
import { spacing, typography } from "@/theme";

type AssignmentEditFormProps = {
  visitId: string;
  initialVisit: VisitDispositionDetail;
  onCancel: () => void;
  onSaved?: (id: string) => void;
};

type SelectOption = { value: string; label: string };

const FORM_CTX = {
  viewContext: "form" as const,
  onDarkSurface: true as const,
};

const EDITABLE_STATUS_OPTIONS: AssignmentStatus[] = [
  "geplant",
  "bestaetigt",
  "storniert",
  "abgeschlossen",
];

type EditSectionKey =
  | "overview"
  | "people"
  | "schedule"
  | "tasks"
  | "status"
  | "catalog"
  | "documentation";

const EDIT_STUDIO_STEPS: readonly AssignmentStudioStep<EditSectionKey>[] = [
  { key: "overview", label: "Übersicht", icon: "grid-outline" },
  { key: "people", label: "Personen", icon: "people-outline" },
  { key: "schedule", label: "Termin & Ort", icon: "calendar-outline" },
  { key: "tasks", label: "Aufgaben", icon: "checkmark-done-outline" },
  { key: "status", label: "Status", icon: "pulse-outline" },
  { key: "catalog", label: "Leistung", icon: "briefcase-outline" },
  {
    key: "documentation",
    label: "Nachweis",
    icon: "clipboard-outline",
    optional: true,
  },
];

function ChipSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={chipStyles.wrap}>
      <Text style={chipStyles.label}>{label}</Text>
      {options.length > 0 ? (
        <View style={chipStyles.row}>
          {options.map((opt) => {
            const selected = value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[chipStyles.chip, selected && chipStyles.chipSelected]}
                onPress={() => onChange(opt.value)}
              >
                <Text
                  style={[
                    chipStyles.chipText,
                    selected && chipStyles.chipTextSelected,
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
  label: {
    ...typography.caption,
    marginBottom: spacing.xs,
    color: "#D5E8F7",
    fontWeight: "800",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: "rgba(105, 215, 255, 0.34)",
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: "#123452",
  },
  chipSelected: { borderColor: "#69D7FF", backgroundColor: "#155386" },
  chipText: { ...typography.caption, color: "#D5E8F7", fontWeight: "700" },
  chipTextSelected: { color: "#FFFFFF", fontWeight: "800" },
});

export function AssignmentEditForm({
  visitId,
  initialVisit,
  onCancel,
  onSaved,
}: AssignmentEditFormProps) {
  const text = useAuroraAdaptiveText();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, isReadOnly } = usePermissions();
  const {
    options,
    loading: optionsLoading,
    error: optionsError,
  } = useAssistAssignmentOptions();
  const canManage = can("assist.assignments.manage") && !isReadOnly;

  const [form, setForm] = useState<VisitEditFormData>(() =>
    mapVisitDetailToEditForm(initialVisit),
  );
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [employees, setEmployees] = useState<SelectOption[]>([]);
  const [services, setServices] = useState<SelectOption[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seriesScope, setSeriesScope] =
    useState<VisitSeriesMutationScope>("this_only");
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<EditSectionKey>("overview");

  const patch = useCallback((partial: Partial<VisitEditFormData>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    setForm(mapVisitDetailToEditForm(initialVisit));
  }, [initialVisit]);

  useEffect(() => {
    if (!tenantId) return;
    setListsLoading(true);
    void (async () => {
      const [clientRes, employeeRes, catalogRes] = await Promise.all([
        fetchClientList(tenantId, profile?.roleKey, {
          lifecycleFilter: "active",
        }),
        fetchAssignmentEmployeeList(tenantId, profile?.roleKey),
        fetchTenantServiceCatalog(tenantId, profile?.roleKey),
      ]);
      if (clientRes.ok) {
        setClients(
          clientRes.data.map((client) => ({
            value: client.id,
            label: `${client.firstName} ${client.lastName}`.trim(),
          })),
        );
      }
      if (employeeRes.ok) {
        setEmployees(
          employeeRes.data.map((employee) => ({
            value: employee.id,
            label: `${employee.firstName} ${employee.lastName}`.trim(),
          })),
        );
      }
      if (catalogRes.ok) {
        setServices(
          catalogRes.data.items
            .filter((item) => item.isActive && item.moduleKey === "assist")
            .map((item) => ({ value: item.serviceKey, label: item.name })),
        );
      }
      setListsLoading(false);
    })();
  }, [tenantId, profile?.roleKey]);

  const subjectOptions = useMemo(
    () =>
      (options?.subjects ?? []).map((subject) => ({
        value: subject.itemKey,
        label: subject.label,
      })),
    [options],
  );

  const statusOptions = useMemo(() => {
    const keys = new Set<AssignmentStatus>([
      ...EDITABLE_STATUS_OPTIONS,
      initialVisit.assignmentStatus,
      form.assignmentStatus,
    ]);
    return [...keys].map((key) => ({
      key,
      label: ASSIGNMENT_STATUS_LABELS[key],
    }));
  }, [form.assignmentStatus, initialVisit.assignmentStatus]);

  const selectedClient =
    clients.find((item) => item.value === form.clientId)?.label ??
    initialVisit.clientName;
  const selectedEmployee =
    employees.find((item) => item.value === form.employeeId)?.label ??
    initialVisit.employeeName;
  const completedTasks = initialVisit.tasks.filter(
    (task) => task.status === "done",
  ).length;

  const handleSave = async () => {
    if (!tenantId || !canManage) return;
    const validation = validateAssignmentCreateForm({
      clientId: form.clientId,
      employeeId: form.employeeId,
      assignmentDate: form.assignmentDate,
      plannedStartTime: form.plannedStartTime,
      plannedEndTime: form.plannedEndTime,
      title: form.title,
      tasks: form.taskDrafts.map((task) => task.title),
    });
    if (hasAssignmentProductionErrors(validation)) {
      setError(Object.values(validation)[0] ?? "Bitte Pflichtfelder prüfen.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateVisitFromWizard(
      tenantId,
      visitId,
      form,
      profile?.roleKey,
      seriesScope,
    );
    setSaving(false);
    if (result.ok) {
      onSaved?.(result.data.id);
    } else {
      setError(result.error);
    }
  };

  if (!canManage) {
    return (
      <InfoBanner
        message="Keine Berechtigung zum Bearbeiten von Einsätzen."
        variant="warning"
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {error ? <ErrorState message={error} /> : null}
      <AssignmentStudioScaffold
        steps={EDIT_STUDIO_STEPS}
        activeStep={section}
        onStepChange={setSection}
        title={form.title || "Einsatz bearbeiten"}
        description="Termin, Zuständigkeit, Aufgaben und Nachweise werden als zusammenhängender Arbeitsablauf gepflegt. Änderungen bleiben bis zum Speichern lokal."
        summary={[
          { label: "Klient:in", value: selectedClient, icon: "person-outline" },
          {
            label: "Termin",
            value: `${form.assignmentDate} · ${form.plannedStartTime}–${form.plannedEndTime}`,
            icon: "time-outline",
          },
          {
            label: "Zuständig",
            value: selectedEmployee || "Nicht zugewiesen",
            icon: "person-add-outline",
            tone: selectedEmployee ? "success" : "warning",
          },
          {
            label: "Aufgaben",
            value: `${completedTasks} von ${initialVisit.tasks.length} erledigt`,
            icon: "checkmark-circle-outline",
            tone:
              completedTasks === initialVisit.tasks.length &&
              initialVisit.tasks.length > 0
                ? "success"
                : "info",
          },
        ]}
        footer={
          <>
            <PremiumButton
              title="Abbrechen"
              variant="ghost"
              onPress={onCancel}
            />
            <PremiumButton
              title="Änderungen speichern"
              loading={saving}
              disabled={saving || !form.title.trim() || !form.clientId}
              onPress={() => void handleSave()}
            />
          </>
        }
      >
        {(() => {
          const recurrence = parseVisitRecurrenceJson(
            initialVisit.recurrenceJson,
          );
          const isSeriesOccurrence =
            recurrence.pattern !== "none" || Boolean(recurrence.parentSeriesId);
          return isSeriesOccurrence && section === "schedule" ? (
            <SectionPanel {...FORM_CTX} title="Änderungsbereich">
              <InfoBanner
                message={
                  seriesScope === "this_only"
                    ? "Es wird ausschließlich dieser konkrete Termin geändert."
                    : "Dieser Termin und alle noch nicht begonnenen Folgetermine werden geändert. Vergangene oder bereits ausgeführte Termine bleiben unverändert."
                }
                variant="info"
              />
              <FilterChipGroup
                onDarkSurface
                options={[
                  { key: "this_only", label: "Nur dieser Termin" },
                  { key: "this_and_following", label: "Dieser und folgende" },
                ]}
                value={seriesScope}
                onChange={(value) =>
                  setSeriesScope(value as VisitSeriesMutationScope)
                }
                wrap
              />
            </SectionPanel>
          ) : null;
        })()}

        {section === "overview" ? (
          <SectionPanel {...FORM_CTX} title="Basisdaten">
            <PremiumInput
              {...FORM_CTX}
              label="Bezeichnung *"
              value={form.title}
              onChangeText={(title) => patch({ title })}
              placeholder="Einsatzbezeichnung"
            />
            <PremiumInput
              {...FORM_CTX}
              label="Beschreibung"
              value={form.description}
              onChangeText={(description) => patch({ description })}
              multiline
            />
          </SectionPanel>
        ) : null}

        {section === "people" ? (
          <SectionPanel {...FORM_CTX} title="Klient:in & Mitarbeitende:r">
            {listsLoading ? (
              <Text style={[styles.hint, { color: text.primary }]}>
                Klient:innen und Mitarbeitende werden geladen…
              </Text>
            ) : null}
            <ChipSelect
              label="Klient:in *"
              options={clients}
              value={form.clientId}
              onChange={(clientId) => patch({ clientId })}
            />
            <ChipSelect
              label="Mitarbeitende:r"
              options={employees}
              value={form.employeeId}
              onChange={(employeeId) => patch({ employeeId })}
            />
          </SectionPanel>
        ) : null}

        {section === "schedule" ? (
          <>
            <SectionPanel {...FORM_CTX} title="Termin & Dauer">
              <CareDateInput
                {...FORM_CTX}
                label="Datum *"
                value={form.assignmentDate}
                onChange={(assignmentDate) => patch({ assignmentDate })}
                showFormatHint={false}
              />
              <CareTimeInput
                {...FORM_CTX}
                label="Beginn *"
                value={form.plannedStartTime}
                onChange={(plannedStartTime) => patch({ plannedStartTime })}
                showFormatHint={false}
              />
              <CareTimeInput
                {...FORM_CTX}
                label="Ende *"
                value={form.plannedEndTime}
                onChange={(plannedEndTime) => patch({ plannedEndTime })}
                showFormatHint={false}
              />
            </SectionPanel>

            <SectionPanel {...FORM_CTX} title="Ort & zielgerichtete Hinweise">
              <PremiumInput
                {...FORM_CTX}
                label="Ort"
                value={form.addressSnapshot}
                onChangeText={(addressSnapshot) => patch({ addressSnapshot })}
                placeholder="Adresse oder Treffpunkt"
              />
              <PremiumInput
                {...FORM_CTX}
                label="Ortshinweise"
                value={form.locationNotes}
                onChangeText={(locationNotes) => patch({ locationNotes })}
                multiline
              />
              <PremiumInput
                {...FORM_CTX}
                label="Interne Notizen"
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
                onChangeText={(clientVisibleNotes) =>
                  patch({ clientVisibleNotes })
                }
                multiline
              />
            </SectionPanel>
          </>
        ) : null}

        {section === "tasks" ? (
          <SectionPanel {...FORM_CTX} title="Aufgaben">
            {form.taskDrafts.map((task, index) => (
              <View key={`${task.itemKey}-${index}`} style={styles.taskRow}>
                <View style={styles.taskIndex}>
                  <Text style={styles.taskIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.taskField}>
                  <PremiumInput
                    {...FORM_CTX}
                    style={styles.taskInput}
                    label={task.isRequired ? "Pflichtaufgabe" : "Aufgabe"}
                    value={task.title}
                    placeholder="Aufgabe beschreiben"
                    onChangeText={(title) => {
                      const taskDrafts = [...form.taskDrafts];
                      taskDrafts[index] = { ...task, title };
                      patch({
                        taskDrafts,
                        tasks: taskDrafts.map((entry) => entry.title),
                      });
                    }}
                  />
                </View>
                {!task.isRequired ? (
                  <PremiumButton
                    title="Entfernen"
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      const taskDrafts = form.taskDrafts.filter(
                        (_, taskIndex) => taskIndex !== index,
                      );
                      patch({
                        taskDrafts,
                        tasks: taskDrafts.map((entry) => entry.title),
                      });
                    }}
                  />
                ) : null}
              </View>
            ))}
            <PremiumButton
              title="Aufgabe hinzufügen"
              size="sm"
              variant="secondary"
              onPress={() => {
                const taskDrafts = [
                  ...form.taskDrafts,
                  {
                    itemKey: `manual-${Date.now()}`,
                    title: "",
                    isRequired: false,
                    isOptional: true,
                    sortOrder: form.taskDrafts.length,
                  },
                ];
                patch({
                  taskDrafts,
                  tasks: taskDrafts.map((entry) => entry.title),
                });
              }}
            />
          </SectionPanel>
        ) : null}

        {section === "status" ? (
          <SectionPanel {...FORM_CTX} title="Status">
            <InfoBanner
              message="Der Status steuert Sichtbarkeit, Durchführung, Dokumentationspflicht und Abrechnung. Bereits ausgeführte Schritte bleiben nachvollziehbar."
              variant="info"
            />
            <FilterChipGroup
              onDarkSurface
              options={statusOptions}
              value={form.assignmentStatus}
              onChange={(assignmentStatus) =>
                patch({
                  assignmentStatus: assignmentStatus as AssignmentStatus,
                })
              }
              wrap
            />
          </SectionPanel>
        ) : null}

        {section === "catalog" ? (
          <SectionPanel {...FORM_CTX} title="Einsatzart & Katalog">
            {optionsLoading ? (
              <Text style={[styles.hint, { color: text.primary }]}>
                Kataloge werden geladen…
              </Text>
            ) : null}
            {optionsError ? (
              <InfoBanner message={optionsError} variant="danger" />
            ) : null}
            <ChipSelect
              label="Einsatz-Betreff"
              options={subjectOptions}
              value={form.subjectKey}
              onChange={(subjectKey) => {
                const label =
                  subjectOptions.find((option) => option.value === subjectKey)
                    ?.label ?? "";
                patch({
                  subjectKey,
                  title: form.title.trim() ? form.title : label,
                });
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
              options={(options?.serviceCategories ?? []).map((category) => ({
                value: category.itemKey,
                label: category.label,
              }))}
              value={form.serviceCategoryKey}
              onChange={(serviceCategoryKey) => patch({ serviceCategoryKey })}
            />
            <ChipSelect
              label="Leistung (Abrechnung)"
              options={services}
              value={form.serviceKey}
              onChange={(serviceKey) => {
                patch({
                  serviceKey,
                  serviceName:
                    services.find((service) => service.value === serviceKey)
                      ?.label ?? serviceKey,
                });
              }}
            />
          </SectionPanel>
        ) : null}

        {section === "documentation" ? (
          <SectionPanel {...FORM_CTX} title="Dokumentation & Portal">
            <PremiumInput
              {...FORM_CTX}
              label="Dokumentationsvorlage"
              value={form.documentationTemplate}
              onChangeText={(documentationTemplate) =>
                patch({ documentationTemplate })
              }
            />
            <PremiumInput
              {...FORM_CTX}
              label="Leistungsnachweis-Vorlage"
              value={form.proofTemplateKey}
              onChangeText={(proofTemplateKey) => patch({ proofTemplateKey })}
            />
            <FilterChipGroup
              onDarkSurface
              options={[
                { key: "hidden", label: "Nicht im Klient:innenportal" },
                { key: "visible", label: "Im Klient:innenportal anzeigen" },
              ]}
              value={form.portalReleaseEnabled ? "visible" : "hidden"}
              onChange={(value) =>
                patch({ portalReleaseEnabled: value === "visible" })
              }
            />
          </SectionPanel>
        ) : null}
      </AssignmentStudioScaffold>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xs,
  },
  hint: { ...typography.caption, marginBottom: spacing.sm },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(119, 207, 250, 0.24)",
    backgroundColor: "rgba(6, 24, 47, 0.72)",
  },
  taskIndex: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(47,168,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(92,190,255,0.38)",
  },
  taskIndexText: { color: "#8FD7FF", fontWeight: "800", fontSize: 12 },
  taskField: { flex: 1, minWidth: 0 },
  taskInput: {
    width: "100%",
    minWidth: 0,
    color: "#FFFFFF",
    backgroundColor: "#071A31",
    borderColor: "rgba(119, 207, 250, 0.58)",
    fontWeight: "700",
  },
});
