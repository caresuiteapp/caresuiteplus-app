export type OfficeRecipientType = 'client' | 'employee' | 'team' | 'internal';

export type OfficeRecipientOption = {
  id: string;
  label: string;
};

export const OFFICE_RECIPIENT_TYPE_OPTIONS: ReadonlyArray<{
  key: OfficeRecipientType;
  label: string;
}> = [
  { key: 'client', label: 'Klient:in' },
  { key: 'employee', label: 'Mitarbeiter:in' },
  { key: 'team', label: 'Team' },
  { key: 'internal', label: 'Intern (Büro)' },
];

export const OFFICE_INTERNAL_RECIPIENT_ID = 'office-broadcast';
