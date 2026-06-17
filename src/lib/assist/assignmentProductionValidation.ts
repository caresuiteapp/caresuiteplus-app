import type { AssignmentCreateTaskSelection } from '@/lib/assist/assignmentCreateFormHelpers';

export type AssignmentCreateFormData = {
  clientId: string;
  employeeId: string;
  assignmentDate: string;
  plannedStartTime: string;
  plannedEndTime: string;
  title: string;
  selectedTasks: AssignmentCreateTaskSelection[];
};

export type AssignmentCreateFormErrors = Partial<
  Record<
    | 'clientId'
    | 'employeeId'
    | 'assignmentDate'
    | 'plannedStartTime'
    | 'plannedEndTime'
    | 'title'
    | 'selectedTasks',
    string
  >
>;

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
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
    const start = new Date(`${data.assignmentDate}T${data.plannedStartTime}:00`);
    const end = new Date(`${data.assignmentDate}T${data.plannedEndTime}:00`);
    if (end <= start) {
      errors.plannedEndTime = 'Endzeit muss nach Startzeit liegen.';
    }
  }

  const taskTitles = data.selectedTasks.map((task) => task.title.trim()).filter(Boolean);
  if (taskTitles.length === 0) {
    errors.selectedTasks = 'Mindestens eine Aufgabe aus der Klientenakte ist erforderlich.';
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
  const plannedStartAt = new Date(
    `${data.assignmentDate}T${data.plannedStartTime}:00`,
  ).toISOString();
  const plannedEndAt = new Date(`${data.assignmentDate}T${data.plannedEndTime}:00`).toISOString();
  return { plannedStartAt, plannedEndAt };
}
