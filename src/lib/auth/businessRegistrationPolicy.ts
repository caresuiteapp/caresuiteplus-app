import { validateRegistrationBody } from '../../../supabase/functions/_shared/companyRegistrationValidation';
import type { BusinessRegistrationInput } from './auth.types';

/** Available to every new company. Kept only for existing entitlement storage. */
export const FREE_REGISTRATION_PRODUCTS: BusinessRegistrationInput['selectedModules'] = [
  'office', 'assist', 'pflege', 'beratung', 'akademie', 'stationaer',
];

export function validateBusinessRegistration(input: BusinessRegistrationInput): string | null {
  return validateRegistrationBody(input as unknown as Record<string, unknown>);
}
