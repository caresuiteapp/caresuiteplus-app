import React, { useState } from 'react';
import {ProfessionalPreview} from './native-professional-preview';
import { CompanyWorkspaceView } from '../../src/components/company/CompanyWorkspaceView';
import { PortalPreview } from './native-portals-preview';
import { createRoot } from 'react-dom/client';
import { View, Text, ScrollView } from 'react-native';
import { CommandCenterScreen } from '../../src/liquid-command/screens/CommandCenterScreen.native';
import { ClientsListExperience as ClientsListView } from '../../src/components/office/ClientsListExperience.native';
import { EmployeesListExperience as EmployeesListView } from '../../src/components/office/EmployeesListExperience.native';
import { COMPANY_EDITOR_CSS,TenantCompanyEditorForms } from '../../src/components/tenant/forms/TenantCompanyEditorForms.native';
import {NativeDiv,NativeWorkspaceStyleScope} from '../../src/components/layout/NativeWorkspaceElements.native';
import { NotesWorkspace } from '../../src/components/office/notes/NotesWorkspace.native';
import { CompanyInventoryWorkspace } from '../../src/components/company/CompanyInventoryWorkspace.native';
import { MobileHeading, MobileSheet, MobileButton, m } from '../../src/components/mobile/MobileWorkspace';
import { permissions, tenantId, snapshot } from './administration-preview-mocks';
const noop=()=>{};
function Preview(){
 const page=new URLSearchParams(location.search).get('screen')??'desktop';
 const [form,setForm]=useState(snapshot),[tab,setTab]=useState('overview');
 if(['academy','consultation','catalog'].includes(page))return <ProfessionalPreview screen={page}/>;
 if(page==='desktop')return <CommandCenterScreen/>;
 if(page==='company')return <ScrollView><CompanyWorkspaceView snapshot={snapshot} tab={tab} onTab={setTab} activeAreas={['Office','Assist']} canEdit canDocuments canInventory refreshing={false} onRefresh={noop} onOpen={noop} onCustomField={noop} onCopy={noop} onDocuments={noop}/></ScrollView>;
 if(!['clients','employees','company-editor','inventory','notes'].includes(page))return <PortalPreview screen={page}/>;
 return <View style={[m.page,{padding:16}]}>{page==='notes'?<NotesWorkspace actor={{tenantId,userId:'visual-person',roleKey:'business_admin',permissions}}/>:page==='clients'?<ClientsListView/>:page==='employees'?<EmployeesListView/>:page==='inventory'?<CompanyInventoryWorkspace tenantId={tenantId} roleKey="business_admin" actorProfileId="visual-person" effectivePermissions={permissions}/>:<><MobileHeading title="Unternehmen" subtitle="Ihre Unternehmensakte" icon="briefcase"/><MobileSheet visible title="Unternehmensprofil bearbeiten" onClose={noop} footer={<MobileButton primary label="Änderungen speichern" onPress={noop}/>}><NativeWorkspaceStyleScope css={[COMPANY_EDITOR_CSS]}><NativeDiv className="cs-company-editor"><TenantCompanyEditorForms section="company" value={form} onChange={setForm} errors={{}}/></NativeDiv></NativeWorkspaceStyleScope></MobileSheet></>}</View>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
