import React from 'react';
import {ScrollView,View} from 'react-native';
import {AcademyWorkspaceView} from '../../src/features/akademie/AcademyWorkspace.native';
import {ConsultationWorkspaceView} from '../../src/features/beratung/ConsultationWorkspace.native';
import {CentralCatalogWorkspace} from '../../src/components/documents/CentralCatalogWorkspace.native';
import {academyWorkspace,consultationWorkspace,catalogProps,reject} from './professional-workspaces-data';
const noop=()=>{};
export function ProfessionalPreview({screen}){return <ScrollView style={{flex:1,minHeight:0}} contentContainerStyle={{padding:16}}><View style={{width:'100%',minWidth:0}}>{screen==='academy'?<AcademyWorkspaceView workspace={academyWorkspace} view="office" loading={false} busy={false} error={null} notice={null} onCommand={reject} onReload={noop} onDownloadCertificate={reject}/>:screen==='consultation'?<ConsultationWorkspaceView workspace={consultationWorkspace} employeeView={false} loading={false} busy={false} error={null} notice={null} onCommand={reject} onReload={noop} onOpenCase={noop}/>:<CentralCatalogWorkspace {...catalogProps}/>}</View></ScrollView>;}
