import type {
  CsContextValidationIssue,
  CsDocumentTemplateVersion,
  CsRecipientScope,
  CsSignatureRequirement,
  CsTemplatePlaceholder,
  CsTemplateSignatureField,
  CsTemplateWithActiveVersion,
  DocumentContext,
} from '@/types/documents/csTemplateDatabase';
import { normalizeDocumentContext } from './csDocumentContextNormalize';
import { extractPlaceholderKeys } from './csTemplateRenderService';

function readContextPath(context: DocumentContext, path: string): string {
  const normalized = normalizeDocumentContext(context);
  const parts = path.split('.');
  let current: unknown = normalized;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[part];
  }
  return current == null ? '' : String(current).trim();
}

const PLACEHOLDER_USER_MESSAGES: Record<string, (key: string) => string> = {
  employee: (key) =>
    `Der Platzhalter {{${key}}} kann nicht gefüllt werden, weil kein Mitarbeitende:r ausgewählt wurde.`,
  client: (key) =>
    `Der Platzhalter {{${key}}} kann nicht gefüllt werden, weil keine Klientin/kein Klient ausgewählt wurde.`,
  assignment: (key) =>
    `Der Platzhalter {{${key}}} kann nicht gefüllt werden, weil kein Einsatz verknüpft ist.`,
  invoice: (key) =>
    `Der Platzhalter {{${key}}} kann nicht gefüllt werden, weil keine Rechnung verknüpft ist.`,
  payor: (key) =>
    `Der Platzhalter {{${key}}} kann nicht gefüllt werden, weil kein Kostenträger verknüpft ist.`,
};

export function validateRecipients(input: {
  recipientScope: CsRecipientScope;
  employeeId?: string | null;
  clientId?: string | null;
}): CsContextValidationIssue[] {
  const issues: CsContextValidationIssue[] = [];
  const { recipientScope, employeeId, clientId } = input;

  if ((recipientScope === 'employee' || recipientScope === 'both') && !employeeId?.trim()) {
    issues.push({
      code: 'missing_context_data',
      message: 'Bitte wählen Sie einen Mitarbeitenden aus.',
    });
  }
  if ((recipientScope === 'client' || recipientScope === 'both') && !clientId?.trim()) {
    issues.push({
      code: 'missing_context_data',
      message: 'Bitte wählen Sie eine Klientin oder einen Klienten aus.',
    });
  }
  return issues;
}

export function validateSignatureFieldsPresent(
  signatureRequirement: CsSignatureRequirement,
  signatureFields: CsTemplateSignatureField[],
): CsContextValidationIssue[] {
  if (signatureRequirement === 'none') return [];
  if (signatureFields.length > 0) return [];
  return [
    {
      code: 'signature_anchor_missing',
      message: 'Für diese Vorlage fehlt ein Signaturfeld.',
    },
  ];
}

export function validateRecipientScope(
  templateScope: CsRecipientScope,
  sendScope: CsRecipientScope,
): CsContextValidationIssue | null {
  if (templateScope === sendScope || templateScope === 'both') return null;
  if (sendScope === 'both' && (templateScope === 'employee' || templateScope === 'client')) return null;
  return {
    code: 'recipient_mismatch',
    message: `Empfängerrolle „${sendScope}“ passt nicht zur Vorlage (erwartet: ${templateScope}).`,
  };
}

export function validateSignatureAnchors(
  version: CsDocumentTemplateVersion,
  signatureFields: CsTemplateSignatureField[],
): CsContextValidationIssue[] {
  const issues: CsContextValidationIssue[] = [];
  for (const field of signatureFields) {
    if (!field.required) continue;
    const token = field.anchorToken.trim();
    if (!token) {
      issues.push({
        code: 'signature_anchor_missing',
        message: `Signaturfeld „${field.label}“ hat keinen Anker.`,
      });
      continue;
    }
    const hasAnchor =
      version.bodyHtml.includes(`data-signature-anchor="${token}"`)
      || version.bodyHtml.includes(`[SIGNATURE:${field.signerRole}]`);
    if (!hasAnchor) {
      issues.push({
        code: 'signature_anchor_missing',
        message: `Signaturfeld „${field.label}“ — Anker „${token}“ fehlt im Dokument.`,
      });
    }
  }
  return issues;
}

export function validateRequiredPlaceholders(
  html: string,
  context: DocumentContext,
  placeholders: CsTemplatePlaceholder[],
): CsContextValidationIssue[] {
  const keysInHtml = new Set(extractPlaceholderKeys(html));
  const issues: CsContextValidationIssue[] = [];

  for (const placeholder of placeholders) {
    if (!placeholder.requiredContext) continue;
    if (!keysInHtml.has(placeholder.placeholderKey)) continue;
    const value = readContextPath(context, placeholder.placeholderKey);
    if (!value) {
      issues.push({
        code: 'missing_context_data',
        message: `Pflichtdaten fehlen: ${placeholder.label} ({{${placeholder.placeholderKey}}}).`,
        placeholderKey: placeholder.placeholderKey,
      });
    }
  }

  for (const key of keysInHtml) {
    const value = readContextPath(context, key);
    if (value) continue;
    const entity = key.split('.')[0];
    if (entity === 'employee' && !context.employee) {
      issues.push({ code: 'missing_context_data', message: PLACEHOLDER_USER_MESSAGES.employee(key), placeholderKey: key });
    } else if (entity === 'client' && !context.client) {
      issues.push({ code: 'missing_context_data', message: PLACEHOLDER_USER_MESSAGES.client(key), placeholderKey: key });
    } else if (entity === 'assignment' && !context.assignment) {
      issues.push({ code: 'missing_context_data', message: PLACEHOLDER_USER_MESSAGES.assignment(key), placeholderKey: key });
    } else if (entity === 'invoice' && !context.invoice) {
      issues.push({ code: 'missing_context_data', message: PLACEHOLDER_USER_MESSAGES.invoice(key), placeholderKey: key });
    } else if (entity === 'payor' && !context.payor) {
      issues.push({ code: 'missing_context_data', message: PLACEHOLDER_USER_MESSAGES.payor(key), placeholderKey: key });
    }
  }

  return issues;
}

export function validateTemplateForSend(input: {
  template: CsTemplateWithActiveVersion | null;
  sendRecipientScope: CsRecipientScope;
  employeeId?: string | null;
  clientId?: string | null;
  context: DocumentContext;
  placeholders: CsTemplatePlaceholder[];
}): CsContextValidationIssue[] {
  if (!input.template?.activeVersion) {
    return [{ code: 'missing_active_version', message: 'Diese Vorlage hat keine aktive Version.' }];
  }

  const issues: CsContextValidationIssue[] = [];

  issues.push(
    ...validateRecipients({
      recipientScope: input.sendRecipientScope,
      employeeId: input.employeeId,
      clientId: input.clientId,
    }),
  );

  const recipientIssue = validateRecipientScope(input.template.recipientScope, input.sendRecipientScope);
  if (recipientIssue) issues.push(recipientIssue);

  issues.push(
    ...validateSignatureFieldsPresent(
      input.template.defaultSignatureRequirement,
      input.template.signatureFields,
    ),
  );
  issues.push(
    ...validateSignatureAnchors(input.template.activeVersion, input.template.signatureFields),
  );
  issues.push(
    ...validateRequiredPlaceholders(
      input.template.activeVersion.bodyHtml,
      input.context,
      input.placeholders,
    ),
  );

  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.message)) return false;
    seen.add(issue.message);
    return true;
  });
}
