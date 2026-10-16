import { AssignmentFormStyles, useAssignmentFormGuard, ChipSelect, PremiumInput, PremiumButton, SectionPanel, InfoBanner, ErrorState, FilterChipGroup, CareDateInput, CareTimeInput, AssistCatalogGroupedChipSelect } from "./AssignmentFormControls.web";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from 'expo-router';



import {
  AssignmentStudioScaffold,
  type AssignmentStudioStep,
} from "./AssignmentFormControls.web";
import { useAssignmentFormOptions } from "./useAssignmentFormOptions.web";
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
  onGuardChange?: (guard: (() => boolean) | null) => void;
};

type SelectOption = { value: string; label: string };

const FORM_CTX = {
  viewContext: "form" as const,
  onDarkSurface: false as const,
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

export function AssignmentEditForm({
  visitId,
  initialVisit,
  onCancel,
  onSaved,
  onGuardChange,
}: AssignmentEditFormProps) {
  const text = { primary: "#173b5b", secondary: "#617b90" };
  const tenantId = useServiceTenantId();
  const router = useRouter();
  const { profile } = useAuth();
  const { can, isReadOnly } = usePermissions();
  const {
    options,
    loading: optionsLoading,
    error: optionsError,
    reload: reloadOptions,
  } = useAssignmentFormOptions();
  const canManage = can("assist.assignments.manage") && !isReadOnly;
  const canManageRef = useRef(canManage); canManageRef.current = canManage;
  const scope = JSON.stringify([tenantId, profile?.id, profile?.roleKey, visitId, initialVisit.id]);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const mounted = useRef(false); const submitScope = useRef<string | null>(null);
  const submitRequest = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const [form, setForm] = useState<VisitEditFormData>(() =>
    mapVisitDetailToEditForm(initialVisit),
  );
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [employees, setEmployees] = useState<SelectOption[]>([]);
  const [services, setServices] = useState<SelectOption[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState<string | null>(null);
  const [listsRetry, setListsRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [seriesScope, setSeriesScope] =
    useState<VisitSeriesMutationScope>("this_only");
  const [error, setError] = useState<string | null>(null);
  const [persistedVisitId, setPersistedVisitId] = useState<string | null>(null);
  const [formScope, setFormScope] = useState(scope);
  const initialForm = useRef(JSON.stringify(mapVisitDetailToEditForm(initialVisit)));
  const latestVisit = useRef(initialVisit); latestVisit.current = initialVisit;
  const [section, setSection] = useState<EditSectionKey>("overview");

  const { confirmLeave, releaseAfterSave } = useAssignmentFormGuard(!persistedVisitId && (JSON.stringify(form) !== initialForm.current || seriesScope !== "this_only"), saving);
  const requestCancel = useCallback(() => { if (!submitScope.current && confirmLeave()) onCancel(); }, [confirmLeave, onCancel]);
  useEffect(() => { onGuardChange?.(() => !submitScope.current && confirmLeave()); return () => onGuardChange?.(null); }, [confirmLeave, onGuardChange]);

  const patch = useCallback((partial: Partial<VisitEditFormData>) => {
    if (canManageRef.current && !submitScope.current) setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    submitRequest.current += 1; submitScope.current = null; setSaving(false); setError(null); setPersistedVisitId(null);
    setFormScope(scope);
    setSeriesScope('this_only'); setSection('overview');
    const freshForm = mapVisitDetailToEditForm(latestVisit.current); initialForm.current = JSON.stringify(freshForm); setForm(freshForm);
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    setClients([]); setEmployees([]); setServices([]); setListsLoading(false);
    if (!tenantId) return;
    setListsError(null); setListsLoading(true);
    void (async () => {
      try {
      const [clientRes, employeeRes, catalogRes] = await Promise.all([
        fetchClientList(tenantId, profile?.roleKey, {
          lifecycleFilter: "active",
        }),
        fetchAssignmentEmployeeList(tenantId, profile?.roleKey),
        fetchTenantServiceCatalog(tenantId, profile?.roleKey),
      ]);
      if (cancelled) return;
      const failed = [clientRes, employeeRes, catalogRes].find(result => !result.ok);
      if (failed && !failed.ok) setListsError(failed.error);
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
      } catch (cause) {
        if (!cancelled) setListsError(cause instanceof Error ? cause.message : 'Auswahldaten konnten nicht geladen werden.');
      } finally { if (!cancelled) setListsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tenantId, profile?.id, profile?.roleKey, listsRetry]);

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
  const selectedEmployee = form.employeeId
    ? employees.find((item) => item.value === form.employeeId)?.label ?? (form.employeeId === initialVisit.employeeId ? initialVisit.employeeName : "")
    : "";
  const completedTasks = initialVisit.tasks.filter(
    (task) => task.status === "done",
  ).length;

  const handleSave = async () => {
    if (!tenantId || (initialVisit.tenantId && initialVisit.tenantId !== tenantId) || !canManageRef.current || submitScope.current || persistedVisitId || listsLoading) return;
    if ((form.clientId !== initialVisit.clientId && !clients.some(client => client.value === form.clientId)) ||
      (form.employeeId && form.employeeId !== initialVisit.employeeId && !employees.some(employee => employee.value === form.employeeId))) {
      setError('Bitte eine verfügbare Person aus den aktuellen Auswahllisten wählen.'); return;
    }
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
    const submittedScope = scope; const request = ++submitRequest.current; submitScope.current = submittedScope;
    const canCommit = () => mounted.current && scopeRef.current === submittedScope && canManageRef.current && submitScope.current === submittedScope && submitRequest.current === request;
    setError(null);
    try {
    const result = await updateVisitFromWizard(
      tenantId,
      visitId,
      form,
      profile?.roleKey,
      seriesScope,
    );
    if (!canCommit()) return;
    if (result.ok) {
      setPersistedVisitId(result.data.id);
      initialForm.current = JSON.stringify(form);
      releaseAfterSave();
      onSaved?.(result.data.id);
    } else {
      setError(result.error);
      setPersistedVisitId(result.persistedVisitId ?? null);
    }
    } catch (cause) {
      if (canCommit()) setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen. Bitte Verbindung prüfen.');
    } finally { if (mounted.current && scopeRef.current === submittedScope && submitRequest.current === request) { submitScope.current = null; setSaving(false); } }
  };

  if (initialVisit.tenantId && initialVisit.tenantId !== tenantId) return <InfoBanner message="Dieser Einsatz gehört nicht zum ausgewählten Unternehmen." variant="warning" />;
  if (formScope !== scope) return <InfoBanner message="Einsatzdaten werden aktualisiert…" />;
  if (!canManage) {
    return (
      <InfoBanner
        onDarkSurface
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
      <AssignmentFormStyles/>
      {listsError ? <ErrorState message={listsError} onRetry={() => setListsRetry(value => value + 1)} /> : null}
      {error ? <ErrorState message={error} /> : null}
      {persistedVisitId ? <PremiumButton title="Gespeicherten Einsatz prüfen" onPress={() => { releaseAfterSave(); onCancel(); router.push(`/assist/assignments/${persistedVisitId}` as never); }} /> : null}
      <AssignmentStudioScaffold
        steps={EDIT_STUDIO_STEPS}
        activeStep={section}
        onStepChange={(key) => { if (!submitScope.current) setSection(key); }}
        title={form.title || "Einsatz bearbeiten"}
        description="Termin, Personen und Aufgaben anpassen. Änderungen werden erst beim Speichern übernommen."
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
              onPress={requestCancel}
            />
            <PremiumButton
              title="Änderungen speichern"
              loading={saving}
              disabled={saving || listsLoading || Boolean(persistedVisitId) || !form.title.trim() || !form.clientId}
              onPress={() => void handleSave()}
            />
          </>
        }
      >
        <fieldset disabled={saving || Boolean(persistedVisitId)}>
        {(() => {
          const recurrence = parseVisitRecurrenceJson(
            initialVisit.recurrenceJson,
          );
          const isSeriesOccurrence =
            recurrence.pattern !== "none" || Boolean(recurrence.parentSeriesId);
          return isSeriesOccurrence && section === "schedule" ? (
            <SectionPanel {...FORM_CTX} title="Änderungsbereich">
              <InfoBanner
                onDarkSurface
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
              options={form.clientId === initialVisit.clientId && !clients.some(client => client.value === form.clientId) ? [{ value: initialVisit.clientId, label: initialVisit.clientName }, ...clients] : clients}
              value={form.clientId}
              onChange={(clientId) => patch({ clientId })}
            />
            <ChipSelect
              label="Mitarbeitende:r"
              options={form.employeeId && form.employeeId === initialVisit.employeeId && !employees.some(employee => employee.value === form.employeeId) ? [{ value: form.employeeId, label: initialVisit.employeeName || "Bisher zugewiesene Person" }, ...employees] : employees}
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

            <SectionPanel {...FORM_CTX} title="Ort & Hinweise">
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
              onDarkSurface
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
              <ErrorState message={optionsError} onRetry={reloadOptions} />
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
        </fieldset>
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
    borderColor: "#d9e6f0",
    backgroundColor: "#f5f9fd",
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
  taskIndexText: { color: "#1b62ac", fontWeight: "800", fontSize: 12 },
  taskField: { flex: 1, minWidth: 0 },
  taskInput: {
    width: "100%",
    minWidth: 0,
    color: "#173b5b",
    backgroundColor: "#FFFFFF",
    borderColor: "#c8dbe9",
    fontWeight: "700",
  },
});
