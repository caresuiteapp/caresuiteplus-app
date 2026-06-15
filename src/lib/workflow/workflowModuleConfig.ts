/**
 * Workflow builder live readiness.
 * Status-Schritte sind UI-fähig; Mandanten-spezifische Persistenz bleibt offen.
 */
export function isWorkflowBuilderLiveReady(): boolean {
  return false;
}

export const WORKFLOW_BUILDER_PREPARED_MESSAGE =
  'Workflow-Schritte werden derzeit nur lokal im Demo konfiguriert — keine Mandanten-Persistenz in Supabase.';
