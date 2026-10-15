// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentSettingsHubScreen } from '@/screens/documents/DocumentSettingsHubScreen.web';
import { TemplateEditorWorkspace } from '@/components/templates/TemplateWorkspace.web';
import type { CareSuiteTemplate } from '@/types/templates';

const h=vi.hoisted(()=>({tenant:'tenant-a',params:{} as {id?:string;type?:string},push:vi.fn(),replace:vi.fn(),create:vi.fn(),update:vi.fn(),archive:vi.fn(),get:vi.fn(),bindings:vi.fn(),allowed:null as Set<string>|null,guard:null as (()=>boolean)|null}));
vi.mock('react-native',()=>({Platform:{OS:'web'}}));
vi.mock('expo-router',()=>({useLocalSearchParams:()=>h.params}));
vi.mock('@/hooks/useFlowRouter',()=>({useFlowRouter:()=>({push:h.push,replace:h.replace})}));
vi.mock('@/hooks/usePermissions',()=>({usePermissions:()=>({can:(permission:string)=>h.allowed===null||h.allowed.has(permission),canAny:(permissions:string[])=>h.allowed===null||permissions.some(permission=>h.allowed!.has(permission)),check:()=>({allowed:true})})}));
vi.mock('@/hooks/useTenantId',()=>({useServiceTenantId:()=>h.tenant}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({profile:{id:'author',roleKey:'business_admin'}})}));
vi.mock('@/hooks/core/useLiveRefresh',()=>({DEFAULT_LIVE_POLL_MS:60_000,useLiveRefresh:()=>({isLiveConnected:false})}));
vi.mock('@/lib/documents/documentEngineService',()=>({loadDocumentEngineBindings:(...args:unknown[])=>h.bindings(...args)}));
vi.mock('@/lib/templates',()=>({createTemplate:(...args:unknown[])=>h.create(...args),updateTemplate:(...args:unknown[])=>h.update(...args),archiveTemplate:(...args:unknown[])=>h.archive(...args),getTemplate:(...args:unknown[])=>h.get(...args),listTemplates:vi.fn(),duplicateSystemTemplateForTenant:vi.fn(),getTenantTemplateSettings:vi.fn()}));
vi.mock('@/components/documents/DocumentsWorkspaceShell.web',()=>({DocumentsWorkspaceShell:({children,actions,beforeNavigate}:{children:ReactNode;actions?:ReactNode;beforeNavigate?:()=>boolean})=>{h.guard=beforeNavigate??null;return <main>{actions}{children}</main>;}}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
const template:CareSuiteTemplate={id:'template-a',tenantId:'tenant-a',scope:'tenant',moduleKey:'office',templateType:'documentation_text',status:'draft',title:'Rückruf',description:'',content:'Bitte {{clientName}} zurückrufen.',variables:['clientName'],tags:[],sortOrder:0,isDefault:false,isRequired:false,createdBy:'author',createdAt:'2026-10-15T10:00:00Z',updatedAt:'2026-10-15T10:00:00Z'};
let host:HTMLDivElement;let root:Root;
async function fill(element:HTMLInputElement|HTMLTextAreaElement,value:string){const proto=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(element,value);await act(async()=>element.dispatchEvent(new Event('input',{bubbles:true})));}
function saveButton(){return [...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Speichern')!;}
beforeEach(()=>{vi.clearAllMocks();h.tenant='tenant-a';h.allowed=null;h.params={id:'template-a'};h.guard=null;h.get.mockResolvedValue({ok:true,data:template});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});

describe('web text template editing (functional, no layout assertions)',()=>{
  it('keeps setting overview access separate from the permissions of its destinations',async()=>{
    h.allowed=new Set(['settings.templates.view']);
    await act(async()=>root.render(<DocumentSettingsHubScreen/>));
    const cards=[...host.querySelectorAll<HTMLButtonElement>('button')].filter(button=>button.textContent==='Nicht freigegeben');
    expect(cards).toHaveLength(6);
    expect(cards.every(button=>button.disabled)).toBe(true);
    expect(host.textContent).not.toContain('Dokument erstellen');
    expect(host.textContent).not.toContain('Zuordnungen ansehen');
    expect(h.bindings).not.toHaveBeenCalled();
    await act(async()=>cards[0].click());
    expect(h.push).not.toHaveBeenCalled();
    h.allowed=new Set(['settings.templates.view','office.catalogs.view']);
    await act(async()=>root.render(<DocumentSettingsHubScreen/>));
    const open=[...host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.getAttribute('aria-label')==='Eigene Textvorlagen: öffnen')!;
    expect(open.disabled).toBe(false);
    await act(async()=>open.click());
    expect(h.push).toHaveBeenCalledWith('/business/templates/tenant');
  });

  it('keeps changed text after rerenders and a failed save, while suppressing repeated writes',async()=>{
    let finish!:(value:unknown)=>void;h.update.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    await act(async()=>root.render(<TemplateEditorWorkspace/>));
    const textarea=host.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(textarea.value).toBe(template.content);
    await fill(textarea,'Bitte am Freitag erneut zurückrufen.');
    await act(async()=>root.render(<TemplateEditorWorkspace/>));
    expect(textarea.value).toBe('Bitte am Freitag erneut zurückrufen.');
    const button=saveButton();
    await act(async()=>{button.click();button.click();});
    expect(h.update).toHaveBeenCalledTimes(1);
    expect(h.update.mock.calls[0][2]).toMatchObject({content:'Bitte am Freitag erneut zurückrufen.'});
    expect(h.guard?.()).toBe(false);
    await act(async()=>finish({ok:false,error:'Verbindung unterbrochen.'}));
    expect(textarea.value).toBe('Bitte am Freitag erneut zurückrufen.');
    expect(host.textContent).toContain('Verbindung unterbrochen.');
    expect(saveButton().disabled).toBe(false);
  });

  it('ignores a completed create after switching companies',async()=>{
    h.params={};let finish!:(value:unknown)=>void;h.create.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    await act(async()=>root.render(<TemplateEditorWorkspace create/>));
    await fill(host.querySelector<HTMLInputElement>('input')!,'Rückruf vorbereiten');
    await fill(host.querySelector<HTMLTextAreaElement>('textarea')!,'Bitte die angegebene Person zurückrufen.');
    const button=saveButton();await act(async()=>{button.click();button.click();});
    expect(h.create).toHaveBeenCalledTimes(1);
    h.tenant='tenant-b';await act(async()=>root.render(<TemplateEditorWorkspace create/>));
    expect(host.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('');
    await act(async()=>finish({ok:true,data:template}));
    expect(h.replace).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLTextAreaElement>('textarea')!.disabled).toBe(false);
  });
});
