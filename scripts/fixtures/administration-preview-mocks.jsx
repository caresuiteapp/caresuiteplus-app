import React, { createContext, useState } from 'react';
import { View } from 'react-native';
import { createNoteDraft } from '../../src/lib/office/notes/model.shared';
import { EMPTY_TENANT_COMPANY, EMPTY_TENANT_TAX, EMPTY_TENANT_LEGAL, EMPTY_TENANT_REGISTER, EMPTY_TENANT_PAYMENT, EMPTY_TENANT_BRANDING, DEFAULT_TENANT_MODULES } from '../../src/types/tenant/tenantCenter';
export { loginBusinessUser,loginEmployeePortal,registerBusinessTenant,completeFirstLogin } from './native-portals-data';
export const permissions = ['office.access','business.tenant.manage','inventory.view','inventory.manage','inventory.issue','inventory.return','inventory.damage','office.clients.view','office.employees.view'];
export const AuthContext=createContext(null);
export const tenantId = 'visual-tenant';
export const snapshot = {tenantId,company:{...EMPTY_TENANT_COMPANY,name:'Pflege & Alltag Nord',legalName:'Pflege & Alltag Nord GmbH',street:'Gartenstraße',houseNumber:'24',zip:'30159',city:'Hannover',email:'kontakt@example.invalid',phone:'0511 000000'},tax:{...EMPTY_TENANT_TAX},legal:{...EMPTY_TENANT_LEGAL},register:{...EMPTY_TENANT_REGISTER},payment:{...EMPTY_TENANT_PAYMENT},branding:{...EMPTY_TENANT_BRANDING},modules:{...DEFAULT_TENANT_MODULES},contact:{billingEmail:'rechnung@example.invalid',supportEmail:'kontakt@example.invalid',supportPhone:'0511 000000',contactPersons:[]},representatives:[],bankAccounts:[],customFields:[],catalogItems:[],auditLogs:[],sections:[],catalogSummary:'Alltagsbegleitung',assistDefaultHourlyRate:'38,00',updatedAt:'2026-10-16T08:00:00Z'};
const inventoryPermissions=Object.fromEntries(['view','manage','issue','returnItems','reportDamage','offboarding','viewEmployees','audit','createItems','manageCatalogs'].map(key=>[key,true]));
export const inventory={items:[{id:'phone',tenantId,name:'Diensttelefon · Verwaltung Nord',categoryId:'devices',categoryGroup:'devices',sku:'TEL-0042',serialNumber:'CS-2026-0042',manufacturer:'Samsung',model:'Galaxy',status:'available',condition:'good',locationId:'office',requiresReturnOnExit:true,portalVisibleToEmployee:true,updatedAt:'2026-10-16T08:00:00Z'},{id:'tablet',tenantId,name:'Tablet · Mobiler Pflegedienst und Alltagsbegleitung',categoryId:'devices',categoryGroup:'devices',sku:'TAB-0018',status:'assigned',condition:'very_good',locationId:'office',requiresReturnOnExit:true,portalVisibleToEmployee:true,updatedAt:'2026-10-16T08:00:00Z'}],categories:[{id:'devices',group:'devices',label:'Dienstgeräte',requiresReturnOnExit:true,portalVisibleToEmployee:true}],locations:[{id:'office',label:'Verwaltung Nord',building:'Hauptgebäude',room:'1.04'}],assignments:[{id:'assignment',itemId:'tablet',recipientEmployeeId:'employee',status:'issued',issueCondition:'very_good',issuedAt:'2026-10-01T08:00:00Z',expectedReturnAt:'2026-10-25T20:00:00Z',updatedAt:'2026-10-16T08:00:00Z'}],returns:[],damageReports:[],employees:[{id:'employee',firstName:'Marlene',lastName:'Beispiel',status:'active'}],employeesVisible:true,audit:[],scopeLimited:false,permissions:inventoryPermissions};
const noop=()=>{};
export const randomUUID=()=>globalThis.crypto.randomUUID();
const note={...createNoteDraft(),id:'visual-note',tenantId,ownerUserId:'visual-person',title:'Teamrunde vorbereiten',category:'tasks',revision:1,createdAt:'2026-10-23T08:00:00Z',updatedAt:'2026-10-23T09:15:00Z',archivedAt:null,content:{...createNoteDraft().content,text:'Rückmeldungen aus dem Team sammeln und die nächste Besprechung vorbereiten.'}};
export const listNotes=async()=>({ok:true,data:[note]});
export const saveNote=async()=>({ok:false,error:'Die Vorschau speichert keine Daten.'}),setNoteArchived=saveNote,deleteNote=saveNote;
export const useAuth=()=>({authReady:true,isAuthenticated:true,portalSession:{accountId:'visual-person',tenantId,roleKey:'employee_portal',mustChangePassword:true,displayName:'Marlene Beispiel'},signInWithSupabaseSession:noop,signInPortalSession:noop,updatePortalSession:noop,user:{id:'visual-person',email:'vorschau@example.invalid'},profile:{id:'visual-person',displayName:'Marlene Beispiel',roleKey:new URLSearchParams(location.search).get('screen')==='family-home'?'family_portal':'business_admin'},signOut:noop});
export const usePermissions=()=>({tenantId,roleKey:'business_admin',can:()=>true,check:()=>({allowed:true}),roleLabel:'Verwaltung',permissions,isReadOnly:false,hasModuleGate:key=>['office','assist'].includes(key)});
export const useModuleAccess=()=>({hasGate:key=>['office','assist'].includes(key)});
export const useDesktopWeather=()=>({data:null,place:null,message:'Wetter nicht verfügbar',choosePlace:noop});
export const DesktopWeatherLocationDialog=()=>null;
export const GoogleWorkspaceWidget=()=>null;
export const useRouter=()=>({push:route=>{window.__previewRoute=route;},replace:route=>{window.__previewRoute=route;},back:noop,setParams:noop});
export const useWebFontScale=()=>({scale:1,effectiveScale:1,increase:noop,decrease:noop,reset:noop,canIncrease:false,canDecrease:false});
export const usePathname=()=>{const screen=new URLSearchParams(location.search).get('screen');return screen?.startsWith('owner-tenant')?'/platform/tenants/visual-platform-tenant':screen?.startsWith('owner-')?'/platform/dashboard':screen==='desktop'||screen==='web-desktop'?'/Desktop':screen==='employee-calendar'?'/portal/employee/calendar':screen==='employee-clients'?'/portal/employee/clients':screen?.startsWith('employee')?'/portal/employee':'/portal/client';};
export const useLocalSearchParams=()=>new URLSearchParams(location.search).get('screen')?.startsWith('owner-')?{tenantId:'visual-platform-tenant'}:{};
export const useNavigation=()=>({dispatch:noop,addListener:()=>noop});
export const Link=({children})=><View>{children}</View>;
export const ScreenShell=({children})=><View style={{flex:1,minHeight:0}}>{children}</View>;
export const SafeAreaView=View;
export const useSafeAreaInsets=()=>({top:0,left:0,right:0,bottom:0});
export const CareSuiteImage=({source,...props})=>React.createElement(require('react-native-web').Image,{source,...props});
export const CareSuiteImageBackground=({source,...props})=>React.createElement(require('react-native-web').ImageBackground,{source,...props});
export const LinearGradient=({colors,style,...props})=><View {...props} style={[style,{backgroundImage:`linear-gradient(130deg,${colors.join(',')})`}]}/>;
const clients=[{id:'one',firstName:'Helene',lastName:'Musterfrau',zip:'30159',city:'Hannover',status:'aktiv',careLevel:'pg2',costCarrier:'Beispiel-Pflegekasse Nord',insuranceNumber:'X123456789',primaryContactPhone:'0511 000000'},{id:'two',firstName:'Friedrich-Wilhelm',lastName:'Mustermann-Beispiel',city:'Langenhagen',zip:'30853',status:'in_bearbeitung',careLevel:'pg3',costCarrier:'Beispiel-Krankenkasse',insuranceNumber:'Y123456789'},{id:'three',firstName:'Maria',lastName:'Beispielfrau',city:'Garbsen',zip:'30823',status:'entwurf'}];
const employees=[{id:'one',firstName:'Marlene',lastName:'Beispiel',status:'aktiv',jobTitle:'Teamleitung Alltagsbegleitung',email:'marlene@example.invalid',phone:'0511 000000'},{id:'two',firstName:'Leonard',lastName:'Mustermann-Beispiel',status:'aktiv',jobTitle:'Pflegefachkraft und Qualitätsbeauftragter',email:'leonard@example.invalid',phone:'0511 000000'},{id:'three',firstName:'Jasmin',lastName:'Musterfrau',status:'entwurf',jobTitle:'Verwaltung'}];
function useList(data){const[search,setSearch]=useState('');const[statusFilter,setStatusFilter]=useState('all');const[careLevelFilter,setCareLevelFilter]=useState('all');const[costBearerFilter,setCostBearerFilter]=useState('all');const[lifecycleFilter,setLifecycleFilter]=useState('all');const[sortKey,setSortKey]=useState('name_asc');const items=data.filter(row=>(statusFilter==='all'||row.status===statusFilter)&&`${row.firstName} ${row.lastName} ${row.city}`.toLowerCase().includes(search.toLowerCase()));return{search,setSearch,statusFilter,setStatusFilter,careLevelFilter,setCareLevelFilter,costBearerFilter,setCostBearerFilter,lifecycleFilter,setLifecycleFilter,sortKey,setSortKey,allItems:data,kpiItems:data,items,totalCount:data.length,filteredCount:items.length,isLive:true,isLiveConnected:true,loading:false,refreshing:false,error:null,refresh:noop,loadMore:noop,hasMore:false,hasActiveFilters:statusFilter!=='all',resetFilters:()=>setStatusFilter('all'),statusFilters:[{key:'all',label:'Alle'},{key:'aktiv',label:'Aktiv'},{key:'entwurf',label:'Entwürfe'}],lifecycleFilters:[{key:'all',label:'Alle'},{key:'active',label:'Aktive'},{key:'archived',label:'Archivierte'}],careLevelFilters:[{key:'all',label:'Alle Pflegegrade'},{key:'pg2',label:'Pflegegrad 2'}],costBearerFilters:[{key:'all',label:'Alle Kostenträger'}],sortOptions:[{key:'name_asc',label:'Name A–Z'},{key:'name_desc',label:'Name Z–A'}]};}
export const useClientList=()=>useList(clients);
export const useEmployeeList=()=>useList(employees);
export const getCompanyInventoryPermissions=()=>inventoryPermissions;
export const loadCompanyInventory=async()=>({ok:true,data:inventory});
export const checkCompanyInventoryOffboarding=async()=>({ok:true,data:{openAssignments:inventory.assignments}});
const deny=async()=>({ok:false,error:'Diese Ansicht verwendet ausschließlich lokale Prüfdaten.'});
export const acknowledgeCompanyInventoryAssignment=deny,requestCompanyInventoryReturn=deny,saveCompanyInventoryItem=deny,saveCompanyInventoryCategory=deny,saveCompanyInventoryLocation=deny,issueCompanyInventoryItem=deny,returnCompanyInventoryItem=deny,reportCompanyInventoryDamage=deny,resolveCompanyInventoryDamage=deny;
export const useAsyncQuery=()=>({data:null,loading:false,error:null,refresh:noop});

