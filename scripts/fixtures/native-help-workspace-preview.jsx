import React, {useState} from 'react';
import {ScrollView,View} from 'react-native';
import {HelpCenterView} from '../../src/components/help/HelpCenterView.native';
import {WorkspaceDashboard} from '../../src/components/googleWorkspace/WorkspaceDashboard.native';
import {NativeDiv} from '../../src/components/layout/NativeWorkspaceElements.native';

/** The same native presentations, with local fixture providers supplied by the layout runner. */
export function HelpWorkspacePreview({screen}){
 const [state,setState]=useState(screen==='help-article'?{article:'dokument-logo'}:{});
 if(screen.startsWith('help'))return <View style={{flex:1,minHeight:0,padding:12,backgroundColor:'#f2f7fd'}}><NativeDiv style={{flex:1,minHeight:0,overflowY:'auto'}}><HelpCenterView state={state} onNavigate={setState} onOpenRoute={route=>{window.__previewRoute=route;}} onClose={()=>{window.__previewRoute='/Desktop';}}/></NativeDiv></View>;
 return <ScrollView style={{flex:1,minHeight:0,backgroundColor:'#f2f7fd'}} contentContainerStyle={{padding:12,paddingBottom:28}}><WorkspaceDashboard initialTab={screen==='google-service'?'calendar':'overview'} callbackResult="connected"/></ScrollView>;
}
