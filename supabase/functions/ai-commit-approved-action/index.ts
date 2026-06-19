import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAiTenantAccess } from '../_shared/aiAuth.ts';
import { corsHeaders, jsonResponse, readClientMeta } from '../_shared/http.ts';

type CommitBody = {
  tenant_id?: string;
  pending_action_id?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as CommitBody;
    const tenantId = body.tenant_id?.trim();
    const pendingActionId = body.pending_action_id?.trim();

    if (!tenantId || !pendingActionId) {
      return jsonResponse({ ok: false, error: 'tenant_id and pending_action_id are required' }, 400);
    }

    const auth = await verifyAiTenantAccess(req, tenantId);
    if (!auth) {
      return jsonResponse({ ok: false, error: 'No tenant access' }, 403);
    }

    const { user, userClient } = auth;

    const { data: action, error } = await userClient
      .from('ai_pending_actions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', pendingActionId)
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .single();

    if (error || !action) {
      return jsonResponse({ ok: false, error: 'Approved pending action not found' }, 404);
    }

    let commitResult: unknown;

    switch (action.action_type) {
      case 'create_schedule_entry':
        commitResult = await createScheduleEntry(userClient, tenantId, action.payload);
        break;
      case 'create_document_draft':
        commitResult = await createDocument(
          userClient,
          tenantId,
          user.id,
          action.payload,
          action.preview_markdown,
        );
        break;
      case 'create_protocol':
        commitResult = await createProtocol(userClient, tenantId, user.id, action.payload);
        break;
      default:
        return jsonResponse(
          { ok: false, error: `Unsupported commit type: ${action.action_type}` },
          400,
        );
    }

    await userClient
      .from('ai_pending_actions')
      .update({
        status: 'committed',
        committed_at: new Date().toISOString(),
      })
      .eq('id', pendingActionId)
      .eq('tenant_id', tenantId);

    const meta = readClientMeta(req);
    await userClient.from('ai_action_logs').insert({
      tenant_id: tenantId,
      session_id: action.session_id,
      user_id: user.id,
      pending_action_id: pendingActionId,
      action_type: `commit:${action.action_type}`,
      input_payload: action.payload,
      output_payload: commitResult as Record<string, unknown>,
      status: 'committed',
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    });

    return jsonResponse({ ok: true, result: commitResult });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    );
  }
});

async function createScheduleEntry(
  supabase: SupabaseClient,
  tenantId: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      title: String(payload.title ?? 'KI-Dienstplan'),
      client_name: payload.client_name ?? null,
      employee_name: payload.employee_name ?? null,
      starts_at: payload.starts_at ?? null,
      ends_at: payload.ends_at ?? null,
      notes: payload.notes ?? null,
      status: 'entwurf',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function createDocument(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  payload: Record<string, unknown>,
  previewMarkdown: string | null,
) {
  const documentType = String(payload.document_type ?? 'generic');
  const title = String(payload.title ?? documentType);

  const { data, error } = await supabase
    .from('generated_documents')
    .insert({
      tenant_id: tenantId,
      document_type: 'generic',
      title,
      status: 'draft',
      client_id: payload.entity_id ?? payload.client_id ?? null,
      created_by: userId,
      metadata_json: {
        source: 'ai_approved',
        document_type_label: documentType,
        content_markdown: previewMarkdown ?? '',
        payload,
      },
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function createProtocol(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  payload: Record<string, unknown>,
) {
  const clientId = payload.client_id ?? payload.entity_id;
  if (!clientId) {
    throw new Error('client_id fehlt für Protokoll.');
  }

  const { data, error } = await supabase
    .from('client_notes')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      content: String(payload.content ?? payload.preview ?? 'KI-Protokoll'),
      category: String(payload.protocol_type ?? 'allgemein'),
      is_internal: true,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}
