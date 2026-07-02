import type { ActiveExecutionItem, AssistDashboardStats, AssignmentListItem } from '@/types/modules/assist';
import { getVisibleNavItemsForRole } from '@/components/healthos/navigation/resolveHealthOSNavigation';
import { EXECUTION_PHASE_LABELS } from '@/lib/assist/executionListStats';

// ─── Exported types ───────────────────────────────────────────────────────────

export type AssistOperationsMetric = {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  icon: string;
  route?: string;
  emptyHint?: string;
};

export type AssistOperationsLink = {
  id: string;
  label: string;
  description?: string;
  route: string;
  count?: number;
  icon?: string;
};

export type AssistOperationsBlockerRow = {
  id: string;
  label: string;
  count: number;
  route?: string;
};

export type AssistOperationsLiveRow = {
  assignmentId: string;
  title: string;
  clientName: string;
  location: string;
  scheduledStart: string;
  phaseLabel: string;
  statusLabel: string;
  phase: string;
  assignmentStatus: string;
};

export type AssistOperationsModel = {
  greetingLine: string;
  einsatzbetriebHeute: AssistOperationsMetric[];
  liveOperations: AssistOperationsLiveRow[];
  nachweiseQualitaet: AssistOperationsMetric[];
  budgetSummary: AssistOperationsMetric[];
  blockerZentrale: AssistOperationsBlockerRow[];
  schnellzugriffe: AssistOperationsLink[];
};

export type AssistOperationsInput = {
  stats: AssistDashboardStats;
  todayAssignments: AssignmentListItem[];
  activeExecutions: ActiveExecutionItem[];
  displayName: string;
};

// ─── Read-only metrics passthrough (for tests) ────────────────────────────────

export type AssistOperationsReadMetrics = {
  todayCount: number;
  runningCount: number;
  completedTodayCount: number;
  atRiskCount: number;
  incompleteCount: number;
  openSignatureCount: number;
  openProofCount: number;
  openProofReviewCount: number;
  openPortalReleaseCount: number;
};

