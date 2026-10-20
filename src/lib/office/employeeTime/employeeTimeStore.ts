import type {
  AssignmentPauseEvent,
  EmployeeAbsenceBlock,
  EmployeeMileageLogEntry,
  EmployeeTimeAuditEvent,
  EmployeeTimeCorrection,
  EmployeeTimeEntry,
  EmployeeTimePeriod,
  PayrollExportAuditEvent,
  PayrollExportBatch,
  PayrollExportItem,
  TenantWorkTimeSettings,
  TravelTimeEntry,
} from '@/types/modules/employeeTime';

type Store = {
  settings: Map<string, TenantWorkTimeSettings>;
  timeEntries: Map<string, EmployeeTimeEntry>;
  periods: Map<string, EmployeeTimePeriod>;
  corrections: Map<string, EmployeeTimeCorrection>;
  pauseEvents: Map<string, AssignmentPauseEvent>;
  travelEntries: Map<string, TravelTimeEntry>;
  mileageEntries: Map<string, EmployeeMileageLogEntry>;
  payrollBatches: Map<string, PayrollExportBatch>;
  payrollItems: Map<string, PayrollExportItem>;
  payrollAudit: PayrollExportAuditEvent[];
  timeAudit: EmployeeTimeAuditEvent[];
  absences: Map<string, EmployeeAbsenceBlock>;
};

const STORE: Store = {
  settings: new Map(),
  timeEntries: new Map(),
  periods: new Map(),
  corrections: new Map(),
  pauseEvents: new Map(),
  travelEntries: new Map(),
  mileageEntries: new Map(),
  payrollBatches: new Map(),
  payrollItems: new Map(),
  payrollAudit: [],
  timeAudit: [],
  absences: new Map(),
};

let entryCounter = 0;
let periodCounter = 0;
let correctionCounter = 0;
let pauseCounter = 0;
let travelCounter = 0;
let mileageCounter = 0;
let batchCounter = 0;
let itemCounter = 0;
let auditCounter = 0;
let payrollAuditCounter = 0;
let absenceCounter = 0;

export function defaultTenantWorkTimeSettings(tenantId: string): TenantWorkTimeSettings {
  return {
    tenantId,
    countsTravelAsWorkTime: false,
    kmBillableByServiceType: {},
    routeProviderConfigured: false,
    payrollProviderConfigured: {},
    updatedAt: new Date().toISOString(),
  };
}

export function getTenantWorkTimeSettings(tenantId: string): TenantWorkTimeSettings {
  return STORE.settings.get(tenantId) ?? defaultTenantWorkTimeSettings(tenantId);
}

export function saveTenantWorkTimeSettings(settings: TenantWorkTimeSettings): TenantWorkTimeSettings {
  const next = { ...settings, updatedAt: new Date().toISOString() };
  STORE.settings.set(settings.tenantId, next);
  return next;
}

export function nextTimeEntryId(): string {
  entryCounter += 1;
  return `etime-${entryCounter}`;
}

export function nextPeriodId(): string {
  periodCounter += 1;
  return `eperiod-${periodCounter}`;
}

export function nextCorrectionId(): string {
  correctionCounter += 1;
  return `ecorr-${correctionCounter}`;
}

export function nextPauseEventId(): string {
  pauseCounter += 1;
  return `epause-${pauseCounter}`;
}

export function nextTravelEntryId(): string {
  travelCounter += 1;
  return `etravel-${travelCounter}`;
}

export function nextMileageEntryId(): string {
  mileageCounter += 1;
  return `emileage-${mileageCounter}`;
}

export function nextPayrollBatchId(): string {
  batchCounter += 1;
  return `paybatch-${batchCounter}`;
}

export function nextPayrollItemId(): string {
  itemCounter += 1;
  return `payitem-${itemCounter}`;
}

export function nextTimeAuditId(): string {
  auditCounter += 1;
  return `etaudit-${auditCounter}`;
}

export function nextPayrollAuditId(): string {
  payrollAuditCounter += 1;
  return `paudit-${payrollAuditCounter}`;
}

export function nextAbsenceId(): string {
  absenceCounter += 1;
  return `eabsence-${absenceCounter}`;
}

export function saveTimeEntry(entry: EmployeeTimeEntry): EmployeeTimeEntry {
  STORE.timeEntries.set(entry.id, entry);
  return entry;
}

export function getTimeEntry(tenantId: string, entryId: string): EmployeeTimeEntry | null {
  const entry = STORE.timeEntries.get(entryId);
  if (!entry || entry.tenantId !== tenantId) return null;
  return entry;
}

export function listTimeEntries(tenantId: string, employeeId?: string | null): EmployeeTimeEntry[] {
  return [...STORE.timeEntries.values()].filter(
    (e) => e.tenantId === tenantId && (!employeeId || e.employeeId === employeeId),
  );
}

export function savePeriod(period: EmployeeTimePeriod): EmployeeTimePeriod {
  STORE.periods.set(period.id, period);
  return period;
}

export function getPeriod(tenantId: string, periodId: string): EmployeeTimePeriod | null {
  const period = STORE.periods.get(periodId);
  if (!period || period.tenantId !== tenantId) return null;
  return period;
}

