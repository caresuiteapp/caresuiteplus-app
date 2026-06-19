export type AiMessageRole = 'user' | 'assistant' | 'tool' | 'system';

export type AiRiskLevel = 'low' | 'normal' | 'high' | 'critical';

export type AiPendingActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'committed'
  | 'failed';

export type AiToolName =
  | 'search_caresuite'
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

export type AiContextSnapshot = {
  tenantId?: string;
  currentModule?: string;
  currentRoute?: string;
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
