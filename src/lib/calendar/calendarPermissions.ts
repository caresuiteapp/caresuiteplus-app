import type { RoleKey } from '@/types';
import type { CalendarViewConfig } from '@/types/calendar';
import type { PermissionKey } from '@/types/permissions';

const OFFICE_CALENDAR_PERMISSION: PermissionKey = 'office.appointments.view';
const ASSIST_CALENDAR_PERMISSION: PermissionKey = 'assist.assignments.view';

const MODULE_PERMISSIONS: Partial<Record<string, PermissionKey>> = {
  office: OFFICE_CALENDAR_PERMISSION,
  assist: ASSIST_CALENDAR_PERMISSION,
  pflege: 'pflege.plans.view',
  stationaer: 'stationaer.residents.view',
  beratung: 'beratung.cases.view',
  akademie: 'akademie.courses.view',
};

export function resolveCalendarPermission(config: CalendarViewConfig): PermissionKey {
  if (config.calendarScope === 'office' || config.showAllModules) {
    return OFFICE_CALENDAR_PERMISSION;
  }
  return MODULE_PERMISSIONS[config.moduleKey] ?? OFFICE_CALENDAR_PERMISSION;
}

export function canViewCalendarModule(roleKey: RoleKey | null | undefined, moduleKey: string): boolean {
  if (!roleKey) return false;
  if (roleKey === 'business_admin' || roleKey === 'business_manager') return true;
  return true;
}
