import {
  ClientRecordTabContent as RecordTabContent,
  ClientRecordConsentsPanel,
  ClientRecordTasksPanel,
  ClientRecordLeistungsbereichePanel,
} from './ClientRecordTabPanels.tsx';
import { ClientRecordContractsPanel } from '@/components/office/ClientRecordContractsPanel.web';
import { usePageTab } from '@/hooks/usePageTab';
import { DocumentRecommendations } from '@/components/documents/DocumentRecommendations.web';
import type { DocumentWorkflow } from '@/lib/documents/documentRecommendations';
import { ClientCareGradeBudgetsPanel } from '@/components/office/ClientCareGradeBudgetsPanel.web';
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
export function ClientRecordTabContent(props: Parameters<typeof RecordTabContent>[0] & {
  onBudgetDirtyChange?: (dirty: boolean) => void;
  onBudgetBusyChange?: (busy: boolean) => void;
}) {
  if (['pflegegrad_budgets', 'pflegegrad_anspruch', 'leistungen_abrechnung', 'budget', 'budgetverlauf', 'warnungen'].includes(props.tab)) {
    return <ClientCareGradeBudgetsPanel clientId={props.clientId} clientName={props.fullClient ? `${props.fullClient.firstName} ${props.fullClient.lastName}`.trim() : undefined} onRecordRefresh={props.onRecordRefresh} onDirtyChange={props.onBudgetDirtyChange} onBusyChange={props.onBudgetBusyChange} />;
  }
  if (props.tab === 'mehr') return <ClientRecordAdditionalPanels {...props} />;
  const workflow = workflows[props.tab];
  return <>
    {workflow ? <DocumentRecommendations module={['medikation', 'vitalwerte', 'pflege', 'risiken'].includes(props.tab) ? 'pflege' : 'office'} workflow={workflow} clientId={props.clientId} compact /> : null}
    <RecordTabContent {...props} />
  </>;
}

const additionalPanels = [
  { key: 'contracts', title: 'Verträge', description: 'Vereinbarungen und erfasste Unterschriften' },
  { key: 'consents', title: 'Einwilligungen', description: 'Zustimmungen prüfen und verwalten' },
  { key: 'services', title: 'Vereinbarte Leistungen', description: 'Leistungsarten und gültige Vereinbarungen' },
  { key: 'tasks', title: 'Aufgaben & Wünsche', description: 'Regelmäßige Unterstützung im Alltag' },
] as const;

function ClientRecordAdditionalPanels(props: Parameters<typeof RecordTabContent>[0]) {
  const [selected, setSelected] = usePageTab<string>('clientRecord.additionalPanel', 'contracts');
  const section = additionalPanels.some(panel => panel.key === selected) ? selected : 'contracts';
  return <div className="cr-additional">
    <style>{additionalCss}</style>
    <div className="cr-additional-options" role="group" aria-label="Weitere Aktenbereiche auswählen">
      {additionalPanels.map(panel => <button type="button" key={panel.key} aria-pressed={section === panel.key} onClick={() => setSelected(panel.key)}><strong>{panel.title}</strong><span>{panel.description}</span></button>)}
    </div>
    <div className="cr-additional-panel">
      {section === 'contracts' ? <ClientRecordContractsPanel clientId={props.clientId} fullClient={props.fullClient} /> : null}
      {section === 'consents' ? <ClientRecordConsentsPanel {...props} /> : null}
      {section === 'services' ? <ClientRecordLeistungsbereichePanel {...props} /> : null}
      {section === 'tasks' ? <ClientRecordTasksPanel {...props} /> : null}
    </div>
  </div>;
}

const additionalCss = `
.cr-additional{container-type:inline-size;min-width:0}.cr-additional-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:22px}.cr-additional-options button{font-family:inherit;text-align:left;min-width:0;padding:17px;border:1px solid #d6e2f1;background:#f7faff;border-radius:15px;cursor:pointer;color:#244361}.cr-additional-options strong{display:block;font-size:14px;font-weight:650}.cr-additional-options span{display:block;font-size:13px;line-height:1.6;color:#5c708a;margin-top:6px}.cr-additional-options button[aria-pressed=true]{border-color:#5f95e2;background:#edf4ff;box-shadow:0 3px 12px #1654a012;color:#1356ae}.cr-additional-options button:hover{border-color:#5f95e2}.cr-additional-options button:focus-visible{outline:3px solid #337ff0;outline-offset:3px}.cr-additional-panel{min-width:0}@container(max-width:420px){.cr-additional-options{grid-template-columns:1fr}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
