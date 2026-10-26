// @vitest-environment happy-dom
import {act,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const hosts=vi.hoisted(()=>({width:360,fontScale:1,styles:new WeakMap<HTMLElement,Record<string,unknown>>(),layouts:new WeakMap<HTMLElement,(event:any)=>void>()}));
const api=vi.hoisted(()=>({refresh:vi.fn(),saveWorkspace:vi.fn(),planner:vi.fn()}));
vi.mock('react-native',async importOriginal=>{
  const actual=await importOriginal<typeof import('react-native')>(),React=await import('react');
  const primitive=(tag:'div'|'button'|'span'|'input')=>React.forwardRef<HTMLElement,any>((props,ref)=>{
    const attach=(node:HTMLElement|null)=>{if(node){hosts.styles.set(node,actual.StyleSheet.flatten(props.style)??{});if(props.onLayout)hosts.layouts.set(node,props.onLayout);}if(typeof ref==='function')ref(node);else if(ref)ref.current=node;};
    return React.createElement(tag,{ref:attach,'data-native-host':tag,'data-testid':props.testID,'aria-label':props.accessibilityLabel,'aria-selected':props.accessibilityState?.selected,disabled:props.disabled,value:props.value,onChange:props.onChangeText?(event:any)=>props.onChangeText(event.target.value):undefined,onClick:props.disabled?undefined:props.onPress},props.children);
  });
  return {...actual,Platform:{...actual.Platform,OS:'android'},View:primitive('div'),Pressable:primitive('button'),Text:primitive('span'),TextInput:primitive('input'),findNodeHandle:()=>null,useWindowDimensions:()=>({width:hosts.width,height:800,scale:1,fontScale:hosts.fontScale})};
});
vi.mock('expo-document-picker',()=>({getDocumentAsync:vi.fn()}));
vi.mock('expo-file-system',()=>({File:class{}}));
vi.mock('react-native-svg',()=>({default:()=>null}));
vi.mock('@/components/layout/NativeSvgPresentation.native',()=>({NativeSvg:()=>null,NativeSvgPath:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceRange.native',()=>({NativeWorkspaceRange:()=>null}));
vi.mock('@/components/layout/NativeWorkspaceMedia.native',()=>({NativeWorkspaceMedia:()=>null}));
vi.mock('@/components/layout/NativeWorkspacePdfFrame.native',()=>({NativeWorkspacePdfFrame:()=>null}));
vi.mock('@/lib/platform/nativeFileDelivery.native',()=>({shareNativeExistingFile:vi.fn()}));
vi.mock('@/components/layout/ScreenShell.tsx',()=>({ScreenShell:({children}:{children:ReactNode})=>children}));
vi.mock('@/components/office/invoices/InvoicesWorkspace.native.tsx',async()=>{
  const {NativeDiv,NativeButton}=await import('@/components/layout/NativeWorkspaceElements.native');
  return {InvoicesWorkspace:()=><NativeDiv className="iw"><NativeDiv className="iw-card" data-testid="invoice-scope-panel"><NativeButton data-testid="invoice-scope-action" onClick={api.refresh}>Aktualisieren</NativeButton></NativeDiv></NativeDiv>};
});
vi.mock('@/components/layout/platform/platformmodal.tsx',()=>({PlatformModal:()=>null}));
vi.mock('@/components/icons/WebActionIcon.native.tsx',()=>({WebActionIcon:()=>null}));
vi.mock('@/hooks/useNativePreventRemove.native',()=>({usePreventRemove:vi.fn()}));
vi.mock('@/lib/platform/nativeWorkflowEnvironment.native',()=>({
  nativeWindow:{get innerWidth(){return hosts.width;},innerHeight:800},
  useNativeWorkflowWindow:()=>({addEventListener:vi.fn(),removeEventListener:vi.fn()}),
}));
vi.mock('@/lib/platform/nativeWorkspaceActions.native',()=>({confirmNativeWorkspaceAction:vi.fn(),runNativeWorkspaceEffect:vi.fn()}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({profile:{id:'user-1',roleKey:'business_admin'},user:{id:'user-1'}})}));
vi.mock('@/hooks/useTenantId',()=>({useServiceTenantId:()=> 'tenant-1'}));
vi.mock('@/hooks/usePermissions',()=>({usePermissions:()=>({can:()=>false,isReadOnly:false})}));
vi.mock('@/hooks/useCalendarEvents.native.ts',()=>({useCalendarEvents:()=>({events:[],allEvents:[],calendarReady:true,loading:false,refreshing:false,error:null,refreshError:null,refresh:api.refresh,refreshWithResult:api.refresh})}));
vi.mock('@/hooks/useEmployeeMonthPlanning.native.ts',()=>({useEmployeeMonthPlanning:()=>({employees:[],plans:[],absences:[],ready:true,loading:false,error:null,employeeError:null,refresh:vi.fn()})}));
vi.mock('@/hooks/useTenantCalendarSettings.native.ts',()=>({useTenantCalendarSettings:()=>({settings:null,loading:false,form:{},error:null})}));
vi.mock('@/lib/calendar/calendarWorkspaceState.native.ts',()=>({
  calendarWorkspaceKey:()=> 'inert-calendar',calendarAnchor:(value:string)=>new Date(`${value}T12:00:00`),
  readCalendarWorkspace:()=>({restored:true,state:{anchor:'2026-10-26',view:'day',employeeId:'',query:'',status:'all'}}),
  saveCalendarWorkspace:api.saveWorkspace,
}));
vi.mock('@/components/calendar/CalendarToolbar.native.tsx',()=>({CalendarToolbar:()=>null}));
vi.mock('@/components/calendar/CalendarEventGrid.native.tsx',()=>({CalendarEventGrid:()=>null}));
vi.mock('@/components/calendar/CalendarEventCreateModal.native.tsx',()=>({CalendarEventCreateModal:()=>null}));
vi.mock('@/components/calendar/EmployeeMonthPlanningModal.native.tsx',()=>({EmployeeMonthPlanningModal:()=>null}));
vi.mock('@/components/office/calendar/OfficeCalendarSettingsModal.native.tsx',()=>({OfficeCalendarSettingsModal:()=>null}));
vi.mock('@/components/calendar/OfficeAssignmentProfileCalendarPlanner.native.tsx',()=>({OfficeAssignmentProfileCalendarPlanner:({children}:{children:(selection:{selectedProfileId:null})=>ReactNode})=>{api.planner();return children({selectedProfileId:null});}}));

import {InvoicesListScreen} from '@/screens/office/InvoicesListScreen.native';
import {AssignmentStudioScaffold} from '@/components/assist/AssignmentFormControls.native';
import {CalendarPageShell} from '@/components/calendar/CalendarPageShell.native';
import {NativeButton,NativeDiv,NativeSpan} from '@/components/layout/NativeWorkspaceElements.native';
import {buildOfficeCalendarConfig} from '@/lib/calendar/calendarEventService';

let root:Root,host:HTMLDivElement;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();hosts.width=360;hosts.fontScale=1;hosts.styles=new WeakMap();hosts.layouts=new WeakMap();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=(children:ReactNode)=>act(async()=>root.render(children));
const style=(node:Element|null)=>hosts.styles.get(node as HTMLElement)!;

describe('actual native parents inherit pure CSS emitters',()=>{
  it.each([[false,360,1.6,12],[true,360,1.6,12],[false,1280,1,16],[true,1280,1,16]] as const)('keeps prebuilt invoice content styled in embedded=%s at %dpx scale%s',async(embedded,width,fontScale,padding)=>{
    hosts.width=width;hosts.fontScale=fontScale;
    await render(<InvoicesListScreen embedded={embedded}/>);
    const panel=host.querySelector('[data-testid="invoice-scope-panel"]')!,button=host.querySelector<HTMLButtonElement>('[data-testid="invoice-scope-action"]')!;
    expect(style(panel)).toMatchObject({paddingTop:padding,paddingLeft:padding,borderRadius:13,backgroundColor:'#fff'});
    expect(style(button)).toMatchObject({minHeight:38,paddingTop:8,paddingLeft:12,borderRadius:10});
    await act(async()=>button.click());expect(api.refresh).toHaveBeenCalledOnce();
  });

  it.each([[360,1.6,17],[1280,1,22]])('composes assignment base and form CSS above the scaffold children at %dpx scale%s',async(width,fontScale,padding)=>{
    hosts.width=width;hosts.fontScale=fontScale;const onStepChange=vi.fn(),onSave=vi.fn();
    await render(<AssignmentStudioScaffold steps={[{key:'client',label:'Klient',icon:'person-outline'},{key:'time',label:'Zeit',icon:'time-outline'}]} activeStep="client" onStepChange={onStepChange} title="Einsatz planen" description="Daten vollständig erfassen" summary={[]} footer={null}>
      <NativeDiv className="aw-panel" data-testid="inherited-panel"><NativeSpan>Stammdaten</NativeSpan><NativeButton className="aw-button" data-testid="inherited-action" onClick={onSave}>Speichern</NativeButton></NativeDiv>
    </AssignmentStudioScaffold>);
    const panel=host.querySelector('[data-testid="inherited-panel"]')!,button=host.querySelector<HTMLButtonElement>('[data-testid="inherited-action"]')!;
    expect(style(panel)).toMatchObject({backgroundColor:'#fff',borderColor:'#dce6f2',paddingTop:padding,paddingLeft:padding});
    expect(style(button)).toMatchObject({minHeight:40,paddingTop:10,paddingLeft:15,borderRadius:12});
    const copy=[...panel.querySelectorAll<HTMLElement>('span')].find(node=>node.textContent==='Stammdaten')!;
    expect(style(copy).color).toBe('#16324a');
    expect(style(panel.parentElement)).toMatchObject({rowGap:18,columnGap:18});
    await act(async()=>button.click());expect(onSave).toHaveBeenCalledOnce();
    const step=[...host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='2Zeit')!;
    await act(async()=>step.click());expect(onStepChange).toHaveBeenCalledExactlyOnceWith('time');
  });

  it.each([[360,1.6,4],[1280,1,8]])('keeps the expression-bodied calendar renderer inside its CSS scope at %dpx scale%s',async(width,fontScale,boardPadding)=>{
    hosts.width=width;hosts.fontScale=fontScale;
    await render(<CalendarPageShell config={{...buildOfficeCalendarConfig(),defaultView:'day'}}/>);
    expect(api.planner).toHaveBeenCalled();
    const search=host.querySelector<HTMLInputElement>('[aria-label="Kalender durchsuchen"]')!,field=search.parentElement!.parentElement!,controls=field.parentElement!,workspace=controls.parentElement!;
    expect(style(workspace)).toMatchObject({width:'100%',rowGap:14,columnGap:14});
    expect(style(controls)).toMatchObject({rowGap:12,columnGap:12,paddingLeft:3,paddingRight:3});
    expect(style(search)).toMatchObject({minHeight:42,borderColor:'#caddeb',borderRadius:11,paddingLeft:11});
    expect(style(field).minWidth).toBe(width<430?'100%':160);
    const refresh=[...host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Aktualisieren')!;
    expect(style(refresh)).toMatchObject({minHeight:40,paddingLeft:13,borderRadius:11});
    await act(async()=>refresh.click());expect(api.refresh).toHaveBeenCalledOnce();
    const boardContent=[...workspace.querySelectorAll<HTMLElement>('[data-native-host="div"]')].find(node=>style(node)?.paddingTop===boardPadding&&style(node)?.paddingRight===boardPadding&&style(node)?.minWidth===0);
    expect(boardContent).toBeTruthy();
  });
});
