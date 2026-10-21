/** Local layout fixture. Synthetic people and callbacks; no auth, SDK or real patient data. */
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeModeProvider } from '../../src/design/ThemeModeProvider';
import { ClientIntakeIdentityPanel } from '../../src/components/office/ClientIntakeIdentityPanel.web';
import type { useClientIntakeWizard } from '../../src/hooks/pflege/useCareClientIntakeWizard.web';
type Scenario = 'similar' | 'empty' | 'exact' | 'denied' | 'error' | 'approved';
declare global { interface Window { intakeQA: { setScenario(scenario: Scenario): void; events: string[] } } }
const events: string[] = [];
const style = document.createElement('style');
style.textContent = 'html,body{margin:0;background:#edf4fc;font:16px/1.5 system-ui}#preview{box-sizing:border-box;width:calc(100% - 32px);max-width:1120px;margin:16px auto;padding-bottom:24px}*{box-sizing:border-box}';
document.head.appendChild(style);
function App() {
 const [scenario,setScenario]=useState<Scenario>('similar');
 useEffect(()=>{window.intakeQA={setScenario,events};},[]);
 const candidates=useMemo(()=>Array.from({length:12},(_,index)=>({
  id:`00000000-0000-4000-8000-${String(index+20).padStart(12,'0')}`,tenant_id:'00000000-0000-4000-8000-000000000001',
  first_name:index===0?'Beispielname mit sehr langem Zusatz zur Prüfung vergrößerter Schrift':'Musterperson',
  last_name:index===0?'Meyer-Mustermann Beispieldaten für den Layouttest':`Meyer ${index+1}`,
  date_of_birth:index===0?null:'1940-02-29',insurance_number:index===0?'SYNTHETISCHE-LANGE-VERSICHERUNGSNUMMER-1234567890':`TEST-${index+1}`,status:'active',updated_at:'2026-10-15T06:10:00.123456+00:00',
 })),[]);
 const wizard={
  identityReview:{status:scenario==='approved'?'approved':scenario==='error'?'error':'ready',candidates:scenario==='empty'||scenario==='denied'||scenario==='error'?[]:candidates,exactConflict:scenario==='exact',error:scenario==='error'?'Die vorhandenen Personen konnten nicht vollständig geprüft werden. Ihre Eingaben bleiben erhalten.':null},
  canReviewIdentity:scenario!=='denied',identityBound:false,
  reviewIdentity:async()=>{events.push('review');},
  confirmNewPerson:async(reason:string)=>{events.push(`new:${reason}`);setScenario('approved');return true;},
 } as unknown as ReturnType<typeof useClientIntakeWizard>;
 return <ClientIntakeIdentityPanel wizard={wizard} onOpenExisting={async id=>{events.push(`existing:${id}`);}} />;
}
createRoot(document.getElementById('preview')!).render(<ThemeModeProvider><App /></ThemeModeProvider>);
