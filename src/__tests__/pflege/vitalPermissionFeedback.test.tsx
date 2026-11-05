// @vitest-environment happy-dom
import React, {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const h=vi.hoisted(()=>({
  loading:false,error:null as string|null,refresh:vi.fn(),query:vi.fn(),
  tenantId:'11111111-1111-4111-8111-111111111111',
  auth:{authReady:true,isLoading:false,profile:{id:'22222222-2222-4222-8222-222222222222',tenantId:'11111111-1111-4111-8111-111111111111',roleKey:'business_admin'}},
}));
// Real screen branches with platform hosts and clinical boundaries replaced.
// These checks exercise feedback and retry; they do not attest browser layout.
vi.mock('react-native',()=>({View:({children}:any)=><div>{children}</div>,Text:({children}:any)=><span>{children}</span>,ScrollView:({children}:any)=><div>{children}</div>,StyleSheet:{create:(v:unknown)=>v}}));
vi.mock('expo-router',()=>({useRouter:()=>({push:vi.fn(),back:vi.fn()}),useLocalSearchParams:()=>({id:'33333333-3333-4333-8333-333333333333'})}));
vi.mock('@/components/layout',()=>({ScreenShell:({title,children}:any)=><main><h1>{title}</h1>{children}</main>}));
vi.mock('@/components/ui',()=>({
  LoadingState:({message}:any)=><div role="status">{message}</div>,
  ErrorState:({message,onRetry}:any)=><div role="alert">{message}{onRetry?<button onClick={onRetry}>Erneut versuchen</button>:null}</div>,
}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>h.auth}));
vi.mock('@/hooks/useTenantId',()=>({useServiceTenantId:()=>h.tenantId}));
vi.mock('@/hooks/pflege/useCareRuntimePermissions.web',()=>({useCareRuntimePermissions:()=>({tenantId:h.tenantId,roleKey:'business_admin',permissions:Object.freeze([]),can:()=>false,loading:h.loading,error:h.error,refreshPermissions:h.refresh})}));
vi.mock('@/hooks/core/useAsyncQuery',()=>({useAsyncQuery:(_load:unknown,_deps:unknown,options:any)=>{h.query(options);return{loading:false,refreshing:false,error:null,refreshError:null,data:null,previewData:false,tableMissing:false,cacheMeta:{fromCache:false,partialDetail:false,usedDemoFallback:false},refresh:vi.fn()};}}));
vi.mock('@/design/tokens/carelightadaptive',()=>({useCareLightPalette:()=>({c:{}})}));
vi.mock('@/theme',()=>({spacing:{},typography:{}}));
vi.mock('@/components/pflege/VitalHistoryChartPanel.web',()=>({VitalHistoryChartPanel:()=>null}));
vi.mock('@/components/pflege/VitalCarePathWorkspacePanel.web',()=>({VitalCarePathWorkspacePanel:()=>null}));
vi.mock('@/components/pflege/RespiratoryIntensiveCareWorkspacePanel.web',()=>({RespiratoryIntensiveCareWorkspacePanel:()=>null}));
vi.mock('@/components/pflege/MedicationEventTimeInput.web',()=>({MedicationEventTimeInput:()=>null,currentMedicationEventTime:()=>'',medicationEventInstant:()=>''}));
vi.mock('@/hooks/useMedicationSubmission.web',()=>({useMedicationSubmission:()=>({})}));
vi.mock('@/lib/pflege/vitalHistoryClientsOriginalRead.web',()=>({fetchVitalHistoryClientsOriginalReadWeb:vi.fn()}));
vi.mock('@/lib/pflege/vitalHistoryViewRuntime.web',()=>({
  createVitalHistoryViewRuntimeWeb:()=>({}),captureVitalHistoryViewReadWeb:()=>null,
  closeVitalHistoryViewRuntimeWeb:()=>{},closeVitalHistoryViewWeb:()=>{},
}));
vi.mock('@/lib/permissions/carePermissionOwner.web',()=>({carePermissionOwner:()=>({profileId:h.auth.profile.id}),sameCarePermissionOwner:()=>true}));
vi.mock('@/lib/pflege/vitalDetailWriteRuntime.web',()=>({
  VitalDetailWriteRuntimeWeb:class{},captureVitalDetailWriteViewWeb:()=>({}),
  vitalDetailWriteActionsWeb:()=>({draftVersion:()=>0,subscribe:()=>()=>{},dispose:()=>{},mount:()=>{},canRead:()=>false,captureReadOrigin:()=>null,readVersion:()=>0,present:()=>{},view:()=>null,pendingState:()=>({}),captureNewFollowUp:()=>null}),
}));
vi.mock('@/lib/supabase/config',()=>({isDemoMode:()=>false}));
import {VitalReadingsListScreen} from '@/screens/pflege/VitalReadingsListScreen.web';
import {VitalReadingDetailScreen} from '@/screens/pflege/VitalReadingDetailScreen.web';

let host:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();h.loading=false;h.error=null;h.auth.authReady=true;h.auth.isLoading=false;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=async(Screen:typeof VitalReadingsListScreen|typeof VitalReadingDetailScreen)=>{await act(async()=>root.render(<Screen/>));};

describe.each([['Vitalwertübersicht',VitalReadingsListScreen],['Vitalwertdetail',VitalReadingDetailScreen]] as const)('%s · Berechtigungszustände',(_name,Screen)=>{
  it('shows a pending confirmation without claiming missing permission or dispatching a clinical read',async()=>{
    h.loading=true;await render(Screen);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Berechtigungen werden geprüft');
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(h.query.mock.calls.every(([options])=>options.enabled===false)).toBe(true);
  });
  it('waits for the native authentication bootstrap instead of showing a permission denial',async()=>{
    h.auth.authReady=false;h.auth.isLoading=true;await render(Screen);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Berechtigungen werden geprüft');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
  it('keeps a failed confirmation closed and exposes the owned retry before returning to pending',async()=>{
    h.error='Die aktuellen Berechtigungen konnten nicht bestätigt werden.';await render(Screen);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(h.error);
    expect(host.textContent).not.toContain('Leseberechtigung fehlt');
    await act(async()=>host.querySelector<HTMLButtonElement>('button')!.click());expect(h.refresh).toHaveBeenCalledOnce();
    h.error=null;h.loading=true;await render(Screen);
    expect(host.querySelector('[role="alert"]')).toBeNull();expect(host.querySelector('[role="status"]')).not.toBeNull();
  });
  it('keeps the settled missing read permission denied',async()=>{
    await render(Screen);expect(host.querySelector('[role="alert"]')?.textContent).toContain('Leseberechtigung');
    expect(host.querySelector('button')).toBeNull();
    expect(h.query.mock.calls.every(([options])=>options.enabled===false)).toBe(true);
  });
});
