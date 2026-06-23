import type { AssistDashboardStats } from '@/types/modules/assist';
import { moduleColor } from '@/design/tokens/modules';

export type AssistDashboardKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
  variant?: 'glass' | 'light';
  /** Route path — navigation handled by screen, not this module. */
  navigationTarget?: string;
};

const KPI_STATUS = {
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  amber: '#FFB020',
  violet: '#8B5CF6',
} as const;

export function buildAssistDashboardKpis(stats: AssistDashboardStats): AssistDashboardKpi[] {
  const accent = moduleColor('assist');
  const runningNow = stats.activeCount + stats.inProgressCount;

  return [
    {
      id: 'today-planned',
      label: 'Heute geplant',
      value: String(stats.todayCount),
      subValue: stats.todayCount === 1 ? '1 Einsatz' : `${stats.todayCount} Einsätze`,
      icon: '📅',
      accentColor: accent,
      variant: 'light',
      navigationTarget: '/assist/assignments',
    },
    {
      id: 'running',
      label: 'Läuft gerade',
      value: String(runningNow),
      subValue: runningNow > 0 ? 'In Durchführung' : 'Keine laufenden',
      icon: '▶️',
      accentColor: runningNow > 0 ? KPI_STATUS.success : accent,
      variant: 'light',
      navigationTarget: '/assist/durchfuehrung',
    },
    {
      id: 'documentation',
      label: 'Dokumentation offen',
      value: String(stats.incompleteCount),
      subValue: stats.incompleteCount > 0 ? 'Nachbearbeitung nötig' : 'Alles dokumentiert',
      icon: '📝',
      accentColor: stats.incompleteCount > 0 ? KPI_STATUS.warning : accent,
      variant: 'light',
      navigationTarget: '/assist/durchfuehrung',
    },
    {
      id: 'signature',
      label: 'Signatur offen',
      value: String(stats.openSignatureCount),
      subValue: stats.openSignatureCount > 0 ? 'Unterschrift fehlt' : 'Keine offenen',
      icon: '🖊️',
      accentColor: stats.openSignatureCount > 0 ? KPI_STATUS.warning : accent,
      variant: 'light',
      navigationTarget: '/assist/nachweise',
    },
    {
      id: 'proof-review',
      label: 'Nachweise zu prüfen',
      value: String(stats.openProofReviewCount),
      subValue: stats.openProofReviewCount > 0 ? 'Prüfung ausstehend' : 'Keine offenen',
      icon: '✍️',
      accentColor: stats.openProofReviewCount > 0 ? KPI_STATUS.amber : accent,
      variant: 'light',
      navigationTarget: '/assist/nachweise',
    },
    {
      id: 'at-risk',
      label: 'Problemfälle',
      value: String(stats.atRiskCount),
      subValue: stats.atRiskCount > 0 ? 'Prüfung nötig' : 'Keine Risiken',
      icon: '⚠️',
      accentColor: stats.atRiskCount > 0 ? KPI_STATUS.danger : accent,
      variant: 'light',
      navigationTarget: '/assist/qualitaet',
    },
    {
      id: 'portal-release',
      label: 'Portal-Freigabe offen',
      value: String(stats.openPortalReleaseCount),
      subValue: stats.openPortalReleaseCount > 0 ? 'Freigabe ausstehend' : 'Keine offenen',
      icon: '🌐',
      accentColor: stats.openPortalReleaseCount > 0 ? KPI_STATUS.violet : accent,
      variant: 'light',
      navigationTarget: '/assist/nachweise',
    },
    {
      id: 'trips',
      label: 'Tracking/Fahrten offen',
      value: String(stats.openTripsCount),
      subValue: stats.openTripsCount > 0 ? 'Fahrt nicht beendet' : 'Keine offenen',
      icon: '🚗',
      accentColor: stats.openTripsCount > 0 ? KPI_STATUS.warning : accent,
      variant: 'light',
      navigationTarget: '/assist/fahrten',
    },
  ];
}
