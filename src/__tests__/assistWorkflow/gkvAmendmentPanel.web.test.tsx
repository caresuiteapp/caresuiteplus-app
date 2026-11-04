// @vitest-environment happy-dom
import {act,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>({personal:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/gkvExchange/assistOriginalClient.web',()=>({personalAssistRpc:api.personal}));
vi.mock('@/components/ui',()=>({
 PremiumButton:({title,disabled,onPress}:{title:string;disabled?:boolean;onPress:()=>void})=><button disabled={disabled} onClick={onPress}>{title}</button>,
 InfoBanner:({message}:{message:string})=><p role="alert">{message}</p>,
}));
import {GkvAssistAmendments} from '@/components/portal/GkvAssistAmendments.web';
import type {AssistAmendment,AmendmentScope,AmendmentInput} from '@/lib/gkvExchange/assistAmendment';
const scope:AmendmentScope={tenantId:crypto.randomUUID(),assignmentId:crypto.randomUUID(),employeeId:crypto.randomUUID(),actorId:crypto.randomUUID(),proofId:crypto.randomUUID(),proofHash:'sha256:'+'a'.repeat(64)};
const original='Ursprünglich dokumentierte Unterstützung.';
let root:Root,container:HTMLDivElement,items:AssistAmendment[],transport:'ok'|'lost'|'not-sent'|'missing',writes:string[];
const button=(label:string)=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent===label);
const click=(name:string)=>act(async()=>{button(name)!.click();});
const render=(disabled=false,s=scope)=>act(async()=>root.render(<StrictMode><GkvAssistAmendments key={s.proofId} scope={s} disabled={disabled}/></StrictMode>));
beforeEach(()=>{
 (globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 vi.resetAllMocks();items=[];writes=[];transport='ok';api.personal.mockResolvedValue(api.rpc);
 api.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
  if(name==='gkv_assist_amendment_state'){
   if(transport==='missing')return {data:null,error:{code:'PGRST202',message:name}};
   const before=args.p_before as number|null,shown=items.filter(a=>!before||a.revision<before).slice(0,10);
   return {data:{contract:'gkv-assist-amendments-v1',...scope,originalText:original,revision:items.length,before,entries:shown,
    nextBefore:(shown.at(-1)?.revision??0)>1?shown.at(-1)?.revision:null,lookup:items.find(a=>a.id===args.p_lookup)??null},error:null};
  }
  expect(name).toBe('gkv_assist_amend_description');const id=String(args.p_request),input=args.p_input as AmendmentInput;writes.push(id);
  if(transport==='not-sent')throw Error('Anfrage nicht zugestellt');
  const a={...input,id,actorId:scope.actorId,employeeId:scope.employeeId,recordedAt:new Date().toISOString(),revision:input.revision+1};
  items.unshift(a);if(transport==='lost')throw Error('Antwort verloren');return {data:a,error:null};
 });
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
async function change(element:HTMLTextAreaElement,value:string){await act(async()=>{
 Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(element,value);
 element.dispatchEvent(new Event('input',{bubbles:true}));});}
async function edit(){
 await click('Beschreibung berichtigen');const fields=container.querySelectorAll('textarea');
 await change(fields[0],'Berichtigte Beschreibung der Unterstützung.');await change(fields[1],'Leistungsbeschreibung präzisiert.');
 await act(async()=>container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
}
it('reads without mutation, hides an absent installation and honors external blocking',async()=>{
 transport='missing';await render();expect(container.textContent).toBe('');expect(writes).toHaveLength(0);
 await act(async()=>root.unmount());root=createRoot(container);transport='ok';await render(true);
 expect(button('Beschreibung berichtigen')?.disabled).toBe(true);expect(writes).toHaveLength(0);
});
it('requires new text, reason and explicit acknowledgement; displays original and saved correction',async()=>{
 await render();await click('Beschreibung berichtigen');expect(button('Berichtigung speichern')?.disabled).toBe(true);
 const fields=container.querySelectorAll('textarea');await change(fields[0],'Berichtigte Beschreibung.');await change(fields[1],'Dokumentierten Fehler erläutert.');
 expect(button('Berichtigung speichern')?.disabled).toBe(true);await act(async()=>container.querySelector<HTMLInputElement>('input')!.click());
 await click('Berichtigung speichern');expect(writes).toHaveLength(1);expect(container.textContent).toContain(original);
 expect(container.textContent).toContain('Berichtigte Beschreibung.');expect(container.textContent).toContain('Berichtigung 1');
});
it('reads the exact lost acknowledgement without repeating the write',async()=>{
 await render();await edit();transport='lost';await click('Berichtigung speichern');expect(writes).toHaveLength(1);
 expect(button('Berichtigung speichern')).toBeUndefined();expect(button('Unverändert erneut senden')).toBeUndefined();
 await click('Speicherung prüfen');expect(writes).toHaveLength(1);expect(items).toHaveLength(1);expect(container.textContent).toContain('ist gespeichert');
});
it('only a checked absent job can be explicitly retried and keeps its identity',async()=>{
 await render();await edit();transport='not-sent';await click('Berichtigung speichern');expect(items).toHaveLength(0);
 transport='ok';await click('Speicherung prüfen');expect(writes).toHaveLength(1);await click('Unverändert erneut senden');
 expect(writes).toHaveLength(2);expect(writes[1]).toBe(writes[0]);expect(items).toHaveLength(1);
});
it('rejects a foreign receipt during recovery without reporting success',async()=>{
 await render();await edit();transport='lost';await click('Berichtigung speichern');items[0]={...items[0],description:'Anderer korrigierter Inhalt.'};
 await click('Speicherung prüfen');expect(container.querySelector('[role=alert]')?.textContent).toMatch(/passt nicht/);
 expect(container.textContent).not.toContain('Die Berichtigung ist gespeichert.');expect(writes).toHaveLength(1);
});
