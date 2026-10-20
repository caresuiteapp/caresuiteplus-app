import type { TenantScopedEntity } from '../../core/base';

export type ClientPreferenceShift = 'morgens' | 'mittags' | 'nachmittags' | 'abends' | 'flexibel';

export const SHIFT_LABELS: Record<ClientPreferenceShift, string> = {
  morgens: 'Morgens',
  mittags: 'Mittags',
  nachmittags: 'Nachmittags',
  abends: 'Abends',
  flexibel: 'Flexibel',
};

export type ClientPreferences = TenantScopedEntity & {
  clientId: string;
  preferredShifts: ClientPreferenceShift[];
  preferredEmployeeIds: string[];
  excludedEmployeeIds: string[];
  language: string | null;
  mobilityNotes: string | null;
  householdNotes: string | null;
  petNotes: string | null;
  accessInstructions: string | null;
};
