import { isDemoMode } from '@/lib/supabase/config';

export const ASSIGNMENT_CREATE_ROUTE = '/assist/einsaetze/new';

export type AssignmentListEmptyState = {
  title: string;
  message: string;
  actionLabel?: string;
};

/** Leerer Listen-Zustand — Demo- vs. Live-Text, optional mit Planungs-CTA. */
export function getAssignmentListEmptyState(canCreate = false): AssignmentListEmptyState {
  if (isDemoMode()) {
    return {
      title: 'Noch keine Einsätze',
      message: 'Es sind keine Einsätze im Demo-Mandanten hinterlegt.',
      actionLabel: canCreate ? 'Einsatz planen (Demo)' : undefined,
    };
  }

  return {
    title: 'Noch keine Einsätze geplant',
    message: 'Planen Sie den ersten Einsatz mit Klient:in, Mitarbeitenden und Zeitfenster.',
    actionLabel: canCreate ? 'Einsatz planen' : undefined,
  };
}
