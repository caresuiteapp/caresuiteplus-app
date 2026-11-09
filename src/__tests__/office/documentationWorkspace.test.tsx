// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentationWorkspace, berlinInputToIso } from '@/components/office/documentation/DocumentationWorkspace.web';
import { documentationDateParts } from '@/lib/office/documentation/model';
import type { DocumentationEntry, DocumentationPage } from '@/lib/office/documentation/model';
import EmployeeDocumentationRoute from '../../../app/portal/employee/dokumentation.web';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const api=vi.hoisted(()=>({list:vi.fn(),create:vi.fn(),upload:vi.fn()}));
vi.mock('@/lib/office/documentation/service',()=>({listDocumentation:api.list,createDocumentation:api.create}));
vi.mock('@/lib/office/documentation/attachments',async(importOriginal)=>({...await importOriginal<object>(),listDocumentationFiles:vi.fn(async()=>({items:[],canUpload:false})),uploadDocumentationFile:api.upload}));
vi.mock('@/hooks/useUnsavedWebChanges.web',()=>({useUnsavedWebChanges:()=>async()=>true}));
vi.mock('@/components/portal/employee/EmployeePortalBackdrop',()=>({EmployeePortalBackdrop:()=>null}));
vi.mock('@/liquid-command/components/DesktopCatalogArtwork',()=>({DesktopCatalogArtwork:()=>null}));
vi.mock('@/components/layout/ScreenShell.web',()=>({ScreenShell:({children}:{children:ReactNode})=>children}));
vi.mock('@/screens/portal/PortalTabScreen',()=>({PortalTabScreen:({children}:{children:ReactNode})=>children}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({user:{id:actor.userId},portalSession:null})}));
vi.mock('@/hooks/useTenantId',()=>({useServiceTenantId:()=>actor.tenantId}));
vi.mock('@/hooks/usePermissions',()=>({usePermissions:()=>({roleKey:'employee_portal',can:()=>false})}));
const actor={tenantId:'11111111-1111-4111-8111-111111111111',userId:'22222222-2222-4222-8222-222222222222'};
const entry:DocumentationEntry={id:'33333333-3333-4333-8333-333333333333',tenant_id:actor.tenantId,source:'visit',area:'client',client_id:'44444444-4444-4444-8444-444444444444',employee_id:null,category:'care',priority:'normal',title:'Abgeschlossener Einsatz',body:'Gespeicherte Beobachtung',occurred_at:'2026-11-04T17:00:00Z',created_at:'2026-11-04T17:05:00Z',author_name:'Team Test',client_name:'Client Test',employee_name:'',visit_id:'55555555-5555-4555-8555-555555555555'};
let host:HTMLDivElement,root:Root;
const page:DocumentationPage={items:[entry],total:1,months:['2026-11'],clients:[{id:entry.client_id!,name:entry.client_name}],employees:[]};
beforeEach(()=>{vi.clearAllMocks();api.list.mockResolvedValue({ok:true,data:structuredClone(page)});api.create.mockResolvedValue({ok:true,data:{id:entry.id}});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=async()=>{await act(async()=>root.render(<DocumentationWorkspace actor={actor}/>));};
const click=async(label:string)=>{const el=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label);expect(el,label).toBeTruthy();await act(async()=>el!.click());};
const input=async(label:string,value:string)=>{const el=[...host.querySelectorAll('label')].find(l=>l.childNodes[0]?.textContent?.trim()===label)?.querySelector('input,textarea,select') as HTMLInputElement;expect(el,label).toBeTruthy();await act(async()=>{const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
describe('shared documentation workspace',()=>{
 it('includes its own padding in the workspace width outside the Office surface',async()=>{
  await render();
  expect(getComputedStyle(host.querySelector('.cs-doc-workspace')!).boxSizing).toBe('border-box');
 });
 it('opens completed report details, creates a linked-context addition and persists without an assignment',async()=>{
  await render();await act(async()=>host.querySelector<HTMLButtonElement>('.cs-doc-card')!.click());expect(document.querySelector('dialog[open] .cs-doc-copy')?.textContent).toBe(entry.body);
  await click('Ergänzung erfassen');expect(host.querySelector('textarea')?.value).toContain('Bezug: Abgeschlossener Einsatz');
  await input('Dokumentation *','Neue Beobachtung');await click('Eintrag speichern');
  expect(api.create).toHaveBeenCalledOnce();expect(api.create.mock.calls[0][2]).toMatchObject({area:'client',clientId:entry.client_id,body:'Neue Beobachtung'});
  expect(api.create.mock.calls[0][2]).not.toHaveProperty('assignmentId');expect(host.textContent).toContain('Dokumentation gespeichert');
 });
 it('opens a large reader from a single click, increases text size and closes with Escape',async()=>{
  await render();await act(async()=>host.querySelector<HTMLButtonElement>('.cs-doc-card')!.click());
  const dialog=document.querySelector('dialog')!;expect(dialog.open).toBe(true);expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
  await click('Schrift vergrößern');expect(document.querySelector<HTMLElement>('.cs-doc-copy')?.style.fontSize).toBe('18px');
  await act(async()=>dialog.dispatchEvent(new Event('cancel',{cancelable:true})));expect(document.querySelector('dialog')).toBeNull();
 });
 it('keeps a committed text receipt and retries only failed files',async()=>{
  await act(async()=>root.render(<DocumentationWorkspace actor={{...actor,canUpload:true}}/>));
  await click('＋ Neuer Eintrag');await input('Titel *','Mit Foto');await input('Dokumentation *','Beschreibung');
  const picker=host.querySelector<HTMLInputElement>('input[type=file]')!;
  const file={name:'foto.png',type:'image/png',size:3,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
  await act(async()=>{Object.defineProperty(picker,'files',{value:[file],configurable:true});picker.dispatchEvent(new Event('change',{bubbles:true}));});
  api.upload.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  await click('Eintrag speichern');expect(api.create).toHaveBeenCalledOnce();expect(host.textContent).toContain('Der Text ist gespeichert');
  await click('Fehlende Anhänge speichern');expect(api.create).toHaveBeenCalledOnce();expect(api.upload).toHaveBeenCalledTimes(2);expect(api.upload.mock.calls[0][2].id).toBe(api.upload.mock.calls[1][2].id);
 });
 it('opens the employee composer as a dialog and saves photos, videos and PDFs with retry',async()=>{
  await act(async()=>root.render(<EmployeeDocumentationRoute/>));
  await click('＋ Neuer Eintrag');
  const dialog=host.querySelector<HTMLDialogElement>('dialog.cs-doc-editor[open]')!;
  expect(dialog).toBeTruthy();expect(host.querySelector('.cs-doc-layout.has-panel')).toBeNull();
  const picker=dialog.querySelector<HTMLInputElement>('input[type=file]')!;
  expect(picker.accept.split(',')).toEqual(expect.arrayContaining(['image/jpeg','video/mp4','application/pdf']));
  expect(dialog.textContent).not.toContain('Sprachnotiz aufnehmen');
  const choose=async(...files:File[])=>act(async()=>{
    Object.defineProperty(picker,'files',{value:files,configurable:true});picker.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await choose(new File(['audio'],'ton.mp3',{type:'audio/mpeg'}));
  expect(dialog.querySelector('[role=alert]')?.textContent).toContain('nur Fotos, Videos oder PDFs');
  await choose(new File(['photo'],'foto.jpg',{type:'image/jpeg'}),new File(['video'],'einsatz.mp4',{type:'video/mp4'}),new File(['PDF'],'bericht.pdf'));
  expect(dialog.querySelectorAll('.cs-doc-pending li')).toHaveLength(3);
  await input('Titel *','Freier Eintrag mit Anhängen');await input('Dokumentation *','Beobachtung erfasst.');
  api.upload.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  await click('Eintrag speichern');expect(dialog.querySelector('[role=alert]')?.textContent).toContain('Der Text ist gespeichert');
  await click('Fehlende Anhänge speichern');expect(api.create).toHaveBeenCalledOnce();
  expect(api.upload.mock.calls.map(call=>call[2].file.name)).toEqual(['foto.jpg','einsatz.mp4','einsatz.mp4','bericht.pdf']);
  expect(api.upload.mock.calls[1][2].id).toBe(api.upload.mock.calls[2][2].id);
  expect(host.querySelector('dialog')).toBeNull();
 });
 it('keeps content and request identity frozen when a save receipt is uncertain',async()=>{
  await render();await click('＋ Neuer Eintrag');await input('Titel *','Teamabsprache');await input('Dokumentation *','Rückmeldung dokumentiert');
  api.create.mockResolvedValueOnce({ok:false,uncertain:true,error:'Speicherbestätigung fehlt'});await click('Eintrag speichern');
  const first=structuredClone(api.create.mock.calls[0]);expect(host.querySelector('fieldset')?.disabled).toBe(true);expect(host.querySelector('textarea')?.value).toBe('Rückmeldung dokumentiert');
  await click('Speicherbestätigung prüfen');expect(api.create.mock.calls[1]).toEqual(first);expect(host.textContent).toContain('Dokumentation gespeichert');
 });
 it('sends filters to the server and recovers from a load error',async()=>{
  await render();await act(async()=>host.querySelector<HTMLButtonElement>('.cs-doc-filter-toggle')!.click());
  api.list.mockResolvedValueOnce({ok:false,error:'Verbindung unterbrochen'});await click('Gesundheit');
  expect(api.list.mock.calls.at(-1)?.[1]).toMatchObject({category:'health',offset:0});expect(host.querySelector('[role=alert]')?.textContent).toContain('Verbindung unterbrochen');expect(host.querySelector('.cs-doc-card')).toBeNull();
  await click('Erneut laden');expect(host.querySelector('.cs-doc-card')).toBeTruthy();
 });
 it('uses the new Berlin calendar day before midnight UTC',()=>{
  expect(documentationDateParts('2026-10-31T23:30:00Z')).toMatchObject({day:'01',year:'2026',time:'00:30'});
 });
 it('converts Berlin wall time independently of device zone and rejects nonexistent DST time',()=>{
  expect(berlinInputToIso('2026-11-01T12:00')).toBe('2026-11-01T11:00:00.000Z');
  expect(berlinInputToIso('2026-07-01T12:00')).toBe('2026-07-01T10:00:00.000Z');
  expect(berlinInputToIso('2026-03-29T02:30')).toBe('');expect(berlinInputToIso('')).toBe('');
 });
});
