import type { CalendarEvent } from '@/types/modules/calendarEvent';
import type { WfmAbsence, WfmAbsenceType } from '@/types/modules/wfm';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { getGermanPublicHolidays } from './germanPublicHolidays';

type BirthdayRow = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
};

type AbsenceRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  absence_type: WfmAbsenceType;
  status: WfmAbsence['status'];
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  requested_days: number | null;
  employee_note: string;
  internal_note: string;
  created_at: string;
  updated_at: string;
};

const ABSENCE_LABELS: Record<WfmAbsenceType, string> = {
  vacation: 'Urlaub',
  sick_leave: 'Krankheit',
  child_sick_leave: 'Kind krank',
  unpaid_leave: 'Unbezahlter Urlaub',
  training: 'Weiterbildung',
  school: 'Schule',
  maternity: 'Mutterschutz',
  parental_leave: 'Elternzeit',
  special_leave: 'Sonderurlaub',
  business_trip: 'Dienstreise',
  public_holiday: 'Feiertag',
  blocked_time: 'Gesperrte Zeit',
  other: 'Abwesenheit',
};

function absenceType(type: WfmAbsenceType): CalendarEvent['type'] {
  if (type === 'vacation' || type === 'unpaid_leave' || type === 'special_leave') return 'urlaub';
  if (type === 'sick_leave' || type === 'child_sick_leave') return 'krank';
  if (type === 'training' || type === 'school') return 'weiterbildung';
  if (type === 'public_holiday') return 'feiertag';
  return 'abwesenheit';
}

function allDayEndInclusive(value: string): string {
  const key = value.slice(0, 10);
  return `${key}T23:59:59.999Z`;
}

