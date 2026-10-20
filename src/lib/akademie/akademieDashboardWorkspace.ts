import type { DashboardKpi, DashboardQuickAction } from '@/types/dashboard';
import type { AkademieDashboardStats, CourseListItem } from '@/types/modules/akademie';

export const AKADEMIE_WORKSPACE_KPI_COUNT = 14;
export const AKADEMIE_ACCENT = '#FACC15';

export type AkademieDashboardSection = {
  id: string;
  title: string;
  subtitle: string;
  links: {
    id: string;
    label: string;
    description?: string;
    route: string;
    count?: number;
    icon?: string;
  }[];
};

export type AkademiePriorityItem = {
  id: string;
  label: string;
  description: string;
  route: string;
  severity: 'high' | 'medium' | 'low';
  count?: number;
};

function emptySubValue(count: number, emptyLabel: string, activeLabel: (n: number) => string): string {
  return count === 0 ? emptyLabel : activeLabel(count);
}

/** Fourteen academy workspace KPIs — courses, compliance, progress and certificates. */
export function buildAkademieWorkspaceKpis(stats: AkademieDashboardStats): DashboardKpi[] {
  const accent = AKADEMIE_ACCENT;
  const warn = '#F59E0B';
  const danger = '#EF4444';

  return [
    {
      id: 'akademie-ws-kpi-active-courses',
      label: 'Aktive Kurse',
      value: stats.activeCoursesCount,
      subValue: emptySubValue(stats.activeCoursesCount, 'Keine aktiven Kurse', (n) => `${n} aktiv`),
      icon: '🎓',
      accentColor: accent,
      route: '/akademie/courses?status=aktiv',
    },
    {
      id: 'akademie-ws-kpi-upcoming-courses',
      label: 'Anstehende Kurse',
      value: stats.upcomingCoursesCount,
      subValue: emptySubValue(stats.upcomingCoursesCount, 'Keine anstehenden Kurse', (n) => `${n} geplant`),
      icon: '📅',
      accentColor: accent,
      route: '/akademie/courses?filter=upcoming',
    },
    {
      id: 'akademie-ws-kpi-running-courses',
      label: 'Laufende Kurse',
      value: stats.runningCoursesCount,
      subValue: emptySubValue(stats.runningCoursesCount, 'Keine laufenden Kurse', (n) => `${n} laufen`),
      icon: '▶️',
      accentColor: accent,
      route: '/akademie/courses?status=in_bearbeitung',
    },
    {
      id: 'akademie-ws-kpi-mandatory-open',
      label: 'Pflichtschulungen offen',
      value: stats.mandatoryOpenCount,
      subValue: emptySubValue(stats.mandatoryOpenCount, 'Keine offenen Pflichtschulungen', (n) => `${n} offen`),
      icon: '⚠️',
      accentColor: stats.mandatoryOpenCount > 0 ? warn : accent,
      route: '/akademie/pflichtschulungen?status=open',
    },
    {
      id: 'akademie-ws-kpi-mandatory-overdue',
      label: 'Pflichtschulungen überfällig',
      value: stats.mandatoryOverdueCount,
      subValue: emptySubValue(
        stats.mandatoryOverdueCount,
        'Keine überfälligen Pflichtschulungen',
        (n) => `${n} überfällig`,
      ),
      icon: '⏰',
      accentColor: stats.mandatoryOverdueCount > 0 ? danger : accent,
      route: '/akademie/pflichtschulungen?filter=overdue',
    },
    {
      id: 'akademie-ws-kpi-active-participants',
      label: 'Teilnehmer:innen aktiv',
      value: stats.activeParticipantsCount,
      subValue: emptySubValue(
        stats.activeParticipantsCount,
        'Keine aktiven Teilnehmer:innen',
        (n) => `${n} aktiv`,
      ),
      icon: '👥',
      accentColor: accent,
      route: '/akademie/teilnehmer?status=aktiv',
    },
    {
      id: 'akademie-ws-kpi-open-enrollments',
      label: 'Einschreibungen offen',
      value: stats.openEnrollmentsCount,
      subValue: emptySubValue(stats.openEnrollmentsCount, 'Keine offenen Einschreibungen', (n) => `${n} offen`),
      icon: '📝',
      accentColor: stats.openEnrollmentsCount > 0 ? warn : accent,
      route: '/akademie/teilnehmer?status=open',
    },
    {
      id: 'akademie-ws-kpi-open-progress',
      label: 'Lernfortschritt offen',
      value: stats.openProgressCount,
      subValue: emptySubValue(stats.openProgressCount, 'Kein offener Lernfortschritt', (n) => `${n} in Bearbeitung`),
      icon: '📊',
      accentColor: stats.openProgressCount > 0 ? warn : accent,
      route: '/akademie/teilnehmer?filter=progress',
    },
    {
      id: 'akademie-ws-kpi-upcoming-exams',
      label: 'Prüfungen anstehend',
      value: stats.upcomingExamsCount,
      subValue: emptySubValue(stats.upcomingExamsCount, 'Keine anstehenden Prüfungen', (n) => `${n} geplant`),
      icon: '📋',
      accentColor: accent,
      route: '/akademie/pruefungen?filter=upcoming',
    },
    {
      id: 'akademie-ws-kpi-exams-grade',
      label: 'Prüfungen zu bewerten',
      value: stats.examsToGradeCount,
      subValue: emptySubValue(stats.examsToGradeCount, 'Keine Prüfungen zu bewerten', (n) => `${n} offen`),
      icon: '✍️',
      accentColor: stats.examsToGradeCount > 0 ? warn : accent,
      route: '/akademie/pruefungen?filter=grade',
    },
    {
      id: 'akademie-ws-kpi-certificates-issue',
      label: 'Zertifikate auszustellen',
      value: stats.certificatesToIssueCount,
      subValue: emptySubValue(
        stats.certificatesToIssueCount,
        'Keine Zertifikate auszustellen',
        (n) => `${n} ausstehend`,
      ),
      icon: '🏅',
      accentColor: stats.certificatesToIssueCount > 0 ? warn : accent,
      route: '/akademie/zertifikate?status=issue',
    },
    {
      id: 'akademie-ws-kpi-certificates-expiring',
      label: 'Zertifikate laufen ab',
      value: stats.certificatesExpiringCount,
      subValue: emptySubValue(
        stats.certificatesExpiringCount,
        'Keine ablaufenden Zertifikate',
        (n) => `${n} bald ablaufend`,
      ),
      icon: '📆',
      accentColor: stats.certificatesExpiringCount > 0 ? danger : accent,
      route: '/akademie/zertifikate?filter=expiring',
    },
    {
      id: 'akademie-ws-kpi-mediathek',
      label: 'Mediathek offen',
      value: stats.mediathekOpenCount,
      subValue: emptySubValue(stats.mediathekOpenCount, 'Keine offenen Medien', (n) => `${n} Materialien`),
      icon: '🎬',
      accentColor: accent,
      route: '/akademie/mediathek?status=open',
    },
    {
      id: 'akademie-ws-kpi-training-plan',
      label: 'Schulungsplan offen',
      value: stats.trainingPlanOpenCount,
      subValue: emptySubValue(stats.trainingPlanOpenCount, 'Kein offener Schulungsplan', (n) => `${n} geplant`),
      icon: '🗓️',
      accentColor: accent,
      route: '/akademie/schulungsplan?status=open',
    },
  ];
}

