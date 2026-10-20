import type { WfmWorkType, WfmWorkTypeKey } from '@/types/modules/wfm';

/** Standard-Tätigkeiten für Büro- und Portal-Arbeitszeit (WFM Phase 1) */
export const WFM_WORK_TYPES: WfmWorkType[] = [
  {
    key: 'buero',
    label: 'Büro',
    startEventType: 'office_check_in',
    workMode: 'office',
    sessionStatus: 'office',
    displayStatus: 'buero',
  },
  {
    key: 'homeoffice',
    label: 'Home Office',
    startEventType: 'homeoffice_start',
    workMode: 'homeoffice',
    sessionStatus: 'homeoffice',
    displayStatus: 'homeoffice',
  },
  {
    key: 'einsatz',
    label: 'Einsatz',
    startEventType: 'visit_started',
    workMode: 'field',
    sessionStatus: 'on_visit',
    displayStatus: 'im_einsatz',
  },
  {
    key: 'pause',
    label: 'Pause',
    startEventType: 'pause_start',
    workMode: 'none',
    sessionStatus: 'paused',
    displayStatus: 'pause',
  },
  {
    key: 'bereitschaft',
    label: 'Bereitschaft',
    startEventType: 'standby_start',
    workMode: 'standby',
    sessionStatus: 'standby',
    displayStatus: 'offline',
  },
  {
    key: 'fortbildung',
    label: 'Fortbildung',
    startEventType: 'training_start',
    workMode: 'training',
    sessionStatus: 'training',
    displayStatus: 'buero',
  },
  {
    key: 'besprechung',
    label: 'Besprechung',
    startEventType: 'meeting_start',
    workMode: 'office',
    sessionStatus: 'office',
    displayStatus: 'buero',
  },
  {
    key: 'fahrt',
    label: 'Fahrt',
    startEventType: 'travel_start',
    workMode: 'travel',
    sessionStatus: 'driving',
    displayStatus: 'unterwegs',
  },
];

export function getWfmWorkType(key: WfmWorkTypeKey): WfmWorkType {
  const found = WFM_WORK_TYPES.find((t) => t.key === key);
  if (!found) throw new Error(`Unbekannter WFM-Tätigkeitstyp: ${key}`);
  return found;
}

export function listWfmWorkTypesForClockIn(): WfmWorkType[] {
  return WFM_WORK_TYPES.filter((t) => t.key !== 'pause');
}
