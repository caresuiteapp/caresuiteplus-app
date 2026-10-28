// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({code:'ABCD2345',account:'account-a',token:'token-a',inspect:vi.fn(),decide:vi.fn(),push:vi.fn(),signOut:vi.fn(),clear:vi.fn(),remember:vi.fn()}));
vi.mock('expo-router',()=>({useLocalSearchParams:()=>({code:h.code}),useRouter:()=>({push:h.push})}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({authReady:true,isAuthenticated:true,portalSession:{tenantId:'tenant-a',accountId:h.account,sessionToken:h.token,roleKey:'client_portal',loginType:'client_portal'},profile:{id:h.account,roleKey:'client_portal'},user:{id:h.account},signOut:h.signOut})}));
vi.mock('@/lib/auth/tvDeviceLogin.web',()=>({TV_LOGIN_ROLES:[{role:'client',title:'Klient:innen',loginPath:'/auth/client-login'}],isTvUserCode:()=>true,inspectTvLogin:h.inspect,decideTvLogin:h.decide}));
vi.mock('@/lib/auth/tvDeviceLoginReturn.web',()=>({clearTvLoginReturn:h.clear,rememberTvLoginReturn:h.remember}));
import {PhoneDeviceApproval} from '@/components/auth/PhoneDeviceApproval.web';
let host:HTMLDivElement,root:Root;
function deferred(){let resolve!:(value:any)=>void;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};}
const inspection=()=>({role:'client',status:'pending',verificationCode:h.code==='ABCD2345'?'123456':'654321',expiresAt:'2099-01-01T00:00:00Z'});
const render=()=>act(async()=>root.render(<PhoneDeviceApproval/>));
const button=(label:string)=>[...host.querySelectorAll('button')].find(node=>node.textContent===label)!;
const match=()=>act(async()=>host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();h.code='ABCD2345';h.account='account-a';h.token='token-a';h.inspect.mockImplementation(async()=>inspection());h.decide.mockResolvedValue(undefined);h.remember.mockReturnValue(true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
describe('actual phone device approval request/identity boundaries',()=>{
 it('requires explicit matching consent before approving',async()=>{await render();expect(button('TV jetzt freigeben').disabled).toBe(true);expect(h.decide).not.toHaveBeenCalled();await match();await act(async()=>button('TV jetzt freigeben').click());expect(h.decide).toHaveBeenCalledWith('ABCD2345','123456','approve','token-a',expect.any(AbortSignal));});
 it('sends a decision only once for synchronous repeated activation',async()=>{const pending=deferred();h.decide.mockReturnValue(pending.promise);await render();const deny=button('Ablehnen');await act(async()=>{deny.click();deny.click();});expect(h.decide).toHaveBeenCalledTimes(1);await act(async()=>pending.resolve(undefined));});
 it('aborts an old decision and ignores its completion when the QR link changes',async()=>{const pending=deferred();h.decide.mockReturnValue(pending.promise);await render();await match();await act(async()=>button('TV jetzt freigeben').click());const signal=h.decide.mock.calls[0][4] as AbortSignal;h.code='WXYZ6789';await render();expect(signal.aborted).toBe(true);await act(async()=>pending.resolve(undefined));expect(host.textContent).not.toContain('TV-Zugang freigegeben');expect(host.textContent).toContain('654 321');expect(h.clear).not.toHaveBeenCalled();});
 it('requires fresh matching consent when a different account becomes active',async()=>{await render();await match();expect(host.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(true);h.account='account-b';h.token='token-b';await render();expect(host.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(false);expect(button('TV jetzt freigeben').disabled).toBe(true);});
 it('aborts a pending decision after the session identity changes',async()=>{const pending=deferred();h.decide.mockReturnValue(pending.promise);await render();await act(async()=>button('Ablehnen').click());const signal=h.decide.mock.calls[0][4] as AbortSignal;h.account='account-b';h.token='token-b';await render();expect(signal.aborted).toBe(true);await act(async()=>pending.resolve(undefined));expect(host.textContent).not.toContain('Diese Anfrage ist beendet');expect(h.clear).not.toHaveBeenCalled();});
});
