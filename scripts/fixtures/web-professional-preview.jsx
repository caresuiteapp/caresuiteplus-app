import React from 'react';
import {AcademyWorkspaceView} from '../../src/features/akademie/AcademyWorkspace.web';
import {ConsultationWorkspaceView} from '../../src/features/beratung/ConsultationWorkspace.web';
import {CentralCatalogWorkspace} from '../../src/components/documents/CentralCatalogWorkspace.web';
import {CompanyInventoryWorkspace} from '../../src/components/company/CompanyInventoryWorkspace.web';
import {NotesWorkspace} from '../../src/components/office/notes/NotesWorkspace.web';
import {permissions,tenantId} from './administration-preview-mocks';
import {academyWorkspace,consultationWorkspace,catalogProps,reject} from './professional-workspaces-data';
const noop=()=>{};
export function WebProfessionalPreview({screen}){return <div style={{height:'100%',overflow:'auto',padding:16,boxSizing:'border-box'}}>{screen==='academy'?<AcademyWorkspaceView workspace={academyWorkspace} view="office" loading={false} busy={false} error={null} notice={null} onCommand={reject} onReload={noop} onDownloadCertificate={reject}/>:screen==='consultation'?<ConsultationWorkspaceView workspace={consultationWorkspace} employeeView={false} loading={false} busy={false} error={null} notice={null} onCommand={reject} onReload={noop} onOpenCase={noop}/>:screen==='inventory'?<CompanyInventoryWorkspace tenantId={tenantId} roleKey="business_admin" actorProfileId="visual-person" effectivePermissions={permissions}/>:screen==='notes'?<NotesWorkspace actor={{tenantId,userId:'visual-person',roleKey:'business_admin',permissions}}/>:<CentralCatalogWorkspace {...catalogProps}/>}</div>;}
