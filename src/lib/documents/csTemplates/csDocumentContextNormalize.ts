import type { DocumentContext } from '@/types/documents/csTemplateDatabase';

/** Normalisiert Kontext + Alias-Keys für Phase-2-Platzhalter. */
export function normalizeDocumentContext(context: DocumentContext): DocumentContext {
  const tenant = { ...context.tenant };
  tenant.display_name = tenant.display_name || tenant.trade_name || tenant.legal_name || '';
  tenant.address = tenant.address || tenant.address_full || '';
  tenant.tax_id = tenant.tax_id || tenant.vat_id || '';

  const employee = context.employee
    ? {
        ...context.employee,
        role: context.employee.role || context.employee.job_title || '',
        entry_date: context.employee.entry_date || context.employee.start_date || '',
      }
    : undefined;

  const client = context.client
    ? {
        ...context.client,
        address: context.client.address || context.client.address_full || '',
        payor_name: context.client.payor_name || context.client.insurance_name || '',
      }
    : undefined;

  const document = {
    ...context.document,
    type: context.document.type || context.document.document_type || '',
    created_at: context.document.created_at || context.document.date || '',
    sender_name:
      context.document.sender_name
      || context.office?.full_name
      || tenant.legal_name
      || '',
  };

  return {
    ...context,
    tenant,
    employee,
    client,
    document,
  };
}
