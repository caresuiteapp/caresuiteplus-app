import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAiTenantAccess } from '../_shared/aiAuth.ts';
import { corsHeaders, jsonResponse, readClientMeta } from '../_shared/http.ts';

type AiToolRequest = {
  tenant_id?: string;
  session_id?: string;
  tool_name?: string;
  arguments?: Record<string, unknown>;
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

    if (!tenantId || !sessionId || !toolName) {
      return jsonResponse({ ok: false, error: 'tenant_id, session_id and tool_name are required' }, 400);
    }

    const auth = await verifyAiTenantAccess(req, tenantId);
    if (!auth) {
      return jsonResponse({ ok: false, error: 'No tenant access' }, 403);
    }

    const { user, userClient } = auth;
    let result: unknown;

    if (toolName === 'search_caresuite') {
      result = await searchCareSuite(userClient, tenantId, args);
    } else if (toolName === 'create_pending_action') {
      result = await createPendingAction(userClient, tenantId, sessionId, user.id, args);
    } else if (toolName === 'navigate_to_caresuite_location') {
      result = {
        type: 'navigation_instruction',
        module: args.module ?? null,
        route: args.route ?? null,
        entity_type: args.entity_type ?? null,
        entity_id: args.entity_id ?? null,
        document_id: args.document_id ?? null,
        highlight: args.highlight ?? null,
      };
    } else if (toolName === 'generate_long_document_draft') {
      result = await generateLongDocumentDraft(userClient, tenantId, sessionId, user.id, args);
    } else {
      return jsonResponse({ ok: false, error: `Unknown tool: ${toolName}` }, 400);
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

async function searchCareSuite(
  supabase: SupabaseClient,
  tenantId: string,
  args: Record<string, unknown>,
) {
  const query = String(args.query ?? '').trim();
  const limit = Math.min(Number(args.limit ?? 8), 20);

  if (!query) {
    return { query, count: 0, results: [] };
  }

  const results: unknown[] = [];
  const clientSearch = await supabase
    .from('clients')
    .select('id, first_name, last_name, date_of_birth, care_level, street, city, zip, status')
    .eq('tenant_id', tenantId)
    .or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,street.ilike.%${query}%,city.ilike.%${query}%,zip.ilike.%${query}%`,
    )
    .limit(limit);

  if (!clientSearch.error && clientSearch.data) {
    results.push(
      ...clientSearch.data.map((item) => ({
        type: 'client',
        title: `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim(),
        entity_id: item.id,
        data: item,
      })),
    );
  }

  const employeeSearch = await supabase
    .from('employees')
    .select('id, first_name, last_name, email, phone, status, job_title')
    .eq('tenant_id', tenantId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(limit);

  if (!employeeSearch.error && employeeSearch.data) {
    results.push(
      ...employeeSearch.data.map((item) => ({
        type: 'employee',
        title: `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim(),
        entity_id: item.id,
        data: item,
      })),
    );
  }

  const appointmentSearch = await supabase
    .from('appointments')
    .select('id, title, client_name, employee_name, starts_at, ends_at, location, status')
    .eq('tenant_id', tenantId)
    .or(`title.ilike.%${query}%,client_name.ilike.%${query}%,employee_name.ilike.%${query}%`)
    .limit(limit);

  if (!appointmentSearch.error && appointmentSearch.data) {
    results.push(
      ...appointmentSearch.data.map((item) => ({
        type: 'appointment',
        title: item.title,
        entity_id: item.id,
        data: item,
      })),
    );
  }

  const docSearch = await supabase
    .from('document_chunks')
    .select('id, document_id, document_type, title, content, metadata')
    .eq('tenant_id', tenantId)
    .ilike('content', `%${query}%`)
    .limit(limit);

  if (!docSearch.error && docSearch.data) {
    results.push(
      ...docSearch.data.map((item) => ({
        type: 'document_chunk',
        title: item.title,
        document_id: item.document_id,
        content_preview: String(item.content ?? '').slice(0, 900),
        metadata: item.metadata,
      })),
    );
  }

  return {
    query,
    count: results.length,
    results,
  };
}

async function createPendingAction(
  supabase: SupabaseClient,
  tenantId: string,
  sessionId: string,
  userId: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from('ai_pending_actions')
    .insert({
      tenant_id: tenantId,
      session_id: sessionId,
      user_id: userId,
      action_type: args.action_type,
      module: args.module,
      entity_type: args.entity_type ?? null,
      entity_id: args.entity_id ?? null,
      title: args.title,
      description: args.description ?? null,
      payload: args.payload ?? {},
      preview_markdown: args.preview_markdown ?? '',
      risk_level: args.risk_level ?? 'normal',
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  return {
    pending_action_id: data.id,
    status: data.status,
    title: data.title,
    preview_markdown: data.preview_markdown,
    risk_level: data.risk_level,
    description: data.description,
  };
}

async function generateLongDocumentDraft(
  supabase: SupabaseClient,
  tenantId: string,
  sessionId: string,
  userId: string,
  args: Record<string, unknown>,
) {
  const documentType = String(args.document_type ?? 'Dokument');
  const moduleName = String(args.module ?? 'office');
  const entityType = args.entity_type ? String(args.entity_type) : null;
  const entityId = args.entity_id ? String(args.entity_id) : null;

  const preview = `
# ${documentType}

## 1. Stammdaten
Die KI hat einen strukturierten Entwurf vorbereitet. Vor dem Speichern müssen alle Inhalte geprüft werden.

## 2. Sachstand
Hier werden die vorhandenen mandantenbezogenen Daten aus CareSuite+ zusammengeführt.

## 3. Einschätzung
Die Einschätzung wird aus den gespeicherten Angaben, Aufgaben, Dokumentationen und Gesprächsnotizen erstellt.

## 4. Maßnahmen / Planung
Die KI schlägt Maßnahmen vor, speichert diese jedoch nicht automatisch.

## 5. Prüfung
Bitte prüfen, ergänzen und freigeben.
`.trim();

  return await createPendingAction(supabase, tenantId, sessionId, userId, {
    action_type: 'create_document_draft',
    module: moduleName,
    entity_type: entityType,
    entity_id: entityId,
    title: `${documentType} als KI-Entwurf erstellen`,
    description: 'Langer Dokumentenentwurf wurde vorbereitet und wartet auf Prüfung.',
    payload: {
      document_type: documentType,
      module: moduleName,
      entity_type: entityType,
      entity_id: entityId,
      generated_mode: 'chunked_long_document',
      source_args: args,
    },
    preview_markdown: preview,
    risk_level: 'normal',
  });
}
