import type { ServiceResult } from '@/types';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import { getServiceMode } from '@/lib/services/mode';
import { prepareDocumentPdf } from './documentPdfService';
import {
  DOCUMENT_EMAIL_NOT_CONFIGURED_MESSAGE,
  DOCUMENT_FAX_NOT_CONFIGURED_MESSAGE,
  isDocumentDeliveryBackendAvailable,
  isValidEmailAddress,
  normalizeGermanFaxNumber,
} from './documentDeliveryConfig';

export const SEND_DOCUMENT_EMAIL_FUNCTION = 'send-document-email';
export const SEND_DOCUMENT_FAX_FUNCTION = 'send-document-fax';

export type DocumentDeliveryResult = {
  configured: boolean;
  message: string;
};

type EdgeDeliveryResponse = {
  configured?: boolean;
  message?: string;
};

export async function sendDocumentViaEmail(input: {
  tenantId: string;
  clientId: string;
  doc: ClientDocumentRecord;
  recipientEmail: string;
  subject?: string;
  message?: string;
  clientLastName?: string | null;
  actorName?: string | null;
}): Promise<ServiceResult<DocumentDeliveryResult>> {
  if (!isValidEmailAddress(input.recipientEmail)) {
    return { ok: false, error: 'Bitte eine gültige E-Mail-Adresse eingeben.' };
  }

  const pdf = await prepareDocumentPdf({
    doc: input.doc,
    clientLastName: input.clientLastName,
  });
  if (!pdf.ok) return pdf;

  if (!isDocumentDeliveryBackendAvailable()) {
    return {
      ok: true,
      data: {
        configured: false,
        message: 'E-Mail-Versand im Demo-Modus simuliert — Live erfordert Supabase Edge Function.',
      },
    };
  }

  const invoke = await invokeEdgeFunction<EdgeDeliveryResponse>(SEND_DOCUMENT_EMAIL_FUNCTION, {
    tenantId: input.tenantId,
    clientId: input.clientId,
    documentId: input.doc.id,
    documentTitle: input.doc.title,
    recipientEmail: input.recipientEmail.trim(),
    subject: input.subject?.trim() || null,
    message: input.message?.trim() || null,
    pdfBase64: pdf.data.base64,
    pdfFileName: pdf.data.fileName,
    actorName: input.actorName ?? null,
  });

  if (!invoke.ok) {
    return { ok: false, error: invoke.error };
  }

  const configured = invoke.data.configured !== false;
  return {
    ok: true,
    data: {
      configured,
      message:
        invoke.data.message
        ?? (configured ? 'E-Mail wurde versendet.' : DOCUMENT_EMAIL_NOT_CONFIGURED_MESSAGE),
    },
  };
}

export async function sendDocumentViaFax(input: {
  tenantId: string;
  clientId: string;
  doc: ClientDocumentRecord;
  faxNumber: string;
  clientLastName?: string | null;
  actorName?: string | null;
}): Promise<ServiceResult<DocumentDeliveryResult>> {
  const normalizedFax = normalizeGermanFaxNumber(input.faxNumber);
  if (!normalizedFax) {
    return {
      ok: false,
      error: 'Bitte eine gültige deutsche Faxnummer eingeben (z. B. 02323 123456 oder +49 …).',
    };
  }

  const pdf = await prepareDocumentPdf({
    doc: input.doc,
    clientLastName: input.clientLastName,
  });
  if (!pdf.ok) return pdf;

  if (!isDocumentDeliveryBackendAvailable()) {
    return {
      ok: true,
      data: {
        configured: false,
        message: 'Fax-Versand im Demo-Modus simuliert — Live erfordert Supabase Edge Function.',
      },
    };
  }

  const invoke = await invokeEdgeFunction<EdgeDeliveryResponse>(SEND_DOCUMENT_FAX_FUNCTION, {
    tenantId: input.tenantId,
    clientId: input.clientId,
    documentId: input.doc.id,
    documentTitle: input.doc.title,
    faxNumber: normalizedFax,
    pdfBase64: pdf.data.base64,
    pdfFileName: pdf.data.fileName,
    actorName: input.actorName ?? null,
  });

  if (!invoke.ok) {
    return { ok: false, error: invoke.error };
  }

  const configured = invoke.data.configured !== false;
  return {
    ok: true,
    data: {
      configured,
      message:
        invoke.data.message
        ?? (configured ? 'Fax wurde versendet.' : DOCUMENT_FAX_NOT_CONFIGURED_MESSAGE),
    },
  };
}

export function resolveDocumentDeliveryDemoHint(channel: 'email' | 'fax'): string | null {
  if (getServiceMode() === 'supabase') return null;
  return channel === 'email'
    ? 'Im Demo-Modus wird kein E-Mail-Versand ausgeführt.'
    : 'Im Demo-Modus wird kein Fax-Versand ausgeführt.';
}
