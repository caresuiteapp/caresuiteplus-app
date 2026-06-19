import type { ComposeRecipientType } from '@/lib/communication/composeRecipients';
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

export function audienceForComposeRecipient(type: ComposeRecipientType): ComposeTemplateAudience {
  if (
    type === 'client' ||
    type === 'relative' ||
    type === 'legal_guardian' ||
    type === 'billing_recipient' ||
    type === 'emergency_contact'
  ) {
    return 'klient';
  }
  if (type === 'employee') return 'mitarbeiter';
  if (type === 'team' || type === 'pdl' || type === 'ward_leadership' || type === 'counseling_team') {
    return 'team';
  }
  return 'intern';
}

export function defaultAudiencesForRecipient(
  recipientType: ComposeRecipientType | OfficeRecipientType,
): ComposeTemplateAudience[] {
  if (recipientType === 'client') return ['klient'];
  if (recipientType === 'employee') return ['mitarbeiter'];
  if (recipientType === 'team') return ['team'];
  if (
    recipientType === 'relative' ||
    recipientType === 'legal_guardian' ||
    recipientType === 'billing_recipient' ||
    recipientType === 'emergency_contact'
  ) {
    return ['klient'];
  }
  if (
    recipientType === 'pdl' ||
    recipientType === 'ward_leadership' ||
    recipientType === 'counseling_team'
  ) {
    return ['team'];
  }
  if (
    recipientType === 'office' ||
    recipientType === 'management' ||
    recipientType === 'billing_dept' ||
    recipientType === 'qm' ||
    recipientType === 'academy' ||
    recipientType === 'internal'
  ) {
    return ['intern'];
  }
  return ['intern', 'team'];
}

export function defaultAudienceTabForRecipient(
  recipientType: ComposeRecipientType | OfficeRecipientType,
): ComposeTemplateAudience | 'all' {
  if (recipientType === 'client') return 'klient';
  if (recipientType === 'employee') return 'mitarbeiter';
  if (recipientType === 'team') return 'team';
  if (
    recipientType === 'relative' ||
    recipientType === 'legal_guardian' ||
    recipientType === 'billing_recipient' ||
    recipientType === 'emergency_contact'
  ) {
    return 'klient';
  }
  if (
    recipientType === 'pdl' ||
    recipientType === 'ward_leadership' ||
    recipientType === 'counseling_team'
  ) {
    return 'team';
  }
  if (recipientType === 'internal') return 'all';
  return 'intern';
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
