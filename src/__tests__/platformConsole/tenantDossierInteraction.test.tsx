// @vitest-environment happy-dom
import React, {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({page:vi.fn(),summary:vi.fn()}));
vi.mock('@/lib/platformConsole/tenantDossierService.web',()=>({getTenantDossierPage:api.page,getTenantDossier:api.summary}));
import {TenantDossierDataBrowser,TenantDossierFields,TenantDossierHeader,TenantDossierHistory,TenantDossierOverview,TenantSetupPanel} from '@/screens/platformConsole/TenantDossierWorkspace.web';
import type {TenantDossier} from '@/lib/platformConsole/tenantDossierModel';
const dossier:TenantDossier={tenantId:'a',checkedAt:'2026-10-09T01:00:00Z',company:{name:'Firma A',status:'active',legal_form:'Einzelunternehmen',industry:'Alltagsbegleitung',street:'Testweg',postal_code:'12345',city:'Berlin',country:'DE',email:'a@example.test',phone:'123',representative_name:'Anna'},platform:{},branding:{logo_url:'https://example.test/a.png'},billing:null,bank:null,portal:null,tax:null,register:null,counts:{clients:{total:1055,active:1055,deleted:1,complete:1000,portalEnabled:0,portalLinked:0},employees:{total:2,active:2,deleted:0,complete:1,portalEnabled:0,portalLinked:0},accounts:3,adminAccounts:1,loggedInAccounts:0,lastLoginAt:null,services:0,pricedServices:0,assignments:5,documents:7},sections:[{key:'clients',label:'Klient:innen',scope:'clients',available:true,count:1056,updatedAt:null},{key:'client_contacts',label:'Kontaktpersonen',scope:'clients',available:true,count:2,updatedAt:null},{key:'tenants',label:'Unternehmensstammdaten',scope:'company',available:true,count:1,updatedAt:null}]};
const row={id:'person-1',tenant_id:'a',first_name:'Anna',last_name:'Test',client_number:'K-1',street:'Testweg',postal_code:'12345',city:'Berlin',status:'active',updated_at:'2026-10-09T01:00:00Z',care_level:'2',email:'anna@example.test'};
const page=(id='a',section='clients',rows:any[]=[row],offset=0,total=1055)=>({ok:true,data:{tenantId:id,section,rows,total,offset,limit:50,hasMore:offset+rows.length<total,checkedAt:'2026-10-09T01:00:00Z',available:true,statuses:['active','inactive']}});
let host:HTMLDivElement,root:Root;
const button=(text:string)=>[...host.querySelectorAll('button')].find(node=>node.textContent===text)!;
const flush=async()=>{await act(async()=>{await vi.advanceTimersByTimeAsync(300);});};
const render=async(node:React.ReactNode)=>{await act(async()=>root.render(node));await flush();};
const click=async(text:string)=>{await act(async()=>button(text).click());await flush();};
const write=async(label:string,value:string)=>{const el=[...host.querySelectorAll('label')].find(node=>node.textContent?.startsWith(label))!.querySelector('input,select') as HTMLInputElement;await act(async()=>{const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});await flush();};
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};api.page.mockImplementation(async(id:string,q:any)=>page(id,q.section,[row],q.offset));host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();});
it('shows actual counts, logo, a transparent percentage and opens the requested view',async()=>{
  const open=vi.fn();await render(<><TenantDossierHeader dossier={dossier} onOpen={open}/><TenantDossierOverview dossier={dossier} onOpen={open}/></>);
  expect(host.textContent).toContain('1055 Klient:innen');expect(host.querySelector('img')?.getAttribute('src')).toBe('https://example.test/a.png');
  expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toMatch(/^\d+$/);
  await click('Klient:innen öffnenStammdaten, Kontakt, Versorgung und Budgets');expect(open).toHaveBeenCalledWith('clients');
});
it('paginates the whole dataset and resets the page when a server search changes',async()=>{
  await render(<TenantDossierDataBrowser dossier={dossier} scope="clients" initialSection="clients"/>);
  expect(host.textContent).toContain('1055 passende Datensätze');await click('Weitere Datensätze');expect(api.page).toHaveBeenLastCalledWith('a',expect.objectContaining({offset:50,section:'clients'}));
  await write('Suchen','Berlin');expect(api.page).toHaveBeenLastCalledWith('a',expect.objectContaining({offset:0,search:'Berlin'}));
  await write('Status','inactive');expect(api.page).toHaveBeenLastCalledWith('a',expect.objectContaining({status:'inactive',offset:0}));
});
it('opens all saved fields and sends the exact parent when related records are selected',async()=>{
  await render(<TenantDossierDataBrowser dossier={dossier} scope="clients" initialSection="clients"/>);await click('Alle Angaben');
  expect(host.querySelector('dialog')?.textContent).toContain('Pflegegrad');expect(host.querySelector('dialog')?.textContent).toContain('anna@example.test');
  await click('Zugehörige Angaben und Akten');expect(api.page).toHaveBeenLastCalledWith('a',expect.objectContaining({section:'client_contacts',parentId:'person-1'}));
});
it('ignores a late response after changing the displayed company',async()=>{
  let resolve!:(value:any)=>void;api.page.mockImplementationOnce(()=>new Promise(r=>resolve=r));
  await render(<TenantDossierDataBrowser dossier={dossier} scope="clients" initialSection="clients"/>);
  api.page.mockImplementation(async(id:string,q:any)=>page(id,q.section,[{...row,tenant_id:'b',first_name:'Firma B'}]));
  await render(<TenantDossierDataBrowser dossier={{...dossier,tenantId:'b'}} scope="clients" initialSection="clients"/>);
  await act(async()=>resolve(page('a','clients',[{...row,first_name:'Alte Firma A'}])));expect(host.textContent).toContain('Firma B');expect(host.textContent).not.toContain('Alte Firma A');
});
it('keeps the search after a failed request and offers a successful retry',async()=>{
  await render(<TenantDossierDataBrowser dossier={dossier} scope="clients" initialSection="clients"/>);api.page.mockResolvedValueOnce({ok:false,error:'Verbindung unterbrochen'});await write('Suchen','Anna');
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Verbindung unterbrochen');expect((host.querySelector('input[maxlength="200"]') as HTMLInputElement).value).toBe('Anna');await click('Erneut laden');expect(host.textContent).toContain('Anna Test');
});
it('preserves zero and false, shows missing fields explicitly and hides authentication keys',async()=>{
  await render(<div className="cs-console"><TenantDossierFields row={{weekly_hours:0,portal_enabled:false,email:null,api_key:'do-not-show'}}/></div>);
  expect(host.textContent).toContain('Nein');expect(host.textContent).toContain('Nicht hinterlegt');expect(host.textContent).toContain('0');expect(host.textContent).not.toContain('do-not-show');
});
it('shows missing setup criteria with their source and opens the matching data section',async()=>{
  const open=vi.fn();await render(<TenantSetupPanel dossier={dossier} onSection={open}/>);expect(host.textContent).toContain('Rechnungspräfix');expect(host.textContent).toContain('Nachweis:');
  const steps=[...host.querySelectorAll('article')];await act(async()=>steps.find(node=>node.textContent?.includes('Bankverbindung'))!.querySelector('button')!.click());expect(open).toHaveBeenCalledWith('tenant_bank_accounts');
});
it('renders stored actor, timing and before/after changes in the history',async()=>{
  api.page.mockResolvedValue(page('a','history',[{id:'event',action:'tenant.record_updated',actor_name:'Inhaber',created_at:'2026-10-09T01:00:00Z',area:'tenants',source:'Plattformprotokoll',reason:'Adresse korrigiert',before:{city:'Herne',secret:'credential-never-render-123'},after:{city:'Dortmund',secret:'credential-never-render-456'}}],0,1));
  await render(<TenantDossierHistory tenantId="a"/>);expect(host.textContent).toContain('Inhaber');expect(host.textContent).toContain('Herne');expect(host.textContent).toContain('Dortmund');expect(host.textContent).not.toContain('credential-never-render');expect(host.textContent).toContain('Adresse korrigiert');
});
