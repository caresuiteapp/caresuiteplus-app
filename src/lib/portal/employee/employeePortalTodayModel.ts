import type { EmployeePortalDashboardProjection } from '@/types/portalSystem';
import type { EmployeePortalAssignmentListItem } from '@/types/modules/employeePortalExecution';
import { getVisibleNavItemsForRole } from '@/components/healthos/navigation/resolveHealthOSNavigation';
import {
  isActiveEmployeeAssignment,
  isDocumentationPendingEmployeeAssignment,
  resolveDashboardCurrentAssignment,
} from '@/lib/portal/employeePortalLiveOverviewService';

// ─── Exported types ───────────────────────────────────────────────────────────

export type EmployeePortalTodayMetric = {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  icon: string;
  route?: string;
};

export type EmployeePortalTodayAssignment = {
  assignmentId: string;
  title: string;
  clientName: string;
  timeRange: string;
  statusTechnical: string;
  isActive: boolean;
  hasOpenDocumentation: boolean;
  executeRoute: string;
  detailRoute: string;
};

export type EmployeePortalTodayTask = {
  id: string;
  label: string;
  count: number;
  route?: string;
};

export type EmployeePortalTodayLink = {
  id: string;
  label: string;
  route: string;
  icon?: string;
};

export type EmployeePortalTodayModel = {
  greetingLine: string;
  tagesübersicht: EmployeePortalTodayMetric[];
  openSignatures: EmployeePortalTodayMetric | null;
  currentAssignment: EmployeePortalTodayAssignment | null;
  meineEinsaetze: EmployeePortalTodayAssignment[];
  offeneAufgaben: EmployeePortalTodayTask[];
  schnellzugriffe: EmployeePortalTodayLink[];
};

export type EmployeePortalTodayInput = {
  dashboard: EmployeePortalDashboardProjection;
  displayName: string;
};

// ─── Read-only metrics passthrough (for tests) ────────────────────────────────

export type EmployeePortalTodayReadMetrics = {
  todayCount: number;
  hoursWorked: string;
  openDocumentationCount: number;
  missingSignatureCount: number;
  openSignatureDocumentCount: number;
  overdueSignatureDocumentCount: number;
  messageCount: number;
};

