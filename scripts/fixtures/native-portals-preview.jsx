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
import { EmployeePortalCalendarScreen } from '../../src/components/portal/EmployeePortalCalendarScreen';
import { PortalTabScreen } from '../../src/screens/portal/PortalTabScreen';
import { PortalViewportContext } from '../../src/lib/portal/portalViewportContext';
import { EmployeePortalPreview } from './native-employee-portals-preview';
import { appointment,dashboard,context,clientData } from './native-portals-data';
const noop=()=>{};
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
 if(screen==='employee-home'||screen==='employee-clients')return <PortalViewportContext.Provider value={{footerInFlow:true}}><EmployeePortalPreview screen={screen}/></PortalViewportContext.Provider>;
 if(screen==='employee-calendar')return <PortalPremiumProvider kind="employee"><PortalViewportContext.Provider value={{footerInFlow:true}}><View style={{flex:1,minHeight:0,backgroundColor:'#071C38',padding:12}}><PortalTabScreen title="Teamkalender" subtitle="Alle Mitarbeitenden, Einsätze, Termine und Abwesenheiten" hideHeaderOnPhone><EmployeePortalCalendarScreen/></PortalTabScreen></View></PortalViewportContext.Provider></PortalPremiumProvider>;
 if(screen==='client-home')return <PortalPremiumProvider kind="client"><PortalViewportContext.Provider value={{footerInFlow:true}}><View style={{flex:1,minHeight:0,backgroundColor:'#071C38'}}><PortalTabScreen title="Klient:innenportal" hideHeaderOnPhone scroll><ClientPortalHomeDashboard context={context} data={clientData} tripsReleased budgetReleased={false} proofsReleased requestsReleased uploadReleased activitiesReleased onRequestChange={noop} onRequestExtra={noop} onUpload={noop} onProofs={noop} onOpenRequests={noop} onOpenActivities={noop} onRequestCallback={noop}/></PortalTabScreen></View></PortalViewportContext.Provider></PortalPremiumProvider>;
 return <PortalPremiumProvider kind={screen.startsWith('employee')?'employee':'client'}><View style={{flex:1,minHeight:0,backgroundColor:'#071C38'}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:12,gap:14,maxWidth:1500,width:'100%',alignSelf:'center'}}>
  {screen==='employee-home'?<HealthOSEmployeePortalTodayView dashboard={dashboard} loading={false} error={null} displayName="Marlene Beispiel" onRefresh={noop}/>:screen==='client-home'?<ClientPortalHomeDashboard context={context} data={clientData} tripsReleased budgetReleased={false} proofsReleased requestsReleased uploadReleased activitiesReleased onRequestChange={noop} onRequestExtra={noop} onUpload={noop} onProofs={noop} onOpenRequests={noop} onOpenActivities={noop} onRequestCallback={noop}/>:screen==='client-appointment'?<ClientPortalAssignmentCard appointment={appointment} tasks={['Haushalt unterstützen','Gemeinsame Besorgungen']} onPreview={noop}/>:<EmployeePortalVisitCompactCard title="Hauswirtschaftliche Unterstützung" status="Dokumentation ausstehend" subtitle="Helene Musterfrau · 14:00–16:00 Uhr" pending onPress={noop} actionLabel="Dokumentation öffnen"/>}
 </ScrollView></View></PortalPremiumProvider>;
}
