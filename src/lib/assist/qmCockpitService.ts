import type { RoleKey, ServiceResult } from '@/types';
import type { BillableItem } from '@/types/careBilling';
import type { CareBillingValidationReport } from '@/types/careBilling/billingValidation';
import {
  QM_COCKPIT_AREA_LABELS,
  type QmCockpitAreaKey,
  type QmCockpitAreaSnapshot,
  type QmCockpitItem,
  type QmCockpitListFilter,
  type QmCockpitSnapshot,
  managementTaskToCockpitItem,
} from '@/types/modules/qmCockpit';
import { createCareBillingValidationReport } from '@/lib/careBilling/careBillingValidationService';
import { listBillableItems } from '@/lib/careBilling/careBillingStore';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { listAssignmentWorkflows } from './assignmentWorkflowService';
import { fetchDayMonitor } from './liveMonitorService';
import { listManagementTasks } from './managementTaskService';
import { onBillingValidationFailed } from './managementTaskAutomationService';
import { listCorrectionRequests } from './correctionRequestService';
import { listServiceRecords } from './correctionRequestService';
import {
  QM_COCKPIT_STORE,
  filterQmByTenant,
  type QmDocumentRegistryEntry,
} from './qmCockpitStore';
import { listEmergencyReports, listProblemReports } from './problemReportService';

const ALL_AREAS: QmCockpitAreaKey[] = [
  'heute_kritisch',
  'doku_fehlt',
  'signatur_fehlt',
  'pruefung_offen',
  'korrektur_angefordert',
  'abrechnungsbereit',
  'abrechnungsblocker',
  'dokumente',
  'qualitaet',
];

function isOpenItem(item: QmCockpitItem): boolean {
  return item.status !== 'resolved' && item.status !== 'archived' && item.status !== 'rejected';
}

function billableItemToCockpitItem(item: BillableItem, area: QmCockpitAreaKey): QmCockpitItem {
  return {
    id: `billable-${item.id}`,
    area,
    taskId: null,
    title: item.description || 'Abrechnungsposition',
    description: `Status: ${item.status}`,
    priority: area === 'abrechnungsblocker' ? 'high' : 'normal',
    status: 'open',
    clientId: item.clientId,
    employeeId: null,
    assignmentId: null,
    relatedEntityType: 'billable_item',
    relatedEntityId: item.id,
    dueAt: null,
    updatedAt: item.updatedAt,
  };
}

function documentToCockpitItem(doc: QmDocumentRegistryEntry): QmCockpitItem {
  return {
    id: `doc-reg-${doc.id}`,
    area: 'dokumente',
    taskId: null,
    title: doc.title,
    description: `Dokument: ${doc.documentType} — ${doc.status}`,
    priority: doc.status === 'missing' ? 'high' : 'normal',
    status: doc.status === 'missing' ? 'open' : 'waiting_for_client',
    clientId: doc.clientId,
    employeeId: null,
    assignmentId: null,
    relatedEntityType: 'document',
    relatedEntityId: doc.id,
    dueAt: null,
    updatedAt: doc.updatedAt,
  };
}

function buildBillingBlockerItems(tenantId: string): QmCockpitItem[] {
  const items: QmCockpitItem[] = [];
  for (const billable of listBillableItems(tenantId)) {
    if (billable.status === 'missing_data') {
      items.push(billableItemToCockpitItem(billable, 'abrechnungsblocker'));
    }
  }
  return items;
}

function buildBillingReadyItems(tenantId: string): QmCockpitItem[] {
  const items: QmCockpitItem[] = [];
  for (const billable of listBillableItems(tenantId)) {
    if (billable.status === 'ready') {
      items.push(billableItemToCockpitItem(billable, 'abrechnungsbereit'));
    }
  }
  for (const record of listServiceRecords(tenantId, { status: 'billing_ready' })) {
    items.push({
      id: `sr-ready-${record.id}`,
      area: 'abrechnungsbereit',
      taskId: null,
      title: `Leistungsnachweis ${record.serviceType}`,
      description: 'Freigegeben — abrechnungsbereit',
      priority: 'normal',
      status: 'open',
      clientId: record.clientId,
      employeeId: record.employeeId,
      assignmentId: record.assignmentId,
      relatedEntityType: 'service_record',
      relatedEntityId: record.id,
      dueAt: null,
      updatedAt: record.updatedAt,
    });
  }
  return items;
}

function buildQualityItems(tenantId: string): QmCockpitItem[] {
  const items: QmCockpitItem[] = [];
  const corrections = listCorrectionRequests(tenantId).filter((c) => c.status !== 'resolved');
  for (const correction of corrections.slice(0, 5)) {
    items.push({
      id: `qual-corr-${correction.id}`,
      area: 'qualitaet',
      taskId: null,
      title: 'Wiederholte Korrektur',
      description: correction.reason,
      priority: 'normal',
      status: 'open',
      clientId: null,
      employeeId: correction.assignedToEmployeeId,
      assignmentId: correction.assignmentId,
      relatedEntityType: 'correction_request',
      relatedEntityId: correction.id,
      dueAt: correction.dueAt,
      updatedAt: correction.updatedAt,
    });
  }
  return items;
}