export function listPeriods(tenantId: string, employeeId?: string | null): EmployeeTimePeriod[] {
  return [...STORE.periods.values()].filter(
    (p) => p.tenantId === tenantId && (!employeeId || p.employeeId === employeeId),
  );
}

export function saveCorrection(correction: EmployeeTimeCorrection): EmployeeTimeCorrection {
  STORE.corrections.set(correction.id, correction);
  return correction;
}

export function listCorrections(tenantId: string): EmployeeTimeCorrection[] {
  return [...STORE.corrections.values()].filter((c) => c.tenantId === tenantId);
}

export function savePauseEvent(event: AssignmentPauseEvent): AssignmentPauseEvent {
  STORE.pauseEvents.set(event.id, event);
  return event;
}

export function listPauseEvents(tenantId: string, assignmentId?: string): AssignmentPauseEvent[] {
  return [...STORE.pauseEvents.values()].filter(
    (p) => p.tenantId === tenantId && (!assignmentId || p.assignmentId === assignmentId),
  );
}

export function saveTravelEntry(entry: TravelTimeEntry): TravelTimeEntry {
  STORE.travelEntries.set(entry.id, entry);
  return entry;
}

export function listTravelEntries(tenantId: string, employeeId?: string): TravelTimeEntry[] {
  return [...STORE.travelEntries.values()].filter(
    (t) => t.tenantId === tenantId && (!employeeId || t.employeeId === employeeId),
  );
}

export function saveMileageEntry(entry: EmployeeMileageLogEntry): EmployeeMileageLogEntry {
  STORE.mileageEntries.set(entry.id, entry);
  return entry;
}

export function listMileageEntries(tenantId: string, employeeId?: string): EmployeeMileageLogEntry[] {
  return [...STORE.mileageEntries.values()].filter(
    (m) => m.tenantId === tenantId && (!employeeId || m.employeeId === employeeId),
  );
}

export function savePayrollBatch(batch: PayrollExportBatch): PayrollExportBatch {
  STORE.payrollBatches.set(batch.id, batch);
  return batch;
}

export function getPayrollBatch(tenantId: string, batchId: string): PayrollExportBatch | null {
  const batch = STORE.payrollBatches.get(batchId);
  if (!batch || batch.tenantId !== tenantId) return null;
  return batch;
}

export function listPayrollBatches(tenantId: string): PayrollExportBatch[] {
  return [...STORE.payrollBatches.values()].filter((b) => b.tenantId === tenantId);
}

export function savePayrollItem(item: PayrollExportItem): PayrollExportItem {
  STORE.payrollItems.set(item.id, item);
  return item;
}

export function listPayrollItems(tenantId: string, batchId?: string): PayrollExportItem[] {
  return [...STORE.payrollItems.values()].filter(
    (i) => i.tenantId === tenantId && (!batchId || i.batchId === batchId),
  );
}

export function appendTimeAudit(event: EmployeeTimeAuditEvent): void {
  STORE.timeAudit.push(event);
}

export function listTimeAudit(tenantId: string): EmployeeTimeAuditEvent[] {
  return STORE.timeAudit.filter((e) => e.tenantId === tenantId);
}

export function appendPayrollAudit(event: PayrollExportAuditEvent): void {
  STORE.payrollAudit.push(event);
}

export function listPayrollAudit(tenantId: string): PayrollExportAuditEvent[] {
  return STORE.payrollAudit.filter((e) => e.tenantId === tenantId);
}

export function saveAbsence(absence: EmployeeAbsenceBlock): EmployeeAbsenceBlock {
  STORE.absences.set(absence.id, absence);
  return absence;
}

export function listAbsences(tenantId: string, employeeId?: string): EmployeeAbsenceBlock[] {
  return [...STORE.absences.values()].filter(
    (a) => a.tenantId === tenantId && (!employeeId || a.employeeId === employeeId),
  );
}

export function resetEmployeeTimeStore(): void {
  STORE.settings.clear();
  STORE.timeEntries.clear();
  STORE.periods.clear();
  STORE.corrections.clear();
  STORE.pauseEvents.clear();
  STORE.travelEntries.clear();
  STORE.mileageEntries.clear();
  STORE.payrollBatches.clear();
  STORE.payrollItems.clear();
  STORE.payrollAudit.length = 0;
  STORE.timeAudit.length = 0;
  STORE.absences.clear();
  entryCounter = 0;
  periodCounter = 0;
  correctionCounter = 0;
  pauseCounter = 0;
  travelCounter = 0;
  mileageCounter = 0;
  batchCounter = 0;
  itemCounter = 0;
  auditCounter = 0;
  payrollAuditCounter = 0;
  absenceCounter = 0;
}

export function getEmployeeTimeStoreSnapshot(tenantId: string) {
  return {
    settings: getTenantWorkTimeSettings(tenantId),
    timeEntries: listTimeEntries(tenantId),
    periods: listPeriods(tenantId),
    corrections: listCorrections(tenantId),
    payrollBatches: listPayrollBatches(tenantId),
  };
}
