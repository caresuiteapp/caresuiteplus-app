import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifyAiTenantAccess } from '../_shared/aiAuth.ts';
import { aiErrorResponse, readOpenAiError } from '../_shared/aiErrors.ts';
import {
  AI_SYSTEM_INSTRUCTIONS,
  AI_TOOL_DEFINITIONS,
  toChatCompletionTools,
} from '../_shared/aiToolDefinitions.ts';
import { dispatchAiTool, type AiPageContext } from '../_shared/aiTools.ts';
import { corsHeaders, jsonResponse, readClientMeta } from '../_shared/http.ts';

type TextChatBody = {
  tenant_id?: string;
  session_id?: string | null;
  message?: string;
  current_module?: string | null;
  current_route?: string | null;
  page_context?: AiPageContext;
  resume?: boolean;
};

type ChatToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return aiErrorResponse('Methode nicht erlaubt.', 405);
  }

  try {
    const body = (await req.json()) as TextChatBody;
    const tenantId = body.tenant_id?.trim();
    const message = body.message?.trim();
    const pageContext = body.page_context ?? {};

    if (!tenantId || !message) {
      return aiErrorResponse('Mandanten-ID und Nachricht sind erforderlich.', 400);
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

    await userClient.from('ai_messages').insert({
      tenant_id: tenantId,
      session_id: activeSessionId,
      role: 'user',
      content: message,
      metadata: { source: 'text_chat' },
    });

    const { data: history } = await userClient
      .from('ai_messages')
      .select('role, content')
      .eq('session_id', activeSessionId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(20);

    const instructions = `${AI_SYSTEM_INSTRUCTIONS}

Aktueller Kontext:
- tenant_id: ${tenantId}
- user_id: ${user.id}
- role: ${membership.role}
- current_module: ${body.current_module ?? 'unknown'}
- current_route: ${body.current_route ?? 'unknown'}
- page_context: ${JSON.stringify(pageContext)}
`;

    const messages = [
      { role: 'system', content: instructions },
      ...(history ?? []).map((row) => ({ role: row.role, content: row.content })),
    ];

    const pendingActions: unknown[] = [];
    let navigation: unknown = null;
    let assistantMessage = '';

    for (let step = 0; step < 4; step++) {
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages,
          tools: toChatCompletionTools(AI_TOOL_DEFINITIONS),
          tool_choice: 'auto',
        }),
      });

      if (!completion.ok) {
        const openAiError = await readOpenAiError(completion);
        console.error('[ai-text-chat] OpenAI completion failed:', completion.status, openAiError);
        return aiErrorResponse(openAiError, completion.status === 401 ? 502 : 500);
      }

      const completionData = await completion.json();
      const choice = completionData.choices?.[0]?.message;
      if (!choice) break;

      if (choice.tool_calls?.length) {
        messages.push(choice);

        for (const toolCall of choice.tool_calls as ChatToolCall[]) {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments ?? '{}');
          } catch {
            parsedArgs = {};
          }

          const toolResult = await dispatchAiTool(
            userClient,
            tenantId,
            activeSessionId,
            user.id,
            toolCall.function.name,
            parsedArgs,
            pageContext,
          );

          if (toolResult && typeof toolResult === 'object' && 'pending_action_id' in toolResult) {
            pendingActions.push(toolResult);
          }
          if (
            toolResult &&
            typeof toolResult === 'object' &&
            'type' in toolResult &&
            (toolResult as { type?: string }).type === 'navigation_instruction'
          ) {
            navigation = toolResult;
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });

          const meta = readClientMeta(req);
          await userClient.from('ai_action_logs').insert({
            tenant_id: tenantId,
            session_id: activeSessionId,
            user_id: user.id,
            action_type: toolCall.function.name,
            input_payload: parsedArgs,
            output_payload: toolResult as Record<string, unknown>,
            status: 'success',
            ip_address: meta.ipAddress,
            user_agent: meta.userAgent,
          });
        }

        continue;
      }

      assistantMessage = String(choice.content ?? '').trim();
      break;
    }

    if (!assistantMessage) {
      assistantMessage = pendingActions.length
        ? 'Ich habe einen Entwurf vorbereitet. Bitte prüfe die Freigabe in CareSuite+.'
        : 'Ich konnte keine Antwort erzeugen. Bitte formuliere die Anfrage präziser.';
    }

    await userClient.from('ai_messages').insert({
      tenant_id: tenantId,
      session_id: activeSessionId,
      role: 'assistant',
      content: assistantMessage,
      metadata: {
        pending_actions: pendingActions,
        navigation,
      },
    });

    const lastGoal = message.slice(0, 180);
    const lastStep = pendingActions.length
      ? 'Entwurf vorbereitet — Freigabe ausstehend'
      : 'Antwort geliefert';
    const memorySummary = body.resume
      ? `Fortsetzung: ${lastGoal}`
      : `Letzte Anfrage: ${lastGoal}`;

    await userClient
      .from('ai_sessions')
      .update({
        last_goal: lastGoal,
        last_step: lastStep,
        memory_summary: memorySummary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeSessionId)
      .eq('tenant_id', tenantId);

    return jsonResponse({
      ok: true,
      session_id: activeSessionId,
      assistant_message: assistantMessage,
      pending_actions: pendingActions,
      navigation,
      memory_summary: memorySummary,
      last_goal: lastGoal,
      last_step: lastStep,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return aiErrorResponse(message, 500);
  }
});