export const AKADEMIE_HEADER_PRIMARY_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'akademie-header-course',
    label: 'Kurs anlegen',
    icon: '➕',
    route: '/akademie/kurse/new',
    variant: 'primary',
  },
  {
    id: 'akademie-header-mandatory',
    label: 'Pflichtschulung planen',
    icon: '➕',
    route: '/akademie/pflichtschulungen?create=1',
    variant: 'primary',
  },
];

export const AKADEMIE_HEADER_SECONDARY_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'akademie-header-participants',
    label: 'Teilnehmer:innen öffnen',
    icon: '👥',
    route: '/akademie/teilnehmer',
    variant: 'secondary',
  },
  {
    id: 'akademie-header-certificates',
    label: 'Zertifikate prüfen',
    icon: '🏅',
    route: '/akademie/zertifikate',
    variant: 'secondary',
  },
  {
    id: 'akademie-header-exam',
    label: 'Prüfung anlegen',
    icon: '📝',
    route: '/akademie/pruefungen?create=1',
    variant: 'secondary',
  },
  {
    id: 'akademie-header-mediathek',
    label: 'Mediathek öffnen',
    icon: '🎬',
    route: '/akademie/mediathek',
    variant: 'secondary',
  },
];

export const AKADEMIE_SIDEBAR_QUICK_ACTIONS: DashboardQuickAction[] = [
  { id: 'akademie-qa-course', label: 'Kurs anlegen', icon: '➕', route: '/akademie/kurse/new' },
  {
    id: 'akademie-qa-mandatory',
    label: 'Pflichtschulung planen',
    icon: '⚠️',
    route: '/akademie/pflichtschulungen?create=1',
  },
  {
    id: 'akademie-qa-participant',
    label: 'Teilnehmer:in hinzufügen',
    icon: '👥',
    route: '/akademie/teilnehmer?create=1',
  },
  {
    id: 'akademie-qa-exam',
    label: 'Prüfung anlegen',
    icon: '📝',
    route: '/akademie/pruefungen?create=1',
  },
  {
    id: 'akademie-qa-certificates',
    label: 'Zertifikate prüfen',
    icon: '🏅',
    route: '/akademie/zertifikate',
  },
  { id: 'akademie-qa-mediathek', label: 'Mediathek', icon: '🎬', route: '/akademie/mediathek' },
  { id: 'akademie-qa-plan', label: 'Schulungsplan', icon: '🗓️', route: '/akademie/schulungsplan' },
  { id: 'akademie-qa-reports', label: 'Auswertungen', icon: '📈', route: '/akademie/auswertungen' },
];

