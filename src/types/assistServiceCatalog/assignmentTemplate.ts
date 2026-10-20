import type { AssignmentWorkflowCreateInput } from '../modules/assignmentWorkflow';

/** Aus Leistungskatalog generierter Einsatz-Entwurf (ohne Termin/Klient). */
export type AssistAssignmentTemplateDraft = {
  serviceCatalogItemId: string;
  serviceKey: string;
  title: string;
  serviceType: string;
  billingRelevant: boolean;
  requiresSignature: boolean;
  requiresDocumentation: boolean;
  defaultDurationMinutes: number;
  tasks: AssignmentWorkflowCreateInput['tasks'];
  taxMode: string;
  budgetEligible: boolean;
};
