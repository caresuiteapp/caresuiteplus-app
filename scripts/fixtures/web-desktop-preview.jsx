import React, {useState} from 'react';
import {WebProfessionalPreview} from './web-professional-preview';
import { createRoot } from 'react-dom/client';
import { CommandCenterScreen } from '../../src/liquid-command/screens/CommandCenterScreen.web';
import { CompanyWorkspaceView } from '../../src/components/company/CompanyWorkspaceView.web';
import { snapshot } from './administration-preview-mocks';
const noop=()=>{};
function Preview(){
 const [tab,setTab]=useState('overview');
 const screen=new URLSearchParams(location.search).get('screen')?.replace(/^web-/,'');
 if(['academy','consultation','catalog','inventory','notes'].includes(screen))return <WebProfessionalPreview screen={screen}/>;
 return new URLSearchParams(location.search).get('screen')==='web-company'
  ? <div style={{height:'100%',overflowY:'auto'}}><CompanyWorkspaceView snapshot={snapshot} tab={tab} onTab={setTab} activeAreas={['Office','Assist']} canEdit canDocuments canInventory refreshing={false} onRefresh={noop} onOpen={noop} onCustomField={noop} onCopy={noop} onDocuments={noop}/></div>
  : <CommandCenterScreen/>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
