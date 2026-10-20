import type {
  ClientSchedulingWishes,
  PreferredEmployeeGender,
  PreferredTimeSlot,
  PreferredWeekday,
} from '@/types/modules/client/clientSchedulingWishes';
import {
  PREFERRED_WEEKDAY_ORDER,
} from '@/types/modules/client/clientSchedulingWishes';

type SchedulingWishesRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  preferred_days: string[] | null;
  preferred_time_slots: string[] | null;
  time_from: string | null;
  time_to: string | null;
  preferred_employee_gender: string | null;
  hours_per_assignment: number | string | null;
  assignments_per_week: number | null;
  assignments_per_month: number | null;
  created_at: string;
  updated_at: string;
};

const WEEKDAYS = new Set<string>(PREFERRED_WEEKDAY_ORDER);
const TIME_SLOTS = new Set<string>(['morgens', 'mittags', 'nachmittags', 'abends']);
const GENDERS = new Set<string>(['männlich', 'weiblich', 'egal']);

function parseWeekdays(values: string[] | null | undefined): PreferredWeekday[] {
  return (values ?? []).filter((value): value is PreferredWeekday => WEEKDAYS.has(value));
}

function parseTimeSlots(values: string[] | null | undefined): PreferredTimeSlot[] {
  return (values ?? []).filter((value): value is PreferredTimeSlot => TIME_SLOTS.has(value));
}

function parseGender(value: string | null | undefined): PreferredEmployeeGender | null {
  if (!value || !GENDERS.has(value)) return null;
  return value as PreferredEmployeeGender;
}

function parseNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapClientSchedulingWishes(row: SchedulingWishesRow): ClientSchedulingWishes {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    preferredDays: parseWeekdays(row.preferred_days),
    preferredTimeSlots: parseTimeSlots(row.preferred_time_slots),
    timeFrom: row.time_from,
    timeTo: row.time_to,
    preferredEmployeeGender: parseGender(row.preferred_employee_gender),
    hoursPerAssignment: parseNumber(row.hours_per_assignment),
    assignmentsPerWeek: row.assignments_per_week,
    assignmentsPerMonth: row.assignments_per_month,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSchedulingWishesToRow(
  tenantId: string,
  clientId: string,
  input: Omit<ClientSchedulingWishes, 'id' | 'tenantId' | 'clientId' | 'createdAt' | 'updatedAt'>,
) {
  return {
    tenant_id: tenantId,
    client_id: clientId,
    preferred_days: input.preferredDays,
    preferred_time_slots: input.preferredTimeSlots,
    time_from: input.timeFrom?.trim() || null,
    time_to: input.timeTo?.trim() || null,
    preferred_employee_gender: input.preferredEmployeeGender,
    hours_per_assignment: input.hoursPerAssignment,
    assignments_per_week: input.assignmentsPerWeek,
    assignments_per_month: input.assignmentsPerMonth,
    updated_at: new Date().toISOString(),
  };
}
