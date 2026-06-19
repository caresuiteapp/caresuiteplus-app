import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveEntityRoute, resolveModuleHomeRoute } from './aiEntityRoutes.ts';

export type AiPageContext = {
  pageTitle?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  activeTab?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  currentModule?: string;
  currentRoute?: string;
};

export const ADMISSION_PROTOCOL_SECTIONS = [
  '1. Aufnahme-Grunddaten',
  '2. Anlass der Aufnahme',
  '3. Stammdaten',
  '4. Kontakt & Adresse',
  '5. Angehörige & Bezugspersonen',
  '6. Notfallkontakt',
  '7. Versicherung & Kostenträger',
  '8. Pflegegrad & MD',
  '9. Medizinische Vorgeschichte',
  '10. Aktuelle Diagnosen',
  '11. Medikation',
  '12. Allergien & Unverträglichkeiten',
  '13. Mobilität & ADL',
  '14. Ernährung & Flüssigkeit',
  '15. Kognition & Kommunikation',
  '16. Psychosoziale Situation',
  '17. Wohn- & Lebenssituation',
  '18. Unterstützungsbedarf',
  '19. Risiken & Sicherheit',
  '20. Schlüssel & Zugang',
  '21. Verträge & Einwilligungen',
  '22. Dokumente & Nachweise',
  '23. Erstes Pflege-/Betreuungskonzept',
  '24. Zusammenfassung & Freigabe',
] as const;

const REQUIRED_CLIENT_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'street',
  'zip',
  'city',
  'phone',
] as const;