export function pickAssistOperationsReadMetrics(
  stats: AssistDashboardStats,
): AssistOperationsReadMetrics {
  return {
    todayCount: stats.todayCount,
    runningCount: stats.activeCount + stats.inProgressCount,
    completedTodayCount: stats.completedTodayCount,
    atRiskCount: stats.atRiskCount,
    incompleteCount: stats.incompleteCount,
    openSignatureCount: stats.openSignatureCount,
    openProofCount: stats.openProofCount,
    openProofReviewCount: stats.openProofReviewCount,
    openPortalReleaseCount: stats.openPortalReleaseCount,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function metricSubValue(count: number, emptyLabel: string, activeLabel: (n: number) => string): string {
  return count === 0 ? emptyLabel : activeLabel(count);
}

function emptyStats(): AssistDashboardStats {
  return {
    totalAssignments: 0,
    todayCount: 0,
    activeCount: 0,
    inProgressCount: 0,
    completedTodayCount: 0,
    upcomingCount: 0,
    atRiskCount: 0,
    incompleteCount: 0,
    openProofCount: 0,
    openProofReviewCount: 0,
    openSignatureCount: 0,
    openPortalReleaseCount: 0,
    openTripsCount: 0,
  };
}

// ─── Section A: Einsatzbetrieb heute ─────────────────────────────────────────

function buildEinsatzbetriebHeute(stats: AssistDashboardStats): AssistOperationsMetric[] {
  const runningNow = stats.activeCount + stats.inProgressCount;

  return [
    {
      id: 'ops-today-count',
      label: 'Einsätze heute',
      value: stats.todayCount,
      subValue: metricSubValue(stats.todayCount, 'Keine Einsätze geplant', (n) => `${n} geplant`),
      icon: '📅',
      route: '/assist/assignments',
    },
    {
      id: 'ops-running-now',
      label: 'Läuft gerade',
      value: runningNow,
      subValue: metricSubValue(runningNow, 'Kein laufender Einsatz', (n) => `${n} in Durchführung`),
      icon: '▶️',
      route: '/assist/durchfuehrung',
    },
    {
      id: 'ops-completed-today',
      label: 'Abgeschlossen heute',
      value: stats.completedTodayCount,
      subValue: metricSubValue(stats.completedTodayCount, 'Noch keine abgeschlossen', (n) => `${n} abgeschlossen`),
      icon: '✅',
      route: '/assist/durchfuehrung',
    },
    {
      id: 'ops-at-risk',
      label: 'Problemfälle',
      value: stats.atRiskCount,
      subValue: metricSubValue(stats.atRiskCount, 'Keine Risikofälle', (n) => `${n} prüfen`),
      icon: '⚠️',
      route: '/assist/qualitaet',
    },
    {
      id: 'ops-incomplete',
      label: 'Dokumentation offen',
      value: stats.incompleteCount,
      subValue: metricSubValue(stats.incompleteCount, 'Alles dokumentiert', (n) => `${n} offen`),
      icon: '📝',
      route: '/assist/durchfuehrung',
    },
    {
      id: 'ops-signature',
      label: 'Signatur ausstehend',
      value: stats.openSignatureCount,
      subValue: metricSubValue(stats.openSignatureCount, 'Keine offenen Signaturen', (n) => `${n} ausstehend`),
      icon: '🖊️',
      route: '/assist/nachweise',
    },
    {
      id: 'ops-proof-open',
      label: 'Nachweise offen',
      value: stats.openProofCount,
      subValue: metricSubValue(stats.openProofCount, 'Keine offenen Nachweise', (n) => `${n} offen`),
      icon: '🧾',
      route: '/assist/nachweise',
    },
    {
      id: 'ops-proof-review',
      label: 'Nachweise zu prüfen',
      value: stats.openProofReviewCount,
      subValue: metricSubValue(stats.openProofReviewCount, 'Keine zur Prüfung', (n) => `${n} zu prüfen`),
      icon: '✍️',
      route: '/assist/nachweise',
    },
  ];
}

// ─── Section B: Live operations ───────────────────────────────────────────────

function buildLiveOperations(activeExecutions: ActiveExecutionItem[]): AssistOperationsLiveRow[] {
  return activeExecutions.map((ex) => ({
    assignmentId: ex.assignmentId,
    title: ex.title,
    clientName: ex.clientName,
    location: ex.location,
    scheduledStart: ex.scheduledStart,
    phaseLabel: EXECUTION_PHASE_LABELS[ex.phase] ?? ex.phase,
    statusLabel: ex.assignmentStatus,
    phase: ex.phase,
    assignmentStatus: String(ex.assignmentStatus),
  }));
}

// ─── Section C: Nachweise & Qualität ─────────────────────────────────────────

function buildNachweiseQualitaet(stats: AssistDashboardStats): AssistOperationsMetric[] {
  return [
    {
      id: 'nq-proof-open',
      label: 'Offene Nachweise',
      value: stats.openProofCount,
      subValue: metricSubValue(stats.openProofCount, 'Keine offenen Nachweise', (n) => `${n} offen`),
      icon: '📝',
      route: '/assist/nachweise',
    },
    {
      id: 'nq-proof-review',
      label: 'Nachweise in Prüfung',
      value: stats.openProofReviewCount,
      subValue: metricSubValue(stats.openProofReviewCount, 'Keine zur Prüfung', (n) => `${n} in Prüfung`),
      icon: '✍️',
      route: '/assist/nachweise',
    },
    {
      id: 'nq-portal-release',
      label: 'Portal-Freigabe offen',
      value: stats.openPortalReleaseCount,
      subValue: metricSubValue(
        stats.openPortalReleaseCount,
        'Keine ausstehenden Freigaben',
        (n) => `${n} freizugeben`,
      ),
      icon: '🌐',
      route: '/assist/nachweise',
    },
    {
      id: 'nq-signature',
      label: 'Signatur ausstehend',
      value: stats.openSignatureCount,
      subValue: metricSubValue(stats.openSignatureCount, 'Keine offenen Signaturen', (n) => `${n} ausstehend`),
      icon: '🖊️',
      route: '/assist/nachweise',
    },
  ];
}

// ─── Section D: Budget summary (read-only placeholder) ───────────────────────

function buildBudgetSummary(): AssistOperationsMetric[] {
  return [
    {
      id: 'budget-verbrauch',
      label: 'Budgetverbrauch',
      value: '—',
      subValue: 'Detailansicht in Klient:innenakte — nicht im Dashboard verfügbar',
      icon: '💰',
      route: '/assist/qualitaet',
      emptyHint: 'Budget-Daten sind nicht Teil der Assist-Dashboard-Statistiken',
    },
    {
      id: 'budget-warnungen',
      label: 'Budget-Warnungen',
      value: '—',
      subValue: 'Zugriff über Klient:innenakte oder Office-Modul',
      icon: '⚠️',
      route: '/assist/qualitaet',
      emptyHint: 'Keine aggregierten Budget-Warnungen im Assist-Dashboard',
    },
    {
      id: 'budget-reservierungen',
      label: 'Offene Reservierungen',
      value: '—',
      subValue: 'Budget-Modul ist im Assist-Nav nicht verfügbar (P0)',
      icon: '📋',
      route: '/assist/qualitaet',
      emptyHint: 'P0 Budget-Zone — nur über Klient:innenakte zugänglich',
    },
  ];
}

// ─── Section E: Blocker / Qualitätszentrale ───────────────────────────────────

function buildBlockerZentrale(stats: AssistDashboardStats): AssistOperationsBlockerRow[] {
  const blockers: AssistOperationsBlockerRow[] = [];

  if (stats.incompleteCount > 0) {
    blockers.push({
      id: 'blocker-documentation',
      label: 'Dokumentation offen',
      count: stats.incompleteCount,
      route: '/assist/durchfuehrung',
    });
  }

  if (stats.openSignatureCount > 0) {
    blockers.push({
      id: 'blocker-signature',
      label: 'Unterschrift ausstehend',
      count: stats.openSignatureCount,
      route: '/assist/nachweise',
    });
  }

  if (stats.openProofCount > 0) {
    blockers.push({
      id: 'blocker-proof',
      label: 'Leistungsnachweis fehlt',
      count: stats.openProofCount,
      route: '/assist/nachweise',
    });
  }

  if (stats.atRiskCount > 0) {
    blockers.push({
      id: 'blocker-at-risk',
      label: 'Risikoeinsätze',
      count: stats.atRiskCount,
      route: '/assist/qualitaet',
    });
  }

  return blockers;
}

// ─── Section F: Schnellzugriffe ───────────────────────────────────────────────

function buildSchnellzugriffe(): AssistOperationsLink[] {
  return getVisibleNavItemsForRole('assist')
    .filter((item) => item.href)
    .map((item) => ({
      id: item.key,
      label: item.label,
      route: item.href!,
      icon: item.icon,
    }));
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildAssistOperationsModel(input: AssistOperationsInput): AssistOperationsModel {
  const { stats, activeExecutions, displayName } = input;
  const safeStats = stats ?? emptyStats();

  return {
    greetingLine: `Assist-Übersicht · ${displayName}`,
    einsatzbetriebHeute: buildEinsatzbetriebHeute(safeStats),
    liveOperations: buildLiveOperations(activeExecutions ?? []),
    nachweiseQualitaet: buildNachweiseQualitaet(safeStats),
    budgetSummary: buildBudgetSummary(),
    blockerZentrale: buildBlockerZentrale(safeStats),
    schnellzugriffe: buildSchnellzugriffe(),
  };
}
