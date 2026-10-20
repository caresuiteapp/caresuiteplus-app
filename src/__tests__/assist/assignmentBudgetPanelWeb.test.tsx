// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const f=vi.hoisted(()=>({calculate:vi.fn(),change:vi.fn(),override:vi.fn(),allowed:true,role:'business_admin',profile:{careGrade:'pg2',careEntitlement:{careFundName:'Testkasse'},carePreventionMode:'none',serviceEntitlements:[],budgetAccounts:[{id:'budget',catalogKey:'paragraph_45b',label:'Entlastungsbetrag',status:'active',period:'monthly',allocatedCents:10000,usedCents:0,reservedCents:0}],canUseBudgetByCatalogKey:{paragraph_45b:true},warnings:[]}}));
vi.mock('react-native',()=>({Platform:{OS:'web'},StyleSheet:{create:(value:unknown)=>value,hairlineWidth:1},View:({children}:any)=><div>{children}</div>,Text:({children}:any)=><span>{children}</span>,ScrollView:({children}:any)=><div>{children}</div>}));
vi.mock('@/components/layout/ScreenShell.web',()=>({ScreenShell:({children}:any)=><div>{children}</div>}));
vi.mock('expo-router',()=>({useNavigation:()=>({dispatch:vi.fn()})}));
vi.mock('expo-router/react-navigation',()=>({usePreventRemove:vi.fn()}));
vi.mock('@/hooks/useTenantId',()=>({useServiceTenantId:()=> 'tenant'}));
vi.mock('@/hooks/usePermissions',()=>({usePermissions:()=>({can:(key:string)=>key==='assist.assignment.budget.override'?f.allowed:true,isReadOnly:false})}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({profile:{id:'actor',roleKey:f.role}})}));
vi.mock('@/hooks/core/useAsyncQuery',()=>({useAsyncQuery:()=>({data:f.profile,loading:false,error:null,refresh:vi.fn()})}));
vi.mock('@/lib/assist/clientAssistBillingProfileService',()=>({getClientAssistBillingProfile:vi.fn()}));
vi.mock('@/lib/assist/calculateAssistBudgetAllocation',()=>({calculateAssistBudgetAllocationFromProfile:f.calculate,resolveHourlyRateCents:()=>4000}));
import {AssignmentBillingBudgetPanel} from '@/components/assist/AssignmentBillingBudgetPanel.web';
const allocation={totalAmountCents:6000,allocationProposal:[],selfPayerAmountCents:0,hasSelfPayerAgreement:false,warnings:[],canSave:true} as any;
let host:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();f.allowed=true;f.role='business_admin';f.calculate.mockReturnValue(allocation);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=async(minutes:number)=>{await act(async()=>root.render(<AssignmentBillingBudgetPanel clientId="client" assignmentDate="2026-10-16" plannedStartTime="09:00" plannedEndTime="10:30" plannedMinutes={minutes} allocation={allocation} manualOverride={null} onAllocationChange={f.change} onManualOverrideChange={f.override}/>))};
const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label)!;
async function fill(tag:'select'|'textarea',value:string){const field=host.querySelector(tag)!;await act(async()=>{Object.getOwnPropertyDescriptor(tag==='select'?HTMLSelectElement.prototype:HTMLTextAreaElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event(tag==='select'?'change':'input',{bubbles:true}));});}
describe('Web budget preview stays tied to actual role and duration',()=>{
 it('passes zero minutes through without inventing an hour of care',async()=>{await render(0);expect(f.calculate.mock.calls[0][1]).toMatchObject({plannedMinutes:0,hourlyRateCents:4000,actorRoleKey:'business_admin'});expect(button('Korrektur anwenden').disabled).toBe(true);expect(f.override).not.toHaveBeenCalled();});
 it('requires a real selected budget and reason before applying an authorized correction',async()=>{await render(90);expect(button('Korrektur anwenden').disabled).toBe(true);await fill('select','paragraph_45b');expect(button('Korrektur anwenden').disabled).toBe(true);await fill('textarea','Mit der Person abgestimmt');await act(async()=>button('Korrektur anwenden').click());expect(f.override).toHaveBeenCalledWith({catalogKey:'paragraph_45b',amountCents:6000,reason:'Mit der Person abgestimmt'});expect(f.calculate.mock.calls.at(-1)![1]).toMatchObject({actorRoleKey:'business_admin',manualOverride:{catalogKey:'paragraph_45b',reason:'Mit der Person abgestimmt'}});});
 it('does not expose manual corrections without permission',async()=>{f.allowed=false;await render(90);expect(host.querySelector('select')).toBeNull();expect(host.textContent).not.toContain('Korrektur anwenden');expect(f.override).not.toHaveBeenCalled();});
});
