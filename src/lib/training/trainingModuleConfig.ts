import { getServiceMode } from '@/lib/services/mode';

export const TRAINING_LIVE_WIRING_MIGRATION = '0052_training_management_prepared.sql';

export const TRAINING_PREPARED_MESSAGE =
  'Schulungen, Unterweisungen und Zertifikate sind vorbereitet. ' +
  'Live-Flip erst nach Remote-Migration und Nachweisprüfung.';

/** Live-Flip bleibt false bis Remote-Migration angewendet und Backfill erfolgt. */
export function isTrainingLiveReady(): boolean {
  return false;
}

export function isTrainingWiringPrepared(): boolean {
  return true;
}

export type TrainingLiveFlipBlocker = {
  id: string;
  label: string;
  resolved: boolean;
};

export function getTrainingLiveFlipBlockers(): TrainingLiveFlipBlocker[] {
  return [
    {
      id: 'migration-0052',
      label: `Remote-Migration ${TRAINING_LIVE_WIRING_MIGRATION} angewendet`,
      resolved: false,
    },
    {
      id: 'no-demo-fallback-production',
      label: 'Produktivmodus ohne Demo-Schulungsdaten',
      resolved: getServiceMode() !== 'supabase',
    },
    {
      id: 'academy-scorm-not-live',
      label: 'SCORM/xAPI/Moodle/ILIAS nur vorbereitet — kein Produktionsanspruch',
      resolved: true,
    },
  ];
}

export function countTrainingLiveFlipBlockersRemaining(): number {
  return getTrainingLiveFlipBlockers().filter((b) => !b.resolved).length;
}

export const TRAINING_UI_ROUTE = '/business/office/personal/training';

export const TRAINING_VIEW_ROUTES: Record<string, string> = {
  dashboard: TRAINING_UI_ROUTE,
  mandatory_briefings: `${TRAINING_UI_ROUTE}/mandatory`,
  my_trainings: `${TRAINING_UI_ROUTE}/my`,
  all_courses: `${TRAINING_UI_ROUTE}/courses`,
  employee_status: `${TRAINING_UI_ROUTE}/employees`,
  certificates: `${TRAINING_UI_ROUTE}/certificates`,
  expiry_monitoring: `${TRAINING_UI_ROUTE}/expiry`,
  settings: `${TRAINING_UI_ROUTE}/settings`,
};