function nameOf(row: BirthdayRow): string {
  return `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
}

function birthdayInYear(dateOfBirth: string, year: number): string {
  const monthDay = dateOfBirth.slice(5, 10);
  if (monthDay === '02-29' && !new Date(Date.UTC(year, 1, 29)).toISOString().startsWith(`${year}-02-29`)) {
    return `${year}-02-28`;
  }
  return `${year}-${monthDay}`;
}

export function birthdayAgeInYear(dateOfBirth: string, year: number): number {
  const birthYear = Number.parseInt(dateOfBirth.slice(0, 4), 10);
  if (!Number.isFinite(birthYear) || birthYear > year) return 0;
  return year - birthYear;
}

function yearsInRange(rangeStart?: string, rangeEnd?: string): number[] {
  const start = rangeStart ? new Date(rangeStart).getUTCFullYear() : new Date().getUTCFullYear();
  const end = rangeEnd ? new Date(rangeEnd).getUTCFullYear() : start;
  const years: number[] = [];
  for (let year = start; year <= end; year += 1) years.push(year);
  return years;
}

export function buildBirthdayEvents(
  rows: BirthdayRow[],
  kind: 'employee' | 'client',
  rangeStart?: string,
  rangeEnd?: string,
): CalendarEvent[] {
  const rangeStartKey = rangeStart?.slice(0, 10);
  const rangeEndKey = rangeEnd?.slice(0, 10);
  return rows.flatMap((row) => {
    if (!row.date_of_birth || !nameOf(row)) return [];
    return yearsInRange(rangeStart, rangeEnd).flatMap((year) => {
      const day = birthdayInYear(row.date_of_birth!, year);
      const age = birthdayAgeInYear(row.date_of_birth!, year);
      if (rangeStartKey && day < rangeStartKey) return [];
      if (rangeEndKey && day > rangeEndKey) return [];
      return [{
        id: `birthday:${kind}:${row.id}:${year}`,
        title: `${nameOf(row)} · ${age}. Geburtstag · ${kind === 'employee' ? 'Mitarbeitende:r' : 'Klient:in'}`,
        start: `${day}T00:00:00.000Z`,
        end: `${day}T23:59:59.999Z`,
        type: 'geburtstag' as const,
        color: '#F472B6',
        allDay: true,
        sourceId: row.id,
        sourceType: `${kind}_birthday`,
        moduleKey: 'assist',
        status: 'aktiv',
        href: kind === 'employee' ? `/office/employees/${row.id}` : `/office/clients/${row.id}`,
        employeeName: kind === 'employee' ? nameOf(row) : undefined,
        clientName: kind === 'client' ? nameOf(row) : undefined,
      }];
    });
  });
}

export function buildAbsenceEvents(
  rows: AbsenceRow[],
  employeeNames: Map<string, string>,
): CalendarEvent[] {
  return rows
    .filter((row) => !['rejected', 'cancelled'].includes(row.status))
    .map((row) => {
      const employeeName = employeeNames.get(row.employee_id) ?? 'Mitarbeitende Person';
      const type = absenceType(row.absence_type);
      const pending = row.status === 'requested' ? ' · beantragt' : '';
      return {
        id: `workforce-absence:${row.id}`,
        title: `${ABSENCE_LABELS[row.absence_type]} · ${employeeName}${pending}`,
        start: row.starts_at,
        end: row.all_day ? allDayEndInclusive(row.ends_at) : row.ends_at,
        type,
        color: type === 'urlaub' ? '#22C55E' : type === 'krank' ? '#F97316' : type === 'weiterbildung' ? '#EC4899' : type === 'feiertag' ? '#EF4444' : '#A78BFA',
        allDay: row.all_day,
        sourceId: row.id,
        sourceType: 'workforce_absence',
        moduleKey: 'assist',
        status: row.status,
        href: `/office/employees/${row.employee_id}`,
        employeeName,
      } satisfies CalendarEvent;
    });
}

export function buildPublicHolidayEvents(rangeStart?: string, rangeEnd?: string): CalendarEvent[] {
  const startKey = rangeStart?.slice(0, 10);
  const endKey = rangeEnd?.slice(0, 10);
  return yearsInRange(rangeStart, rangeEnd).flatMap((year) =>
    getGermanPublicHolidays(year, 'NW').flatMap((holiday) => {
      if (startKey && holiday.date < startKey) return [];
      if (endKey && holiday.date > endKey) return [];
      return [{
        id: `public-holiday:NW:${holiday.key}:${year}`,
        title: holiday.name,
        start: `${holiday.date}T00:00:00.000Z`,
        end: `${holiday.date}T23:59:59.999Z`,
        type: 'feiertag' as const,
        color: '#EF4444',
        allDay: true,
        sourceType: 'public_holiday',
        moduleKey: 'assist',
        status: 'aktiv',
      }];
    }),
  );
}

export function mergeOperationalCalendarEvents(
  base: CalendarEvent[],
  operational: CalendarEvent[],
): CalendarEvent[] {
  const seen = new Set<string>();
  const absenceSourceIds = new Set(
    base
      .filter((event) => ['absence', 'vacation', 'sick_leave', 'workforce_absence'].includes(event.sourceType ?? ''))
      .map((event) => event.sourceId)
      .filter((id): id is string => Boolean(id)),
  );
  return [...base, ...operational]
    .filter((event) => {
      if (event.sourceType === 'workforce_absence' && event.sourceId && absenceSourceIds.has(event.sourceId)) {
        return false;
      }
      const sourceKey = event.sourceId && event.sourceType
        ? `${event.sourceType}:${event.sourceId}`
        : event.id;
      if (seen.has(sourceKey)) return false;
      seen.add(sourceKey);
      return true;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

export async function loadAssistOperationalCalendarEvents(
  tenantId: string,
  rangeStart?: string,
  rangeEnd?: string,
): Promise<CalendarEvent[]> {
  if (getServiceMode() !== 'supabase') return buildPublicHolidayEvents(rangeStart, rangeEnd);
  const supabase = getSupabaseClient();
  if (!supabase) return buildPublicHolidayEvents(rangeStart, rangeEnd);

  let absenceQuery = fromUnknownTable(supabase, 'workforce_absences')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['requested', 'approved', 'active', 'completed'])
    .order('starts_at', { ascending: true })
    .limit(1000);
  if (rangeStart) absenceQuery = absenceQuery.gte('ends_at', rangeStart);
  if (rangeEnd) absenceQuery = absenceQuery.lte('starts_at', rangeEnd);

  const [absences, employees, clients] = await Promise.all([
    absenceQuery,
    fromUnknownTable(supabase, 'employees')
      .select('id,first_name,last_name,date_of_birth')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .limit(2000),
    fromUnknownTable(supabase, 'clients')
      .select('id,first_name,last_name,date_of_birth')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .limit(5000),
  ]);

  const employeeRows = employees.error ? [] : (employees.data ?? []) as BirthdayRow[];
  const clientRows = clients.error ? [] : (clients.data ?? []) as BirthdayRow[];
  const employeeNames = new Map(employeeRows.map((row) => [row.id, nameOf(row)]));
  const absenceRows = absences.error ? [] : (absences.data ?? []) as AbsenceRow[];

  return [
    ...buildAbsenceEvents(absenceRows, employeeNames),
    ...buildBirthdayEvents(employeeRows, 'employee', rangeStart, rangeEnd),
    ...buildBirthdayEvents(clientRows, 'client', rangeStart, rangeEnd),
    ...buildPublicHolidayEvents(rangeStart, rangeEnd),
  ];
}
