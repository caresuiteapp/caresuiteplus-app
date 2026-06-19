export type AiMessageRole = 'user' | 'assistant' | 'tool' | 'system';

export type AiRiskLevel = 'low' | 'normal' | 'high' | 'critical';

export type AiPendingActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'committed'
  | 'failed';

export type AiStatus =
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'tool_loading'
  | 'pending'
  | 'error';

export type AiToolName =
  | 'search_caresuite'
  | 'get_current_page_context'
  | 'get_client_details'
  | 'get_employee_details'
  | 'get_client_tasks'
  | 'get_schedule_conflicts'
  | 'create_schedule_pending_action'
  | 'create_admission_protocol_pending_action'
  | 'search_documents'
  | 'open_document_preview'
  | 'summarize_client_case'
  | 'create_document_draft_pending_action'
  | 'create_care_note_pending_action'
  | 'navigate_to_module'
  | 'ask_missing_required_fields'
  | 'approve_pending_action'
  | 'create_pending_action'
  | 'navigate_to_caresuite_location'
  | 'generate_long_document_draft';

export type AiNavigationInstruction = {
  type: 'navigation_instruction';
  module: string;
  route: string;
  entity_type?: string | null;
  entity_id?: string | null;
  document_id?: string | null;
  highlight?: string | null;
};

export type AiPendingActionSummary = {
  pending_action_id: string;
  title: string;
  preview_markdown: string;
  status: AiPendingActionStatus | string;
  risk_level?: AiRiskLevel | string;
  description?: string | null;
};

export type AiDispatchResult = {
  ok?: boolean;
  result?: AiPendingActionSummary | AiNavigationInstruction | Record<string, unknown>;
  error?: string;
};

export type AiRealtimeTokenResponse = {
  ok?: boolean;
  session_id: string;
  realtime?: {
    value?: string;
    client_secret?: { value?: string };
  };
  error?: string;
};

export type AiTextChatResponse = {
  ok?: boolean;
  session_id?: string;
  assistant_message?: string;
  pending_actions?: AiPendingActionSummary[];
  navigation?: AiNavigationInstruction | null;
  memory_summary?: string | null;
  last_goal?: string | null;
  last_step?: string | null;
  error?: string;
};

export type AiContextSnapshot = {
  tenantId?: string;
  currentModule?: string;
  currentRoute?: string;
};

export type AiPageContextSnapshot = AiContextSnapshot & {
  pageTitle?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  activeTab?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
};

export type AiChatMessage = {
  id: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
};

export type AiFunctionCallEvent = {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string | Record<string, unknown>;
  item?: {
    type?: string;
    name?: string;
    call_id?: string;
    arguments?: string;
  };
};

export const AI_STATUS_LABELS: Record<AiStatus, string> = {
  ready: 'Bereit',
  listening: 'Hört zu',
  thinking: 'Denkt',
  speaking: 'Antwortet',
  tool_loading: 'Arbeitet…',
  pending: 'Aktion vorbereitet',
  error: 'Fehler',
};
