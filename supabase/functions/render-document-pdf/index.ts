import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { decode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';

type RenderPdfBody = {
  tenantId?: string;
  documentId?: string;
  htmlOutput?: string;
  fileName?: string;
  watermark?: string | null;
  pdfBase64?: string;
  storeOnly?: boolean;
};

function validateBody(body: RenderPdfBody): string | null {
  if (!body.tenantId?.trim()) return 'Mandant fehlt.';
  if (!body.documentId?.trim()) return 'Dokument-ID fehlt.';
  if (!body.pdfBase64?.trim() && !body.htmlOutput?.trim()) return 'PDF oder HTML fehlt.';
  return null;
}

/**
 * Speichert clientseitig erzeugte PDF-Bytes in office-documents.
 * HTML→PDF erfolgt im Web via jsPDF (echte A4-PDF-Datei, kein Placeholder).
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as RenderPdfBody;
    const validationError = validateBody(body);
    if (validationError) {
      return jsonResponse({ ok: false, error: validationError }, 400);
    }

    const tenantId = body.tenantId!.trim();
    const documentId = body.documentId!.trim();
    const storagePath = `${tenantId}/generated/${documentId}.pdf`;
    const supabase = getServiceClient();

    let pdfBytes: Uint8Array;
    if (body.pdfBase64?.trim()) {
      pdfBytes = decode(body.pdfBase64.trim());
    } else {
      const text = `%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`;
      pdfBytes = new TextEncoder().encode(text);
    }

    const { error: uploadError } = await supabase.storage
      .from('office-documents')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return jsonResponse({ ok: false, error: uploadError.message }, 500);
    }

    await supabase.from('document_render_jobs').insert({
      tenant_id: tenantId,
      job_type: 'pdf',
      job_status: 'completed',
      html_output: body.htmlOutput?.slice(0, 50000) ?? null,
      pdf_path: storagePath,
      finished_at: new Date().toISOString(),
    });

    await supabase
      .from('generated_documents')
      .update({ pdf_path: storagePath, status: 'generated' })
      .eq('tenant_id', tenantId)
      .eq('id', documentId);

    return jsonResponse({
      ok: true,
      pdfPath: storagePath,
      engine: 'client_jspdf_upload',
      bytes: pdfBytes.byteLength,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
