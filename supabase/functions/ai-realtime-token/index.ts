import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifyAiTenantAccess } from '../_shared/aiAuth.ts';
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
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as RealtimeTokenBody;
    const tenantId = body.tenant_id?.trim();

    if (!tenantId) {
      return jsonResponse({ ok: false, error: 'tenant_id is required' }, 400);
    }

    const auth = await verifyAiTenantAccess(req, tenantId);
    if (!auth) {
      return jsonResponse({ ok: false, error: 'No tenant access' }, 403);
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!openaiKey) {
      return jsonResponse({ ok: false, error: 'OPENAI_API_KEY not configured' }, 503);
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
        return jsonResponse({ ok: false, error: createError.message }, 500);
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

    const instructions = `
Du bist die CareSuite+ KI innerhalb einer mandantenfähigen Pflege-, Assistenz-, Beratungs-, Office- und Akademie-Software.

Identität:
- Du bist ein professioneller digitaler Arbeitsassistent für CareSuite+.
- Du sprichst klar, freundlich, verbindlich und fachlich.
- Du arbeitest mandantenbezogen.
- Du beantwortest allgemeine Fragen, darfst aber interne Daten nur über bereitgestellte Tools abrufen.
- Du fragst nach, wenn Pflichtdaten fehlen.
- Du führst Nutzer:innen dialogisch durch komplexe Aufgaben.

Harte Regeln:
- Zeige, suche und verarbeite ausschließlich Daten des aktiven Mandanten.
- Erfinde keine Klient:innen, Mitarbeitende, Kostenträger, Zeiten, Preise oder Dokumenteninhalte.
- Schreibe niemals direkt in Live-Daten.
- Jede Änderung wird zuerst als prüfbarer Entwurf über create_pending_action vorbereitet.
- Speichern, Versenden, Löschen, Dienstplanänderungen, Akteneinträge und Dokumentenerstellung benötigen ausdrückliche Nutzerfreigabe.
- Bei Unsicherheit stellst du Rückfragen.
- Bei rechtlichen, medizinischen oder pflegerischen Aussagen formulierst du vorsichtig und verweist auf interne Prüfung/Fachfreigabe.
- Nutze vorhandene Aufgaben, Leistungen, Preise, Budgets, Stammdaten und Vorlagen des Mandanten.

Aktueller Kontext:
- tenant_id: ${tenantId}
- user_id: ${user.id}
- role: ${membership.role}
- current_module: ${body.current_module ?? 'unknown'}
- current_route: ${body.current_route ?? 'unknown'}
- ai_session_id: ${activeSessionId}

Arbeitsweise:
1. Nutzerwunsch verstehen.
2. Relevante Daten über Tools suchen.
3. Fehlende Pflichtangaben aktiv erfragen.
4. Entwurf/Vorschau erstellen.
5. Vor Speicherung eine pending_action erzeugen.
6. Erst nach Nutzerfreigabe darf commit_approved_action ausgeführt werden.
`.trim();

    const realtimeResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': `${tenantId}:${user.id}`,
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: 'gpt-realtime',
          instructions,
          audio: {
            output: {
              voice: 'marin',
            },
          },
          tools: [
            {
              type: 'function',
              name: 'search_caresuite',
              description:
                'Search tenant-scoped CareSuite+ data across clients, employees, documents, schedules, tasks, invoices, protocols and templates.',
              parameters: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  module: { type: 'string' },
                  entity_types: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  limit: { type: 'number' },
                },
                required: ['query'],
              },
            },
            {
              type: 'function',
              name: 'create_pending_action',
              description: 'Create a tenant-scoped action draft that requires user review before saving.',
              parameters: {
                type: 'object',
                properties: {
                  action_type: { type: 'string' },
                  module: { type: 'string' },
                  entity_type: { type: 'string' },
                  entity_id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  payload: { type: 'object' },
                  preview_markdown: { type: 'string' },
                  risk_level: {
                    type: 'string',
                    enum: ['low', 'normal', 'high', 'critical'],
                  },
                },
                required: ['action_type', 'module', 'title', 'payload', 'preview_markdown'],
              },
            },
            {
              type: 'function',
              name: 'navigate_to_caresuite_location',
              description:
                'Navigate the app to a specific module, page, entity, document preview or highlighted section.',
              parameters: {
                type: 'object',
                properties: {
                  module: { type: 'string' },
                  route: { type: 'string' },
                  entity_type: { type: 'string' },
                  entity_id: { type: 'string' },
                  document_id: { type: 'string' },
                  highlight: { type: 'string' },
                },
                required: ['module', 'route'],
              },
            },
            {
              type: 'function',
              name: 'generate_long_document_draft',
              description:
                'Generate long structured CareSuite+ documents such as Aufnahmeprotokoll, Pflege-/Betreuungsdokumentation, Beratungsbericht, Vertrag, Leistungsnachweis or QM document.',
              parameters: {
                type: 'object',
                properties: {
                  document_type: { type: 'string' },
                  module: { type: 'string' },
                  entity_type: { type: 'string' },
                  entity_id: { type: 'string' },
                  target_length: { type: 'string' },
                  required_sections: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  source_data_query: { type: 'string' },
                  style: { type: 'string' },
                },
                required: ['document_type', 'module'],
              },
            },
          ],
          tool_choice: 'auto',
        },
      }),
    });

    if (!realtimeResponse.ok) {
      const errorText = await realtimeResponse.text();
      return jsonResponse({ ok: false, error: errorText }, 500);
    }

    const realtimeData = await realtimeResponse.json();

    return jsonResponse({
      ok: true,
      session_id: activeSessionId,
      realtime: realtimeData,
    });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    );
  }
});