export const AKADEMIE_QUICK_ACCESS: DashboardQuickAction[] = [
  { id: 'akademie-qa-all-courses', label: 'Alle Kurse', icon: '🎓', route: '/akademie/courses' },
  { id: 'akademie-qa-kurse', label: 'Kursverwaltung', icon: '📚', route: '/akademie/kurse' },
  {
    id: 'akademie-qa-pflicht',
    label: 'Pflichtschulungen',
    icon: '⚠️',
    route: '/akademie/pflichtschulungen',
  },
  { id: 'akademie-qa-mediathek', label: 'Mediathek', icon: '🎬', route: '/akademie/mediathek' },
  { id: 'akademie-qa-teilnehmer', label: 'Teilnehmer:innen', icon: '👥', route: '/akademie/teilnehmer' },
  { id: 'akademie-qa-zertifikate', label: 'Zertifikate', icon: '🏅', route: '/akademie/zertifikate' },
  { id: 'akademie-qa-pruefungen', label: 'Prüfungen', icon: '📝', route: '/akademie/pruefungen' },
  { id: 'akademie-qa-plan', label: 'Schulungsplan', icon: '🗓️', route: '/akademie/schulungsplan' },
  { id: 'akademie-qa-auswertungen', label: 'Auswertungen', icon: '📈', route: '/akademie/auswertungen' },
  { id: 'akademie-qa-settings', label: 'Einstellungen', icon: '⚙️', route: '/akademie/settings' },
];

export function buildAkademieOpenTasks(
  stats: AkademieDashboardStats | null | undefined,
): { title: string; count: number | string }[] {
  if (!stats) {
    return [{ title: 'Keine Akademie-Daten', count: '—' }];
  }

  return [
    { title: 'Kurse heute', count: stats.upcomingCoursesCount },
    { title: 'Pflichtschulungen fällig', count: stats.mandatoryOverdueCount },
    { title: 'Einschreibungen', count: stats.openEnrollmentsCount },
    { title: 'Prüfungen', count: stats.upcomingExamsCount },
    { title: 'Zertifikate auszustellen', count: stats.certificatesToIssueCount },
    { title: 'Ablaufende Zertifikate', count: stats.certificatesExpiringCount },
    { title: 'Materialien zur Prüfung', count: stats.mediathekOpenCount },
  ];
}

