import { ClientRecordTabContent as RecordTabContent } from './ClientRecordTabPanels.tsx';
import { DocumentRecommendations } from '@/components/documents/DocumentRecommendations.web';
import type { DocumentWorkflow } from '@/lib/documents/documentRecommendations';
export {
  ClientRecordConsentsPanel, ClientRecordMedicationPanel, ClientRecordVitalsPanel,
  ClientRecordTimelinePanel, ClientRecordModulesPanel, ClientRecordPortalPanel,
  ClientRecordLeistungsbereichePanel, ClientRecordBudgetCorePanel,
  ClientRecordTasksPanel, ClientRecordShiftsTabPanel,
} from './ClientRecordTabPanels.tsx';

const workflows: Record<string, DocumentWorkflow> = {
  einwilligungen: 'client_contracts', medikation: 'medication', vitalwerte: 'care',
  nachweise: 'service_proof', einsaetze: 'assignment', aufgaben: 'assignment',
  dokumentation: 'care', protokolle: 'care', pflege: 'care', risiken: 'incident',
  tagesstruktur: 'care', mahlzeiten: 'care', fallakte: 'consultation', beratungsanlass: 'consultation',
  portal: 'portal_access', abrechnung: 'invoice',
};

/** Only persisted client identifiers enter suggestions; existing record panels keep their behavior. */
export function ClientRecordTabContent(props: Parameters<typeof RecordTabContent>[0]) {
  const workflow = workflows[props.tab];
  return <>
    {workflow ? <DocumentRecommendations module={['medikation', 'vitalwerte', 'pflege', 'risiken'].includes(props.tab) ? 'pflege' : 'office'} workflow={workflow} clientId={props.clientId} compact /> : null}
    <RecordTabContent {...props} />
  </>;
}
