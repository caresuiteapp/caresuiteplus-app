import type {
  WfmOfficeAuditEntry,
  WfmOfficeMessage,
  WfmOfficeTimeEntry,
} from '@/types/modules/wfmOfficeTimekeeping';

const entryOverlays = new Map<string, Partial<WfmOfficeTimeEntry>>();
const manualEntries = new Map<string, WfmOfficeTimeEntry>();
const auditEntries = new Map<string, WfmOfficeAuditEntry[]>();
const officeMessages = new Map<string, WfmOfficeMessage[]>();
const visitJustifications = new Map<string, { start?: JustificationRecord; end?: JustificationRecord }>();

type JustificationRecord = {
  text: string;
  submittedAt: string;
  ampel: string;
  deviationMinutes: number;
  direction: string;
};

let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Date.now()}`;
}

export function resetWfmOfficeTimekeepingStore(): void {
  entryOverlays.clear();
  manualEntries.clear();
  auditEntries.clear();
  officeMessages.clear();
  visitJustifications.clear();
  idCounter = 0;
}

export function getEntryOverlay(entryId: string): Partial<WfmOfficeTimeEntry> | undefined {
  return entryOverlays.get(entryId);
}

export function setEntryOverlay(entryId: string, patch: Partial<WfmOfficeTimeEntry>): void {
  entryOverlays.set(entryId, { ...entryOverlays.get(entryId), ...patch });
}

export function listManualEntries(tenantId: string): WfmOfficeTimeEntry[] {
  return [...manualEntries.values()].filter((e) => e.tenantId === tenantId);
}

export function saveManualEntry(entry: WfmOfficeTimeEntry): void {
  manualEntries.set(entry.id, entry);
}

export function getManualEntry(entryId: string): WfmOfficeTimeEntry | undefined {
  return manualEntries.get(entryId);
}

export function appendAuditEntry(tenantId: string, entry: WfmOfficeAuditEntry): void {
  const list = auditEntries.get(tenantId) ?? [];
  list.unshift(entry);
  auditEntries.set(tenantId, list);
}

export function listAuditForEntity(tenantId: string, entityId: string): WfmOfficeAuditEntry[] {
  return (auditEntries.get(tenantId) ?? []).filter((e) => e.entityId === entityId);
}

export function listAuditForTenant(tenantId: string): WfmOfficeAuditEntry[] {
  return auditEntries.get(tenantId) ?? [];
}

export function appendOfficeMessage(tenantId: string, message: WfmOfficeMessage): void {
  const list = officeMessages.get(tenantId) ?? [];
  list.unshift(message);
  officeMessages.set(tenantId, list);
}

export function listOfficeMessages(tenantId: string): WfmOfficeMessage[] {
  return officeMessages.get(tenantId) ?? [];
}

export function updateOfficeMessageReview(
  tenantId: string,
  messageId: string,
  reviewStatus: WfmOfficeMessage['reviewStatus'],
): void {
  const list = officeMessages.get(tenantId) ?? [];
  const idx = list.findIndex((m) => m.id === messageId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], reviewStatus };
    officeMessages.set(tenantId, list);
  }
}

export function visitJustificationKey(
  tenantId: string,
  visitId: string,
  employeeId: string,
): string {
  return `${tenantId}:${visitId}:${employeeId}`;
}

export function getVisitJustification(
  tenantId: string,
  visitId: string,
  employeeId: string,
): { start?: JustificationRecord; end?: JustificationRecord } | undefined {
  return visitJustifications.get(visitJustificationKey(tenantId, visitId, employeeId));
}

export function setVisitJustification(
  tenantId: string,
  visitId: string,
  employeeId: string,
  phase: 'start' | 'end',
  record: JustificationRecord,
): void {
  const key = visitJustificationKey(tenantId, visitId, employeeId);
  const current = visitJustifications.get(key) ?? {};
  visitJustifications.set(key, { ...current, [phase]: record });
}

export function createAuditId(): string {
  return nextId('audit');
}

export function createMessageId(): string {
  return nextId('msg');
}

export function createEntryId(): string {
  return nextId('entry');
}