export function pickEmployeePortalTodayReadMetrics(
  dashboard: EmployeePortalDashboardProjection,
): EmployeePortalTodayReadMetrics {
  const minutes = dashboard.todayAssignments.reduce((sum, item) => {
    const start = new Date(item.plannedStartAt).getTime();
    const end = new Date(item.plannedEndAt).getTime();
    return sum + Math.max(0, Math.round((end - start) / 60000));
  }, 0);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hoursWorked =
    minutes === 0
      ? '0 Std.'
      : mins > 0
        ? `${hours} Std. ${mins} Min.`
        : `${hours} Std.`;
  return {
    todayCount: dashboard.todayAssignments.length,
    hoursWorked,
    openDocumentationCount: dashboard.openDocumentationCount,
    missingSignatureCount: dashboard.missingSignatureCount,
    openSignatureDocumentCount: dashboard.openSignatureDocumentCount,
    overdueSignatureDocumentCount: dashboard.overdueSignatureDocumentCount,
    messageCount: dashboard.messageCount,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const e = new Date(end).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${s} – ${e}`;
}

function toTodayAssignment(
  item: EmployeePortalAssignmentListItem,
): EmployeePortalTodayAssignment {
  return {
    assignmentId: item.assignmentId,
    title: item.title,
    clientName: item.clientName,
    timeRange: formatTimeRange(item.plannedStartAt, item.plannedEndAt),
    statusTechnical: String(item.status),
    isActive: isActiveEmployeeAssignment(item.status),
    hasOpenDocumentation:
      item.documentationPending || isDocumentationPendingEmployeeAssignment(item.status),
    executeRoute: `/portal/employee/assignments/${item.assignmentId}/execute`,
    detailRoute: `/portal/employee/assignments/${item.assignmentId}`,
  };
}

function buildOpenSignaturesCard(
  dashboard: EmployeePortalDashboardProjection,
): EmployeePortalTodayMetric | null {
  if (dashboard.openSignatureDocumentCount <= 0) return null;
  return {
    id: 'open-signatures',
    label: 'Offene Unterschriften',
    value: dashboard.openSignatureDocumentCount,
    subValue:
      dashboard.overdueSignatureDocumentCount > 0
        ? `${dashboard.overdueSignatureDocumentCount} überfällig`
        : 'Zum Unterschreiben',
    icon: '✍️',
    route: '/portal/employee/signatures',
  };
}

function buildTagesübersicht(
  dashboard: EmployeePortalDashboardProjection,
): EmployeePortalTodayMetric[] {
  const m = pickEmployeePortalTodayReadMetrics(dashboard);
  return [
    {
      id: 'today-assignments',
      label: 'Einsätze heute',
      value: m.todayCount,
      subValue: m.todayCount === 0 ? 'Keine Einsätze geplant' : `${m.todayCount} geplant`,
      icon: '📅',
      route: '/portal/employee/assignments',
    },
    {
      id: 'today-hours',
      label: 'Geplante Stunden',
      value: m.hoursWorked,
      subValue: m.todayCount === 0 ? 'Kein Dienst heute' : 'Summe heute',
      icon: '⏱️',
      route: '/portal/employee/times',
    },
    {
      id: 'today-open-docs',
      label: 'Offene Dokumentation',
      value: m.openDocumentationCount,
      subValue:
        m.openDocumentationCount === 0
          ? 'Alles dokumentiert'
          : `${m.openDocumentationCount} ausstehend`,
      icon: '📝',
      route: '/portal/employee/assignments',
    },
    {
      id: 'today-messages',
      label: 'Nachrichten',
      value: m.messageCount,
      subValue:
        m.messageCount === 0 ? 'Keine neuen Nachrichten' : `${m.messageCount} ungelesen`,
      icon: '💬',
      route: '/portal/employee/messages',
    },
  ];
}

// ─── Section B: Meine Einsätze ────────────────────────────────────────────────

function buildMeineEinsaetze(
  dashboard: EmployeePortalDashboardProjection,
): EmployeePortalTodayAssignment[] {
  const today = dashboard.todayAssignments.map(toTodayAssignment);
  const upcoming = dashboard.upcomingAssignments.slice(0, 3).map(toTodayAssignment);
  const combined = [...today];
  for (const u of upcoming) {
    if (!combined.some((t) => t.assignmentId === u.assignmentId)) {
      combined.push(u);
    }
  }
  return combined.slice(0, 5);
}

// ─── Section C: Offene Aufgaben ───────────────────────────────────────────────

function buildOffeneAufgaben(
  dashboard: EmployeePortalDashboardProjection,
): EmployeePortalTodayTask[] {
  const tasks: EmployeePortalTodayTask[] = [];
  if (dashboard.openDocumentationCount > 0) {
    tasks.push({
      id: 'task-documentation',
      label: 'Dokumentation ausstehend',
      count: dashboard.openDocumentationCount,
      route: '/portal/employee/assignments',
    });
  }
  if (dashboard.missingSignatureCount > 0) {
    tasks.push({
      id: 'task-signature',
      label: 'Unterschrift fehlend (Einsatz)',
      count: dashboard.missingSignatureCount,
      route: '/portal/employee/assignments',
    });
  }
  if (dashboard.openSignatureDocumentCount > 0) {
    tasks.push({
      id: 'task-document-signatures',
      label: 'Dokumente zur Unterschrift',
      count: dashboard.openSignatureDocumentCount,
      route: '/portal/employee/signatures',
    });
  }
  return tasks;
}

// ─── Section D: Schnellzugriffe ───────────────────────────────────────────────

function buildSchnellzugriffe(): EmployeePortalTodayLink[] {
  const navLinks = getVisibleNavItemsForRole('employee_portal')
    .filter((item) => item.href)
    .map((item) => ({
      id: item.key,
      label: item.label,
      route: item.href!,
      icon: item.icon,
    }));

  const m1Links: EmployeePortalTodayLink[] = [
    { id: 'calendar', label: 'Kalender', route: '/portal/employee/calendar', icon: '📅' },
    { id: 'clients', label: 'Klientenakten', route: '/portal/employee/clients', icon: '👥' },
    { id: 'uploads', label: 'Uploads / Dokumente', route: '/portal/employee/uploads', icon: '📤' },
    { id: 'times', label: 'Meine Zeiten', route: '/portal/employee/times', icon: '⏱️' },
  ];

  const merged = [...m1Links];
  for (const link of navLinks) {
    if (!merged.some((entry) => entry.route === link.route)) merged.push(link);
  }
  return merged;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildEmployeePortalTodayModel(
  input: EmployeePortalTodayInput,
): EmployeePortalTodayModel {
  const { dashboard, displayName } = input;
  const currentItem = resolveDashboardCurrentAssignment(dashboard.todayAssignments);

  return {
    greetingLine: `Mitarbeiterportal · ${displayName}`,
    tagesübersicht: buildTagesübersicht(dashboard),
    openSignatures: buildOpenSignaturesCard(dashboard),
    currentAssignment: currentItem ? toTodayAssignment(currentItem) : null,
    meineEinsaetze: buildMeineEinsaetze(dashboard),
    offeneAufgaben: buildOffeneAufgaben(dashboard),
    schnellzugriffe: buildSchnellzugriffe(),
  };
}
