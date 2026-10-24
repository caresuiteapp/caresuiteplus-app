// Generated native presentation from src/components/assist/AssignmentCreateForm.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeP,NativeDiv,NativeFieldset} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { PlatformModal, useAssignmentFormGuard, ChipSelect, PremiumInput, PremiumButton, SectionPanel, InfoBanner, ErrorState, CareDateInput, CareTimeInput, AssistCatalogGroupedChipSelect, AssistCatalogMultiSelect } from "./AssignmentFormControls.native.tsx";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from 'expo-router';
import { DocumentModuleTemplatesPanel } from "../documents/DocumentModuleTemplatesPanel.native.tsx";
import { moduleColor } from "@/design/tokens/modules";
import { careSpacing } from "@/design/tokens/spacing";
import { useAssignmentFormOptions } from "./useAssignmentFormOptions.native.ts";
import { useAuth } from "@/lib/auth/context";
import { useServiceTenantId } from "@/hooks/useTenantId";
import { usePermissions } from "@/hooks/usePermissions";
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { fetchClientList } from "@/lib/office/clientListService";
import { fetchAssignmentEmployeeList } from "@/lib/assist/assignmentEmployeeListService";
import { fetchTenantServiceCatalog } from "@/lib/tenant/tenantServiceCatalogService";
import { createVisitFromWizard } from "@/lib/assist/visitService";
import { buildPlannedTimestamps } from '@/lib/assist/assignmentProductionValidation';
import { validAssistDate } from "../../lib/assist/assistClientsWorkspaceModel.native.ts";
import { AssignmentClientBillingSummary as ClientBillingProfileSummary } from "./AssignmentBillingBudgetPanel.native.tsx";
import { AssignmentBillingBudgetPanel } from "./AssignmentBillingBudgetPanel.native.tsx";
import { AssignmentStudioScaffold, type AssignmentStudioStep, } from "./AssignmentFormControls.native.tsx";
import type { AssistBudgetAllocationResult, ManualBudgetAllocationOverride, } from "@/types/assist/assignmentBudgetAllocation";
import { loadTaskPackageItems, mergeTaskDrafts } from "@/lib/assistCatalog";
import { EMPTY_VISIT_WIZARD_DATA, VISIT_RECURRENCE_PATTERN_LABELS, VISIT_RECURRENCE_PATTERN_OPTIONS, VISIT_WEEKDAY_OPTIONS, type AssignmentCreateSectionKey, type VisitCreateWizardData, type VisitRecurrencePattern, type VisitWeekdayKey, } from "@/lib/assist/visitTypes";
import type { AssistAssignmentTaskDraft, CatalogItem, } from "@/types/assistCatalog";
import { spacing, typography } from "@/theme";
type AssignmentCreateFormProps = {
    visible: boolean;
    initialClientId?: string | null;
    initialAssignmentDate?: string | null;
    initialEmployeeId?: string | null;
    onClose: () => void;
    onCreated?: (id: string) => void;
};
type SelectOption = {
    value: string;
    label: string;
};
const FORM_CTX = {
    viewContext: "form" as const,
    onDarkSurface: false as const,
};
const CREATE_STUDIO_STEPS: readonly AssignmentStudioStep<AssignmentCreateSectionKey>[] = [
    { key: "basis", label: "Grunddaten", icon: "document-text-outline" },
    { key: "people", label: "Personen", icon: "people-outline" },
    { key: "schedule", label: "Termin & Serie", icon: "calendar-outline" },
    { key: "type", label: "Leistung", icon: "briefcase-outline" },
    { key: "tasks", label: "Aufgaben", icon: "checkmark-done-outline" },
    {
        key: "hints",
        label: "Hinweise",
        icon: "shield-checkmark-outline",
        optional: true,
    },
    { key: "billing", label: "Budget", icon: "wallet-outline" },
    {
        key: "documentation",
        label: "Nachweis",
        icon: "clipboard-outline",
        optional: true,
    },
    { key: "review", label: "Prüfen", icon: "sparkles-outline" },
];
function syncOptionalTaskDrafts(selectedKeys: string[], currentDrafts: AssistAssignmentTaskDraft[], taskItems: CatalogItem[], removedTaskKeys: Set<string>): AssistAssignmentTaskDraft[] {
    const optionalKeys = new Set(taskItems.map((t) => t.itemKey));
    const packageDrafts = currentDrafts.filter((d) => d.isRequired || !optionalKeys.has(d.itemKey));
    const optionalDrafts = selectedKeys
        .filter((k) => optionalKeys.has(k))
        .map((k, index) => {
        const existing = currentDrafts.find((d) => d.itemKey === k);
        if (existing)
            return existing;
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
export function AssignmentCreateForm({ visible, initialClientId = null, initialAssignmentDate = null, initialEmployeeId = null, onClose, onCreated, }: AssignmentCreateFormProps) {
    const assistAccent = moduleColor("assist");
    const text = { primary: "#173b5b", secondary: "#617b90" };
    const tenantId = useServiceTenantId();
    const router = useRouter();
    const { profile } = useAuth();
    const { can, roleKey } = usePermissions();
    const canManage = Boolean(roleKey && !isPortalOnlyRole(roleKey) && can('assist.assignments.view') && can('assist.assignments.manage'));
    const { options, loading: optionsLoading, error: optionsError, reload: reloadOptions, } = useAssignmentFormOptions(visible && canManage);
    const canManageRef = useRef(canManage);
    canManageRef.current = canManage;
    const scope = JSON.stringify([tenantId, profile?.id, profile?.roleKey, visible, initialClientId, initialAssignmentDate, initialEmployeeId]);
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const mounted = useRef(false);
    const submitScope = useRef<string | null>(null);
    const submitRequest = useRef(0);
    const packageRequest = useRef(0);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const [section, setSection] = useState<AssignmentCreateSectionKey>("basis");
    const [form, setForm] = useState<VisitCreateWizardData>(EMPTY_VISIT_WIZARD_DATA);
    const [clients, setClients] = useState<SelectOption[]>([]);
    const [employees, setEmployees] = useState<SelectOption[]>([]);
    const [services, setServices] = useState<SelectOption[]>([]);
    const [listsLoading, setListsLoading] = useState(false);
    const [listsError, setListsError] = useState<string | null>(null);
    const [listsRetry, setListsRetry] = useState(0);
    const [loading, setLoading] = useState(false);
    const [packageLoading, setPackageLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [persistedVisitId, setPersistedVisitId] = useState<string | null>(null);
    const [savedConflicts, setSavedConflicts] = useState<string[]>([]);
    const [formScope, setFormScope] = useState(scope);
    const initialForm = useRef(JSON.stringify(EMPTY_VISIT_WIZARD_DATA));
    const [removedTaskKeys, setRemovedTaskKeys] = useState<Set<string>>(new Set());
    const [budgetAllocation, setBudgetAllocation] = useState<AssistBudgetAllocationResult | null>(null);
    const [budgetManualOverride, setBudgetManualOverride] = useState<ManualBudgetAllocationOverride | null>(null);
    const { confirmLeave, releaseAfterSave } = useAssignmentFormGuard(visible && !persistedVisitId && (JSON.stringify(form) !== initialForm.current || Boolean(budgetManualOverride)), loading || packageLoading);
    const requestClose = async () => { if (!submitScope.current && await confirmLeave())
        onClose(); };
    const patch = useCallback((partial: Partial<VisitCreateWizardData>) => {
        if (!canManageRef.current || submitScope.current)
            return;
        if (['clientId', 'assignmentDate', 'plannedStartTime', 'plannedEndTime', 'serviceKey', 'recurrencePattern', 'recurrenceEndDate', 'recurrenceOccurrenceCount', 'recurrenceWeekdays'].some(key => key in partial)) {
            setBudgetAllocation(null);
            setBudgetManualOverride(null);
        }
        setForm((prev) => ({ ...prev, ...partial }));
    }, []);
    useEffect(() => {
        submitRequest.current += 1;
        submitScope.current = null;
        setLoading(false);
        setPersistedVisitId(null);
        setSavedConflicts([]);
        packageRequest.current += 1;
        setPackageLoading(false);
        setFormScope(scope);
        setClients([]);
        setEmployees([]);
        setServices([]);
        setListsLoading(false);
        if (!visible || !tenantId)
            return;
        setSection("basis");
        const freshForm = { ...EMPTY_VISIT_WIZARD_DATA, assignmentDate: validAssistDate(initialAssignmentDate) ? initialAssignmentDate : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date()), clientId: initialClientId ?? "", employeeId: initialEmployeeId?.trim() ?? "" };
        initialForm.current = JSON.stringify(freshForm);
        setForm(freshForm);
        setError(null);
        setRemovedTaskKeys(new Set());
        setBudgetAllocation(null);
        setBudgetManualOverride(null);
    }, [scope, initialClientId, initialAssignmentDate, initialEmployeeId, tenantId, visible]);
    useEffect(() => {
        let cancelled = false;
        setClients([]);
        setEmployees([]);
        setServices([]);
        setListsLoading(false);
        if (!visible || !tenantId || !canManage)
            return;
        setListsError(null);
        setListsLoading(true);
        void (async () => {
            try {
                const [clientRes, employeeRes, catalogRes] = await Promise.all([
                    fetchClientList(tenantId, profile?.roleKey, {
                        lifecycleFilter: "active",
                    }),
                    fetchAssignmentEmployeeList(tenantId, profile?.roleKey),
                    fetchTenantServiceCatalog(tenantId, profile?.roleKey),
                ]);
                if (cancelled)
                    return;
                const failed = [clientRes, employeeRes, catalogRes].find(result => !result.ok);
                if (failed && !failed.ok)
                    setListsError(failed.error);
                if (clientRes.ok) {
                    setClients(clientRes.data.map((c) => ({
                        value: c.id,
                        label: `${c.firstName} ${c.lastName}`.trim(),
                    })));
                }
                if (employeeRes.ok) {
                    setEmployees(employeeRes.data.map((e) => ({
                        value: e.id,
                        label: `${e.firstName} ${e.lastName}`.trim(),
                    })));
                }
                if (catalogRes.ok) {
                    setServices(catalogRes.data.items
                        .filter((item) => item.isActive && item.moduleKey === "assist")
                        .map((item) => ({ value: item.serviceKey, label: item.name })));
                }
            }
            catch (cause) {
                if (!cancelled)
                    setListsError(cause instanceof Error ? cause.message : 'Auswahldaten konnten nicht geladen werden.');
            }
            finally {
                if (!cancelled)
                    setListsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [scope, profile?.roleKey, tenantId, visible, listsRetry, canManage]);
    const subjectOptions = useMemo(() => (options?.subjects ?? []).map((s) => ({
        value: s.itemKey,
        label: s.label,
    })), [options]);
    const optionalTaskItemKeys = useMemo(() => {
        const items = options?.taskItems ?? [];
        return form.taskDrafts
            .filter((d) => items.some((t) => t.itemKey === d.itemKey))
            .map((d) => d.itemKey);
    }, [form.taskDrafts, options?.taskItems]);
    const durationMinutes = useMemo(() => {
        let diff = 0;
        try {
            const times = buildPlannedTimestamps(form);
            diff = Date.parse(times.plannedEndAt) - Date.parse(times.plannedStartAt);
        }
        catch {
            return 0;
        }
        return diff > 0 ? Math.round(diff / 60000) : 0;
    }, [form]);
    const handlePackageSelect = async (packageId: string) => {
        if (!tenantId || !canManageRef.current || submitScope.current)
            return;
        const requestedScope = scope;
        const request = ++packageRequest.current;
        const canCommit = () => mounted.current && scopeRef.current === requestedScope && canManageRef.current && packageRequest.current === request;
        setPackageLoading(true);
        patch({ taskPackageId: packageId });
        try {
            const res = await loadTaskPackageItems(tenantId, packageId, profile?.roleKey);
            if (!canCommit())
                return;
            if (res.ok) {
                const merged = mergeTaskDrafts(res.data, [], new Set());
                patch({ taskDrafts: merged, tasks: merged.map((t) => t.title) });
                setRemovedTaskKeys(new Set());
            }
            else {
                setError(res.error);
            }
        }
        catch (cause) {
            if (canCommit())
                setError(cause instanceof Error ? cause.message : 'Aufgabenpaket konnte nicht geladen werden.');
        }
        finally {
            if (mounted.current && scopeRef.current === requestedScope && packageRequest.current === request)
                setPackageLoading(false);
        }
    };
    const showRecurrenceWeekdays = form.recurrencePattern === "weekly" ||
        form.recurrencePattern === "biweekly";
    const sectionIndex = CREATE_STUDIO_STEPS.findIndex((item) => item.key === section);
    const selectedClient = clients.find((item) => item.value === form.clientId)?.label ?? "";
    const selectedEmployee = employees.find((item) => item.value === form.employeeId)?.label ?? "";
    const selectedService = services.find((item) => item.value === form.serviceKey)?.label ??
        subjectOptions.find((item) => item.value === form.subjectKey)?.label ??
        form.title;
    const goToRelativeSection = (offset: number) => {
        const next = CREATE_STUDIO_STEPS[sectionIndex + offset];
        if (next)
            setSection(next.key);
    };
    const handleSave = async (asDraft: boolean) => {
        if (!tenantId || !canManageRef.current || submitScope.current || persistedVisitId || listsLoading || packageLoading || optionsLoading)
            return;
        if (!clients.some(client => client.value === form.clientId) || (form.employeeId && !employees.some(employee => employee.value === form.employeeId))) {
            setError('Bitte eine verfügbare Person aus den aktuellen Auswahllisten wählen.');
            setSection('people');
            return;
        }
        if (!form.clientId) {
            setError("Bitte eine:n Klient:in auswählen.");
            setSection("people");
            return;
        }
        if (!asDraft && !form.employeeId) {
            setError("Für einen geplanten Einsatz ist eine mitarbeitende Person erforderlich.");
            setSection("people");
            return;
        }
        if (!asDraft && !form.subjectKey && !form.title.trim()) {
            setError("Bitte einen Einsatz-Betreff auswählen.");
            setSection("type");
            return;
        }
        if (!asDraft &&
            !form.taskDrafts.some((task) => task.title.trim()) &&
            !form.tasks.some((task) => task.trim())) {
            setError("Bitte mindestens eine Aufgabe auswählen.");
            setSection("tasks");
            return;
        }
        setLoading(true);
        const submittedScope = scope;
        const request = ++submitRequest.current;
        submitScope.current = submittedScope;
        const canCommit = () => mounted.current && scopeRef.current === submittedScope && canManageRef.current && submitScope.current === submittedScope && submitRequest.current === request;
        setError(null);
        const payload: VisitCreateWizardData = {
            ...form,
            saveAsDraft: asDraft,
            title: form.title ||
                subjectOptions.find((s) => s.value === form.subjectKey)?.label ||
                "Neuer Einsatz",
            catalogSnapshotJson: {
                subjectKey: form.subjectKey,
                subjectLabel: subjectOptions.find((item) => item.value === form.subjectKey)
                    ?.label ?? null,
                assignmentTypeKey: form.assignmentTypeKey,
                assignmentTypeLabel: options?.assignmentTypes.find((item) => item.itemKey === form.assignmentTypeKey)?.label ?? null,
                serviceCategoryKey: form.serviceCategoryKey,
                serviceCategoryLabel: options?.serviceCategories.find((item) => item.itemKey === form.serviceCategoryKey)?.label ?? null,
                taskPackageId: form.taskPackageId,
                taskPackageLabel: options?.taskPackages.find((item) => item.id === form.taskPackageId)
                    ?.label ?? null,
                riskFlagKeys: form.riskFlagKeys,
                riskFlagLabels: form.riskFlagKeys.map((key) => options?.riskFlags.find((item) => item.itemKey === key)?.label ??
                    key),
                documentationTemplateKey: form.documentationTemplate || null,
                proofTemplateKey: form.proofTemplateKey || null,
                recurrencePattern: form.recurrencePattern,
                recurrenceEndDate: form.recurrenceEndDate || null,
                recurrenceWeekdays: form.recurrenceWeekdays,
                recurrenceOccurrenceCount: form.recurrenceOccurrenceCount,
                budgetAllocation,
            },
            budgetAllocation: form.recurrencePattern === 'none' ? budgetAllocation : null,
            budgetManualOverride,
            budgetAmountCents: budgetAllocation?.totalAmountCents ?? form.budgetAmountCents,
            billingBudgetSourceKey: budgetAllocation?.primaryCatalogKey ?? form.billingBudgetSourceKey,
        };
        try {
            const res = await createVisitFromWizard(tenantId, payload, profile?.roleKey);
            if (!canCommit())
                return;
            if (res.ok) {
                setPersistedVisitId(res.data.id);
                if (res.data.conflicts?.length) {
                    setSavedConflicts(res.data.conflicts);
                }
                else {
                    releaseAfterSave();
                    onCreated?.(res.data.id);
                    onClose();
                }
            }
            else {
                setError(res.error);
                setPersistedVisitId(res.persistedVisitId ?? null);
            }
        }
        catch (cause) {
            if (canCommit())
                setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen. Bitte Verbindung prüfen.');
        }
        finally {
            if (mounted.current && scopeRef.current === submittedScope && submitRequest.current === request) {
                submitScope.current = null;
                setLoading(false);
            }
        }
    };
    const finishSavedResult = async () => {
        if (submitScope.current)
            return;
        if (persistedVisitId) {
            releaseAfterSave();
            if (savedConflicts.length)
                onCreated?.(persistedVisitId);
            onClose();
        }
        else
            await requestClose();
    };
    const renderCatalogSectionHint = () => {
        if (optionsLoading) {
            return (<Text style={[styles.hint, { color: text.primary }]}>
          Kataloge werden geladen…
        </Text>);
        }
        if (optionsError) {
            return <ErrorState message={optionsError} onRetry={reloadOptions}/>;
        }
        return null;
    };
    const renderSection = () => {
        switch (section) {
            case "basis":
                return (<SectionPanel {...FORM_CTX} title="Basisdaten">
            <PremiumInput {...FORM_CTX} label="Titel (optional)" value={form.title} onChangeText={(title) => patch({ title })} placeholder="z. B. Hausbesuch Pflege"/>
            <PremiumInput {...FORM_CTX} label="Beschreibung" value={form.description} onChangeText={(description) => patch({ description })} placeholder="Kurzbeschreibung des Einsatzes" multiline/>
          </SectionPanel>);
            case "people":
                return (<SectionPanel {...FORM_CTX} title="Klient:in & Mitarbeitende:r">
            {listsLoading ? (<Text style={[styles.hint, { color: text.primary }]}>
                Klient:innen und Mitarbeitende werden geladen…
              </Text>) : null}
            {!listsLoading && clients.length === 0 ? (<InfoBanner message="Keine aktiven Klient:innen gefunden." variant="warning"/>) : null}
            <ChipSelect label="Klient:in *" options={clients} value={form.clientId} onChange={(v) => patch({ clientId: v as string })}/>
            {form.clientId ? (<ClientBillingProfileSummary clientId={form.clientId}/>) : null}
            <ChipSelect label="Mitarbeitende:r (für geplante Einsätze erforderlich)" options={employees} value={form.employeeId} onChange={(v) => patch({ employeeId: v as string })}/>
          </SectionPanel>);
            case "schedule":
                return (<SectionPanel {...FORM_CTX} title="Termin & Wiederholung">
            <PremiumInput {...FORM_CTX} label="Adresse oder Treffpunkt" value={form.addressSnapshot} onChangeText={(addressSnapshot) => patch({ addressSnapshot })} placeholder="Optional – sonst aus der Klient:innenakte"/>
            <PremiumInput {...FORM_CTX} label="Hinweise zum Ort" value={form.locationNotes} onChangeText={(locationNotes) => patch({ locationNotes })} multiline/>
            <CareDateInput {...FORM_CTX} label="Datum *" value={form.assignmentDate} onChange={(assignmentDate) => patch({ assignmentDate })} showFormatHint={false}/>
            <CareTimeInput {...FORM_CTX} label="Beginn *" value={form.plannedStartTime} onChange={(plannedStartTime) => patch({ plannedStartTime })} showFormatHint={false}/>
            <CareTimeInput {...FORM_CTX} label="Ende *" value={form.plannedEndTime} onChange={(plannedEndTime) => patch({ plannedEndTime })} showFormatHint={false}/>
            <NativeP className="acf-muted">Uhrzeiten gelten für Deutschland (Europe/Berlin).</NativeP>
            {durationMinutes > 0 ? (<Text style={[styles.hint, { color: text.primary }]}>
                Dauer: {durationMinutes} Minuten
              </Text>) : null}
            <ChipSelect label="Wiederholung" options={VISIT_RECURRENCE_PATTERN_OPTIONS.map((o) => ({
                        value: o.key,
                        label: o.label,
                    }))} value={form.recurrencePattern} onChange={(v) => {
                        const pattern = v as VisitRecurrencePattern;
                        patch({
                            recurrencePattern: pattern,
                            recurrenceWeekdays: pattern === "weekly" || pattern === "biweekly"
                                ? form.recurrenceWeekdays
                                : [],
                        });
                    }}/>
            {showRecurrenceWeekdays ? (<ChipSelect label="Wochentage" options={VISIT_WEEKDAY_OPTIONS.map((o) => ({
                            value: o.key,
                            label: o.label,
                        }))} value={form.recurrenceWeekdays} onChange={(v) => patch({ recurrenceWeekdays: v as VisitWeekdayKey[] })} multi/>) : null}
            {form.recurrencePattern !== "none" ? (<>
                <CareDateInput {...FORM_CTX} label="Wiederholen bis" value={form.recurrenceEndDate} onChange={(recurrenceEndDate) => patch({ recurrenceEndDate })} placeholder="TT.MM.JJJJ — oder Anzahl angeben" showFormatHint={false}/>
                <PremiumInput {...FORM_CTX} label="Anzahl Termine" value={form.recurrenceOccurrenceCount != null
                            ? String(form.recurrenceOccurrenceCount)
                            : ""} onChangeText={(v) => {
                            const n = v.trim() ? Number(v.replace(/\D/g, "")) : null;
                            patch({
                                recurrenceOccurrenceCount: n != null && Number.isFinite(n) && n > 0 ? n : null,
                            });
                        }} placeholder="z. B. 12 — oder Enddatum angeben" keyboardType="numeric"/>
              </>) : null}
          </SectionPanel>);
            case "type":
                return (<SectionPanel {...FORM_CTX} title="Einsatzart & Betreff">
            {renderCatalogSectionHint()}
            <ChipSelect label="Einsatz-Betreff *" options={subjectOptions} value={form.subjectKey} onChange={(v) => {
                        const key = v as string;
                        const label = subjectOptions.find((s) => s.value === key)?.label ?? "";
                        patch({ subjectKey: key, title: label });
                    }}/>
            {(options?.assignmentTypes?.length ?? 0) > 0 ? (<AssistCatalogGroupedChipSelect label="Einsatzart" items={options?.assignmentTypes ?? []} value={form.assignmentTypeKey} onChange={(assignmentTypeKey) => patch({ assignmentTypeKey })}/>) : null}
            <ChipSelect label="Leistungskategorie" options={(options?.serviceCategories ?? []).map((c) => ({
                        value: c.itemKey,
                        label: c.label,
                    }))} value={form.serviceCategoryKey} onChange={(v) => patch({ serviceCategoryKey: v as string })}/>
            <ChipSelect label="Leistung (Abrechnung)" options={services} value={form.serviceKey} onChange={(v) => {
                        const key = v as string;
                        patch({
                            serviceKey: key,
                            serviceName: services.find((s) => s.value === key)?.label ?? key,
                        });
                    }}/>
          </SectionPanel>);
            case "tasks":
                return (<SectionPanel {...FORM_CTX} title="Aufgabenpaket & Aufgaben">
            {renderCatalogSectionHint()}
            <Text style={styles.darkHint}>
              Aufgabenpaket wählen — enthaltene Aufgaben werden automatisch
              geladen.
            </Text>
            {(options?.taskPackages?.length ?? 0) === 0 && !optionsLoading ? (<InfoBanner message="Keine Aufgabenpakete verfügbar." variant="warning"/>) : null}
            <View style={styles.packageGrid}>
              {(options?.taskPackages ?? []).map((pkg) => (<TouchableOpacity key={pkg.id} style={[
                            styles.packageCard,
                            form.taskPackageId === pkg.id && styles.packageCardSelected,
                        ]} onPress={() => void handlePackageSelect(pkg.id)}>
                  <Text style={styles.packageTitle}>{pkg.label}</Text>
                  {pkg.defaultDurationMinutes ? (<Text style={styles.packageMeta}>
                      {pkg.defaultDurationMinutes} Min.
                    </Text>) : null}
                </TouchableOpacity>))}
            </View>
            <AssistCatalogMultiSelect items={options?.taskItems ?? []} label="Zusätzliche Einzelaufgaben (Mehrfachauswahl)" values={optionalTaskItemKeys} loading={optionsLoading} onChange={(keys) => {
                        const merged = syncOptionalTaskDrafts(keys, form.taskDrafts, options?.taskItems ?? [], removedTaskKeys);
                        patch({
                            taskDrafts: merged,
                            tasks: merged.map((t) => t.title),
                        });
                    }}/>
            <PremiumButton title="Eigene Aufgabe hinzufügen" variant="secondary" disabled={packageLoading} onPress={() => { const taskDrafts = [...form.taskDrafts, { itemKey: `manual-${crypto.randomUUID()}`, title: '', isRequired: false, isOptional: true, sortOrder: form.taskDrafts.length }]; patch({ taskDrafts, tasks: taskDrafts.map(task => task.title) }); }}/>
            {form.taskDrafts.map((task, index) => (<View key={`${task.itemKey}-${index}`} style={styles.taskRow}>
                {task.itemKey.startsWith('manual-') ? <NativeDiv style={{ flex: 1, minWidth: 0 }}><PremiumInput label="Eigene Aufgabe" value={task.title} onChangeText={title => { const taskDrafts = form.taskDrafts.map((entry, taskIndex) => taskIndex === index ? { ...entry, title } : entry); patch({ taskDrafts, tasks: taskDrafts.map(entry => entry.title) }); }}/></NativeDiv> : <Text style={[styles.taskTitle, { color: text.primary }]}>{task.isRequired ? "Pflicht: " : ""}{task.title}</Text>}
                <PremiumButton title={task.isRequired ? "Pflichtaufgabe" : "Entfernen"} disabled={task.isRequired} variant="secondary" onPress={() => {
                            const nextRemoved = new Set(removedTaskKeys);
                            nextRemoved.add(task.itemKey);
                            setRemovedTaskKeys(nextRemoved);
                            const merged = mergeTaskDrafts(form.taskDrafts, [], nextRemoved);
                            patch({
                                taskDrafts: merged,
                                tasks: merged.map((t) => t.title),
                            });
                        }}/>
              </View>))}
          </SectionPanel>);
            case "hints":
                return (<SectionPanel {...FORM_CTX} title="Hinweise & Risiken">
            {renderCatalogSectionHint()}
            <AssistCatalogMultiSelect items={options?.riskFlags ?? []} label="Risiken (Mehrfachauswahl)" values={form.riskFlagKeys} loading={optionsLoading} onChange={(riskFlagKeys) => patch({ riskFlagKeys })}/>
            <PremiumInput {...FORM_CTX} label="Interne Hinweise" value={form.internalNotes} onChangeText={(internalNotes) => patch({ internalNotes })} multiline/>
            <PremiumInput {...FORM_CTX} label="Hinweise für Mitarbeitende" value={form.employeeNotes} onChangeText={(employeeNotes) => patch({ employeeNotes })} multiline/>
            <PremiumInput {...FORM_CTX} label="Hinweise für Klient:innen" value={form.clientVisibleNotes} onChangeText={(clientVisibleNotes) => patch({ clientVisibleNotes })} multiline/>
          </SectionPanel>);
            case "billing":
                return (<SectionPanel {...FORM_CTX} title="Abrechnung & Budget">
            {form.clientId ? (<AssignmentBillingBudgetPanel clientId={form.clientId} clientName={clients.find((c) => c.value === form.clientId)?.label} assignmentDate={form.assignmentDate} plannedStartTime={form.plannedStartTime} plannedEndTime={form.plannedEndTime} serviceKey={form.serviceKey} plannedMinutes={durationMinutes} allocation={budgetAllocation} manualOverride={budgetManualOverride} onAllocationChange={setBudgetAllocation} onManualOverrideChange={setBudgetManualOverride}/>) : (<InfoBanner message="Bitte zuerst eine:n Klient:in im Bereich „Personen“ auswählen." variant="warning"/>)}
          </SectionPanel>);
            case "documentation":
                return (<>
            <SectionPanel {...FORM_CTX} title="Dokumentation & Nachweis">
              <PremiumInput {...FORM_CTX} label="Dokumentationsvorlage" value={form.documentationTemplate} onChangeText={(documentationTemplate) => patch({ documentationTemplate })}/>
              <ChipSelect label="Leistungsnachweis-Vorlage" options={[
                        { value: "einzel", label: "Einzel-Einsatznachweis" },
                        { value: "monat", label: "Monatsnachweis" },
                    ]} value={form.proofTemplateKey} onChange={(v) => patch({ proofTemplateKey: v as string })}/>
            </SectionPanel>
            <DocumentModuleTemplatesPanel tenantId={tenantId} targetModule="assist" targetArea="assignment" clientId={form.clientId || undefined} employeeId={form.employeeId || undefined} assistOnly title="Einsatz-Dokumentvorlagen"/>
          </>);
            case "review":
                return (<SectionPanel {...FORM_CTX} title="Prüfung & Speichern">
            <InfoBanner onDarkSurface message={`Betreff: ${form.title || form.subjectKey || "—"}`}/>
            <InfoBanner onDarkSurface message={`Klient: ${clients.find((c) => c.value === form.clientId)?.label ?? "—"}`}/>
            <InfoBanner onDarkSurface message={`Termin: ${form.assignmentDate} ${form.plannedStartTime}–${form.plannedEndTime}`}/>
            <InfoBanner onDarkSurface message={`Wiederholung: ${VISIT_RECURRENCE_PATTERN_LABELS[form.recurrencePattern]}${form.recurrenceWeekdays.length > 0
                        ? ` (${form.recurrenceWeekdays
                            .map((d) => VISIT_WEEKDAY_OPTIONS.find((o) => o.key === d)
                            ?.label ?? d)
                            .join(", ")})`
                        : ""}${form.recurrenceEndDate ? ` bis ${form.recurrenceEndDate}` : ""}${form.recurrenceOccurrenceCount
                        ? ` · ${form.recurrenceOccurrenceCount}×`
                        : ""}`}/>
            <InfoBanner onDarkSurface message={`Aufgaben: ${form.taskDrafts.length || form.tasks.filter(Boolean).length}`}/>
            <InfoBanner onDarkSurface message={`Abrechnung: ${budgetAllocation
                        ? `${budgetAllocation.allocationProposal
                            .filter((l) => l.amountCents > 0)
                            .map((l) => `${l.label} ${(l.amountCents / 100).toFixed(2)} €`)
                            .join(" · ") || "—"}`
                        : "Automatisch nach Klient:innenprofil"}`}/>
            <View style={styles.actions}>
              <PremiumButton title="Entwurf speichern" variant="secondary" onPress={() => void handleSave(true)} disabled={loading || listsLoading || optionsLoading || packageLoading || Boolean(persistedVisitId)}/>

            </View>
          </SectionPanel>);
            default:
                return null;
        }
    };
    if (formScope !== scope)
        return <PlatformModal visible={visible} onClose={onClose} title="Neuer Einsatz"><InfoBanner message="Auswahldaten werden aktualisiert…"/></PlatformModal>;
    if (!canManage) {
        return (<PlatformModal visible={visible} onClose={onClose} title="Neuer Einsatz">
        <InfoBanner message="Keine Berechtigung zum Anlegen von Einsätzen."/>
      </PlatformModal>);
    }
    return (<PlatformModal visible={visible} onClose={finishSavedResult} title="Neuer Einsatz" maxWidth={1240} maxHeightRatio={0.95} glowColor={assistAccent} dismissOnBackdrop={false}>
      {listsError ? <ErrorState message={listsError} onRetry={() => setListsRetry(value => value + 1)}/> : null}
      {error ? <InfoBanner message={error} variant="danger"/> : null}
      {savedConflicts.length ? <InfoBanner message={`Einsatz wurde gespeichert. Bitte Planungshinweise prüfen: ${savedConflicts.join(' · ')}`} variant="warning"/> : null}
      {persistedVisitId ? <PremiumButton title="Gespeicherten Einsatz prüfen" onPress={async () => {
                await finishSavedResult();
                if (!savedConflicts.length || !onCreated)
                    router.push(`/assist/assignments/${persistedVisitId}` as never);
            }}/> : null}
      <ScrollView style={styles.sectionScroll} contentContainerStyle={styles.sectionBody} keyboardShouldPersistTaps="handled">
        <AssignmentStudioScaffold steps={CREATE_STUDIO_STEPS} activeStep={section} onStepChange={(key) => { if (!submitScope.current)
        setSection(key); }} title="Einsatz planen" description="Personen, Termin und Aufgaben festlegen. Ihre Angaben werden erst beim Speichern übernommen." summary={[
            {
                label: "Klient:in",
                value: selectedClient,
                icon: "person-outline",
            },
            {
                label: "Termin",
                value: form.assignmentDate
                    ? `${form.assignmentDate} · ${form.plannedStartTime}–${form.plannedEndTime}`
                    : "",
                icon: "time-outline",
            },
            {
                label: "Mitarbeitende:r",
                value: selectedEmployee || "Noch nicht zugewiesen",
                icon: "person-add-outline",
                tone: selectedEmployee ? "success" : "warning",
            },
            {
                label: "Leistung",
                value: selectedService,
                icon: "briefcase-outline",
            },
        ]} footer={<>
              <PremiumButton title={savedConflicts.length ? "Schließen" : "Abbrechen"} variant="ghost" onPress={finishSavedResult}/>
              <View style={styles.footerActions}>
                {sectionIndex > 0 ? (<PremiumButton title="Zurück" variant="secondary" onPress={() => goToRelativeSection(-1)}/>) : null}
                {sectionIndex < CREATE_STUDIO_STEPS.length - 1 ? (<PremiumButton title="Weiter" onPress={() => goToRelativeSection(1)}/>) : (<PremiumButton title="Einsatz speichern" onPress={() => void handleSave(false)} loading={loading} disabled={loading || listsLoading || optionsLoading || packageLoading || Boolean(persistedVisitId) || !form.clientId}/>)}
              </View>
            </>}>
          <NativeFieldset disabled={loading || Boolean(persistedVisitId)}>{renderSection()}</NativeFieldset>
        </AssignmentStudioScaffold>
      </ScrollView>
    </PlatformModal>);
}
const styles = StyleSheet.create({
    sectionScroll: { flexGrow: 1, flexShrink: 1, maxWidth: "100%" },
    sectionBody: {
        gap: careSpacing.md,
        paddingBottom: careSpacing.sm,
        minHeight: 120,
    },
    hint: { ...typography.caption, marginBottom: spacing.sm },
    darkHint: {
        ...typography.caption,
        marginBottom: spacing.sm,
        color: "#536f86",
        fontWeight: "600",
    },
    packageGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    packageCard: {
        borderWidth: 1,
        borderColor: "#d4e3ef",
        borderRadius: 12,
        padding: spacing.md,
        minWidth: 160,
        flexGrow: 1,
        backgroundColor: "#FFFFFF",
    },
    packageCardSelected: {
        borderColor: "#39B8FF",
        backgroundColor: "#e7f2ff",
    },
    packageTitle: { ...typography.body, color: "#173b5b", fontWeight: "800" },
    packageMeta: {
        ...typography.caption,
        color: "#617b90",
        marginTop: 4,
        fontWeight: "700",
    },
    taskRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.xs,
        gap: spacing.sm,
    },
    taskTitle: { ...typography.body, flex: 1 },
    actions: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    footerActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
