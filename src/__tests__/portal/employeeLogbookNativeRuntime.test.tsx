// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {EmployeeLogbookBundle,LogbookTrip} from '@/types/modules/employeeLogbook';
const h = vi.hoisted(() => ({ query: vi.fn(), pick: vi.fn(), upload: vi.fn(), receipt: vi.fn(), profile: vi.fn(), refresh: vi.fn(), refreshWithResult: vi.fn(), actor: { isReady: true, isResolvingEmployeeLink: false, tenantId: 'tenant', employeeId: 'employee' as string | null, displayName: 'Employee' } }));
vi.mock('react-native',async importOriginal=>{
 const actual=await importOriginal<typeof import('react-native')>(),React=await import('react');
 const primitive=(kind:'View'|'Text'|'Pressable'|'Input')=>React.forwardRef<any,any>((p,ref)=>{
  const style=actual.StyleSheet.flatten(typeof p.style==='function'?p.style({pressed:false}):p.style)??{};
  if(kind==='Text'||kind==='Input')for(const[key,value]of Object.entries(style))if((/^border.*(?:Radius|Width)$/.test(key)||['fontSize','lineHeight','letterSpacing','opacity','zIndex'].includes(key))&&value!=null&&(typeof value!=='number'||!Number.isFinite(value)))throw new TypeError('Native '+kind+' '+key+' must be finite number');
  if(kind==='Input')return <input ref={ref} aria-label={p.accessibilityLabel} value={p.value??''} onInput={event=>p.onChangeText?.(event.currentTarget.value)}/>;
  return React.createElement(kind==='Text'?'span':kind==='Pressable'?'button':'div',{ref,'data-testid':p.testID,'aria-label':p.accessibilityLabel,disabled:p.disabled,onClick:p.disabled?undefined:p.onPress},p.children);
 });
 return {...actual,View:primitive('View'),ScrollView:primitive('View'),Text:primitive('Text'),TextInput:primitive('Input'),Pressable:primitive('Pressable'),Modal:({visible,children}:any)=>visible?<div role="dialog">{children}</div>:null,Platform:{...actual.Platform,OS:'android'},useWindowDimensions:()=>({width:360,height:800,scale:1,fontScale:1.6}),findNodeHandle:()=>null};
});
vi.mock('react-native-reanimated',async()=>{const React=await import('react'),RN=await import('react-native');return{default:{View:RN.View,Text:RN.Text,createAnimatedComponent:(component:any)=>component},useSharedValue:(value:any)=>React.useRef({value}).current,useAnimatedStyle:(create:any)=>create(),withSpring:(value:any)=>value,withTiming:(value:any)=>value,withRepeat:(value:any)=>value,withSequence:(value:any)=>value,withDelay:(_delay:any,value:any)=>value,runOnJS:(callback:any)=>callback,cancelAnimation:()=>{}};});
vi.mock('expo-linear-gradient',async()=>({LinearGradient:(await import('react-native')).View}));
vi.mock('expo-blur',async()=>({BlurView:(await import('react-native')).View}));
vi.mock('@expo/vector-icons',()=>Object.fromEntries(['Feather','Ionicons','MaterialIcons','MaterialCommunityIcons','AntDesign','FontAwesome','FontAwesome5','Entypo','Octicons','SimpleLineIcons','Fontisto','Foundation','EvilIcons'].map(name=>[name,()=>null])));
vi.mock('@expo/vector-icons/Feather',()=>({default:()=>null}));
vi.mock('@expo/vector-icons/Ionicons',()=>({default:()=>null}));
vi.mock('react-native-svg',async()=>({default:(await import('react-native')).View,Path:()=>null,Circle:()=>null,Rect:()=>null,Line:()=>null,Polyline:()=>null,Polygon:()=>null,Ellipse:()=>null,G:()=>null,Defs:()=>null,Stop:()=>null,LinearGradient:()=>null,RadialGradient:()=>null,ClipPath:()=>null,Pattern:()=>null,Text:()=>null,TSpan:()=>null}));
vi.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,left:0,right:0,bottom:0}),useSafeAreaFrame:()=>({x:0,y:0,width:360,height:800})}));
vi.mock('expo-router',()=>({usePathname:()=>'/portal/employee/fahrtenbuch',useRouter:()=>({push:vi.fn(),replace:vi.fn()}),useLocalSearchParams:()=>({}),useIsFocused:()=>true,useNavigation:()=>({dispatch:vi.fn(),addListener:()=>()=>{}})}));
vi.mock('@/design/ThemeModeProvider',()=>({useThemeMode:()=>({mode:'light',desktopThemeMode:'dark',setMode:vi.fn(),toggleMode:vi.fn()})}));
vi.mock('@/components/ui',async()=>({...await import('@/components/ui/StateViews'),...await import('@/components/ui/PremiumCard'),...await import('@/components/ui/PremiumButton'),...await import('@/components/ui/PremiumBadge'),...await import('@/components/ui/PremiumInput'),...await import('@/components/ui/InfoBanner'),...await import('@/components/ui/SectionPanel')}));
vi.mock('@/components/images/CareSuiteImage', () => ({ CareSuiteImage: () => null }));
vi.mock('@/components/inputs/CareSignatureModal',async()=>await import('@/components/inputs/CareSignatureModal.native'));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: h.pick }));
vi.mock('@/lib/platform/nativeWorkflowEnvironment.native',()=>({nativeWindow:{addEventListener:()=>{},removeEventListener:()=>{}},useNativeWorkflowWindow:()=>({addEventListener:()=>{},removeEventListener:()=>{}}),nativeDocument:{visibilityState:'visible',addEventListener:()=>{},removeEventListener:()=>{}},nativeStructuredClone:structuredClone,nativeNavigator:{onLine:false}}));
vi.mock('expo-router/react-navigation',()=>({usePreventRemove:()=>{}}));
vi.mock('@/hooks/core/useAsyncQuery', () => ({ useAsyncQuery: h.query }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => h.actor }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/lib/employeeLogbook', () => ({
  berlinToday: () => '2026-10-11', berlinDateKey: () => '2026-10-11', resolveEmployeeLogbookEligibility: vi.fn(), loadEmployeeLogbook: vi.fn(),
  uploadLogbookFile: h.upload, createLogbookReceipt: h.receipt, saveLogbookProfile: h.profile,
}));
vi.mock('@/lib/portal/portalAppointmentsLiveService', () => ({ fetchLivePortalAppointmentsForEmployee: vi.fn() }));
vi.mock('@/lib/portal/employeePortalClientRecordsService', () => ({ fetchEmployeePortalClientRecords: vi.fn() }));
vi.mock('@/lib/employeeLogbook/employeeLogbookAutomation', () => ({ createEmployeeLogbookTrackingGuard: (_tenant: string, _employee: string, options: any) => options?.shouldContinue ?? (() => true) }));

