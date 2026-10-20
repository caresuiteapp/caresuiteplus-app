import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { AssignmentEditForm } from '@/components/assist/AssignmentEditForm.web';
import { AssignmentsWorkspaceShell } from '@/components/assist/AssignmentsWorkspaceShell.web';
import { fetchVisitDispositionDetail } from '@/lib/assist/visitService';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

export function AssignmentEditScreen() {
 const {id:routeId}=useLocalSearchParams<{id?:string|string[]}>();const id=Array.isArray(routeId)?routeId[0]:routeId;
 const router=useRouter();const tenantId=useServiceTenantId();const {profile}=useAuth();
 const scope=JSON.stringify([tenantId,profile?.id,profile?.roleKey,id]);const scopeRef=useRef(scope);scopeRef.current=scope;
 const [state,setState]=useState<{scope:string;loading:boolean;visit:VisitDispositionDetail|null;error:string|null;saved:boolean}>({scope,loading:true,visit:null,error:null,saved:false});
 const [retry,setRetry]=useState(0);const guard=useRef<(()=>boolean)|null>(null);const setGuard=useCallback((next:(()=>boolean)|null)=>{guard.current=next;},[]);
 useEffect(()=>{let cancelled=false;setState({scope,loading:true,visit:null,error:null,saved:false});if(!id||!tenantId){setState({scope,loading:false,visit:null,error:!id?'Kein Einsatz ausgewählt.':'Kein Unternehmen ausgewählt.',saved:false});return;}
 void fetchVisitDispositionDetail(id,tenantId,profile?.roleKey).then(result=>{if(!cancelled)setState({scope,loading:false,visit:result.ok?result.data:null,error:result.ok?(result.data?null:'Einsatz nicht gefunden.'):result.error,saved:false});}).catch(cause=>{if(!cancelled)setState({scope,loading:false,visit:null,error:cause instanceof Error?cause.message:'Einsatz konnte nicht geladen werden.',saved:false});});return()=>{cancelled=true;};},[id,tenantId,profile?.id,profile?.roleKey,scope,retry]);
 const returnToDetail=()=>{if(guard.current&&!guard.current())return;router.canGoBack()?router.back():router.replace(id?`/assist/assignments/${encodeURIComponent(id)}` as never:'/assist/assignments');};
 return <AssignmentsWorkspaceShell title={state.saved?'Einsatz gespeichert':'Einsatz bearbeiten'} description={state.visit?.clientName??'Termin, Personen, Aufgaben und Nachweise bearbeiten.'} onBack={returnToDetail}>
 {state.loading||state.scope!==scope?<div className="aw-alert" role="status">Einsatz wird geladen…</div>:state.saved?<section className="aw-panel"><div className="aw-alert" data-tone="success" role="status">Ihre Änderungen wurden gespeichert.</div><div className="aw-actions" style={{marginTop:16}}><button className="aw-button aw-button--primary" onClick={()=>setRetry(v=>v+1)}>Weiter bearbeiten</button><button className="aw-button" onClick={returnToDetail}>Zurück zum Einsatz</button></div></section>:state.error||!state.visit||!id?<div className="aw-alert" data-tone="danger" role="alert">{state.error??'Einsatz nicht gefunden.'}<button className="aw-button" onClick={()=>setRetry(v=>v+1)}>Erneut laden</button></div>:<AssignmentEditForm key={scope} visitId={id} initialVisit={state.visit} onGuardChange={setGuard} onCancel={()=>{router.canGoBack()?router.back():router.replace(`/assist/assignments/${encodeURIComponent(id)}` as never);}} onSaved={()=>{if(scopeRef.current===scope)setState(previous=>({...previous,saved:true}));}}/>}
 </AssignmentsWorkspaceShell>;
}
