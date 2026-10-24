import React, { useState } from 'react';
import { CompanyWorkspaceView } from '../../src/components/company/CompanyWorkspaceView';
import { PortalPreview } from './native-portals-preview';
import { createRoot } from 'react-dom/client';
import { View, Text, ScrollView } from 'react-native';
import { CommandCenterScreen } from '../../src/liquid-command/screens/CommandCenterScreen.native';
import { ClientsListView } from '../../src/components/office/ClientsListView.native';
import { EmployeesListView } from '../../src/components/office/EmployeesListView.native';
import { TenantCompanyEditorForms } from '../../src/components/tenant/forms/TenantCompanyEditorForms.native';
import { NativeNotes } from '../../src/screens/office/OfficeNotesScreen.native';
import { CompanyInventoryWorkspace } from '../../src/components/company/CompanyInventoryWorkspace.native';
import { MobileHeading, MobileSheet, MobileButton, m } from '../../src/components/mobile/MobileWorkspace';
import { permissions, tenantId, snapshot } from './administration-preview-mocks';
const noop=()=>{};
function Preview(){
 const page=new URLSearchParams(location.search).get('screen')??'desktop';
 const [form,setForm]=useState(snapshot),[tab,setTab]=useState('overview');
 if(page==='desktop')return <CommandCenterScreen/>;
 if(page==='company')return <ScrollView><CompanyWorkspaceView snapshot={snapshot} tab={tab} onTab={setTab} activeAreas={['Office','Assist']} canEdit canDocuments canInventory refreshing={false} onRefresh={noop} onOpen={noop} onCustomField={noop} onCopy={noop} onDocuments={noop}/></ScrollView>;
 if(!['clients','employees','company-editor','inventory','notes'].includes(page))return <PortalPreview screen={page}/>;
 return <View style={[m.page,{padding:16}]}>{page==='notes'?<NativeNotes actor={{tenantId,userId:'visual-person',roleKey:'business_admin',permissions}}/>:page==='clients'?<ClientsListView/>:page==='employees'?<EmployeesListView/>:page==='inventory'?<CompanyInventoryWorkspace tenantId={tenantId} roleKey="business_admin" actorProfileId="visual-person" effectivePermissions={permissions}/>:<><MobileHeading title="Unternehmen" subtitle="Ihre Unternehmensakte" icon="briefcase"/><MobileSheet visible title="Unternehmensprofil bearbeiten" onClose={noop} footer={<MobileButton primary label="Änderungen speichern" onPress={noop}/>}><TenantCompanyEditorForms section="company" value={form} onChange={setForm}/></MobileSheet></>}</View>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
