import type { AssistDashboardStats } from '@/types/modules/assist';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type AssistDashboardKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
  /** Route path — navigation handled by screen, not this module. */
  navigationTarget?: string;
};

export function buildAssistDashboardKpis(stats: AssistDashboardStats, mode: ColorMode = 'dark'): AssistDashboardKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'today',
      label: 'Heute',
      value: String(stats.todayCount),
      subValue: `${stats.completedTodayCount} abgeschlossen`,
      icon: '📅',
      accentColor: colors.amber,
      navigationTarget: '/assist/assignments',
    },
    {
      id: 'active',
      label: 'Aktiv',
      value: String(stats.activeCount),
      subValue: `${stats.inProgressCount} in Arbeit`,
      icon: '▶️',
      accentColor: colors.success,
      navigationTarget: '/assist/durchfuehrung',
    },
    {
      id: 'upcoming',
      label: 'Geplant',
      value: String(stats.upcomingCount),
      subValue: `${stats.totalAssignments} gesamt`,
      icon: '📋',
      accentColor: colors.violet,
      navigationTarget: '/assist/assignments',
    },
    {
      id: 'at-risk',
      label: 'Problemfälle',
      value: String(stats.atRiskCount),
      subValue: stats.atRiskCount > 0 ? 'Prüfung nötig' : 'Keine Risiken',
      icon: '⚠️',
      accentColor: stats.atRiskCount > 0 ? colors.danger : colors.success,
      navigationTarget: '/assist/qualitaet',
    },
    {
      id: 'incomplete',
      label: 'Unvollständig',
      value: String(stats.incompleteCount),
      subValue: stats.incompleteCount > 0 ? 'Dokumentation prüfen' : 'Alles vollständig',
      icon: '📝',
      accentColor: stats.incompleteCount > 0 ? colors.warning : colors.success,
      navigationTarget: '/assist/durchfuehrung',
    },
    {
      id: 'open-proof',
      label: 'Offene Nachweise',
      value: String(stats.openProofCount),
      subValue: stats.openProofCount > 0 ? 'Nachweis ausstehend' : 'Keine offenen',
      icon: '✍️',
      accentColor: stats.openProofCount > 0 ? colors.amber : colors.success,
      navigationTarget: '/assist/nachweise',
    },
    {
      id: 'open-signature',
      label: 'Fehlende Signaturen',
      value: String(stats.openSignatureCount),
      subValue: stats.openSignatureCount > 0 ? 'Unterschrift offen' : 'Keine offenen',
      icon: '🖊️',
      accentColor: stats.openSignatureCount > 0 ? colors.warning : colors.success,
      navigationTarget: '/assist/signaturen',
    },
    {
      id: 'open-trips',
      label: 'Offene Fahrten',
      value: String(stats.openTripsCount),
      subValue: stats.openTripsCount > 0 ? 'Fahrt nicht beendet' : 'Fahrtenbuch ok',
      icon: '🚗',
      accentColor: stats.openTripsCount > 0 ? colors.violet : colors.success,
      navigationTarget: '/assist/fahrten',
    },
  ];
}
