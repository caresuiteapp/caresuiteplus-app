import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifyAiTenantAccess } from '../_shared/aiAuth.ts';
import { dispatchAiTool, type AiPageContext } from '../_shared/aiTools.ts';
import { corsHeaders, jsonResponse, readClientMeta } from '../_shared/http.ts';

type AiToolRequest = {
  tenant_id?: string;
  session_id?: string;
  tool_name?: string;
  arguments?: Record<string, unknown>;
  page_context?: AiPageContext;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as AiToolRequest;
    const tenantId = body.tenant_id?.trim();
    const sessionId = body.session_id?.trim();
    const toolName = body.tool_name?.trim();
    const args = body.arguments ?? {};
    const pageContext = body.page_context ?? {};

    if (!tenantId || !sessionId || !toolName) {
      return jsonResponse(
        { ok: false, error: 'tenant_id, session_id and tool_name are required' },
        400,
      );
    }

    const auth = await verifyAiTenantAccess(req, tenantId);
    if (!auth) {
      return jsonResponse({ ok: false, error: 'No tenant access' }, 403);
    }

    const { user, userClient } = auth;

    let result: unknown;
    try {
      result = await dispatchAiTool(
        userClient,
        tenantId,
        sessionId,
        user.id,
        toolName,
        args,
        pageContext,
      );
    } catch (toolError) {
      const meta = readClientMeta(req);
      await userClient.from('ai_action_logs').insert({
        tenant_id: tenantId,
        session_id: sessionId,
        user_id: user.id,
        action_type: toolName,
        input_payload: args,
        output_payload: {},
        status: 'error',
        error_message: toolError instanceof Error ? toolError.message : 'Unknown tool error',
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      });
      throw toolError;
    }

    const meta = readClientMeta(req);
    await userClient.from('ai_action_logs').insert({
      tenant_id: tenantId,
      session_id: sessionId,
      user_id: user.id,
      action_type: toolName,
      input_payload: args,
      output_payload: result as Record<string, unknown>,
      status: 'success',
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    });

    return jsonResponse({ ok: true, result });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    );
  }
});
