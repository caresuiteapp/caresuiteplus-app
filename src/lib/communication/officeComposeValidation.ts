import type { OfficeRecipientType } from '@/types/office/officeCompose';

export const OFFICE_COMPOSE_MIN_SUBJECT_LENGTH = 3;
export const OFFICE_COMPOSE_MIN_BODY_LENGTH = 1;

export type OfficeComposeValidationInput = {
  subject: string;
  body: string;
  requireRecipient?: boolean;
  recipientType?: OfficeRecipientType | null;
  recipientId?: string | null;
};

export function validateOfficeComposeMessage(input: OfficeComposeValidationInput): string | null {
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (input.requireRecipient) {
    if (!input.recipientType) {
      return 'Bitte Empfängertyp wählen.';
    }
    if (input.recipientType !== 'internal' && !input.recipientId?.trim()) {
      return 'Bitte Empfänger auswählen.';
    }
  }

  if (subject.length < OFFICE_COMPOSE_MIN_SUBJECT_LENGTH) {
    return `Betreff muss mindestens ${OFFICE_COMPOSE_MIN_SUBJECT_LENGTH} Zeichen haben.`;
  }

  if (body.length < OFFICE_COMPOSE_MIN_BODY_LENGTH) {
    return 'Nachricht darf nicht leer sein.';
  }

  return null;
}
