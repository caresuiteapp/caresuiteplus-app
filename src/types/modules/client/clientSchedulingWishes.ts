import type { TenantScopedEntity } from '../../core/base';

export type PreferredWeekday = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';

export const PREFERRED_WEEKDAY_LABELS: Record<PreferredWeekday, string> = {
  mo: 'Mo',
  di: 'Di',
  mi: 'Mi',
  do: 'Do',
  fr: 'Fr',
  sa: 'Sa',
  so: 'So',
};

export const PREFERRED_WEEKDAY_ORDER: PreferredWeekday[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

export type PreferredTimeSlot = 'morgens' | 'mittags' | 'nachmittags' | 'abends';

export const PREFERRED_TIME_SLOT_LABELS: Record<PreferredTimeSlot, string> = {
  morgens: 'Morgens',
  mittags: 'Mittags',
  nachmittags: 'Nachmittags',
  abends: 'Abends',
};

export type PreferredEmployeeGender = 'männlich' | 'weiblich' | 'egal';

export const PREFERRED_EMPLOYEE_GENDER_LABELS: Record<PreferredEmployeeGender, string> = {
  männlich: 'Männlich',
  weiblich: 'Weiblich',
  egal: 'Egal',
};

export type ClientSchedulingWishes = TenantScopedEntity & {
  clientId: string;
  preferredDays: PreferredWeekday[];
  preferredTimeSlots: PreferredTimeSlot[];
  timeFrom: string | null;
  timeTo: string | null;
  preferredEmployeeGender: PreferredEmployeeGender | null;
  hoursPerAssignment: number | null;
  assignmentsPerWeek: number | null;
  assignmentsPerMonth: number | null;
};

export type ClientSchedulingWishesInput = Omit<
  ClientSchedulingWishes,
  'id' | 'tenantId' | 'clientId' | 'createdAt' | 'updatedAt'
>;
