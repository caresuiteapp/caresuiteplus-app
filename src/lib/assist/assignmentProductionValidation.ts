import { berlinTimestamp } from '@/lib/calendar/employeeMonthPlanning';
export type AssignmentCreateFormData = {
  clientId: string;
  employeeId: string;
  assignmentDate: string;
  plannedStartTime: string;
  plannedEndTime: string;
  title: string;
  tasks: string[];
};

export type AssignmentCreateFormErrors = Partial<
  Record<
    | 'clientId'
    | 'employeeId'
    | 'assignmentDate'
    | 'plannedStartTime'
    | 'plannedEndTime'
    | 'title'
    | 'tasks',
    string
  >
>;

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateAssignmentCreateForm(
  data: AssignmentCreateFormData,
): AssignmentCreateFormErrors {
  const errors: AssignmentCreateFormErrors = {};

  if (!data.clientId.trim()) errors.clientId = 'Klient:in ist erforderlich.';
  if (!data.employeeId.trim()) errors.employeeId = 'Mitarbeitende:r ist erforderlich.';
  if (!data.title.trim()) errors.title = 'Bezeichnung ist erforderlich.';

  if (!data.assignmentDate.trim()) {
    errors.assignmentDate = 'Datum ist erforderlich.';
  } else if (!isValidDate(data.assignmentDate)) {
    errors.assignmentDate = 'Format: JJJJ-MM-TT';
  }

  if (!data.plannedStartTime.trim()) {
    errors.plannedStartTime = 'Startzeit ist erforderlich.';
  } else if (!isValidTime(data.plannedStartTime)) {
    errors.plannedStartTime = 'Format: HH:MM';
  }

  if (!data.plannedEndTime.trim()) {
    errors.plannedEndTime = 'Endzeit ist erforderlich.';
  } else if (!isValidTime(data.plannedEndTime)) {
    errors.plannedEndTime = 'Format: HH:MM';
  }

  if (
    isValidDate(data.assignmentDate) &&
    isValidTime(data.plannedStartTime) &&
    isValidTime(data.plannedEndTime)
  ) {
    try {
      const { plannedStartAt, plannedEndAt } = buildPlannedTimestamps(data);
      if (plannedEndAt <= plannedStartAt) errors.plannedEndTime = 'Endzeit muss nach Startzeit liegen.';
    } catch {
      errors.plannedStartTime = 'Diese Ortszeit existiert wegen der Zeitumstellung nicht. Bitte Uhrzeit anpassen.';
    }
  }

  const taskTitles = data.tasks.map((t) => t.trim()).filter(Boolean);
  if (taskTitles.length === 0) {
    errors.tasks = 'Mindestens eine Aufgabe ist erforderlich.';
  }

  return errors;
}

export function hasAssignmentProductionErrors(errors: AssignmentCreateFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function buildPlannedTimestamps(data: AssignmentCreateFormData): {
  plannedStartAt: string;
  plannedEndAt: string;
} {
  const plannedStartAt = berlinTimestamp(data.assignmentDate, data.plannedStartTime);
  const plannedEndAt = berlinTimestamp(data.assignmentDate, data.plannedEndTime);
  return { plannedStartAt, plannedEndAt };
}
