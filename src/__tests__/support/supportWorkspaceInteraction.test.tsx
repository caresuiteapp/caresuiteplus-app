// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({ rpc:vi.fn(), pick:vi.fn(), confirm:vi.fn(), changed:undefined as undefined|(()=>void), queueChanged:undefined as undefined|(()=>void) }));
vi.mock('react-native',async()=>{
 const React=await import('react');
 const element=(tag:string)=>(props:any)=>React.createElement(tag,{onClick:props.onPress,disabled:props.disabled,'aria-label':props.accessibilityLabel,role:props.accessibilityRole},props.children);
 return {Platform:{OS:'web'},StyleSheet:{create:(styles:any)=>styles},Text:element('span'),View:element('div'),ScrollView:element('div'),Pressable:element('button'),ActivityIndicator:element('span'),TextInput:(props:any)=>React.createElement('textarea',{'aria-label':props.accessibilityLabel,readOnly:props.editable===false,value:props.value,onInput:(event:any)=>props.onChangeText(event.currentTarget.value)})};
});
vi.mock('@/lib/platform/confirmAction',()=>({confirmAction:api.confirm}));
vi.mock('@/lib/support/supportService',()=>({
 SUPPORT_STATUS:{open:'Offen'},SUPPORT_SCOPES:{'company.read':'Unternehmensdaten einsehen'},newSupportNonce:()=>crypto.randomUUID(),supportRpc:api.rpc,
 subscribeSupport:(_id:string|null,callback:()=>void)=>{if(_id)api.changed=callback;else api.queueChanged=callback;return()=>undefined;},isSupportAccessActive:()=>false,isSupportPermissionError:()=>false,withRequiredReadScopes:(s:any)=>s,
 downloadSupportAttachment:vi.fn(),removeSupportDraftAttachment:vi.fn(),pickSupportAttachment:api.pick,
}));
import { SupportWorkspace } from '@/components/support/SupportWorkspace';
const ticket={id:'t1',number:1,subject:'Testanfrage',tenant_id:'tenant1',tenant_name:'Musterbetrieb',status:'open',category:'technical',priority:'normal',assigned_name:null,updated_at:'2026-09-07T10:00:00Z',last_message:'Anfrage'};
const detail=()=>({ticket,messages:[],requests:[],audit:[],can_approve:true,can_write:true,can_support_write:false});
let host:HTMLDivElement;let root:Root;
const button=(text:string)=>[...host.querySelectorAll('button')].find(node=>node.textContent?.includes(text))!;
async function click(text:string){await act(async()=>{button(text).click();});}
async function write(text:string){await act(async()=>{const input=host.querySelector('textarea[aria-label="Ihre Nachricht"]') as HTMLTextAreaElement;input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));});}
beforeEach(async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 vi.useFakeTimers();api.rpc.mockReset();api.pick.mockReset();api.confirm.mockReset();api.confirm.mockResolvedValue(true);api.changed=undefined;api.queueChanged=undefined;
 api.rpc.mockImplementation(async(name:string)=>name==='support_list_tickets'?{tickets:[ticket],can_create:true}:detail());
 host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
 await act(async()=>{root.render(<SupportWorkspace/>);});
 await act(async()=>{await vi.advanceTimersByTimeAsync(300);});
 await click('Testanfrage');
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();});
describe('support messages',()=>{
 it('preserves an unfinished access request when leaving its ticket is declined',async()=>{
   api.rpc.mockImplementation(async(name:string)=>name==='support_list_tickets'?{tickets:[ticket],can_create:true}:{...detail(),can_support_write:true});
   await act(async()=>{root.render(<SupportWorkspace platformMode/>);api.changed?.();});
   const reason=()=>host.querySelector('textarea[aria-label="Warum wird dieser Zugriff benötigt?"]') as HTMLTextAreaElement;
   await act(async()=>{reason().value='Gespeicherten Einsatzstatus prüfen';reason().dispatchEvent(new Event('input',{bubbles:true}));});
   api.confirm.mockResolvedValueOnce(false);
   await click('Zur Ticketliste');
   expect(reason()?.value).toBe('Gespeicherten Einsatzstatus prüfen');
   await click('Zur Ticketliste');
   expect(reason()).toBeNull();
   expect(host.querySelector('textarea[aria-label="Tickets suchen"]')).not.toBeNull();
 });
 it('preserves an unsent draft while a server event refreshes the thread',async()=>{
   await write('Nicht überschreiben');
   await act(async()=>{api.changed?.();});
   expect((host.querySelector('textarea[aria-label="Ihre Nachricht"]') as HTMLTextAreaElement).value).toBe('Nicht überschreiben');
 });
 it('locks the composer until an in-flight send is acknowledged',async()=>{
   await write('Gespeicherter Text');
   let acknowledge!:(value:unknown)=>void;
   api.rpc.mockImplementation(async(name:string)=>name==='support_send_message'?new Promise(resolve=>{acknowledge=resolve;}):name==='support_list_tickets'?{tickets:[ticket],can_create:true}:detail());
   await click('Nachricht senden');
   expect((host.querySelector('textarea[aria-label="Ihre Nachricht"]') as HTMLTextAreaElement).readOnly).toBe(true);
   await act(async()=>{acknowledge({});});
   expect((host.querySelector('textarea[aria-label="Ihre Nachricht"]') as HTMLTextAreaElement).readOnly).toBe(false);
 });
 it('uses a new operation when an attachment changes a failed message draft',async()=>{
   await write('Bitte prüfen');
   api.rpc.mockImplementation(async(name:string)=>{if(name==='support_send_message')throw new Error('Verbindung unterbrochen');return name==='support_list_tickets'?{tickets:[ticket],can_create:true}:detail();});
   await click('Nachricht senden');
   const original=api.rpc.mock.calls.find(call=>call[0]==='support_send_message')![1].p_client_nonce;
   api.pick.mockResolvedValue({id:'file1',file_name:'hinweis.txt',storage_path:'test',byte_size:12,mime_type:'text/plain',state:'ready'});
   await click('Datei anhängen');
   await click('Nachricht senden');
   const latest=api.rpc.mock.calls.filter(call=>call[0]==='support_send_message').at(-1)![1];
   expect(latest.p_client_nonce).not.toBe(original);expect(latest.p_attachment_ids).toEqual(['file1']);
 });
 it('retains text on a failed send and clears it only after confirmed success',async()=>{
   await write('Bitte prüfen');
   api.rpc.mockImplementation(async(name:string)=>{if(name==='support_send_message')throw new Error('Verbindung unterbrochen');return name==='support_list_tickets'?{tickets:[ticket],can_create:true}:detail();});
   await click('Nachricht senden');
   expect(host.textContent).toContain('Verbindung unterbrochen');
   expect((host.querySelector('textarea[aria-label="Ihre Nachricht"]') as HTMLTextAreaElement).value).toBe('Bitte prüfen');
   api.rpc.mockImplementation(async(name:string)=>name==='support_list_tickets'?{tickets:[ticket],can_create:true}:detail());
   await click('Nachricht senden');
   expect((host.querySelector('textarea[aria-label="Ihre Nachricht"]') as HTMLTextAreaElement).value).toBe('');
   const sends=api.rpc.mock.calls.filter(call=>call[0]==='support_send_message');
   expect(sends).toHaveLength(2);expect(sends[0][1].p_client_nonce).toBe(sends[1][1].p_client_nonce);
});
});

