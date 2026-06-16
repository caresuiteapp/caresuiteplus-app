import { formatDocumentAddress } from './formatDocumentAddress';
import type { InvoiceRecipientInput, InvoiceRecipientKind } from '@/types/documents/tenantDocumentSettings';

export type ResolvedRecipient = {
  kind: InvoiceRecipientKind;
  fullName: string;
  address: string;
  street: string;
  zip: string;
  city: string;
};

/**
 * Adresslogik für Rechnungsempfänger:
 * 1. Gesetzliche Betreuung als Rechnungsempfänger → Betreueradresse
 * 2. Kostenträger als Rechnungsempfänger → Kostenträgeradresse
 * 3. Selbstzahler → Klient:in oder hinterlegte Rechnungsempfängeradresse
 */
export function resolveInvoiceRecipient(input: InvoiceRecipientInput): ResolvedRecipient {
  const kind = resolveRecipientKind(input);

  if (kind === 'guardian' && input.representative) {
    return buildRecipient(kind, input.representative.full_name ?? '', {
      street: input.representative.street,
      zip: input.representative.zip,
      city: input.representative.city,
    });
  }

  if (kind === 'cost_carrier' && input.cost_carrier) {
    return buildRecipient(kind, input.cost_carrier.name ?? 'Kostenträger', {
      street: input.cost_carrier.street,
      zip: input.cost_carrier.zip,
      city: input.cost_carrier.city,
    });
  }

  if (kind === 'custom' && input.custom) {
    return buildRecipient(kind, input.custom.full_name ?? '', {
      street: input.custom.street,
      zip: input.custom.zip,
      city: input.custom.city,
    });
  }

  const billing = input.client.billing_address?.trim();
  if (billing) {
    return {
      kind: 'self_payer',
      fullName: input.client.full_name?.trim() ?? '',
      address: billing,
      street: input.client.street?.trim() ?? '',
      zip: input.client.zip?.trim() ?? '',
      city: input.client.city?.trim() ?? '',
    };
  }

  return buildRecipient('self_payer', input.client.full_name ?? '', {
    street: input.client.street,
    zip: input.client.zip,
    city: input.client.city,
  });
}

function resolveRecipientKind(input: InvoiceRecipientInput): InvoiceRecipientKind {
  if (input.kind === 'guardian' || input.representative?.is_invoice_recipient) return 'guardian';
  if (input.kind === 'cost_carrier') return 'cost_carrier';
  if (input.kind === 'custom') return 'custom';
  return 'self_payer';
}

function buildRecipient(
  kind: InvoiceRecipientKind,
  fullName: string,
  parts: { street?: string | null; zip?: string | null; city?: string | null },
): ResolvedRecipient {
  const street = parts.street?.trim() ?? '';
  const zip = parts.zip?.trim() ?? '';
  const city = parts.city?.trim() ?? '';
  return {
    kind,
    fullName: fullName.trim(),
    address: formatDocumentAddress({ street, zip, city }),
    street,
    zip,
    city,
  };
}

/** Wendet aufgelösten Empfänger auf DocumentContext recipient-Section an. */
export function applyRecipientToContext(
  recipient: ResolvedRecipient,
): Record<string, string> {
  return {
    full_name: recipient.fullName,
    address: recipient.address,
    street: recipient.street,
    zip: recipient.zip,
    city: recipient.city,
    kind: recipient.kind,
  };
}
