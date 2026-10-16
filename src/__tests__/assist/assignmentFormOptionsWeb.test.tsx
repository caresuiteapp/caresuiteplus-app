// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const f=vi.hoisted(()=>({tenant:'a',actor:'person-a',role:'business_admin',load:vi.fn(),value:{} as any}));
vi.mock('@/hooks/useTenantId',()=>({useServiceTenantId:()=>f.tenant}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({profile:{id:f.actor,roleKey:f.role}})}));
vi.mock('@/lib/assistCatalog',()=>({loadAssistAssignmentOptions:f.load}));
import {useAssignmentFormOptions} from '@/components/assist/useAssignmentFormOptions.web';
function Harness({enabled=true}:{enabled?:boolean}){f.value=useAssignmentFormOptions(enabled);return <span>{f.value.options?.subjects?.[0]?.label??f.value.error??'empty'}</span>}
function deferred(){let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve}}
let host:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();f.tenant='a';f.actor='person-a';f.role='business_admin';host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=async(enabled=true)=>{await act(async()=>root.render(<Harness enabled={enabled}/>))};
const options=(label:string)=>({ok:true,data:{subjects:[{itemKey:label,label}]}});
describe('Web form option ownership',()=>{
 it('clears previous tenant options immediately and rejects its late response',async()=>{const old=deferred(),current=deferred();f.load.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);await render();f.tenant='b';await render();await act(async()=>old.resolve(options('Alter Katalog')));expect(host.textContent).toBe('empty');expect(f.value.loading).toBe(true);await act(async()=>current.resolve(options('Neuer Katalog')));expect(host.textContent).toBe('Neuer Katalog');expect(f.load.mock.calls[1]).toEqual(['b','business_admin']);});
 it('clears an already visible catalog when the signed-in actor changes',async()=>{f.load.mockResolvedValueOnce(options('Person A'));await render();const next=deferred();f.load.mockReturnValueOnce(next.promise);f.actor='person-b';await render();expect(host.textContent).toBe('empty');await act(async()=>next.resolve(options('Person B')));expect(host.textContent).toBe('Person B');});
 it('surfaces a rejected request and supports retry without stale content',async()=>{f.load.mockRejectedValueOnce(new Error('Verbindung unterbrochen')).mockResolvedValueOnce(options('Geladen'));await render();expect(host.textContent).toBe('Verbindung unterbrochen');expect(f.value.loading).toBe(false);await act(async()=>f.value.reload());expect(host.textContent).toBe('Geladen');expect(f.load).toHaveBeenCalledTimes(2);});
 it('does not fetch hidden forms and rejects results from a closed form session',async()=>{const old=deferred();f.load.mockReturnValueOnce(old.promise);await render(false);expect(f.load).not.toHaveBeenCalled();await render();expect(f.load).toHaveBeenCalledOnce();await render(false);await act(async()=>old.resolve(options('Veraltet')));expect(host.textContent).toBe('empty');expect(f.value.loading).toBe(false);});
});
