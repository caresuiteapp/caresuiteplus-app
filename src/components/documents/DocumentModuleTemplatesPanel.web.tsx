import { DocumentRecommendations } from './DocumentRecommendations.web';
import { DocumentModuleTemplatesPanel as WorkflowDocuments } from './DocumentModuleTemplatesPanel.tsx';
import { usePermissions } from '@/hooks/usePermissions';
import { documentWorkflowForArea } from '@/lib/documents/documentRecommendations';
import type { DocumentModuleTemplatesPanelProps } from './DocumentModuleTemplatesPanel';

/** Web workflows use the new central catalogue and keep the actual record context. */
export function DocumentModuleTemplatesPanel(props: DocumentModuleTemplatesPanelProps) {
  const { can } = usePermissions();
  if (!props.tenantId) return null;
  const suggestions = <DocumentRecommendations title={props.title} module={props.targetModule} workflow={documentWorkflowForArea(props.targetModule, props.targetArea, props.triggerEvent)} clientId={props.clientId} employeeId={props.employeeId} assignmentId={props.assignmentId} compact />;
  // Execution documents belong to the protected completion/signature flow.
  // The catalogue adds optional drafts without replacing that persisted proof.
  if (props.targetArea === 'visit_complete' || !can('office.documents.view')) return <><WorkflowDocuments {...props} />{suggestions}</>;
  return suggestions;
}
