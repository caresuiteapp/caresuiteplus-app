// @vitest-environment happy-dom
// Actual status/retry component; UI primitives and service calls are boundaries.
// This proves DOM behavior, not wide/narrow visual rendering.
import {act,StrictMode,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({load:vi.fn(),prepare:vi.fn()}));
vi.mock('@/lib/gkvExchange/assistOriginalClient.web',()=>({loadPersonalAssistOriginal:api.load}));
vi.mock('@/lib/assist/repositories/assignmentRepository.supabase.web',()=>({assignmentSupabaseRepository:{prepareServiceRecord:api.prepare}}));
vi.mock('@/components/ui',()=>({
 PremiumCard:({children}:{children:ReactNode})=><section>{children}</section>,
 PremiumButton:({title,disabled,onPress}:{title:string;disabled?:boolean;onPress:()=>void})=><button disabled={disabled} onClick={onPress}>{title}</button>,
 InfoBanner:({message}:{message:string})=><p role="alert">{message}</p>,
}));
vi.mock('@/design/web/webFontSize',()=>({webScaledFontMetric:(v:number)=>v}));
import {GkvAssistCompletion} from '@/components/portal/GkvAssistCompletion.web';
const scope={tenantId:'11111111-1111-4111-8111-111111111111',assignmentId:'22222222-2222-4222-8222-222222222222',
 actorId:'33333333-3333-4333-8333-333333333333',employeeId:'44444444-4444-4444-8444-444444444444'};
const ready={...scope,phase:'ready'},sealed={...scope,phase:'sealed'};
let root:Root,container:HTMLDivElement;
const render=async(props=scope,disabled=false)=>act(async()=>root.render(<StrictMode><GkvAssistCompletion {...props} disabled={disabled}/></StrictMode>));
const button=(text:string)=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent===text);
const click=async(text:string)=>act(async()=>button(text)!.click());
describe('Personal Assist original completion panel',()=>{
 beforeEach(()=>{
  (globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  vi.resetAllMocks();api.load.mockResolvedValue(ready);api.prepare.mockResolvedValue({ok:true,data:{id:'record'}});
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
 });
 afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
 it('does not mutate on load and hides an absent or legacy installation',async()=>{
  for(const value of [null,{...ready,phase:'legacy'}]){
   api.load.mockResolvedValue(value);await render({...scope,assignmentId:crypto.randomUUID()});expect(container.textContent).toBe('');
  }expect(api.prepare).not.toHaveBeenCalled();
 });
 it('shows the unfinished final-original step, with a separate monthly confirmation',async()=>{
  await render();expect(container.textContent).toContain('muss noch abgeschlossen werden');expect(button('Nachweis abschließen')).toBeDefined();
  expect(container.textContent).toContain('Monatsnachweises');expect(api.prepare).not.toHaveBeenCalled();
 });
 it('shows captured content awaiting portal signature, then allows explicit completion after refresh',async()=>{
  api.load.mockResolvedValue({...ready,phase:'awaiting_signature'});await render();
  expect(container.textContent).toContain('Leistungsinhalt ist persönlich erfasst und gesichert');
  expect(button('Nachweis abschließen')).toBeUndefined();expect(api.prepare).not.toHaveBeenCalled();
  api.load.mockResolvedValue(ready);await click('Nachweisstand aktualisieren');expect(button('Nachweis abschließen')).toBeDefined();
  expect(api.prepare).not.toHaveBeenCalled();
  api.load.mockResolvedValueOnce(ready).mockResolvedValueOnce(sealed);await click('Nachweis abschließen');
  expect(container.textContent).toContain('Nachweisverwaltung sind bestätigt');
 });
 it('rechecks personal scope, completes and only then confirms bytes and handoff',async()=>{
  await render();api.load.mockResolvedValueOnce(ready).mockResolvedValueOnce(sealed);await click('Nachweis abschließen');
  expect(api.prepare).toHaveBeenCalledExactlyOnceWith(scope.tenantId,scope.assignmentId);
  expect(container.textContent).toContain('PDF und Übergabe an die Nachweisverwaltung sind bestätigt');
  expect(button('Nachweis abschließen')).toBeUndefined();
 });
 it('keeps a failed byte handoff visible and allows an explicit retry',async()=>{
  api.load.mockResolvedValue(sealed);api.prepare.mockResolvedValueOnce({ok:false,error:'PDF-Antwort verloren'}).mockResolvedValueOnce({ok:true,data:{id:'record'}});
  await render();await click('PDF und Übergabe prüfen');expect(container.querySelector('[role="alert"]')?.textContent).toBe('PDF-Antwort verloren');
  expect(container.textContent).not.toContain('Nachweisverwaltung sind bestätigt');await click('PDF und Übergabe prüfen');expect(api.prepare).toHaveBeenCalledTimes(2);
 });
 it('locks duplicate clicks and does not write when externally blocked',async()=>{
  await render(scope,true);expect(button('Nachweis abschließen')!.disabled).toBe(true);await click('Nachweis abschließen');expect(api.prepare).not.toHaveBeenCalled();
  await render();let resolve!: (r:unknown)=>void;api.prepare.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  await click('Nachweis abschließen');expect(button('Nachweis abschließen')!.disabled).toBe(true);await click('Nachweis abschließen');expect(api.prepare).toHaveBeenCalledOnce();
  api.load.mockResolvedValue(sealed);await act(async()=>resolve({ok:true,data:{id:'record'}}));
 });
 it('ignores late responses after a tenant/account change',async()=>{
  let resolve!: (v:unknown)=>void;api.load.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));await render();
  api.load.mockResolvedValue(null);await render({...scope,tenantId:crypto.randomUUID(),actorId:crypto.randomUUID()});
  await act(async()=>resolve(sealed));expect(container.textContent).toBe('');expect(api.prepare).not.toHaveBeenCalled();
 });
 it('permission/revocation failures remain unconfirmed without calling completion',async()=>{
  await render();api.load.mockRejectedValue(Error('Persönliche Freigabe widerrufen'));await click('Nachweis abschließen');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('widerrufen');expect(api.prepare).not.toHaveBeenCalled();
 });
 it('does not claim completion for a null record or missing final source',async()=>{
  await render();api.prepare.mockResolvedValue({ok:true,data:null});await click('Nachweis abschließen');expect(container.querySelector('[role="alert"]')).not.toBeNull();
  api.prepare.mockResolvedValue({ok:true,data:{id:'record'}});api.load.mockResolvedValue(ready);await click('Nachweis abschließen');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Originalfassung');expect(container.textContent).not.toContain('Nachweisverwaltung sind bestätigt');
 });
});