export function buildAkademieDashboardPriorities(stats: AkademieDashboardStats): AkademiePriorityItem[] {
  const items: AkademiePriorityItem[] = [];

  if (stats.mandatoryOverdueCount > 0) {
    items.push({
      id: 'priority-mandatory-overdue',
      label: 'Pflichtschulungen überfällig',
      description: `${stats.mandatoryOverdueCount} Pflichtschulung(en) sind überfällig — Compliance prüfen.`,
      route: '/akademie/pflichtschulungen?filter=overdue',
      severity: 'high',
      count: stats.mandatoryOverdueCount,
    });
  }
  if (stats.certificatesExpiringCount > 0) {
    items.push({
      id: 'priority-certificates-expiring',
      label: 'Zertifikate laufen ab',
      description: `${stats.certificatesExpiringCount} Zertifikat(e) laufen in Kürze ab.`,
      route: '/akademie/zertifikate?filter=expiring',
      severity: 'high',
      count: stats.certificatesExpiringCount,
    });
  }
  if (stats.certificatesToIssueCount > 0) {
    items.push({
      id: 'priority-certificates-issue',
      label: 'Zertifikate auszustellen',
      description: `${stats.certificatesToIssueCount} Zertifikat(e) warten auf Ausstellung.`,
      route: '/akademie/zertifikate?status=issue',
      severity: 'medium',
      count: stats.certificatesToIssueCount,
    });
  }
  if (stats.examsToGradeCount > 0) {
    items.push({
      id: 'priority-exams-grade',
      label: 'Prüfungen zu bewerten',
      description: `${stats.examsToGradeCount} Prüfung(en) warten auf Bewertung.`,
      route: '/akademie/pruefungen?filter=grade',
      severity: 'medium',
      count: stats.examsToGradeCount,
    });
  }
  if (stats.openProgressCount > 0) {
    items.push({
      id: 'priority-progress',
      label: 'Lernfortschritt offen',
      description: `${stats.openProgressCount} Teilnahme(n) mit offenem Lernfortschritt.`,
      route: '/akademie/teilnehmer?filter=progress',
      severity: 'low',
      count: stats.openProgressCount,
    });
  }
  if (stats.mandatoryOpenCount > 0) {
    items.push({
      id: 'priority-mandatory-open',
      label: 'Pflichtschulungen offen',
      description: `${stats.mandatoryOpenCount} Pflichtschulung(en) sind noch offen.`,
      route: '/akademie/pflichtschulungen?status=open',
      severity: 'low',
      count: stats.mandatoryOpenCount,
    });
  }

  return items;
}

