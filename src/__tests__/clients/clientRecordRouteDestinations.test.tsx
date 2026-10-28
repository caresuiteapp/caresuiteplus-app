// @vitest-environment happy-dom
import React, {act, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {helgaSchneiderFull} from '@/data/demo/clients/helga-schneider';
import {getClientRecordTabsForClientContext, type ClientRecordTabKey} from '@/lib/clients/clientIntakeFieldRules';

const state=vi.hoisted(()=>({params:{} as Record<string,string>,replace:vi.fn(),setParams:vi.fn(),fullLoading:false,fullError:null as string|null,fullMissing:false,recordLoading:false,canViewBilling:true}));
vi.mock('expo-router',()=>({useLocalSearchParams:()=>state.params,useRouter:()=>({replace:state.replace,setParams:state.setParams})}));
vi.mock('@/hooks/usePageFlag',()=>({usePageFlag:(_key:string,initial:boolean)=>useState(initial)}));
vi.mock('@/hooks/useSectionEditModal',()=>({useSectionEditModal:()=>({open:false,section:null,close:()=>{},openSection:()=>{}})}));
vi.mock('@/ai/useAiPageContext',()=>({useAiPageContext:()=>{}}));
vi.mock('@/hooks/useClientRecord',()=>({useClientRecord:()=>({detail:state.recordLoading?null:helgaSchneiderFull,careContexts:['daily_assistance'],tabs:state.recordLoading?[]:getClientRecordTabsForClientContext(['daily_assistance']),loading:state.recordLoading,error:null,refresh:vi.fn()})}));
vi.mock('@/hooks/useClientFullDetail',()=>({useClientFullDetail:()=>({data:state.fullLoading||state.fullMissing?null:helgaSchneiderFull,loading:state.fullLoading,error:state.fullError,refresh:vi.fn(),canViewSensitive:true})}));
vi.mock('@/hooks/usePermissions',()=>({usePermissions:()=>({can:(key:string)=>key==='office.clients.view'||(key==='clients.billing_profile.view'&&state.canViewBilling)})}));
vi.mock('@/hooks/useTenantId',()=>({useServiceTenantId:()=>helgaSchneiderFull.tenantId}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({profile:{id:'fixture-admin',roleKey:'business_admin'},user:{id:'fixture-admin'}})}));
vi.mock('@/lib/office',()=>({archiveClient:vi.fn(),deleteClient:vi.fn()}));
vi.mock('@/components/layout',()=>({ScreenShell:({children,title,subtitle}:any)=><main aria-label={title}><p>{subtitle}</p>{children}</main>}));
vi.mock('@/components/detail',()=>({DetailInfoRow:({label,value}:any)=><p>{label}: {value??'—'}</p>}));
vi.mock('@/components/ui',()=>({
 SectionPanel:({children,title}:any)=><section><h2>{title}</h2>{children}</section>,PremiumCard:({children}:any)=><div>{children}</div>,PremiumBadge:({label}:any)=><span>{label}</span>,Timeline:()=>null,
 EmptyState:({title,message}:any)=><section><h2>{title}</h2><p>{message}</p></section>,ErrorState:({message}:any)=><p role="alert">{message}</p>,LoadingState:({message}:any)=><p role="status">{message}</p>,PremiumButton:({title,onPress}:any)=><button onClick={onPress}>{title}</button>,
}));
vi.mock('@/components/office/ClientSectionEditModal',()=>({ClientSectionEditModal:()=>null}));
vi.mock('@/components/office/ClientMasterDataEditModal',()=>({ClientMasterDataEditModal:()=>null}));
vi.mock('@/components/office/OfficeRecordDeleteButton',()=>({OfficeRecordDeleteButton:()=>null}));
vi.mock('@/components/office/ClientRecordOverviewPanel.web',()=>({ClientRecordOverviewPanel:()=> <div data-testid="record-overview">Übersichtsinhalt</div>}));
vi.mock('@/screens/business/office/ClientRecordTabPanels.web',async()=>{
 const {VertragAbrechnungTab}=await import('@/screens/office/ClientFullDetailTabs');
 function Panel({tab,fullClient,onBudgetDirtyChange}:any){const [draft,setDraft]=useState('');return tab==='abrechnung'&&fullClient?<VertragAbrechnungTab client={fullClient}/>:<div data-testid="record-panel">{tab}{tab==='pflegegrad_budgets'?<input aria-label="Budgetentwurf" value={draft} onInput={event=>{setDraft(event.currentTarget.value);onBudgetDirtyChange?.(true);}}/>:null}</div>;}
 return {ClientRecordTabContent:Panel};
});
vi.mock('@/lib/platform/confirmAction',()=>({confirmAction:vi.fn().mockResolvedValue(false)}));
import {ClientRecordScreen} from '@/screens/business/office/ClientRecordScreen.web';

