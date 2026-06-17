import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  isDocumentFaxConfigured,
  logDocumentDeliveryTimeline,
  resolveDocumentDeliveryEnvConfig,
  sendDocumentFaxViaGenericApi,
  verifyCallerTenant,
} from '../_shared/documentDelivery.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';

type FaxBody = {
  tenantId?: string;
  clientId?: string;
  documentId?: string;
  documentTitle?: string;
  faxNumber?: string;
  pdfBase64?: string;
  pdfFileName?: string;
  actorName?: string | null;
};

function validateBody(body: FaxBody): string | null {
  if (!body.tenantId?.trim()) return 'Mandant fehlt.';
  if (!body.clientId?.trim()) return 'Klient fehlt.';
  if (!body.documentId?.trim()) return 'Dokument-ID fehlt.';
  if (!body.documentTitle?.trim()) return 'Dokumenttitel fehlt.';
  if (!body.faxNumber?.trim()) return 'Faxnummer fehlt.';
  if (!body.pdfBase64?.trim()) return 'PDF-Anhang fehlt.';
  if (!body.pdfFileName?.trim()) return 'PDF-Dateiname fehlt.';
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as FaxBody;
    const validationError = validateBody(body);
    if (validationError) {
      return jsonResponse({ ok: false, error: validationError }, 400);
    }

    const tenantId = body.tenantId!.trim();
    const authorized = await verifyCallerTenant(req, tenantId);
    if (!authorized) {
      return jsonResponse({ ok: false, error: 'Nicht autorisiert für diesen Mandanten.' }, 403);
    }

    const config = resolveDocumentDeliveryEnvConfig({
      DOCUMENT_FAX_API_URL: Deno.env.get('DOCUMENT_FAX_API_URL') ?? undefined,
      DOCUMENT_FAX_API_KEY: Deno.env.get('DOCUMENT_FAX_API_KEY') ?? undefined,
    });

    if (!isDocumentFaxConfigured(config)) {
      return jsonResponse({
        ok: true,
        configured: false,
        message: 'Fax-Versand ist noch nicht konfiguriert.',
      });
    }

    const faxNumber = body.faxNumber!.trim();
    const documentTitle = body.documentTitle!.trim();

    const sendResult = await sendDocumentFaxViaGenericApi({
      apiUrl: config.genericFaxApiUrl!,
      apiKey: config.genericFaxApiKey,
      faxNumber,
      pdfBase64: body.pdfBase64!.trim(),
      pdfFileName: body.pdfFileName!.trim(),
      documentTitle,
    });

    if (!sendResult.ok) {
      return jsonResponse(
        {
          ok: false,
          configured: true,
          error: sendResult.error ?? 'Fax-Versand fehlgeschlagen.',
        },
        502,
      );
    }

    const service = getServiceClient();
    await logDocumentDeliveryTimeline(service, {
      tenantId,
      clientId: body.clientId!.trim(),
      channel: 'fax',
      documentTitle,
      recipient: faxNumber,
      actorName: body.actorName,
    });

    return jsonResponse({
      ok: true,
      configured: true,
      message: `Dokument „${documentTitle}“ wurde per Fax an ${faxNumber} gesendet.`,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
