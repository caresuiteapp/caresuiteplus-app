// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { VisitExecutionScreen } from '@/screens/assist/VisitExecutionScreen.web';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
const MASTER = '11111111-1111-4111-8111-111111111111';
const CHILD = '22222222-2222-4222-8222-222222222222';
const h=vi.hoisted(()=>({id:'',tenant:'tenant-a',readOnly:false,canManage:true,profile:{id:'profile-a',roleKey:'business_admin'},visit:null as VisitDispositionDetail|null,replace:vi.fn(),push:vi.fn(),refresh:vi.fn(),resolve:vi.fn()}));
vi.mock('expo-router',()=>({useLocalSearchParams:()=>({id:h.id})}));
vi.mock('@/hooks/useFlowRouter',()=>({useFlowRouter:()=>({push:h.push,replace:h.replace,back:vi.fn()})}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({profile:h.profile})}));
vi.mock('@/hooks/useTenantId',()=>({useServiceTenantId:()=>h.tenant}));
vi.mock('@/hooks/usePermissions',()=>({usePermissions:()=>({can:(key:string)=>key==='assist.execution.manage'?h.canManage:true,isReadOnly:h.readOnly,check:()=>({reason:null})})}));
vi.mock('@/hooks/usePortalActor',()=>({usePortalActor:()=>({tenantId:h.tenant,employeeId:'employee-a'})}));
vi.mock('@/hooks/useVisitDispositionDetail',()=>({useVisitDispositionDetail:()=>({data:h.visit,loading:false,error:null,refreshError:null,refresh:h.refresh,refreshAfterSave:h.refresh,notFound:false})}));
vi.mock('@/lib/assist/visitService',()=>({resolveExecutableVisitId:h.resolve}));
vi.mock('@/lib/assist/visitProofPreviewService',()=>({buildVisitProofPreview:(visit:VisitDispositionDetail)=>({visitId:visit.id})}));
vi.mock('@/components/assist/AssignmentsWorkspaceShell.web',()=>({AssignmentsWorkspaceShell:({children,actions}:{children:React.ReactNode;actions:React.ReactNode})=><main>{actions}{children}</main>,AssignmentWorkspaceIcon:()=>null}));
vi.mock('@/components/assist/AdministrativeVisitFollowUpPanel.web',()=>({AdministrativeVisitFollowUpPanel:({visit}:{visit:VisitDispositionDetail})=><div data-admin={visit.id}>Nachbearbeitung für {visit.id}</div>}));
vi.mock('@/components/assist/VisitProofPreviewPanel.web',()=>({VisitProofPreviewPanel:()=>null}));
vi.mock('@/components/documents/DocumentModuleTemplatesPanel.web',()=>({DocumentModuleTemplatesPanel:()=>null}));
vi.mock('@/design/tokens/surfaceContrast',()=>({SurfaceContrastProvider:({children}:{children:React.ReactNode})=><>{children}</>}));
let root:Root,host:HTMLDivElement;
function fixture(id=MASTER,tenantId='tenant-a'){return {id,tenantId,title:'Begleitung',clientName:'Alex Beispiel',employeeId:'employee-a',employeeName:'Sam Muster',assignmentStatus:'beendet',documentationStatus:'complete',proofStatus:'pending',documentationNotes:'Bericht',tasks:[],scheduledStart:'2026-10-16T07:00:00Z',scheduledEnd:'2026-10-16T09:00:00Z'} as unknown as VisitDispositionDetail;}
async function render(){await act(async()=>root.render(<VisitExecutionScreen/>));}
function button(text:string){const button=[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===text);expect(button,text).toBeDefined();return button!;}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};}
beforeEach(()=>{vi.clearAllMocks();h.id=MASTER;h.tenant='tenant-a';h.readOnly=false;h.canManage=true;h.visit=fixture();h.profile={id:'profile-a',roleKey:'business_admin'};h.resolve.mockResolvedValue({ok:true,data:{visitId:CHILD,materialized:true}});Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
describe('Web execution record boundaries',()=>{
 it('uses the resolved physical record when opening a materialized occurrence',async()=>{h.id=`${MASTER}::2026-10-16`;h.visit=fixture(CHILD);await render();expect(host.querySelector('[data-admin]')?.getAttribute('data-admin')).toBe(CHILD);expect(h.resolve).not.toHaveBeenCalled();});
 it('does not send virtual occurrence IDs to administrative editors; materializes explicitly once',async()=>{h.id=`${MASTER}::2026-10-16`;h.visit=fixture(h.id);await render();expect(host.querySelector('[data-admin]')).toBeNull();const pending=deferred<unknown>();h.resolve.mockReturnValue(pending.promise);await act(async()=>{const b=button('Einzeltermin zur Nachbearbeitung öffnen');b.click();b.click();});expect(h.resolve).toHaveBeenCalledTimes(1);expect(h.resolve).toHaveBeenCalledWith('tenant-a',`${MASTER}::2026-10-16`,'business_admin');await act(async()=>pending.resolve({ok:true,data:{visitId:CHILD,materialized:true}}));expect(h.replace).toHaveBeenCalledWith(`/assist/assignments/${CHILD}/execute`);});
 it('does not navigate to an old materialization after a company switch',async()=>{h.id=`${MASTER}::2026-10-16`;h.visit=fixture(h.id);await render();const pending=deferred<unknown>();h.resolve.mockReturnValue(pending.promise);await act(async()=>button('Einzeltermin zur Nachbearbeitung öffnen').click());h.tenant='tenant-b';h.id=CHILD;h.visit=fixture(CHILD,'tenant-b');await render();await act(async()=>pending.resolve({ok:true,data:{visitId:MASTER,materialized:true}}));expect(h.replace).not.toHaveBeenCalled();});
 it('rejects stale foreign-company results and removes editors in read-only mode',async()=>{h.tenant='tenant-b';await render();expect(host.querySelector('[data-admin]')).toBeNull();expect(host.textContent).toContain('anderen Unternehmen');h.visit=fixture(MASTER,'tenant-b');h.readOnly=true;await render();expect(host.querySelector('[data-admin]')).toBeNull();expect(host.textContent).toContain('Änderungen sind für Ihre Rolle nicht freigegeben');});
});