describe('support refresh ordering',()=>{
 it('keeps the chosen filter when a previous subscription read finishes late',async()=>{
   await click('Zur Ticketliste');
   let finish!:(value:unknown)=>void;
   api.rpc.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
   await act(async()=>{api.queueChanged?.();});
   const resolved={...ticket,id:'t2',subject:'Abgeschlossene Anfrage',status:'resolved'};
   api.rpc.mockImplementation(async(name:string,args:any)=>name==='support_list_tickets'?{tickets:args.p_status==='resolved'?[resolved]:[ticket],can_create:true}:detail());
   await click('Gelöst');
   await act(async()=>{await vi.advanceTimersByTimeAsync(300);});
   expect(host.textContent).toContain('Abgeschlossene Anfrage');
   await act(async()=>{finish({tickets:[ticket],can_create:true});});
   expect(host.textContent).toContain('Abgeschlossene Anfrage');
   expect(host.textContent).not.toContain('Testanfrage');
 });

 it('keeps the newly selected ticket when an old ticket refresh fails late',async()=>{
   let fail!:(cause:Error)=>void;
   api.rpc.mockImplementationOnce(()=>new Promise((_resolve,reject)=>{fail=reject;}));
   await act(async()=>{api.changed?.();});
   const next={...ticket,id:'t2',subject:'Zweite Anfrage',tenant_id:'tenant2',tenant_name:'Zweites Unternehmen'};
   api.rpc.mockImplementation(async(name:string,args:any)=>name==='support_list_tickets'?{tickets:[ticket,next],can_create:true}:{...detail(),ticket:args.p_ticket_id==='t2'?next:ticket});
   await click('Zur Ticketliste');
   await act(async()=>{api.queueChanged?.();});
   await click('Zweite Anfrage');
   await act(async()=>{fail(new Error('Altes Ticket nicht erreichbar'));});
   expect(host.textContent).toContain('Zweite Anfrage');
   expect(host.textContent).not.toContain('Altes Ticket nicht erreichbar');
   expect(host.textContent).not.toContain('Ticket wird geladen');
   expect(host.querySelector('textarea[aria-label="Ihre Nachricht"]')).not.toBeNull();
 });

 it('does not restore old messages after a newer refresh of the same ticket',async()=>{
   let finish!:(value:unknown)=>void;
   api.rpc.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
   await act(async()=>{api.changed?.();});
   const message={id:'m2',body:'Aktueller Verlauf',author_kind:'tenant',author_name:'Verwaltung',created_at:'2026-09-08T10:00:00Z',attachments:[]};
   api.rpc.mockImplementation(async()=>({...detail(),messages:[message]}));
   await act(async()=>{api.changed?.();});
   expect(host.textContent).toContain('Aktueller Verlauf');
   await act(async()=>{finish({...detail(),messages:[{...message,id:'m1',body:'Überholter Verlauf'}]});});
   expect(host.textContent).toContain('Aktueller Verlauf');
   expect(host.textContent).not.toContain('Überholter Verlauf');
 });
});
