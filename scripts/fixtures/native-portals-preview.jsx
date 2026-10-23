import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { HealthOSEmployeePortalTodayView } from '../../src/components/healthos/employee/HealthOSEmployeePortalTodayView';
import { ClientPortalHomeDashboard } from '../../src/components/portal/assist/ClientPortalHomeDashboard';
import { ClientPortalAssignmentCard } from '../../src/components/portal/ClientPortalAssignmentCard';
import { EmployeePortalVisitCompactCard } from '../../src/components/portal/EmployeePortalVisitCompactCard';
import { PortalHomeScreen } from '../../src/liquid-command/screens/PortalHomeScreen';
import { BusinessAccessScreen, EmployeeAccessScreen, PortalAccessScreen, RegisterOrganizationScreen, EmployeeFirstLoginScreen } from '../../src/liquid-command/screens/AccessScreens';
import { AccessHubScreen } from '../../src/liquid-command/screens/AccessHubScreen';
import { NativeBusinessPasswordRecoveryScreen, NativeBusinessPasswordResetScreen } from '../../src/screens/auth/BusinessPasswordRecovery.native';
import { PortalPremiumProvider } from '../../src/design/tokens/portalPremium';
const noop=()=>{};
const today=new Date(); const startsAt=new Date(today.getFullYear(),today.getMonth(),today.getDate(),14).toISOString(),endsAt=new Date(today.getFullYear(),today.getMonth(),today.getDate(),16).toISOString();
const appointment={id:'visual-visit',title:'Unterstützung im Alltag',startsAt,endsAt,location:'Gartenstraße 24 · Hannover',status:'geplant',assignmentStatus:'geplant',employeeName:'Marlene Beispiel'};
const dashboard={todayAssignments:[{assignmentId:'visual-visit',title:'Hauswirtschaftliche Unterstützung',clientName:'Helene Musterfrau',clientId:'visual-client',plannedStartAt:startsAt,plannedEndAt:endsAt,locationAddress:appointment.location,status:'geplant',canonicalStatus:'planned',documentationPending:false,signaturePending:false,isLocked:false}],upcomingAssignments:[],openTasks:[],openDocumentationCount:1,missingSignatureCount:1,openSignatureDocumentCount:1,overdueSignatureDocumentCount:0,messageCount:2};
const context={tenantId:'visual-tenant',clientId:'visual-client',portalUserId:'visual-person',displayName:'Helene Musterfrau',tenantName:'Pflege & Alltag Nord',roleKey:'client_portal',primaryModule:'assist',hasModuleAssignments:true,moduleAssignments:[{moduleKey:'assist',isPrimary:true,isActive:true}],features:[],visibilityRules:[],careProfile:{},metrics:{},widgetMetrics:{}};
const clientData={nextAppointment:appointment,upcomingAppointments:[appointment],contactPhone:'0511 000000',kpis:{appointments:2,messages:1,documents:3,proofs:1,signatures:1,budgetAvailable:false,openRequests:1,activities:2,begleitungen:null},activities:[],budget:null,budgetVisuals:[],openRequests:[]};
export function PortalPreview({screen}){
 if(screen==='access-hub')return <AccessHubScreen/>;
 if(screen==='business-access')return <BusinessAccessScreen/>;
 if(screen==='employee-access')return <EmployeeAccessScreen/>;
 if(screen==='client-access')return <PortalAccessScreen portal="client"/>;
 if(screen==='registration')return <RegisterOrganizationScreen/>;
 if(screen==='first-password')return <EmployeeFirstLoginScreen/>;
 if(screen==='password-recovery')return <NativeBusinessPasswordRecoveryScreen/>;
 if(screen==='password-reset')return <NativeBusinessPasswordResetScreen/>;
 if(screen==='family-home')return <PortalHomeScreen portal="family"/>;
 return <PortalPremiumProvider kind={screen.startsWith('employee')?'employee':'client'}><View style={{flex:1,minHeight:0,backgroundColor:'#071C38'}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:12,gap:14,maxWidth:1500,width:'100%',alignSelf:'center'}}>
  {screen==='employee-home'?<HealthOSEmployeePortalTodayView dashboard={dashboard} loading={false} error={null} displayName="Marlene Beispiel" onRefresh={noop}/>:screen==='client-home'?<ClientPortalHomeDashboard context={context} data={clientData} tripsReleased budgetReleased={false} proofsReleased requestsReleased uploadReleased activitiesReleased onRequestChange={noop} onRequestExtra={noop} onUpload={noop} onProofs={noop} onOpenRequests={noop} onOpenActivities={noop} onRequestCallback={noop}/>:screen==='client-appointment'?<ClientPortalAssignmentCard appointment={appointment} tasks={['Haushalt unterstützen','Gemeinsame Besorgungen']} onPreview={noop}/>:<EmployeePortalVisitCompactCard title="Hauswirtschaftliche Unterstützung" status="Dokumentation ausstehend" subtitle="Helene Musterfrau · 14:00–16:00 Uhr" pending onPress={noop} actionLabel="Dokumentation öffnen"/>}
 </ScrollView></View></PortalPremiumProvider>;
}
export const fetchPortalAppointments=async()=>({ok:true,data:[appointment]});
export const fetchPortalDocuments=async()=>({ok:true,data:[{id:'visual-document',title:'Informationen zur Unterstützung',fileName:'Informationen.pdf',mimeType:'application/pdf',sizeBytes:1024,uploadedAt:startsAt,status:'freigegeben'}]});
export const fetchPortalDocumentDetail=async()=>({ok:false,error:'Lokale Layoutprüfung'}),downloadPortalDocument=fetchPortalDocumentDetail;
export const formatFileSize=value=>`${Math.round(value/1024)} KB`;
export const usePortalOfficeMessages=()=>({threads:[],loading:false,error:null,refreshing:false,refreshWithResult:async()=>true});
export const usePortalActor=()=>({tenantId:'visual-tenant',clientId:'visual-client',employeeId:'visual-employee',actorId:'visual-person',roleKey:'family_portal',displayName:'Marlene Beispiel',isReady:true,isLinkedReady:true});
export const useClientSignatureAttention=()=>({items:[{route:'/portal/client/documents/signatures/visual-document'}],error:null,refresh:noop});
export const useThemeMode=()=>({mode:'light',desktopThemeMode:'dark',setMode:noop,toggleMode:noop});
export const useURL=()=>null;
export const requestBusinessPasswordReset=async()=>({ok:false,error:'Diese Layoutprüfung versendet keine E-Mails.'}),completeBusinessPasswordReset=requestBusinessPasswordReset,signOut=async()=>{};
export const loginBusinessUser=requestBusinessPasswordReset,loginEmployeePortal=requestBusinessPasswordReset,registerBusinessTenant=requestBusinessPasswordReset,completeFirstLogin=requestBusinessPasswordReset,loginClientPortal=requestBusinessPasswordReset,completePortalLogin=requestBusinessPasswordReset;
export const signInWithPassword=requestBusinessPasswordReset;
