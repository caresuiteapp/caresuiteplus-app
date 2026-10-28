// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,it,expect,vi} from 'vitest';
const f=vi.hoisted(()=>({path:'',section:undefined as unknown,target:''}));
vi.mock('expo-router',()=>({usePathname:()=>f.path,useLocalSearchParams:()=>({section:f.section}),Redirect:({href}:any)=>{f.target=href;return null;}}));
vi.mock('react-native',()=>({Platform:{OS:'android'}}));
import Layout from '../../../app/liquid-command/_layout';
describe('legacy portal entry target preservation',()=>{
 it.each([
  ['/liquid-command/portal/family',undefined,'/portal/client'],
  ['/liquid-command/portal/family','messages','/portal/client/messages'],
  ['/liquid-command/portal/client','documents','/portal/client/documents'],
  ['/liquid-command/portal/employee','logbook','/portal/employee/fahrtenbuch'],
  ['/liquid-command/portal/employee','assignments','/portal/employee/assignments'],
  ['/liquid-command/portal/family','https://untrusted.invalid','/portal/client'],
  ['/liquid-command/portal/client',['messages','documents'],'/portal/client'],
 ])('preserves %s section %s at %s',async(path,section,target)=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;f.path=path;f.section=section;
  const host=document.createElement('div'),root=createRoot(host);
  try{await act(async()=>root.render(<Layout/>));expect(f.target).toBe(target);}finally{await act(async()=>root.unmount());}
 });
});
