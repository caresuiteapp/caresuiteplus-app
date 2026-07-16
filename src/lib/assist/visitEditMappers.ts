import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type {
  VisitCreateWizardData,
  VisitDispositionDetail,
  VisitRecurrencePattern,
} from '@/lib/assist/visitTypes';
import {
  EMPTY_VISIT_WIZARD_DATA,
  buildVisitRecurrenceJson,
} from '@/lib/assist/visitTypes';
import { parseVisitRecurrenceJson } from '@/lib/assist/visitRecurrenceExpansion';

export type VisitEditFormData = VisitCreateWizardData & {
  assignmentStatus: AssignmentStatus;
};

function padTimePart(value: number): string {
  return String(value).padStart(2, '0');
}

function isoToLocalDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}`;
}

function isoToLocalTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '09:00';
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;
}

function readCatalogSnapshotString(
  snapshot: Record<string, unknown> | undefined,
  key: string,
): string {
  const value = snapshot?.[key];
  return typeof value === 'string' ? value : '';
}

export function mapVisitDetailToEditForm(visit: VisitDispositionDetail): VisitEditFormData {
  const recurrence = parseVisitRecurrenceJson(visit.recurrenceJson ?? { pattern: 'none' });
  const snapshot = visit.catalogSnapshotJson ?? {};

  return {
    ...EMPTY_VISIT_WIZARD_DATA,
    title: visit.title,
    description: visit.description ?? '',
    clientId: visit.clientId,
    employeeId: visit.employeeId ?? '',
    serviceKey: visit.serviceKey ?? '',
    serviceName: visit.serviceName ?? visit.title,
    tasks: visit.tasks.map((task) => task.title),
    taskDrafts: visit.tasks.map((task, index) => ({
      itemKey: task.id,
      title: task.title,
      isRequired: task.isRequired,
      isOptional: !task.isRequired,
      sortOrder: index,
    })),
    assignmentDate: visit.assignmentDate ?? isoToLocalDate(visit.scheduledStart),
    plannedStartTime: isoToLocalTime(visit.scheduledStart),
    plannedEndTime: isoToLocalTime(visit.scheduledEnd),
    addressSnapshot: visit.addressSnapshot ?? visit.location ?? '',
    locationNotes: visit.locationNotes ?? '',
    internalNotes: visit.notes ?? '',
    employeeNotes: visit.employeeNotes ?? '',
    clientVisibleNotes: visit.clientVisibleNotes ?? '',
    subjectKey: visit.subjectKey ?? readCatalogSnapshotString(snapshot, 'subjectKey'),
    assignmentTypeKey:
      visit.assignmentTypeKey ?? readCatalogSnapshotString(snapshot, 'assignmentTypeKey'),
    serviceCategoryKey:
      visit.serviceCategoryKey ?? readCatalogSnapshotString(snapshot, 'serviceCategoryKey'),
    taskPackageId: visit.taskPackageId ?? readCatalogSnapshotString(snapshot, 'taskPackageId'),
    billingBudgetSourceKey:
      visit.billingBudgetSourceKey ?? readCatalogSnapshotString(snapshot, 'billingBudgetSourceKey'),
    proofTemplateKey: visit.proofTemplateKey ?? readCatalogSnapshotString(snapshot, 'proofTemplateKey'),
    documentationTemplate:
      visit.documentationTemplateKey
      ?? readCatalogSnapshotString(snapshot, 'documentationTemplateKey'),
    riskFlagKeys: visit.riskFlagKeys ?? [],
    budgetAmountCents: visit.budget?.budgetAmountCents ?? null,
    portalReleaseEnabled: visit.portalReleaseEnabled,
    recurrencePattern: (recurrence.pattern ?? 'none') as VisitRecurrencePattern,
    recurrenceEndDate: recurrence.endDate ?? '',
    recurrenceWeekdays: recurrence.weekdays ?? [],
    recurrenceOccurrenceCount: recurrence.occurrenceCount ?? null,
    catalogSnapshotJson: snapshot,
    assignmentStatus: visit.assignmentStatus,
  };
}

export function buildVisitUpdateInputFromEditForm(
  form: VisitEditFormData,
): import('@/lib/assist/visitTypes').VisitCreateInput & { assignmentStatus: AssignmentStatus } {
  const taskTitles =
    form.taskDrafts.length > 0
      ? form.taskDrafts.map((task) => task.title)
      : form.tasks.map((task) => task.trim()).filter(Boolean);

  return {
    clientId: form.clientId,
    employeeId: form.employeeId || null,
    serviceKey: form.serviceKey,
    serviceName: form.serviceName || form.title,
    title: form.title,
    description: form.description || null,
    assignmentDate: form.assignmentDate,
    plannedStartAt: new Date(`${form.assignmentDate}T${form.plannedStartTime}:00`).toISOString(),
    plannedEndAt: new Date(`${form.assignmentDate}T${form.plannedEndTime}:00`).toISOString(),
    addressSnapshot: form.addressSnapshot || null,
    locationNotes: form.locationNotes || null,
    tasks: taskTitles,
    budgetAmountCents: form.budgetAmountCents,
    internalNotes: form.internalNotes || null,
    employeeNotes: form.employeeNotes || null,
    clientVisibleNotes: form.clientVisibleNotes || null,
    notifyEmployee: form.notifyEmployee,
    notifyClient: form.notifyClient,
    portalReleaseEnabled: form.portalReleaseEnabled,
    saveAsDraft: false,
    subjectKey: form.subjectKey || null,
    assignmentTypeKey: form.assignmentTypeKey || null,
    serviceCategoryKey: form.serviceCategoryKey || null,
    taskPackageId: form.taskPackageId || null,
    billingBudgetSourceKey: form.billingBudgetSourceKey || null,
    proofTemplateKey: form.proofTemplateKey || null,
    documentationTemplateKey: form.documentationTemplate || null,
    riskFlagKeys: form.riskFlagKeys,
    recurrenceJson: buildVisitRecurrenceJson(form),
    catalogSnapshotJson: {
      ...form.catalogSnapshotJson,
      subjectKey: form.subjectKey,
      assignmentTypeKey: form.assignmentTypeKey,
      serviceCategoryKey: form.serviceCategoryKey,
      taskPackageId: form.taskPackageId,
    },
    budgetAllocation: form.budgetAllocation ?? null,
    budgetManualOverride: form.budgetManualOverride ?? null,
    assignmentStatus: form.assignmentStatus,
  };
}
