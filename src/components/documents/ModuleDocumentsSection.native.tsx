// Generated native presentation from src/components/documents/ModuleDocumentsSection.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { DocumentRecommendations } from "./DocumentRecommendations.native.tsx";
import { documentWorkflowForArea } from '@/lib/documents/documentRecommendations';
import type { ModuleDocumentsSectionProps } from './ModuleDocumentsSection';
export function ModuleDocumentsSection(props: ModuleDocumentsSectionProps) {
    if (props.collapsed)
        return null;
    return <DocumentRecommendations title={props.title} module={props.targetModule} workflow={documentWorkflowForArea(props.targetModule, props.targetArea, props.triggerEvent)} clientId={props.clientId} employeeId={props.employeeId} assignmentId={props.assignmentId}/>;
}
