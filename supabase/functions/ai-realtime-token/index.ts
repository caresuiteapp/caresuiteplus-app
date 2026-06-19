import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifyAiTenantAccess } from '../_shared/aiAuth.ts';
import { aiErrorResponse, readOpenAiError } from '../_shared/aiErrors.ts';
import { openAiSafetyIdentifier } from '../_shared/crypto.ts';
import {
  AI_SYSTEM_INSTRUCTIONS,
  AI_TOOL_DEFINITIONS,
  normalizeRealtimeTools,
} from '../_shared/aiToolDefinitions.ts';
import { corsHeaders, jsonResponse } from '../_shared/http.ts';

type RealtimeTokenBody = {
  tenant_id?: string;
  session_id?: string | null;
  current_module?: string | null;
  current_route?: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return aiErrorResponse('Methode nicht erlaubt.', 405);
  }

  try {
    const body = (await req.json()) as RealtimeTokenBody;
    const tenantId = body.tenant_id?.trim();

    if (!tenantId) {
      return aiErrorResponse('Mandanten-ID fehlt.', 400);
    }

    const auth = await verifyAiTenantAccess(req, tenantId);
    if (!auth) {
      return aiErrorResponse('Kein Zugriff auf den Mandanten für die KI-Funktionen.', 403);
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!openaiKey) {
      return aiErrorResponse('OPENAI_API_KEY not configured', 503);
    }

    const { user, membership, userClient } = auth;
    let activeSessionId = body.session_id?.trim() || null;

    if (!activeSessionId) {
      const { data: createdSession, error: createError } = await userClient
        .from('ai_sessions')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          title: 'CareSuite+ KI Gespräch',
          current_module: body.current_module ?? null,
          current_route: body.current_route ?? null,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('[ai-realtime-token] session insert failed:', createError.message);
        return aiErrorResponse(createError.message, 500);
      }

      activeSessionId = createdSession.id;
    } else {
      await userClient
        .from('ai_sessions')
        .update({
          current_module: body.current_module ?? null,
          current_route: body.current_route ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeSessionId)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);
    }

    const instructions = `${AI_SYSTEM_INSTRUCTIONS}

Aktueller Kontext:
- tenant_id: ${tenantId}
- user_id: ${user.id}
- role: ${membership.role}
- current_module: ${body.current_module ?? 'unknown'}
- current_route: ${body.current_route ?? 'unknown'}
- ai_session_id: ${activeSessionId}
`.trim();

    const realtimeTools = normalizeRealtimeTools(AI_TOOL_DEFINITIONS);

    const buildSessionBody = (includeTools: boolean) => ({
      session: {
        type: 'realtime',
        model: 'gpt-realtime',
        instructions,
        audio: {
          output: {
            voice: 'marin',
          },
        },
        ...(includeTools
          ? {
              tools: realtimeTools,
              tool_choice: 'auto',
            }
          : {}),
      },
    });

    const safetyIdentifier = await openAiSafetyIdentifier(tenantId, user.id);

    const requestClientSecret = (includeTools: boolean) =>
      fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Safety-Identifier': safetyIdentifier,
        },
        body: JSON.stringify(buildSessionBody(includeTools)),
      });

    let realtimeResponse = await requestClientSecret(true);

    if (!realtimeResponse.ok) {
      const firstError = await readOpenAiError(realtimeResponse);
      const shouldRetryWithoutTools =
        /invalid schema|invalid tools|tool|parameters|json schema/i.test(firstError);

      if (shouldRetryWithoutTools) {
        console.warn(
          '[ai-realtime-token] Retrying client_secrets without tools after:',
          firstError,
        );
        realtimeResponse = await requestClientSecret(false);
      }

      if (!realtimeResponse.ok) {
        const openAiError = shouldRetryWithoutTools
          ? await readOpenAiError(realtimeResponse)
          : firstError;
        console.error(
          '[ai-realtime-token] OpenAI client_secrets failed:',
          realtimeResponse.status,
          openAiError,
        );
        return aiErrorResponse(openAiError, realtimeResponse.status === 401 ? 502 : 500);
      }
    }

    const realtimeData = await realtimeResponse.json();

    return jsonResponse({
      ok: true,
      session_id: activeSessionId,
      realtime: realtimeData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('[ai-realtime-token] unexpected error:', message);
    return aiErrorResponse(message, 500);
  }
});
