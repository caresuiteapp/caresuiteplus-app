import type { BusinessRegistrationInput } from './auth.types';

/** Available to every new company. Kept only for existing entitlement storage. */
export const FREE_REGISTRATION_PRODUCTS: BusinessRegistrationInput['selectedModules'] = [
  'office', 'assist', 'pflege', 'beratung', 'akademie', 'stationaer',
];

export function validateBusinessRegistration(input: BusinessRegistrationInput): string | null {
  const required: (keyof BusinessRegistrationInput)[] = [
    'companyName', 'legalForm', 'industry', 'street', 'zip', 'city', 'phone',
    'email', 'adminFirstName', 'adminLastName', 'adminEmail',
  ];
  if (required.some(key => typeof input[key] !== 'string' || !(input[key] as string).trim())) {
    return 'Bitte Unternehmensdaten, Anschrift und Administrationskonto vollständig ausfüllen.';
  }
  if (required.some(key => (input[key] as string).length > 200)) return 'Bitte Angaben auf höchstens 200 Zeichen begrenzen.';
  if (![input.email, input.adminEmail].every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
    return 'Bitte gültige E-Mail-Adressen für Unternehmen und Administration eingeben.';
  }
  if (input.adminPassword.length < 10 || input.adminPassword.length > 128) return 'Das Passwort muss 10 bis 128 Zeichen lang sein.';
  if (input.website?.trim() && !/^https?:\/\/[^\s]+$/i.test(input.website.trim())) return 'Die Website muss mit https:// oder http:// beginnen.';
  return null;
}
