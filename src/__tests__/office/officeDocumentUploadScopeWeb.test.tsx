// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OfficeDocumentUploadScreen } from '@/screens/office/OfficeDocumentUploadScreen.web';
const h=vi.hoisted(()=>({tenant:'tenant-a',upload:vi.fn(),clients:vi.fn(),read:vi.fn(),navigationGuard:null as (()=>boolean)|null,profile:{id:'profile-a',roleKey:'business_admin'}}));
vi.mock('@/hooks/useTenantId',()=>({useServiceTenantId:()=>h.tenant}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({profile:h.profile})}));
vi.mock('@/hooks/usePermissions',()=>({usePermissions:()=>({can:()=>true})}));
vi.mock('@/components/documents/DocumentsWorkspaceShell.web',()=>({DocumentsWorkspaceShell:({children,beforeNavigate}:{children:React.ReactNode;beforeNavigate?:()=>boolean})=>{h.navigationGuard=beforeNavigate??null;return <main>{children}</main>;},DocumentWorkspaceIcon:()=>null}));
vi.mock('@/components/office/officeDocumentWorkspace.web',()=>({officeDocumentWorkspaceCss:'',documentSize:()=> '3 B'}));
vi.mock('@/lib/office/officeDocumentsService.web',()=>({loadOfficeUploadClients:h.clients,uploadOfficeDocument:h.upload,OFFICE_UPLOAD_MAX_BYTES:20*1024*1024}));
let container:HTMLDivElement;let root:ReturnType<typeof createRoot>;
beforeEach(()=>{h.tenant='tenant-a';vi.clearAllMocks();h.clients.mockResolvedValue({ok:true,data:[{id:'client-a',name:'Ada Test'}]});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it('discards an old upload result even when the user switches away and back to the same tenant',async()=>{
  let complete!:(value:unknown)=>void;h.upload.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
  class Reader {result:string|null=null;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;readAsDataURL(){this.result='data:application/pdf;base64,cGRm';this.onload?.();}}
  vi.stubGlobal('FileReader',Reader);
  await act(async()=>root.render(<OfficeDocumentUploadScreen/>));
  const fileInput=container.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(fileInput,'files',{value:[new File(['pdf'],'Beleg.pdf',{type:'application/pdf'})],configurable:true});
  await act(async()=>{fileInput.dispatchEvent(new Event('change',{bubbles:true}));});
  const selects=container.querySelectorAll('select');
  await act(async()=>{selects[0].value='client-a';selects[0].dispatchEvent(new Event('change',{bubbles:true}));selects[1].value='sonstige';selects[1].dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>{container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  expect(h.upload).toHaveBeenCalledTimes(1);
  h.tenant='tenant-b';await act(async()=>root.render(<OfficeDocumentUploadScreen/>));
  h.tenant='tenant-a';await act(async()=>root.render(<OfficeDocumentUploadScreen/>));
  await act(async()=>complete({ok:true,data:{id:'old-document',storagePath:'old-path'}}));
  expect(container.textContent).not.toContain('Das Dokument wurde gespeichert');
  expect(container.querySelector<HTMLInputElement>('input[type=file]')!.files?.length??0).toBe(0);
  expect(container.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
});

it('allows only one upload for two submits in the same event turn and blocks navigation until completion',async()=>{
  let complete!:(value:unknown)=>void;h.upload.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
  class Reader {result:string|null=null;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;readAsDataURL(){h.read();this.result='data:application/pdf;base64,cGRm';this.onload?.();}}
  vi.stubGlobal('FileReader',Reader);
  await act(async()=>root.render(<OfficeDocumentUploadScreen/>));
  const fileInput=container.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(fileInput,'files',{value:[new File(['pdf'],'Beleg.pdf',{type:'application/pdf'})],configurable:true});
  await act(async()=>{fileInput.dispatchEvent(new Event('change',{bubbles:true}));});
  const selects=container.querySelectorAll('select');
  await act(async()=>{selects[0].value='client-a';selects[0].dispatchEvent(new Event('change',{bubbles:true}));selects[1].value='sonstige';selects[1].dispatchEvent(new Event('change',{bubbles:true}));});
  expect(h.navigationGuard?.()).toBe(true);
  await act(async()=>{const form=container.querySelector('form')!;form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));expect(h.navigationGuard?.()).toBe(false);});
  expect(h.read).toHaveBeenCalledTimes(1);
  expect(h.upload).toHaveBeenCalledTimes(1);
  expect(h.navigationGuard?.()).toBe(false);
  await act(async()=>complete({ok:true,data:{id:'saved-document',storagePath:'saved-path'}}));
  expect(h.navigationGuard?.()).toBe(true);
});