import { EmployeeLogbookScreen } from '@/screens/portal/EmployeeLogbookScreen';
let root: Root, host: HTMLDivElement;
const bundle:EmployeeLogbookBundle = { profile: { tenantId: 'tenant', employeeId: 'employee',defaultVehicleId:null,mileageRateCents:30,gpsConsent:false,licenseFrontPath:null,licenseBackPath:null }, trips: [], vehicles: [], confirmations: [], segments: [], receipts: [] };
beforeEach(() => {
  vi.clearAllMocks(); h.actor.employeeId='employee'; h.actor.isReady=true; h.actor.isResolvingEmployeeLink=false; bundle.trips=[];bundle.confirmations=[]; h.refresh.mockResolvedValue(undefined); h.refreshWithResult.mockResolvedValue(true);
  h.query.mockImplementation((_fetch, _deps, options) => ({ data: options.queryKey.startsWith('logbook-eligibility:') ? { eligible: true } : options.queryKey.startsWith('logbook-links:') ? { assignments: [], clients: [] } : bundle, loading: false, error: null, refreshError: null, refresh: h.refresh, refreshWithResult: h.refreshWithResult }));
  h.pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///receipt.pdf', name: 'receipt.pdf', mimeType: 'application/pdf' }] });
  h.upload.mockResolvedValue('stored-file'); h.receipt.mockResolvedValue(undefined); h.profile.mockResolvedValue(undefined);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const button = (text: string) => [...host.querySelectorAll('button')].find(node => node.textContent === text)!;
const render = async () => { await act(async () => root.render(<EmployeeLogbookScreen />)); };
const click = async (text: string) => { await act(async () => button(text).click()); };
describe('actual native logbook renderer with inert service boundaries',()=>{
 it.each([true,false])('handles an unresolved employee link without dereferencing disabled query data (resolving=%s)',async resolving=>{
  h.actor.employeeId=null; h.actor.isResolvingEmployeeLink=resolving;
  h.query.mockImplementation((_fetch,_deps,options)=>({data:undefined,loading:false,error:null,refreshError:null,refresh:h.refresh,refreshWithResult:h.refreshWithResult,enabled:options.enabled}));
  await render();
  expect(host.querySelector('main')).not.toBeNull();
  if(!resolving)expect(host.textContent).toContain('Mitarbeitendenkonto ist noch nicht vollständig verknüpft');
  expect(host.textContent).not.toContain('Monatsübersicht');
  expect(h.query.mock.calls.every(call=>call[2].enabled===false)).toBe(true);
  expect(h.upload).not.toHaveBeenCalled(); expect(h.profile).not.toHaveBeenCalled();
 });
 it('renders an awaiting trip confirmation and opens/closes the actual native signature surface without writing data',async()=>{
  const trip:LogbookTrip={id:'trip-fixture',tenantId:'tenant',employeeId:'employee',assignmentId:null,clientId:null,vehicleId:null,routeType:'home_to_client',purpose:'Anfahrt',manualReason:null,status:'confirmation_required',startedAt:'2026-10-11T08:00:00Z',endedAt:'2026-10-11T08:15:00Z',startAddress:null,endAddress:null,distanceGpsKm:4.5,distanceFinalKm:4.5,durationSeconds:900,countsAsWorkTime:true,worktimeDeductionMinutes:0,mileageRateCents:30,mileageAmountCents:135,gpsCaptured:true,distanceSource:'gps',googleRouteDistanceKm:null,googleRouteDurationMinutes:null,routeQualityStatus:'measured',correctedAt:null,notes:null};
  bundle.trips=[trip];await render();expect([...host.querySelectorAll<HTMLInputElement>('input')].some(input=>input.value==='4,50')).toBe(true);await click('Meine Fahrten');expect(host.textContent).toContain('4.50 km');await click('Unterschrift im Vollbild erfassen');expect(host.querySelector('[role="dialog"]')).not.toBeNull();await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Unterschrift schließen"]')!.click());expect(host.querySelector('[role="dialog"]')).toBeNull();expect(h.profile).not.toHaveBeenCalled();expect(h.upload).not.toHaveBeenCalled();expect(h.receipt).not.toHaveBeenCalled();
 });

 it('mounts the actual employee screen and all five tabs with real shared UI and finite native text styles',async()=>{
  await render();expect(host.textContent).toContain('Monatsübersicht');
  for(const title of ['Aufzeichnen','Meine Fahrten','Belege','Führerschein','Übersicht']){await click(title);expect(host.textContent).toContain('FAHRTENBUCH');}
  expect(h.upload).not.toHaveBeenCalled();expect(h.receipt).not.toHaveBeenCalled();expect(h.profile).not.toHaveBeenCalled();
 });
});
