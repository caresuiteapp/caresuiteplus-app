import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildDocumentEmailContent,
  isDocumentEmailConfigured,
  logDocumentDeliveryTimeline,
  resolveDocumentDeliveryEnvConfig,
  sendDocumentEmailViaGenericApi,
  sendDocumentEmailViaResend,
  sendDocumentEmailViaSendGrid,
  verifyCallerTenant,
} from '../_shared/documentDelivery.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';

type EmailBody = {
  tenantId?: string;
  clientId?: string;
  documentId?: string;
  documentTitle?: string;
  recipientEmail?: string;
  subject?: string | null;
  message?: string | null;
  pdfBase64?: string;
  pdfFileName?: string;
  actorName?: string | null;
};

function validateBody(body: EmailBody): string | null {
  if (!body.tenantId?.trim()) return 'Mandant fehlt.';
  if (!body.clientId?.trim()) return 'Klient fehlt.';
  if (!body.documentId?.trim()) return 'Dokument-ID fehlt.';
  if (!body.documentTitle?.trim()) return 'Dokumenttitel fehlt.';
  if (!body.recipientEmail?.trim() || !body.recipientEmail.includes('@')) {
    return 'Empfänger-E-Mail fehlt oder ist ungültig.';
  }
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
    const body = (await req.json()) as EmailBody;
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
      RESEND_API_KEY: Deno.env.get('RESEND_API_KEY') ?? undefined,
      SENDGRID_API_KEY: Deno.env.get('SENDGRID_API_KEY') ?? undefined,
      DOCUMENT_EMAIL_FROM: Deno.env.get('DOCUMENT_EMAIL_FROM') ?? undefined,
      DSGVO_NOTIFY_FROM_EMAIL: Deno.env.get('DSGVO_NOTIFY_FROM_EMAIL') ?? undefined,
      DOCUMENT_EMAIL_API_URL: Deno.env.get('DOCUMENT_EMAIL_API_URL') ?? undefined,
    });

    if (!isDocumentEmailConfigured(config)) {
      return jsonResponse({
        ok: true,
        configured: false,
        message: 'E-Mail-Versand ist noch nicht konfiguriert.',
      });
    }

    const recipientEmail = body.recipientEmail!.trim().toLowerCase();
    const documentTitle = body.documentTitle!.trim();
    const emailContent = buildDocumentEmailContent({
      documentTitle,
      message: body.message,
    });
    const subject = body.subject?.trim() || emailContent.subject;

    let sendResult: { ok: boolean; error?: string };

    if (config.genericEmailApiUrl) {
      sendResult = await sendDocumentEmailViaGenericApi({
        apiUrl: config.genericEmailApiUrl,
        to: recipientEmail,
        subject,
        message: emailContent.text,
        pdfBase64: body.pdfBase64!.trim(),
        pdfFileName: body.pdfFileName!.trim(),
      });
    } else if (config.resendApiKey && config.emailFrom) {
      sendResult = await sendDocumentEmailViaResend({
        apiKey: config.resendApiKey,
        from: config.emailFrom,
        to: recipientEmail,
        subject,
        text: emailContent.text,
        html: emailContent.html,
        pdfBase64: body.pdfBase64!.trim(),
        pdfFileName: body.pdfFileName!.trim(),
      });
    } else if (config.sendgridApiKey && config.emailFrom) {
      sendResult = await sendDocumentEmailViaSendGrid({
        apiKey: config.sendgridApiKey,
        from: config.emailFrom,
        to: recipientEmail,
        subject,
        text: emailContent.text,
        html: emailContent.html,
        pdfBase64: body.pdfBase64!.trim(),
        pdfFileName: body.pdfFileName!.trim(),
      });
    } else {
      return jsonResponse({
        ok: true,
        configured: false,
        message: 'E-Mail-Versand ist noch nicht konfiguriert.',
      });
    }

    if (!sendResult.ok) {
      return jsonResponse(
        {
          ok: false,
          configured: true,
          error: sendResult.error ?? 'E-Mail-Versand fehlgeschlagen.',
        },
        502,
      );
    }

    const service = getServiceClient();
    await logDocumentDeliveryTimeline(service, {
      tenantId,
      clientId: body.clientId!.trim(),
      channel: 'email',
      documentTitle,
      recipient: recipientEmail,
      actorName: body.actorName,
    });

    return jsonResponse({
      ok: true,
      configured: true,
      message: `Dokument „${documentTitle}“ wurde per E-Mail an ${recipientEmail} gesendet.`,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