function applyFilter(items: QmCockpitItem[], filter?: QmCockpitListFilter): QmCockpitItem[] {
  if (!filter) return items;
  return items.filter((item) => {
    if (filter.area && item.area !== filter.area) return false;
    if (filter.status && item.status !== filter.status) return false;
    if (filter.priority && item.priority !== filter.priority) return false;
    if (filter.assignmentId && item.assignmentId !== filter.assignmentId) return false;
    if (filter.clientId && item.clientId !== filter.clientId) return false;
    if (filter.employeeId && item.employeeId !== filter.employeeId) return false;
    if (filter.search?.trim()) {
      const q = filter.search.trim().toLowerCase();
      if (!`${item.title} ${item.description}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function buildAreaSnapshot(area: QmCockpitAreaKey, items: QmCockpitItem[]): QmCockpitAreaSnapshot {
  const openItems = items.filter(isOpenItem);
  return {
    area,
    label: QM_COCKPIT_AREA_LABELS[area],
    openCount: openItems.length,
    criticalCount: openItems.filter((i) => i.priority === 'critical').length,
    items,
  };
}

export function collectQmCockpitItems(tenantId: string): QmCockpitItem[] {
  const taskItems = listManagementTasks(tenantId)
    .filter((t) => t.status !== 'resolved' && t.status !== 'archived')
    .map(managementTaskToCockpitItem);

  const monitor = fetchDayMonitor(tenantId, 'business_admin');
  const criticalRows = monitor.ok
    ? monitor.data.filter(
        (r) =>
          r.problemStatus !== 'none' ||
          r.displayStatus === 'kritisch' ||
          r.displayStatus === 'nicht_angetroffen' ||
          r.cancelRequest ||
          r.rescheduleRequest ||
          (r.overrunMinutes != null && r.overrunMinutes > 0) ||
          (r.delayMinutes != null && r.delayMinutes > 15),
      )
    : [];

  const criticalItems: QmCockpitItem[] = criticalRows.map((row) => ({
    id: `crit-${row.assignmentId}`,
    area: 'heute_kritisch',
    taskId: null,
    title: row.title,
    description: `Status: ${row.displayStatus}`,
    priority: row.problemStatus === 'emergency' ? 'critical' : 'high',
    status: 'open',
    clientId: row.clientId,
    employeeId: row.employeeId,
    assignmentId: row.assignmentId,
    relatedEntityType: 'assignment',
    relatedEntityId: row.assignmentId,
    dueAt: null,
    updatedAt: row.plannedStartAt,
  }));

  const docRegistryItems = filterQmByTenant(QM_COCKPIT_STORE.documentRegistry, tenantId)
    .filter((d) => d.status === 'missing' || d.status === 'pending_signature')
    .map(documentToCockpitItem);

  const billingReady = buildBillingReadyItems(tenantId);
  const billingBlocker = buildBillingBlockerItems(tenantId);
  const quality = buildQualityItems(tenantId);

  const merged = [...taskItems, ...criticalItems, ...docRegistryItems, ...billingReady, ...billingBlocker, ...quality];

  const byArea = new Map<QmCockpitAreaKey, QmCockpitItem[]>();
  for (const area of ALL_AREAS) {
    byArea.set(area, []);
  }
  for (const item of merged) {
    const list = byArea.get(item.area) ?? [];
    list.push(item);
    byArea.set(item.area, list);
  }

  return ALL_AREAS.flatMap((area) => byArea.get(area) ?? []);
}

export function fetchQmCockpitSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  filter?: QmCockpitListFilter,
): ServiceResult<QmCockpitSnapshot> {
  if (actorRoleKey === 'client_portal') {
    return { ok: false, error: 'Interne QM-Aufgaben sind für Klient:innen nicht sichtbar.' };
  }

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const liveBlock = guardLiveDemoFeature<QmCockpitSnapshot>(tenantId, 'QM-Cockpit');
    if (liveBlock) return liveBlock;
  }

  const denied = enforcePermission<QmCockpitSnapshot>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;

  const allItems = applyFilter(collectQmCockpitItems(tenantId), filter);
  const areas = ALL_AREAS.map((area) =>
    buildAreaSnapshot(
      area,
      allItems.filter((item) => item.area === area),
    ),
  );

  const openItems = allItems.filter(isOpenItem);

  return {
    ok: true,
    data: {
      tenantId,
      generatedAt: new Date().toISOString(),
      totalOpen: openItems.length,
      totalCritical: openItems.filter((i) => i.priority === 'critical').length,
      areas,
    },
  };
}

export function syncBillingBlockerTasks(
  tenantId: string,
  clientId: string,
  input: Parameters<typeof createCareBillingValidationReport>[0],
): CareBillingValidationReport {
  const report = createCareBillingValidationReport(input);
  if (!report.passed) {
    onBillingValidationFailed({
      tenantId,
      clientId,
      billableItemId: input.billableItemId ?? null,
      report,
    });
  }
  return report;
}

export function registerClientDocument(input: Omit<QmDocumentRegistryEntry, 'id' | 'createdAt' | 'updatedAt'>): QmDocumentRegistryEntry {
  const entry: QmDocumentRegistryEntry = {
    ...input,
    id: `qm-doc-${QM_COCKPIT_STORE.documentRegistry.length + 1}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  QM_COCKPIT_STORE.documentRegistry.push(entry);
  return entry;
}

export function detectLateAssignments(tenantId: string): number {
  let count = 0;
  const now = Date.now();
  for (const assignment of listAssignmentWorkflows(tenantId)) {
    const plannedStart = new Date(assignment.plannedStartAt).getTime();
    if (
      !assignment.actualStartAt &&
      plannedStart < now - 15 * 60_000 &&
      assignment.status === 'geplant'
    ) {
      count += 1;
    }
  }
  return count;
}

export function countOpenEmergenciesWithoutFollowUp(tenantId: string): number {
  const emergencies = listEmergencyReports(tenantId);
  const followUps = listManagementTasks(tenantId, { taskType: 'emergency_follow_up' });
  const covered = new Set(followUps.map((t) => t.assignmentId).filter(Boolean));
  return emergencies.filter((e) => !covered.has(e.assignmentId)).length;
}

export function countOpenProblems(tenantId: string): number {
  return listProblemReports(tenantId).length;
}
