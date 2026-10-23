import {useCallback,useMemo,useRef,useState} from 'react';
import {View} from 'react-native';
import {useRouter} from 'expo-router';
import {CareDocumentationWorkspacePanel} from '@/components/pflege/CareDocumentationWorkspacePanel.web';
import {BasicCareWorkspacePanel} from '@/components/pflege/BasicCareWorkspacePanel.web';
import {NutritionEliminationWorkspacePanel} from '@/components/pflege/NutritionEliminationWorkspacePanel.web';
import {ScreenShell} from '@/components/layout';
import {ErrorState,FilterChipGroup,LoadingState,PremiumButton} from '@/components/ui';
import {useAsyncQuery} from '@/hooks/core/useAsyncQuery';
import {useCareRuntimePermissions} from '@/hooks/pflege/useCareRuntimePermissions.web';
import {useAuth} from '@/lib/auth/context';
import {fetchEligibleCareClients} from '@/lib/careAssessment';
import {spacing} from '@/theme';

export function PflegeberichtErstellenScreen(){
 const router=useRouter(),permissions=useCareRuntimePermissions(),{profile}=useAuth();const tenantId=permissions.tenantId??'',actorId=profile?.id??'';
 const clients=useAsyncQuery(()=>tenantId?fetchEligibleCareClients(tenantId,permissions.roleKey):Promise.resolve({ok:false as const,error:'Kein Mandant.'}),[tenantId,permissions.roleKey],{enabled:!!tenantId&&!!actorId});
 const options=useMemo(()=>(clients.data??[]).map(client=>({key:client.id,label:`${client.lastName}, ${client.firstName}`})),[clients.data]);const [clientId,setClientId]=useState(''),[workspace,setWorkspace]=useState<'documentation'|'basic-care'|'nutrition-elimination'>('documentation');

 const basicLeave=useRef<(()=>Promise<boolean>)|null>(null),nutritionLeave=useRef<(()=>Promise<boolean>)|null>(null),selectionFlight=useRef(false),selection=useRef({tenantId,actorId,clientId,workspace});selection.current={tenantId,actorId,clientId,workspace};
 const registerBasicLeave=useCallback((guard:(()=>Promise<boolean>)|null)=>{basicLeave.current=guard;},[]),registerNutritionLeave=useCallback((guard:(()=>Promise<boolean>)|null)=>{nutritionLeave.current=guard;},[]),isLeavingSelection=useCallback(()=>selectionFlight.current,[]);
 const changeSelection=async(kind:'client'|'workspace',value:string)=>{if(selectionFlight.current)return;const before={...selection.current},ref=before.workspace==='basic-care'?basicLeave:before.workspace==='nutrition-elimination'?nutritionLeave:null,guard=ref?.current??null;selectionFlight.current=true;try{if(guard&&await guard()!==true)return;const now=selection.current;if(now.tenantId!==before.tenantId||now.actorId!==before.actorId||now.clientId!==before.clientId||now.workspace!==before.workspace||(ref?.current??null)!==guard)return;if(kind==='client')setClientId(value);else setWorkspace(value as typeof workspace);}finally{selectionFlight.current=false;}};
 return <ScreenShell title="Pflegedokumentation erfassen" subtitle="Bericht, Grundpflege sowie Ernährung und Ausscheidung verbunden dokumentieren">
  <View style={{gap:spacing.md}}>
   {permissions.loading?<LoadingState message="Aktuelle Dokumentationsrechte werden bestätigt…"/>:permissions.error?<ErrorState message={permissions.error} onRetry={permissions.refreshPermissions}/>:null}
   {clients.loading?<LoadingState message="Aktive eigene Pflegefälle werden geladen…"/>:clients.error?<ErrorState message={clients.error} onRetry={clients.refresh}/>:null}
   <FilterChipGroup wrap options={options} value={clientId} onChange={value=>{void changeSelection('client',value);}}/>
   {clientId?<FilterChipGroup wrap options={[{key:'documentation',label:'Allgemeine Pflegedokumentation'},{key:'basic-care',label:'Grundpflege und Prophylaxen'},{key:'nutrition-elimination',label:'Ernährung und Ausscheidung'}]} value={workspace} onChange={value=>{void changeSelection('workspace',value);}}/>:null}
   {clientId&&tenantId&&actorId&&workspace==='documentation'?<CareDocumentationWorkspacePanel key={`documentation:${tenantId}:${clientId}:${actorId}`} tenantId={tenantId} clientId={clientId} actorId={actorId} actorName={profile?.displayName??profile?.email??'Aktuelle Person'} canCreate={permissions.can('pflege.documentation.create')} canConfirm={permissions.can('pflege.documentation.sign')} onSaved={()=>router.replace(`/pflege/dokumentation?clientId=${clientId}` as never)}/>:null}
   {clientId&&tenantId&&actorId&&workspace==='basic-care'?<BasicCareWorkspacePanel key={`basic-care:${tenantId}:${clientId}:${actorId}:${permissions.permissions.join('|')}`} tenantId={tenantId} clientId={clientId} actorId={actorId} actorName={profile?.displayName??profile?.email??'Aktuelle Person'} canView={permissions.can('pflege.plans.view')&&permissions.can('pflege.documentation.view')} canCreate={permissions.can('pflege.plans.view')&&permissions.can('pflege.documentation.create')} canReview={permissions.can('pflege.documentation.sign')} canPlan={permissions.can('pflege.plans.manage')&&permissions.can('pflege.documentation.create')} isOwnerCurrent={()=>permissions.can('pflege.plans.view')&&permissions.can('pflege.documentation.view')} isLeaving={isLeavingSelection} registerLeave={registerBasicLeave} onSaved={()=>undefined}/>:null}
   {clientId&&tenantId&&actorId&&workspace==='nutrition-elimination'?<NutritionEliminationWorkspacePanel key={`nutrition-elimination:${tenantId}:${clientId}:${actorId}:${permissions.permissions.join('|')}`} tenantId={tenantId} clientId={clientId} actorId={actorId} actorName={profile?.displayName??profile?.email??'Aktuelle Person'} canView={permissions.can('pflege.plans.view')&&permissions.can('pflege.documentation.view')&&permissions.can('pflege.vitals.view')} canCreate={permissions.can('pflege.plans.view')&&permissions.can('pflege.documentation.view')&&permissions.can('pflege.vitals.view')&&permissions.can('pflege.documentation.create')} canCaptureBinding={permissions.can('pflege.plans.view')&&permissions.can('pflege.documentation.view')&&permissions.can('pflege.vitals.view')&&permissions.can('pflege.plans.manage')&&permissions.can('pflege.documentation.create')} canReview={permissions.can('pflege.documentation.sign')} isOwnerCurrent={()=>permissions.can('pflege.plans.view')&&permissions.can('pflege.documentation.view')&&permissions.can('pflege.vitals.view')} isLeaving={isLeavingSelection} registerLeave={registerNutritionLeave} onSaved={()=>undefined}/>:null}
   <PremiumButton title="Zur vollständigen Dokumentation" variant="secondary" onPress={()=>router.replace(`/pflege/dokumentation${clientId?`?clientId=${clientId}`:''}` as never)}/>
  </View>
 </ScreenShell>;
}
export const CareReportCreateScreen=PflegeberichtErstellenScreen;