export const loadNote=async()=>({ok:true,data:note});
export const useIsFocused=()=>true,useGlobalSearchParams=()=>({}),usePreventRemove=()=>{};
export const nativeWindow=window,nativeDocument=document,nativeNavigator=navigator,nativeCrypto=crypto,nativeStructuredClone=structuredClone,nativeLocalStorage=localStorage,nativeSessionStorage=sessionStorage,nativeBlob=Blob,nativeURL=URL,nativeFetch=fetch;
export const useNativeWorkflowWindow=()=>window;
export const useVideoPlayer=()=>({addListener:()=>({remove:()=>{}})}),VideoView=View;
export const isAvailableAsync=async()=>false,shareAsync=deny,printAsync=deny,printToFileAsync=deny;
export const shareNativeFile=deny,shareNativeExistingFile=deny,deliverNativeArchive=deny,openNativePdfUrl=deny,printNativePdf=deny;
export const Paths={cache:'layout-fixture://cache'};
export class File {constructor(uri){this.uri=uri;}get exists(){return false;}}
export class Directory extends File {}
export const renderNativePdfPages=deny,extractNativePdfAttachments=deny;
export const useServiceTenantId=()=>tenantId;

// Google fixtures are local and inert. The layout runner never connects an
// account, sends a message or changes a calendar/file/task.
const workspaceConnection={status:'connected',email:'verwaltung@example.invalid',domain:'example.invalid',connectedAt:'2026-10-26T08:00:00Z',lastSyncAt:'2026-10-26T09:10:00Z',capabilities:Object.fromEntries(['gmail','calendar','meet','drive','docs','sheets','slides','tasks','contacts','chat'].map(key=>[key,true]))};
export const useGoogleWorkspace=()=>({connection:workspaceConnection,loading:false,actionLoading:false,error:null,scope:'visual-person:visual-tenant:business_admin',refresh:noop,connect:deny,disconnect:deny});
export const useWorkspacePage=(service)=>({loading:false,error:null,refresh:noop,data:{fetchedAt:'2026-10-26T09:10:00Z',items:service==='calendar'||service==='meet'?[{id:'fixture-event',title:'Teamrunde · Übergaben und Wochenplanung',subtitle:'Verwaltung Nord',when:'2026-10-27T09:00:00Z',raw:{description:'Besprechung der bevorstehenden Einsätze und offenen organisatorischen Fragen.',end:{dateTime:'2026-10-27T10:00:00Z'}}}]:service==='gmail'?[{id:'fixture-mail',title:'Unterlagen für unsere nächste Besprechung',subtitle:'team@example.invalid',unread:true}]:service==='tasks'?[{id:'fixture-task',title:'Teamrunde vorbereiten',subtitle:'Planung',completed:false,raw:{notes:'Rückmeldungen aus dem Team sammeln.'}}]:[{id:'fixture-file',title:'Organisation und Zusammenarbeit',subtitle:'Lokale Vorschau'}]}});
export const refreshWorkspaceData=noop;
export const invokeGoogleWorkspaceAction=async(action)=>{if(action==='tasks_lists')return{items:[{id:'fixture-list',title:'Verwaltung'}]};throw Error('Die lokale Layoutvorschau führt keine Google-Aktionen aus.');};
export const invokeEdgeFunction=async()=>({ok:true,data:{events:[]}});