export function buildAkademieDashboardSections(
  stats: AkademieDashboardStats,
  upcomingCourses: CourseListItem[],
): AkademieDashboardSection[] {
  return [
    {
      id: 'courses',
      title: 'Kurse & Schulungen',
      subtitle: 'Kursübersicht, Verwaltung und anstehende Starts',
      links: [
        {
          id: 'courses-all',
          label: 'Alle Kurse',
          description: 'Suche, Filter und Status',
          route: '/akademie/courses',
          count: stats.totalCourses,
          icon: '🎓',
        },
        {
          id: 'courses-admin',
          label: 'Kursverwaltung',
          description: 'Kurse anlegen und bearbeiten',
          route: '/akademie/kurse',
          count: stats.activeCoursesCount,
          icon: '📚',
        },
        {
          id: 'courses-create',
          label: 'Kurs anlegen',
          description: 'Neuen Kurs erstellen',
          route: '/akademie/kurse/new',
          icon: '➕',
        },
        {
          id: 'courses-calendar',
          label: 'Kalender',
          description: 'Kursstarts und Termine',
          route: '/akademie/calendar',
          count: stats.upcomingCoursesCount,
          icon: '📅',
        },
        ...(upcomingCourses.slice(0, 3).map((course) => ({
          id: `course-${course.id}`,
          label: course.title,
          description: course.category,
          route: `/akademie/courses/${course.id}`,
          icon: '📖' as const,
        })) ?? []),
      ],
    },
    {
      id: 'mandatory',
      title: 'Pflichtschulungen',
      subtitle: 'Compliance, Fristen und verpflichtende Schulungen',
      links: [
        {
          id: 'mandatory-list',
          label: 'Pflichtschulungen',
          description: 'Verpflichtende Kurse im Mandanten',
          route: '/akademie/pflichtschulungen',
          count: stats.mandatoryOpenCount,
          icon: '⚠️',
        },
        {
          id: 'mandatory-overdue',
          label: 'Überfällige Pflichtschulungen',
          description: 'Fristüberschreitungen prüfen',
          route: '/akademie/pflichtschulungen?filter=overdue',
          count: stats.mandatoryOverdueCount,
          icon: '⏰',
        },
        {
          id: 'mandatory-plan',
          label: 'Pflichtschulung planen',
          description: 'Neue Pflichtschulung anlegen',
          route: '/akademie/pflichtschulungen?create=1',
          icon: '➕',
        },
      ],
    },
    {
      id: 'participants',
      title: 'Teilnehmer:innen & Fortschritt',
      subtitle: 'Einschreibungen, Lernfortschritt und aktive Teilnahmen',
      links: [
        {
          id: 'participants-list',
          label: 'Teilnehmer:innen',
          description: 'Alle Einschreibungen und Fortschritt',
          route: '/akademie/teilnehmer',
          count: stats.activeParticipantsCount,
          icon: '👥',
        },
        {
          id: 'participants-open',
          label: 'Einschreibungen offen',
          description: 'Offene Anmeldungen bearbeiten',
          route: '/akademie/teilnehmer?status=open',
          count: stats.openEnrollmentsCount,
          icon: '📝',
        },
        {
          id: 'participants-progress',
          label: 'Lernfortschritt',
          description: 'Teilnahmen in Bearbeitung',
          route: '/akademie/teilnehmer?filter=progress',
          count: stats.openProgressCount,
          icon: '📊',
        },
        {
          id: 'participants-add',
          label: 'Teilnehmer:in hinzufügen',
          description: 'Neue Einschreibung erfassen',
          route: '/akademie/teilnehmer?create=1',
          icon: '➕',
        },
      ],
    },
    {
      id: 'exams',
      title: 'Prüfungen',
      subtitle: 'Prüfungstermine, Bewertungen und Bestehensgrenzen',
      links: [
        {
          id: 'exams-list',
          label: 'Prüfungen',
          description: 'Alle Prüfungen und Termine',
          route: '/akademie/pruefungen',
          count: stats.upcomingExamsCount,
          icon: '📝',
        },
        {
          id: 'exams-upcoming',
          label: 'Anstehende Prüfungen',
          description: 'Geplante Prüfungstermine',
          route: '/akademie/pruefungen?filter=upcoming',
          count: stats.upcomingExamsCount,
          icon: '📅',
        },
        {
          id: 'exams-grade',
          label: 'Prüfungen zu bewerten',
          description: 'Offene Bewertungen',
          route: '/akademie/pruefungen?filter=grade',
          count: stats.examsToGradeCount,
          icon: '✍️',
        },
        {
          id: 'exams-create',
          label: 'Prüfung anlegen',
          description: 'Neue Prüfung planen',
          route: '/akademie/pruefungen?create=1',
          icon: '➕',
        },
      ],
    },
    {
      id: 'certificates',
      title: 'Zertifikate',
      subtitle: 'Ausstellung, Gültigkeit und ablaufende Nachweise',
      links: [
        {
          id: 'certificates-list',
          label: 'Zertifikate',
          description: 'Alle ausgestellten Nachweise',
          route: '/akademie/zertifikate',
          icon: '🏅',
        },
        {
          id: 'certificates-issue',
          label: 'Zertifikate auszustellen',
          description: 'Ausstehende Ausstellungen',
          route: '/akademie/zertifikate?status=issue',
          count: stats.certificatesToIssueCount,
          icon: '📤',
        },
        {
          id: 'certificates-expiring',
          label: 'Ablaufende Zertifikate',
          description: 'Erneuerung planen',
          route: '/akademie/zertifikate?filter=expiring',
          count: stats.certificatesExpiringCount,
          icon: '📆',
        },
      ],
    },
    {
      id: 'mediathek',
      title: 'Mediathek & Lernmaterial',
      subtitle: 'Videos, PDFs, Links und Lerninhalte',
      links: [
        {
          id: 'mediathek-list',
          label: 'Mediathek',
          description: 'Alle Lernmaterialien',
          route: '/akademie/mediathek',
          count: stats.mediathekOpenCount,
          icon: '🎬',
        },
        {
          id: 'lessons-list',
          label: 'Lektionen',
          description: 'Lektionsreihenfolge je Kurs',
          route: '/akademie/lektionen',
          icon: '📖',
        },
      ],
    },
    {
      id: 'planning',
      title: 'Planung & Auswertung',
      subtitle: 'Schulungsplan, Kennzahlen und Modul-Einstellungen',
      links: [
        {
          id: 'plan-list',
          label: 'Schulungsplan',
          description: 'Geplante Kursstarts',
          route: '/akademie/schulungsplan',
          count: stats.trainingPlanOpenCount,
          icon: '🗓️',
        },
        {
          id: 'plan-reports',
          label: 'Auswertungen',
          description: 'KPIs und Compliance-Kennzahlen',
          route: '/akademie/auswertungen',
          icon: '📈',
        },
        {
          id: 'plan-settings',
          label: 'Einstellungen',
          description: 'Modul-Konfiguration',
          route: '/akademie/settings',
          icon: '⚙️',
        },
      ],
    },
  ];
}
