import type { RoleKey } from '@/types/core/auth';
import type {
  EmployeeTrainingRecord,
  TrainingCourse,
  TrainingDashboardTile,
  TrainingReminder,
} from '@/types/modules/training';
import { TRAINING_UI_ROUTE } from './trainingModuleConfig';

export function buildTrainingDashboardTiles(input: {
  records: EmployeeTrainingRecord[];
  courses: TrainingCourse[];
  reminders: TrainingReminder[];
  actorRole?: RoleKey | null;
}): TrainingDashboardTile[] {
  const mandatoryCourses = input.courses.filter((c) => c.isMandatory);
  const mandatoryRecords = input.records.filter((r) =>
    mandatoryCourses.some((c) => c.id === r.courseId),
  );

  const overdue = mandatoryRecords.filter((r) =>
    ['required', 'assigned', 'in_progress', 'expired', 'failed'].includes(r.status),
  ).length;
  const expiringSoon = mandatoryRecords.filter((r) => r.status === 'expires_soon').length;
  const pendingReview = input.records.filter((r) => r.status === 'pending_review').length;
  const openReminders = input.reminders.filter((r) => !r.acknowledgedAt).length;

  if (input.actorRole === 'employee_portal') {
    return [
      {
        id: 'tr-tile-my-open',
        label: 'Offene Pflichtschulungen',
        value: overdue,
        subValue: 'Eigene Aufgaben',
        accentColor: '#FF9500',
        routeHint: `${TRAINING_UI_ROUTE}/my`,
      },
      {
        id: 'tr-tile-my-expiry',
        label: 'Bald ablaufend',
        value: expiringSoon,
        subValue: 'Erneuerung',
        accentColor: '#FF3B30',
        routeHint: `${TRAINING_UI_ROUTE}/my`,
      },
    ];
  }

  return [
    {
      id: 'tr-tile-overdue',
      label: 'Überfällige Pflichtschulungen',
      value: overdue,
      subValue: 'Mandant',
      accentColor: '#FF3B30',
      routeHint: `${TRAINING_UI_ROUTE}/expiry`,
    },
    {
      id: 'tr-tile-expiring',
      label: 'Läuft in 90/30 Tagen ab',
      value: expiringSoon,
      subValue: 'Erinnerungen',
      accentColor: '#FF9500',
      routeHint: `${TRAINING_UI_ROUTE}/expiry`,
    },
    {
      id: 'tr-tile-review',
      label: 'Nachweise zur Prüfung',
      value: pendingReview,
      subValue: 'Admin',
      accentColor: '#5856D6',
      routeHint: `${TRAINING_UI_ROUTE}/certificates`,
    },
    {
      id: 'tr-tile-reminders',
      label: 'Offene Erinnerungen',
      value: openReminders,
      subValue: 'Aufgaben',
      accentColor: '#007AFF',
      routeHint: `${TRAINING_UI_ROUTE}/expiry`,
    },
  ];
}
