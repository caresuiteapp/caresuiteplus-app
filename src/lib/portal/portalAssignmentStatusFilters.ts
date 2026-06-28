/** Remote assignment_status values used by public.assignments (English enum). */
export const PORTAL_UPCOMING_ASSIGNMENT_STATUSES = [
  'planned',
  'confirmed',
  'on_the_way',
  'arrived',
  'started',
  'paused',
  'finished',
  'documentation_open',
  'signature_open',
] as const;

/** Non-terminal statuses shown in portal appointment lists (employee + client). */
export const PORTAL_APPOINTMENT_STATUSES = PORTAL_UPCOMING_ASSIGNMENT_STATUSES;

export const PORTAL_PLANNED_ASSIGNMENT_STATUSES = ['planned', 'confirmed'] as const;

export const PORTAL_ACTIVE_LIVE_ASSIGNMENT_STATUSES = ['on_the_way', 'arrived', 'started'] as const;
