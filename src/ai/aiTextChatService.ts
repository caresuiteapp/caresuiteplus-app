import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import { getRegisteredPageContext } from './registerAiPageContext';
import type { AiDispatchResult, AiTextChatResponse } from './aiToolTypes';
import { useAiStore } from './useAiStore';

export async function dispatchAiTool(
  tenantId: string,
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<AiDispatchResult> {
  const pageContext = getRegisteredPageContext();
  return invokeEdgeFunction<AiDispatchResult>('ai-action-dispatch', {
    tenant_id: tenantId,
    session_id: sessionId,
    tool_name: toolName,
    arguments: args,
    page_context: pageContext,
  }).then((res) => {
    if (!res.ok) return { ok: false, error: res.error };
    return res.data ?? { ok: true };
  });
}

export async function sendAiTextMessage(params: {
  tenantId: string;
  sessionId: string | null;
  message: string;
  currentModule: string;
  currentRoute: string;
  resume?: boolean;
}): Promise<{ ok: true; data: AiTextChatResponse } | { ok: false; error: string }> {
  const pageContext = getRegisteredPageContext();
  const result = await invokeEdgeFunction<AiTextChatResponse>('ai-text-chat', {
    tenant_id: params.tenantId,
    session_id: params.sessionId,
    message: params.message,
    current_module: params.currentModule,
    current_route: params.currentRoute,
    page_context: pageContext,
    resume: params.resume ?? false,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, data: result.data };
}

export async function loadAiSessionMessages(sessionId: string, tenantId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: session } = await fromUnknownTable(supabase, 'ai_sessions')
    .select('last_goal, last_step, memory_summary')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (session) {
    const row = session as {
      last_goal?: string | null;
      last_step?: string | null;
      memory_summary?: string | null;
    };
    useAiStore.getState().setProgress(row.last_goal ?? '', row.last_step ?? '');
    useAiStore.getState().setMemorySummary(row.memory_summary ?? null);
  }

  const { data: messages } = await fromUnknownTable(supabase, 'ai_messages')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(40);

  if (messages) {
    useAiStore.getState().setMessages(
      (messages as Array<{ id: string; role: string; content: string; created_at: string }>).map(
        (row) => ({
          id: row.id,
          role: row.role as 'user' | 'assistant' | 'tool' | 'system',
          content: row.content,
          createdAt: row.created_at,
        }),
      ),
    );
  }
}

export async function ensureAiSession(params: {
  tenantId: string;
  sessionId: string | null;
  currentModule: string;
  currentRoute: string;
}): Promise<string | null> {
  if (params.sessionId) return params.sessionId;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const { data, error } = await fromUnknownTable(supabase, 'ai_sessions')
    .insert({
      tenant_id: params.tenantId,
      user_id: userId,
      title: 'CareSuite+ KI Gespräch',
      current_module: params.currentModule,
      current_route: params.currentRoute,
    })
    .select('id')
    .single();

  if (error || !data) return null;
  const sessionId = (data as { id: string }).id;
  useAiStore.getState().setSessionId(sessionId);
  return sessionId;
}
