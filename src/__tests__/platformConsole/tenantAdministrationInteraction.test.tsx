// @vitest-environment happy-dom
import React, {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({accounts:vi.fn(),manage:vi.fn(),contracts:vi.fn(),plans:vi.fn(),assign:vi.fn(),addons:vi.fn(),assigned:vi.fn(),versions:vi.fn(),addonAssign:vi.fn(),reload:vi.fn()}));
vi.mock('@/hooks/useUnsavedWebChanges.web',()=>({useUnsavedWebChanges:()=>async()=>true}));
vi.mock('@/lib/platformConsole/platformAccountService',()=>({listPlatformAccounts:api.accounts,managePlatformAccount:api.manage}));
vi.mock('@/lib/platformConsole/platformOpsService',()=>({listPlatformPlans:api.plans}));
vi.mock('@/lib/platformConsole/platformOperatorDataService',()=>({listPlatformTenantSubscriptions:api.contracts,listPlatformAddonsCatalog:api.addons,listPlatformTenantAddons:api.assigned,listPlatformAddonVersions:api.versions}));
vi.mock('@/lib/platformConsole/platformFoundationService',()=>({assignPlatformPlanToTenant:api.assign,assignPlatformAddonToTenant:api.addonAssign,removePlatformAddonFromTenant:vi.fn()}));
import {TenantAccountsTab} from '@/screens/platformConsole/TenantAccountsTab.web';
import {TenantContractTab,TenantAddonsTab} from '@/screens/platformConsole/TenantContractsTab.web';
let host:HTMLDivElement,root:Root;
const account={id:'owner',display_name:'Geschäftsführung',username:'verwaltung',email:'old@example.test',role_key:'owner',status:'active',has_login:true,last_login_at:null,welcome:null};
const detail={tenant:{plan_key:'free_platform'},modules:[]} as any;
const button=(text:string)=>[...host.querySelectorAll('button')].find(node=>node.textContent===text)!;
const render=async(node:React.ReactNode)=>{await act(async()=>root.render(node));};
const click=async(text:string)=>{await act(async()=>button(text).click());};
const write=async(selector:string,value:string)=>{
  const node=host.querySelector(selector) as HTMLInputElement;
  await act(async()=>{
    const prototype=node.tagName==='SELECT'?HTMLSelectElement.prototype:node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(node,value);
    node.dispatchEvent(new Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));
  });
};
beforeEach(()=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();
  api.accounts.mockResolvedValue({ok:true,data:[account]});api.manage.mockResolvedValue({ok:true,data:{message:'Versand beauftragt'}});
  api.contracts.mockResolvedValue({ok:true,data:[]});api.plans.mockResolvedValue({ok:true,data:[{plan_key:'professional',plan_name:'Professional',monthly_price_cents:29900,yearly_price_cents:299000,currency:'EUR',status:'active'}]});
  api.addons.mockResolvedValue({ok:true,data:[{addon_key:'sms_pack',addon_name:'SMS-Paket',status:'active'}]});api.assigned.mockResolvedValue({ok:true,data:[]});api.versions.mockResolvedValue({ok:true,data:[]});api.assign.mockResolvedValue({ok:true,data:{}});
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('requires a valid changed email, explicit authorization, reason and typed destination',async()=>{
  await render(<TenantAccountsTab tenantId="a" role="platform_owner"/>);await click('Anmelde-E-Mail ändern');
  await write('input[type="email"]','new@example.test');expect(button('Korrektur prüfen').disabled).toBe(true);
  await act(async()=>(host.querySelector('input[type="checkbox"]') as HTMLInputElement).click());await click('Korrektur prüfen');
  expect(button('Bestätigen').disabled).toBe(true);await write('dialog textarea','Beauftragung geprüft');await write('dialog input','new@example.test');await click('Bestätigen');
  expect(api.manage).toHaveBeenCalledWith(expect.objectContaining({tenantId:'a',tenantUserId:'owner',action:'email_change',newEmail:'new@example.test',authorizationConfirmed:true,reason:'Beauftragung geprüft'}));
  expect(host.textContent).toContain('Versand beauftragt');expect(host.querySelector('dialog')).toBeNull();
});
it('preserves the request identity and inputs after a failed recovery send',async()=>{
  api.manage.mockResolvedValueOnce({ok:false,error:'Versand nicht bestätigt'});
  await render(<TenantAccountsTab tenantId="a" role="platform_owner"/>);await click('Passwort wiederherstellen');await write('dialog textarea','Auftrag der Geschäftsführung');await click('Bestätigen');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Versand nicht bestätigt');
  expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Auftrag der Geschäftsführung');
  await click('Bestätigen');expect(api.manage).toHaveBeenCalledTimes(2);expect(api.manage.mock.calls[0][0].nonce).toBe(api.manage.mock.calls[1][0].nonce);
});
it('does not let readers or an account under review start an account action',async()=>{
  await render(<TenantAccountsTab tenantId="a" role="platform_readonly"/>);expect(button('Passwort wiederherstellen')).toBeUndefined();
  api.accounts.mockResolvedValue({ok:true,data:[{...account,open_operation:{state:'needs_review'}}]});
  await render(<TenantAccountsTab key="blocked" tenantId="a" role="platform_owner"/>);expect(button('Anmelde-E-Mail ändern')).toBeUndefined();expect(host.textContent).toContain('bis zur Klärung gesperrt');
});
it('ignores accounts arriving after the displayed company has changed',async()=>{
  let resolve!:(value:any)=>void;api.accounts.mockReturnValueOnce(new Promise(r=>{resolve=r;}));
  await render(<TenantAccountsTab tenantId="a" role="platform_owner"/>);
  api.accounts.mockResolvedValue({ok:true,data:[{...account,display_name:'Firma B'}]});await render(<TenantAccountsTab tenantId="b" role="platform_owner"/>);
  await act(async()=>resolve({ok:true,data:[{...account,display_name:'Firma A'}]}));expect(host.textContent).toContain('Firma B');expect(host.textContent).not.toContain('Firma A');
});
it.each([TenantContractTab, TenantAddonsTab])('replaces a retired company purchase view with free usage without catalog requests',async Component=>{
  await render(<Component tenantId="a" role="platform_owner" detail={detail} onReload={api.reload}/>);
  expect(host.textContent).toContain('vollständig kostenlos');
  expect(host.textContent).toContain('derzeit nicht verfügbar');
  expect(host.querySelector('select')).toBeNull();
  expect(host.querySelector('button')).toBeNull();
  for (const request of [api.contracts,api.plans,api.addons,api.assigned,api.versions,api.assign,api.addonAssign]) expect(request).not.toHaveBeenCalled();
});
