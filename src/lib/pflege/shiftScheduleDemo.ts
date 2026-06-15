import type { WorkflowStatus } from '@/types/core/base';
import { SHIFT_LOCATIONS, SHIFT_STAFF } from '@/data/demo/generators/pflegeDemoGenerators';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

export type ShiftScheduleListItem = {
  id: string;
  tenantId: string;
  employeeName: string;
  roleLabel: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  location: string;
  status: WorkflowStatus;
  updatedAt: string;
};

const SHIFT_TIMES: Array<{ start: string; end: string }> = [
  { start: '06:00', end: '14:00' },
  { start: '07:00', end: '15:00' },
  { start: '08:00', end: '16:00' },
  { start: '14:00', end: '22:00' },
  { start: '09:00', end: '17:00' },
];

const STATUSES: WorkflowStatus[] = ['aktiv', 'aktiv', 'in_bearbeitung', 'entwurf'];

function formatDate(base: Date, dayOffset: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

function buildTwoWeekShifts(): ShiftScheduleListItem[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const items: ShiftScheduleListItem[] = [];
  let counter = 1;

  for (let day = 0; day < 14; day++) {
    for (let staffIdx = 0; staffIdx < SHIFT_STAFF.length; staffIdx++) {
      const staff = SHIFT_STAFF[staffIdx]!;
      const time = SHIFT_TIMES[(day + staffIdx) % SHIFT_TIMES.length]!;
      const id = `shift-${String(counter).padStart(3, '0')}`;
      counter += 1;

      items.push({
        id,
        tenantId: DEMO_TENANT_ID,
        employeeName: staff.name,
        roleLabel: staff.role,
        shiftDate: formatDate(base, day),
        startTime: time.start,
        endTime: time.end,
        location: SHIFT_LOCATIONS[(day + staffIdx) % SHIFT_LOCATIONS.length]!,
        status: STATUSES[(day + staffIdx) % STATUSES.length]!,
        updatedAt: new Date(Date.now() - day * 86_400_000).toISOString(),
      });
    }
  }

  return items;
}

const SHIFT_SEEDS = buildTwoWeekShifts();
let shiftStore: ShiftScheduleListItem[] = SHIFT_SEEDS.map((s) => ({ ...s }));

export function getDemoShiftScheduleListItems(): ShiftScheduleListItem[] {
  return shiftStore.map((s) => ({ ...s }));
}

export function getDemoShiftById(id: string): ShiftScheduleListItem | null {
  const shift = shiftStore.find((s) => s.id === id);
  return shift ? { ...shift } : null;
}

export function createDemoShift(input: {
  employeeName: string;
  roleLabel: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  location: string;
}): ShiftScheduleListItem {
  const now = new Date().toISOString();
  const item: ShiftScheduleListItem = {
    id: `shift-${Date.now()}`,
    tenantId: DEMO_TENANT_ID,
    ...input,
    status: 'entwurf',
    updatedAt: now,
  };
  shiftStore = [item, ...shiftStore];
  return { ...item };
}
