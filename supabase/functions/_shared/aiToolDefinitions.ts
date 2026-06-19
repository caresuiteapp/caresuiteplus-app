export const AI_TOOL_DEFINITIONS = [
  {
    type: 'function',
    name: 'search_caresuite',
    description: 'Search tenant-scoped CareSuite+ data across clients, employees, appointments and documents.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        module: { type: 'string' },
        entity_types: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'get_current_page_context',
    description: 'Return the current page context registered by the active screen.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'get_client_details',
    description: 'Load tenant-scoped client details including contacts, notes and tasks.',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
      },
      required: ['client_id'],
    },
  },
  {
    type: 'function',
    name: 'get_employee_details',
    description: 'Load tenant-scoped employee details.',
    parameters: {
      type: 'object',
      properties: {
        employee_id: { type: 'string' },
      },
      required: ['employee_id'],
    },
  },
  {
    type: 'function',
    name: 'get_client_tasks',
    description: 'List client tasks for the active tenant.',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        status: { type: 'string' },
      },
      required: ['client_id'],
    },
  },
  {
    type: 'function',
    name: 'get_schedule_conflicts',
    description: 'Detect overlapping appointments for a time window.',
    parameters: {
      type: 'object',
      properties: {
        starts_at: { type: 'string' },
        ends_at: { type: 'string' },
        employee_id: { type: 'string' },
        client_id: { type: 'string' },
      },
      required: ['starts_at', 'ends_at'],
    },
  },
  {
    type: 'function',
    name: 'create_schedule_pending_action',
    description: 'Prepare a schedule entry draft requiring user approval before saving.',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        employee_id: { type: 'string' },
        starts_at: { type: 'string' },
        ends_at: { type: 'string' },
        title: { type: 'string' },
        tasks: { type: 'array', items: { type: 'string' } },
      },
      required: ['starts_at', 'ends_at'],
    },
  },
  {
    type: 'function',
    name: 'create_admission_protocol_pending_action',
    description: 'Prepare a 24-section admission protocol draft from existing client data only.',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
      },
      required: ['client_id'],
    },
  },
  {
    type: 'function',
    name: 'search_documents',
    description: 'Search tenant documents and chunks.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        client_id: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    type: 'function',
    name: 'open_document_preview',
    description: 'Navigate to a document preview in the app.',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        document_id: { type: 'string' },
        highlight: { type: 'string' },
      },
      required: ['client_id', 'document_id'],
    },
  },
  {
    type: 'function',
    name: 'summarize_client_case',
    description: 'Summarize a client case from stored tenant data.',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
      },
      required: ['client_id'],
    },
  },
  {
    type: 'function',
    name: 'create_document_draft_pending_action',
    description: 'Prepare a structured document draft requiring approval.',
    parameters: {
      type: 'object',
      properties: {
        document_type: { type: 'string' },
        module: { type: 'string' },
        entity_type: { type: 'string' },
        entity_id: { type: 'string' },
        required_sections: { type: 'array', items: { type: 'string' } },
      },
      required: ['document_type', 'module'],
    },
  },
  {
    type: 'function',
    name: 'create_care_note_pending_action',
    description: 'Prepare a care note draft requiring approval.',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        content: { type: 'string' },
        category: { type: 'string' },
      },
      required: ['client_id', 'content'],
    },
  },
  {
    type: 'function',
    name: 'navigate_to_module',
    description: 'Navigate the app to a module, route or entity.',
    parameters: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        route: { type: 'string' },
        entity_type: { type: 'string' },
        entity_id: { type: 'string' },
        document_id: { type: 'string' },
        highlight: { type: 'string' },
        tab: { type: 'string' },
      },
      required: ['module'],
    },
  },
  {
    type: 'function',
    name: 'ask_missing_required_fields',
    description: 'List missing required fields for a client in a given context.',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        context: { type: 'string' },
      },
      required: ['client_id'],
    },
  },
  {
    type: 'function',
    name: 'approve_pending_action',
    description: 'UI-only hint that approval happens in the app review sheet.',
    parameters: {
      type: 'object',
      properties: {
        pending_action_id: { type: 'string' },
      },
    },
  },
] as const;

type RealtimeToolDefinition = (typeof AI_TOOL_DEFINITIONS)[number];

/** Realtime API expects flat function tools with JSON Schema parameters. */
export function normalizeRealtimeTools(
  tools: readonly RealtimeToolDefinition[],
): Array<{
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return tools.map((tool) => ({
    type: 'function' as const,
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties:
        tool.parameters &&
        typeof tool.parameters === 'object' &&
        'properties' in tool.parameters &&
        tool.parameters.properties &&
        typeof tool.parameters.properties === 'object'
          ? tool.parameters.properties
          : {},
      ...(Array.isArray(
        tool.parameters &&
          typeof tool.parameters === 'object' &&
          'required' in tool.parameters &&
          tool.parameters.required,
      )
        ? { required: tool.parameters.required }
        : {}),
      additionalProperties: false,
    },
  }));
}

/** Chat Completions expects nested `function` objects, not Realtime flat tools. */
export function toChatCompletionTools(tools: readonly RealtimeToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties:
          tool.parameters &&
          typeof tool.parameters === 'object' &&
          'properties' in tool.parameters &&
          tool.parameters.properties &&
          typeof tool.parameters.properties === 'object'
            ? tool.parameters.properties
            : {},
        ...(Array.isArray(
          tool.parameters &&
            typeof tool.parameters === 'object' &&
            'required' in tool.parameters &&
            tool.parameters.required,
        )
          ? { required: tool.parameters.required }
          : {}),
        additionalProperties: false,
      },
    },
  }));
}

export const AI_SYSTEM_INSTRUCTIONS = `
Du bist die CareSuite+ KI innerhalb einer mandantenfähigen Pflege-, Assistenz-, Beratungs-, Office- und Akademie-Software.

Harte Regeln:
- Zeige, suche und verarbeite ausschließlich Daten des aktiven Mandanten.
- Erfinde keine Klient:innen, Mitarbeitende, Zeiten oder Dokumenteninhalte.
- Schreibe niemals direkt in Live-Daten.
- Jede Änderung wird zuerst als prüfbarer Entwurf über ein pending-action Tool vorbereitet.
- Speichern erfolgt erst nach ausdrücklicher Nutzerfreigabe im Entwurfs-Panel.
`.trim();