export async function dispatchAiTool(
  supabase: SupabaseClient,
  tenantId: string,
  sessionId: string,
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
  pageContext: AiPageContext = {},
): Promise<unknown> {
  switch (toolName) {
    case 'search_caresuite':
      return searchCareSuite(supabase, tenantId, args);
    case 'get_current_page_context':
      return getCurrentPageContext(pageContext);
    case 'get_client_details':
      return getClientDetails(supabase, tenantId, args);
    case 'get_employee_details':
      return getEmployeeDetails(supabase, tenantId, args);
    case 'get_client_tasks':
      return getClientTasks(supabase, tenantId, args);
    case 'get_schedule_conflicts':
      return getScheduleConflicts(supabase, tenantId, args);
    case 'create_schedule_pending_action':
      return createSchedulePendingAction(supabase, tenantId, sessionId, userId, args);
    case 'create_admission_protocol_pending_action':
      return createAdmissionProtocolPendingAction(supabase, tenantId, sessionId, userId, args);
    case 'search_documents':
      return searchDocuments(supabase, tenantId, args);
    case 'open_document_preview':
      return openDocumentPreview(tenantId, args);
    case 'summarize_client_case':
      return summarizeClientCase(supabase, tenantId, args);
    case 'create_document_draft_pending_action':
    case 'generate_long_document_draft':
      return createDocumentDraftPendingAction(supabase, tenantId, sessionId, userId, args);
    case 'create_care_note_pending_action':
      return createCareNotePendingAction(supabase, tenantId, sessionId, userId, args);
    case 'navigate_to_module':
    case 'navigate_to_caresuite_location':
      return navigateToModule(tenantId, args);
    case 'ask_missing_required_fields':
      return askMissingRequiredFields(supabase, tenantId, args);
    case 'approve_pending_action':
      return {
        ui_only: true,
        message: 'Freigabe erfolgt über das Entwurfs-Panel in der App.',
      };
    case 'create_pending_action':
      return createPendingAction(supabase, tenantId, sessionId, userId, args);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

function getCurrentPageContext(pageContext: AiPageContext) {
  return {
    ...pageContext,
    captured_at: new Date().toISOString(),
  };
}

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

  return { query, count: results.length, results };
}

async function getClientDetails(
  supabase: SupabaseClient,
  tenantId: string,
  args: Record<string, unknown>,
) {
  const clientId = String(args.client_id ?? args.entity_id ?? '').trim();
  if (!clientId) throw new Error('client_id is required');

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
    .single();

  if (error || !client) throw new Error('Klient nicht gefunden');

  const [contacts, notes, tasks] = await Promise.all([
    supabase.from('client_contacts').select('*').eq('tenant_id', tenantId).eq('client_id', clientId),
    supabase.from('client_notes').select('*').eq('tenant_id', tenantId).eq('client_id', clientId).limit(10),
    supabase.from('client_tasks').select('*').eq('tenant_id', tenantId).eq('client_id', clientId).limit(20),
  ]);

  return {
    client,
    contacts: contacts.data ?? [],
    recent_notes: notes.data ?? [],
    open_tasks: tasks.data ?? [],
  };
}

async function getEmployeeDetails(
  supabase: SupabaseClient,
  tenantId: string,
  args: Record<string, unknown>,
) {
  const employeeId = String(args.employee_id ?? args.entity_id ?? '').trim();
  if (!employeeId) throw new Error('employee_id is required');

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .single();

  if (error || !data) throw new Error('Mitarbeiter nicht gefunden');
  return { employee: data };
}

async function getClientTasks(
  supabase: SupabaseClient,
  tenantId: string,
  args: Record<string, unknown>,
) {
  const clientId = String(args.client_id ?? args.entity_id ?? '').trim();
  if (!clientId) throw new Error('client_id is required');

  const status = args.status ? String(args.status) : null;
  let query = supabase
    .from('client_tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('due_date', { ascending: true })
    .limit(50);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { client_id: clientId, count: data?.length ?? 0, tasks: data ?? [] };
}

async function getScheduleConflicts(
  supabase: SupabaseClient,
  tenantId: string,
  args: Record<string, unknown>,
) {
  const startsAt = String(args.starts_at ?? '').trim();
  const endsAt = String(args.ends_at ?? '').trim();
  const employeeId = args.employee_id ? String(args.employee_id) : null;
  const clientId = args.client_id ? String(args.client_id) : null;

  if (!startsAt || !endsAt) throw new Error('starts_at and ends_at are required');

  let query = supabase
    .from('appointments')
    .select('id, title, client_name, employee_name, starts_at, ends_at, status')
    .eq('tenant_id', tenantId)
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const conflicts = (data ?? []).filter((row) => {
    const haystack = `${row.client_name ?? ''} ${row.employee_name ?? ''}`.toLowerCase();
    if (employeeId && !haystack.includes(employeeId.toLowerCase())) return false;
    if (clientId && !haystack.includes(clientId.toLowerCase())) return false;
    return true;
  });

  return {
    starts_at: startsAt,
    ends_at: endsAt,
    conflict_count: conflicts.length,
    conflicts,
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

async function createSchedulePendingAction(
  supabase: SupabaseClient,
  tenantId: string,
  sessionId: string,
  userId: string,
  args: Record<string, unknown>,
) {
  const clientId = args.client_id ? String(args.client_id) : null;
  const employeeId = args.employee_id ? String(args.employee_id) : null;
  const startsAt = String(args.starts_at ?? '').trim();
  const endsAt = String(args.ends_at ?? '').trim();
  const title = String(args.title ?? 'Dienstplan-Eintrag').trim();
  const tasks = Array.isArray(args.tasks) ? args.tasks : [];

  if (!startsAt || !endsAt) throw new Error('starts_at and ends_at sind Pflichtfelder');

  let clientName = args.client_name ? String(args.client_name) : null;
  let employeeName = args.employee_name ? String(args.employee_name) : null;

  if (clientId) {
    const { data } = await supabase
      .from('clients')
      .select('first_name, last_name')
      .eq('tenant_id', tenantId)
      .eq('id', clientId)
      .maybeSingle();
    if (data) clientName = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim();
  }

  if (employeeId) {
    const { data } = await supabase
      .from('employees')
      .select('first_name, last_name')
      .eq('tenant_id', tenantId)
      .eq('id', employeeId)
      .maybeSingle();
    if (data) employeeName = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim();
  }

  const conflicts = await getScheduleConflicts(supabase, tenantId, {
    starts_at: startsAt,
    ends_at: endsAt,
    employee_id: employeeId,
    client_id: clientId,
  });

  const preview = [
    '# Dienstplan-Entwurf',
    '',
    `- **Titel:** ${title}`,
    `- **Klient:** ${clientName ?? '—'}`,
    `- **Mitarbeiter:** ${employeeName ?? '—'}`,
    `- **Beginn:** ${startsAt}`,
    `- **Ende:** ${endsAt}`,
    `- **Aufgaben:** ${tasks.length > 0 ? tasks.map(String).join(', ') : '—'}`,
    '',
    '## Konflikte',
    conflicts.conflict_count > 0
      ? conflicts.conflicts
          .map(
            (c: { title?: string; starts_at?: string; ends_at?: string }) =>
              `- ${c.title ?? 'Termin'} (${c.starts_at ?? '?'} – ${c.ends_at ?? '?'})`,
          )
          .join('\n')
      : 'Keine Konflikte erkannt.',
    '',
    '## Hinweis',
    'Speichern erst nach Prüfung und Freigabe.',
  ].join('\n');

  return createPendingAction(supabase, tenantId, sessionId, userId, {
    action_type: 'create_schedule_entry',
    module: 'office',
    entity_type: clientId ? 'client' : null,
    entity_id: clientId,
    title: `Dienstplan: ${title}`,
    description: 'Termin-Entwurf wartet auf Freigabe.',
    payload: {
      title,
      client_id: clientId,
      employee_id: employeeId,
      client_name: clientName,
      employee_name: employeeName,
      starts_at: startsAt,
      ends_at: endsAt,
      tasks,
      conflicts,
    },
    preview_markdown: preview,
    risk_level: conflicts.conflict_count > 0 ? 'high' : 'normal',
  });
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '_Nicht hinterlegt_';
  return String(value);
}

async function createAdmissionProtocolPendingAction(
  supabase: SupabaseClient,
  tenantId: string,
  sessionId: string,
  userId: string,
  args: Record<string, unknown>,
) {
  const clientId = String(args.client_id ?? args.entity_id ?? '').trim();
  if (!clientId) throw new Error('client_id is required');

  const details = await getClientDetails(supabase, tenantId, { client_id: clientId });
  const client = details.client as Record<string, unknown>;
  const missing = REQUIRED_CLIENT_FIELDS.filter((field) => !client[field]);

  const sectionContent = ADMISSION_PROTOCOL_SECTIONS.map((section) => {
    switch (section) {
      case '1. Aufnahme-Grunddaten':
        return `## ${section}\n- Aufnahmedatum: ${formatValue(client.admission_date)}\n- Status: ${formatValue(client.status)}`;
      case '3. Stammdaten':
        return `## ${section}\n- Name: ${formatValue(client.first_name)} ${formatValue(client.last_name)}\n- Geburtsdatum: ${formatValue(client.date_of_birth)}\n- Pflegegrad: ${formatValue(client.care_level)}`;
      case '4. Kontakt & Adresse':
        return `## ${section}\n- Telefon: ${formatValue(client.phone)}\n- E-Mail: ${formatValue(client.email)}\n- Adresse: ${formatValue(client.street)}, ${formatValue(client.zip)} ${formatValue(client.city)}`;
      case '5. Angehörige & Bezugspersonen':
        return `## ${section}\n${(details.contacts as unknown[]).length > 0 ? (details.contacts as Record<string, unknown>[]).map((c) => `- ${formatValue(c.name ?? c.first_name)} (${formatValue(c.relation)})`).join('\n') : '_Keine Angehörigen hinterlegt_'}`;
      case '22. Dokumente & Nachweise':
        return `## ${section}\n_Dokumente werden aus der Akte ergänzt — keine erfundenen Inhalte._`;
      case '24. Zusammenfassung & Freigabe':
        return `## ${section}\nEntwurf basiert ausschließlich auf vorhandenen Mandantendaten. Fehlende Pflichtfelder: ${missing.length > 0 ? missing.join(', ') : 'keine'}.`;
      default:
        return `## ${section}\n_Nur aus vorhandenen Daten befüllt — bitte fehlende Angaben ergänzen._`;
    }
  }).join('\n\n');

  const preview = `# Aufnahmeprotokoll\n\n${sectionContent}\n\n---\n**Keine Speicherung ohne Freigabe.**`;

  return createPendingAction(supabase, tenantId, sessionId, userId, {
    action_type: 'create_protocol',
    module: 'office',
    entity_type: 'client',
    entity_id: clientId,
    title: `Aufnahmeprotokoll: ${client.first_name ?? ''} ${client.last_name ?? ''}`.trim(),
    description: '24-Kapitel-Aufnahmeprotokoll als Entwurf vorbereitet.',
    payload: {
      client_id: clientId,
      protocol_type: 'admission',
      missing_fields: missing,
      sections: ADMISSION_PROTOCOL_SECTIONS,
    },
    preview_markdown: preview,
    risk_level: missing.length > 0 ? 'high' : 'normal',
  });
}

async function searchDocuments(
  supabase: SupabaseClient,
  tenantId: string,
  args: Record<string, unknown>,
) {
  const query = String(args.query ?? '').trim();
  const clientId = args.client_id ? String(args.client_id) : null;
  const limit = Math.min(Number(args.limit ?? 10), 25);

  const results: unknown[] = [];

  let chunkQuery = supabase
    .from('document_chunks')
    .select('id, document_id, document_type, title, content, metadata, source_entity_id')
    .eq('tenant_id', tenantId)
    .limit(limit);

  if (query) chunkQuery = chunkQuery.ilike('content', `%${query}%`);
  if (clientId) chunkQuery = chunkQuery.eq('source_entity_id', clientId);

  const chunks = await chunkQuery;
  if (!chunks.error && chunks.data) {
    results.push(
      ...chunks.data.map((item) => ({
        type: 'document_chunk',
        document_id: item.document_id,
        title: item.title,
        preview: String(item.content ?? '').slice(0, 500),
        client_id: item.source_entity_id,
      })),
    );
  }

  let clientDocQuery = supabase
    .from('client_documents')
    .select('id, client_id, title, document_type, status, created_at')
    .eq('tenant_id', tenantId)
    .limit(limit);

  if (query) clientDocQuery = clientDocQuery.ilike('title', `%${query}%`);
  if (clientId) clientDocQuery = clientDocQuery.eq('client_id', clientId);

  const clientDocs = await clientDocQuery;
  if (!clientDocs.error && clientDocs.data) {
    results.push(
      ...clientDocs.data.map((item) => ({
        type: 'client_document',
        document_id: item.id,
        title: item.title,
        client_id: item.client_id,
        document_type: item.document_type,
      })),
    );
  }

  return { query, count: results.length, results };
}

function openDocumentPreview(tenantId: string, args: Record<string, unknown>) {
  const clientId = String(args.client_id ?? args.entity_id ?? '').trim();
  const documentId = String(args.document_id ?? '').trim();
  if (!clientId || !documentId) throw new Error('client_id and document_id are required');

  return {
    type: 'navigation_instruction',
    module: 'office',
    route: resolveEntityRoute('client', clientId, { tab: 'documents', documentId }),
    entity_type: 'client',
    entity_id: clientId,
    document_id: documentId,
    highlight: args.highlight ? String(args.highlight) : null,
    tenant_id: tenantId,
  };
}

async function summarizeClientCase(
  supabase: SupabaseClient,
  tenantId: string,
  args: Record<string, unknown>,
) {
  const clientId = String(args.client_id ?? args.entity_id ?? '').trim();
  if (!clientId) throw new Error('client_id is required');

  const details = await getClientDetails(supabase, tenantId, { client_id: clientId });
  const client = details.client as Record<string, unknown>;
  const openTasks = (details.open_tasks as Record<string, unknown>[]).filter(
    (t) => t.status !== 'done' && t.status !== 'completed',
  );

  const summary = [
    `Klient: ${client.first_name ?? ''} ${client.last_name ?? ''}`.trim(),
    `Pflegegrad: ${formatValue(client.care_level)}`,
    `Status: ${formatValue(client.status)}`,
    `Offene Aufgaben: ${openTasks.length}`,
    `Letzte Notizen: ${(details.recent_notes as unknown[]).length}`,
  ].join('\n');

  return {
    client_id: clientId,
    summary,
    open_tasks: openTasks.slice(0, 10),
    recent_notes: (details.recent_notes as unknown[]).slice(0, 5),
  };
}

async function createDocumentDraftPendingAction(
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
  const sections = Array.isArray(args.required_sections)
    ? args.required_sections.map(String)
    : ['Stammdaten', 'Sachstand', 'Einschätzung', 'Maßnahmen', 'Prüfung'];

  const preview = sections
    .map((section, index) => `## ${index + 1}. ${section}\n_Entwurf — Inhalte aus Mandantendaten, keine Speicherung ohne Freigabe._`)
    .join('\n\n');

  return createPendingAction(supabase, tenantId, sessionId, userId, {
    action_type: 'create_document_draft',
    module: moduleName,
    entity_type: entityType,
    entity_id: entityId,
    title: `${documentType} als KI-Entwurf`,
    description: 'Dokumentenentwurf wartet auf Prüfung.',
    payload: {
      document_type: documentType,
      module: moduleName,
      entity_type: entityType,
      entity_id: entityId,
      sections,
      source_args: args,
    },
    preview_markdown: `# ${documentType}\n\n${preview}`,
    risk_level: 'normal',
  });
}

async function createCareNotePendingAction(
  supabase: SupabaseClient,
  tenantId: string,
  sessionId: string,
  userId: string,
  args: Record<string, unknown>,
) {
  const clientId = String(args.client_id ?? args.entity_id ?? '').trim();
  const content = String(args.content ?? args.note ?? '').trim();
  const category = String(args.category ?? 'pflege');

  if (!clientId) throw new Error('client_id is required');
  if (!content) throw new Error('content is required');

  const preview = `# Pflegenotiz-Entwurf\n\n**Kategorie:** ${category}\n\n${content}\n\n---\nSpeichern erst nach Freigabe.`;

  return createPendingAction(supabase, tenantId, sessionId, userId, {
    action_type: 'create_care_note',
    module: 'office',
    entity_type: 'client',
    entity_id: clientId,
    title: 'Pflegenotiz erstellen',
    description: 'Notiz-Entwurf wartet auf Freigabe.',
    payload: {
      client_id: clientId,
      content,
      category,
      protocol_type: category,
    },
    preview_markdown: preview,
    risk_level: 'normal',
  });
}

function navigateToModule(_tenantId: string, args: Record<string, unknown>) {
  const moduleName = String(args.module ?? 'business');
  const route = args.route
    ? String(args.route)
    : args.entity_type && args.entity_id
      ? resolveEntityRoute(String(args.entity_type), String(args.entity_id), {
          tab: args.tab ? String(args.tab) : undefined,
          documentId: args.document_id ? String(args.document_id) : undefined,
        })
      : resolveModuleHomeRoute(moduleName);

  return {
    type: 'navigation_instruction',
    module: moduleName,
    route,
    entity_type: args.entity_type ? String(args.entity_type) : null,
    entity_id: args.entity_id ? String(args.entity_id) : null,
    document_id: args.document_id ? String(args.document_id) : null,
    highlight: args.highlight ? String(args.highlight) : null,
  };
}

async function askMissingRequiredFields(
  supabase: SupabaseClient,
  tenantId: string,
  args: Record<string, unknown>,
) {
  const clientId = String(args.client_id ?? args.entity_id ?? '').trim();
  const context = String(args.context ?? 'admission');

  if (!clientId) throw new Error('client_id is required');

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
    .single();

  if (error || !client) throw new Error('Klient nicht gefunden');

  const missing = REQUIRED_CLIENT_FIELDS.filter((field) => !(client as Record<string, unknown>)[field]);

  return {
    client_id: clientId,
    context,
    missing_fields: missing,
    message:
      missing.length > 0
        ? `Bitte ergänzen: ${missing.join(', ')}`
        : 'Alle Pflichtfelder für den gewählten Kontext sind vorhanden.',
  };
}