let root:Root,host:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});state.params={id:helgaSchneiderFull.id};state.fullLoading=false;state.fullError=null;state.fullMissing=false;state.recordLoading=false;state.canViewBilling=true;state.replace.mockReset();state.setParams.mockReset();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=async(initialTabOverride?:ClientRecordTabKey)=>{await act(async()=>root.render(<ClientRecordScreen initialTabOverride={initialTabOverride}/>));};

describe('actual client record deep-link presentation and tab lifecycle',()=>{
 it.each(['override','query'] as const)('opens the actual billing profile and contracts through a %s without substituting a budget page',async(source)=>{
  if(source==='query')state.params.tab='abrechnung';await render(source==='override'?'abrechnung':undefined);
  expect(host.textContent).toContain('Abrechnungsprofil');expect(host.textContent).toContain('Abrechnungsart');expect(host.textContent).toContain('Verträge');expect(host.querySelector('[data-testid="record-overview"]')).toBeNull();expect(host.querySelector('[role=tab][aria-selected=true]')?.textContent).toContain('Abrechnung');
 });
 it('waits for the matching full record and keeps its billing destination through loading and errors',async()=>{
  state.fullLoading=true;await render('abrechnung');expect(host.textContent).toContain('Abrechnungsdaten werden geladen');expect(host.querySelector('[data-testid="record-overview"]')).toBeNull();
  state.fullLoading=false;state.fullError='Keine Verbindung zur Abrechnungsakte.';state.fullMissing=true;await render('abrechnung');expect(host.querySelector('[role=alert]')?.textContent).toContain('Keine Verbindung');
  state.fullMissing=false;state.fullError=null;await render('abrechnung');expect(host.textContent).toContain('Abrechnungsprofil');
 });
 it.each(['nachweise','pflege','medikation','vitalwerte','icd','module','nachrichten'] as ClientRecordTabKey[])('identifies the unavailable requested %s view instead of showing an unrelated overview',async(tab)=>{
  await render(tab);expect(host.textContent).toContain('nicht verfügbar');expect(host.textContent).toContain('Die angeforderte Ansicht wurde nicht geöffnet');expect(host.querySelector('[data-testid="record-overview"]')).toBeNull();expect(host.querySelector('[data-testid="record-panel"]')).toBeNull();
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Zur Aktenübersicht')!.click());expect(state.replace).toHaveBeenCalledWith(`/business/office/clients/${helgaSchneiderFull.id}`);
 });
 it.each(['portal','verlauf'] as ClientRecordTabKey[])('retains the available %s route destination',async(tab)=>{await render(tab);expect(host.querySelector('[data-testid="record-panel"]')?.textContent).toBe(tab);expect(host.textContent).not.toContain('nicht verfügbar');});
 it('honors a billing deep link after the asynchronous record tabs arrive',async()=>{state.recordLoading=true;await render('abrechnung');expect(host.textContent).toContain('Akte wird geladen');state.recordLoading=false;await render('abrechnung');expect(host.textContent).toContain('Abrechnungsprofil');expect(host.querySelector('[data-testid="record-overview"]')).toBeNull();});
 it('does not expose the restored billing view through general client-read permission alone',async()=>{state.canViewBilling=false;await render('abrechnung');expect(host.textContent).toContain('Abrechnung nicht verfügbar');expect(host.textContent).not.toContain('Abrechnungsprofil');expect(host.querySelector('[data-testid="record-overview"]')).toBeNull();});
 it('keeps an edited budget mounted when an unavailable URL target arrives',async()=>{
  state.params.tab='pflegegrad_budgets';await render();const input=host.querySelector<HTMLInputElement>('[aria-label="Budgetentwurf"]')!;await act(async()=>{input.value='Ungespeichert';input.dispatchEvent(new Event('input',{bubbles:true}));});
  state.params.tab='nachweise';await render();expect(host.textContent).toContain('Leistungsnachweise nicht verfügbar');expect(host.querySelector('[aria-label="Budgetentwurf"]')).toBe(input);expect(input.value).toBe('Ungespeichert');expect(host.querySelector('[data-testid="record-overview"]')).toBeNull();
 });
});
