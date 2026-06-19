import type { OfficeRecipientType } from '@/types/office/officeCompose';

export type ComposeTemplateAudience = 'klient' | 'mitarbeiter' | 'team' | 'intern';

export const COMPOSE_TEMPLATE_AUDIENCES: ReadonlyArray<{
  key: ComposeTemplateAudience;
  label: string;
}> = [
  { key: 'klient', label: 'Klient' },
  { key: 'mitarbeiter', label: 'Mitarbeiter' },
  { key: 'team', label: 'Team' },
  { key: 'intern', label: 'Intern' },
];

export function defaultAudiencesForRecipient(
  recipientType: OfficeRecipientType,
): ComposeTemplateAudience[] {
  if (recipientType === 'client') return ['klient'];
  if (recipientType === 'employee') return ['mitarbeiter'];
  if (recipientType === 'team') return ['team'];
  return ['intern', 'team'];
}

export function defaultAudienceTabForRecipient(
  recipientType: OfficeRecipientType,
): ComposeTemplateAudience | 'all' {
  if (recipientType === 'client') return 'klient';
  if (recipientType === 'employee') return 'mitarbeiter';
  if (recipientType === 'team') return 'team';
  return 'all';
}

export function normalizeTemplateAudience(categoryKey: string | null): ComposeTemplateAudience | null {
  if (!categoryKey) return null;
  const key = categoryKey.toLowerCase();
  if (key === 'klient' || key === 'client') return 'klient';
  if (key === 'mitarbeiter' || key === 'employee') return 'mitarbeiter';
  if (key === 'team') return 'team';
  if (key === 'intern' || key === 'internal' || key === 'general') return 'intern';
  return null;
}
