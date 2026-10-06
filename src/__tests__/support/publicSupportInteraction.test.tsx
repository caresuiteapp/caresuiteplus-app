// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({invoke:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/supabase/edgeFunctions',()=>({invokeEdgeFunction:api.invoke}));
vi.mock('@/lib/support/supportService.web',()=>({supportRpc:api.rpc}));
vi.mock('@/liquid-command/components/PublicAccessShell.web',()=>({PublicAccessShell:({children}:any)=><main>{children}</main>}));
vi.mock('@/liquid-command/components/LiquidPrimitives',()=>({LiquidSurface:({children}:any)=><section>{children}</section>}));
import PublicSupportScreen from '../../../app/support/index.web';
import {PublicSupportQueue} from '@/components/support/PublicSupportQueue.web';
let host:HTMLDivElement;let root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;api.invoke.mockReset();api.rpc.mockReset();host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=async(node:React.ReactNode)=>{await act(async()=>root.render(node));};
async function write(id:string,value:string) {
  const element=host.querySelector(`#${id}`) as HTMLInputElement|HTMLTextAreaElement;
  await act(async()=>{const proto=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));});
}
async function fill() {await write('support-name','Anna Beispiel');await write('support-email','anna@example.test');await write('support-subject','Anmeldung funktioniert nicht');await write('support-message','Ich kann mich mit meinen Zugangsdaten nicht anmelden.');await act(async()=>{(host.querySelector('input[type=checkbox]') as HTMLInputElement).click();});}
const submit=async()=>{await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));};
const click=async(text:string)=>{await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent?.includes(text))!.click();});};
describe('public support form',()=>{
  it('submits without an auth context and displays a real confirmed reference',async()=>{
    api.invoke.mockResolvedValue({ok:true,data:{reference:'PUB-000123'}});await render(<PublicSupportScreen/>);await fill();await submit();
    expect(api.invoke).toHaveBeenCalledWith('public-support-ticket',expect.objectContaining({email:'anna@example.test',privacyAccepted:true}));
    expect(host.textContent).toContain('PUB-000123');expect(host.querySelector('form')).toBeNull();
  });
  it('retains inputs and the same nonce after an uncertain response, then clears only after confirmation',async()=>{
    api.invoke.mockResolvedValueOnce({ok:false,error:'Verbindung unterbrochen'}).mockResolvedValueOnce({ok:true,data:{reference:'PUB-000456'}});
    await render(<PublicSupportScreen/>);await fill();await submit();
    expect((host.querySelector('#support-message') as HTMLTextAreaElement).value).toContain('Zugangsdaten');expect(host.textContent).toContain('Verbindung unterbrochen');
    const first=api.invoke.mock.calls[0][1].nonce;await submit();expect(api.invoke.mock.calls[1][1].nonce).toBe(first);expect(host.textContent).toContain('PUB-000456');
  });
  it('locks inputs during submission and never accepts an empty backend response as a saved ticket',async()=>{
    let finish!:(v:unknown)=>void;api.invoke.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
    await render(<PublicSupportScreen/>);await fill();await submit();
    expect(host.querySelector('fieldset')!.disabled).toBe(true);await submit();expect(api.invoke).toHaveBeenCalledTimes(1);
    await act(async()=>finish({ok:true,data:{}}));expect(host.textContent).toContain('nicht bestätigt');expect(host.querySelector('form')).not.toBeNull();
  });
});
describe('public support operator inbox',()=>{
  const ticket={id:'ticket',reference:'PUB-000123',name:'Anna',email:'anna@example.test',organization:'Firma',subject:'Login-Hilfe',category:'account',message:'<script>Dieser Text ist kein HTML.</script>',status:'open',created_at:'2026-10-06T04:00:00Z'};
  it('shows contact data as text and changes status only after a confirmed RPC',async()=>{
    api.rpc.mockImplementation(async(name:string)=>name==='support_list_public_tickets'?{tickets:[ticket]}:false);
    await render(<PublicSupportQueue canWrite/>);await click('PUB-000123');expect(host.querySelector('script')).toBeNull();expect(host.textContent).toContain(ticket.message);
    const select=host.querySelector('select[aria-label="Ticketstatus bearbeiten"]') as HTMLSelectElement;
    await act(async()=>{select.value='resolved';select.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(host.textContent).toContain('nicht bestätigt');expect(api.rpc).toHaveBeenCalledWith('support_set_public_ticket_status',{p_ticket_id:'ticket',p_status:'resolved'});
  });
  it('removes stale ticket details if the server denies access on refresh',async()=>{
    api.rpc.mockResolvedValueOnce({tickets:[ticket]}).mockRejectedValueOnce(new Error('Zugriff beendet'));
    await render(<PublicSupportQueue canWrite={false}/>);await click('PUB-000123');expect(host.textContent).toContain(ticket.email);
    await click('Aktualisieren');expect(host.textContent).toContain('Zugriff beendet');expect(host.textContent).not.toContain(ticket.email);
  });
});
