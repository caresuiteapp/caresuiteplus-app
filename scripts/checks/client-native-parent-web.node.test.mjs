import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {stripTypeScriptTypes as strip} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(new URL('../../',import.meta.url).pathname),read=p=>readFileSync(resolve(root,p),'utf8');
const moduleBody=p=>strip(read(p).replace(/^import[\s\S]*?;\n/gm,'').replace(/^export type \{[^;]+;\n/gm,'').replace(/\bexport /g,''));
const load=p=>import(pathToFileURL(resolve(root,p)).href);
const {captureClientDocumentEvidence}=await load('src/lib/clients/clientDocumentEvidence.web.ts');
const {captureClientRecordDates}=await load('src/lib/clients/clientRecordDates.web.ts');
const ownDomain=await load('src/lib/clients/clientRecordRead.web.ts');
const actionDomain=await load('src/lib/clients/clientRecordActions.web.ts');
const fieldRules=await load('src/lib/clients/clientIntakeFieldRules.ts');
const aiRegistry=await load('src/ai/registerAiPageContext.ts');
const ownerDomain=await load('src/lib/permissions/carePermissionOwner.web.ts');
const {woundUuid,woundInstant}=await load('src/lib/pflege/woundCareDomain.ts');
const nativeOriginal=await load('src/lib/clients/clientRecordNativeOriginal.web.ts');
const {ClientTimelineNoteControllerStore}=await load('src/lib/clients/clientTimelineNoteAction.web.ts');
const {withServiceQueryTimeout}=await load('src/lib/services/queryTimeout.ts');
const compose=(p,deps,names)=>new Function(...Object.keys(deps),moduleBody(p)+';return {'+names.join(',')+'};')(...Object.values(deps));
const appointmentDomain=existsSync(resolve(root,'src/lib/clients/clientRecordAppointmentEvidence.web.ts'))?await load('src/lib/clients/clientRecordAppointmentEvidence.web.ts'):{};
const sharedOverview=new Function('CLIENT_RECORD_TAB_LABELS','formatClientAddressLine','getCatalogLabel','formatCareLevel','formatDate','formatDateTime','BILLING_TYPE_LABELS',moduleBody('src/lib/clients/clientRecordOverview.ts')+';return buildClientRecordOverview;')({},(...x)=>x.filter(Boolean).join(' '),(_,v)=>v,v=>v,v=>v,v=>v,{});
const webOverview=new Function('buildSharedOverview','captureClientDocumentEvidence','captureClientRecordDates','captureClientRecordAppointmentEvidence',moduleBody('src/lib/clients/clientRecordOverview365.web.ts')+';return buildClientRecordOverview;')(sharedOverview,captureClientDocumentEvidence,captureClientRecordDates,appointmentDomain.captureClientRecordAppointmentEvidence);
const address=compose('src/lib/clients/clientAddressResolver.ts',compose('src/lib/formatAddress.ts',{},['formatStreetLine']),['mergeClientAddresses','resolveClientPhone','resolveClientStreetLine']);
const contact=compose('src/lib/clients/clientContactPayload.ts',{},['resolveClientContactDisplayName','resolveClientContactIsEmergency','resolveClientContactType']);
const status=compose('src/lib/services/workflow/clientStatus.ts',{},['CLIENT_STATUS_HINTS','getAllowedStatusActions']);
const bridge=compose('src/lib/services/clients/clientStatusBridge.ts',{},['remoteStatusToWorkflow']);
const baseMapper=compose('src/lib/supabase/mappers/clientMapper.ts',{...address,...contact,...status,...bridge},['mapClientDetail']);
const office=compose('src/lib/office/officeDocumentDisplay.ts',{getSystemIntakeTemplateByKey:()=>null,CLIENT_DOCUMENT_CATEGORY_LABELS:{},PORTAL_DOCUMENT_CATEGORY_LABELS:{}},['isIntakeTemplateFileName','resolveIntakeTemplateKey','isTechnicalIntakeDocumentTitle']);
const merge=compose('src/lib/clients/clientDocumentMerge.ts',office,['mergeClientRecordDocuments','mapIntakeDocumentRow']);
const mapper=compose('src/lib/supabase/mappers/clientExtendedMapper.ts',{...address,...baseMapper,...merge,...contact},['mapClientFullDetail']);
// Real private edit prerequisites are composed even when an old action case never opens an editor.
const {EMPTY_CLIENT_INTAKE_FORM}=compose('src/types/forms/clientIntakeForm.ts',{},['EMPTY_CLIENT_INTAKE_FORM']);
const {EMPTY_CLIENT_EDIT_FORM}=compose('src/types/forms/clientEditForm.ts',{},['EMPTY_CLIENT_EDIT_FORM']);
const {splitStreetLine}=compose('src/lib/clients/clientEditAddressUtils.ts',{},['splitStreetLine']);
const {parseHomeAccessStoredValue}=compose('src/lib/clients/clientIntakeHomeAccess.ts',{},['parseHomeAccessStoredValue']);
const sharedIntake=compose('src/lib/clients/clientIntakeFormMappers.ts',{EMPTY_CLIENT_INTAKE_FORM,createEmptyIntakeForm:()=>({...EMPTY_CLIENT_INTAKE_FORM}),splitStreetLine,parseHomeAccessStoredValue},['mapClientEditLoadToIntakeForm']);
const originalForm=compose('src/lib/clients/clientIntakeEditOriginalForm.web.ts',{...nativeOriginal,...ownDomain,woundInstant,mapSharedForm:sharedIntake.mapClientEditLoadToIntakeForm},['captureClientIntakeEditOriginalForm']);
const editMapper=compose('src/lib/clients/clientEditFormMappers.ts',{EMPTY_CLIENT_EDIT_FORM,splitStreetLine},['mapClientToEditForm','mapClientEditRawFields']);
const {CLIENT_MASTER_DATA_SECTION_KEYS}=compose('src/lib/clients/clientMasterDataSections.ts',{},['CLIENT_MASTER_DATA_SECTION_KEYS']);
const portalKeys=compose('src/lib/portal/engine/portalModuleKeys.ts',{},['isPortalModuleKey']);
const funding=compose('src/types/clients/clientFundingSource.ts',{},['normalizeClientFundingSources']);
const normalize=compose('src/lib/clients/clientIntakeCareLevel.ts',{},['normalizeIntakeCareLevelForDb']);
const cost=compose('src/lib/clients/clientIntakeCostBearerConfig.ts',{},['resolvePrimaryCostBearerName']);
const statusWrite=compose('src/lib/services/clients/clientStatusBridge.ts',{},['workflowStatusToRemote']);
const validation=(await import(new URL('./helpers/current-intake-validation.mjs',import.meta.url).href)).currentIntakeValidation;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const q=read('src/hooks/core/useAsyncQuery.ts'),queryBody=q.slice(q.indexOf('function isTransientQueryError(')).replace('export function useAsyncQuery','function useAsyncQuery');
const s=read('src/screens/pflege/ClientRecordWorkspace365.web.tsx');
const ownHook=s.slice(s.indexOf('type ParentReadEnvelope<'),s.indexOf('function resolvePrimaryAddress('));
const handlerStart=s.indexOf('  const canEdit = !!editTicket;',s.indexOf('  if (loading)'));
assert.ok(handlerStart>=0);
const handlerBody=s.slice(handlerStart,s.indexOf('  const headerActions =',handlerStart));
const apiFields='identityAttachment,identityWorkBlocked,currentIdentityEdit,nativeWrites,nativeWritesRef,liveActionCan,captureNativeAction,id,tenantId,profile,user,detail,fullQuery,loading,error,refresh,careContexts,tabs,parentRead,currentParent,masterDataEditOpen,archiveError,handleEditMasterData,actions,editor,currentEditor,closeEditor,savedEditor,actionStatus,editTicket,deleteFollowup';
const prefix=s.slice(s.indexOf('function ClientRecordScreenContent('),s.indexOf('  if (loading)'))+'if(!detail)return {'+apiFields+'};\n'+handlerBody+'return {'+apiFields+',handleArchive,handleDelete,handleDeleted,handleRecordRefresh,deleteTicket,archiveTicket};}';
const checks=[];
function harness(initial={}){
 let slots=[],cursor=0,effects=[],api,reads=[],queries=[],ai=[],writes=[],draft=null,liveConfigs=[],actionCalls=[],routes=[],permissionAPIs=[],permissionReads=[],fullArguments=[],contextReads=[];
 let state={expiresAt:(Math.floor(Date.now()/1000)+3600)*1000,tenantId:id(1),user:{id:id(2)},profile:{id:id(2),tenantId:id(1),roleKey:'business_admin'},rights:new Set(['office.clients.view','office.clients.view_sensitive']),clientId:id(4),...initial};
 const at='2026-10-08 10:00:00.123456+00:00';
 const rawRow=(n,extra={})=>({id:id(n),tenant_id:state.tenantId,client_id:state.clientId,created_at:at,updated_at:at,...extra});
 const tables={clients:[rawRow(4,{first_name:'Original',last_name:'Klient',status:'active',lifecycle_status:'aktiv',insurance_number:'RAW-SECRET',key_safe_code:'1234',diagnoses:['Originaldiagnose'],admission_date:'2026-10-08',raw_unmapped:{author:id(2),version:0,time:at}})],...Object.fromEntries(Object.values(nativeOriginal.CLIENT_RECORD_NATIVE_POOLS).map(table=>[table,[]])),client_care_contexts:[rawRow(600,{context_key:'ambulatory_care',is_primary:true})]};
 tables.client_history_entries=Array.from({length:5},(_,i)=>rawRow(300+i,{title:'Original '+i,status:'active',actor_name:'Native author',raw_history:{sequence:i,at}}));
 if(state.identityEditFixture)Object.assign(tables.clients[0],{updated_by:id(2),salutation:null,gender:null,date_of_birth:'1999-03-17',service_start:'2011-02-08',housing_form:null,special_notes:'Original internal',internal_notes:'Original internal',notes:'Original internal',apartment_number:null,mobility_notes:null,visible_notes_for_employee:null,emergency_notes:null,key_management_notes:null});
 const selectCalls=[],mapperCalls=[],legacyCalls=[],rpcCalls=[];
 const eq=(a,b)=>a?.length===b?.length&&a.every((v,i)=>Object.is(v,b[i]));
 const useState=v=>{let i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];};
 const useRef=v=>{let i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i];};
 const useMemo=(f,d)=>{let i=cursor++;if(!(i in slots)||!eq(slots[i].deps,d))slots[i]={deps:d,value:f()};return slots[i].value;};
 const useCallback=(f,d)=>useMemo(()=>f,d);
 const useEffect=(f,d)=>{let i=cursor++;if(!(i in slots)||!eq(slots[i].deps,d)){let old=slots[i];slots[i]={deps:d,cleanup:old?.cleanup};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=f();});}};

 const useAuth=()=>({authReady:true,isAuthenticated:true,isLoading:false,profileBootstrapError:null,profile:state.profile,user:state.user,portalSession:state.portalSession??null,session:Object.hasOwn(state,'session')?state.session:{user:state.user,accessToken:state.token??'token-A',expiresAt:state.expiresAt??null}}),useServiceTenantId=()=>state.tenantId;
 const permissionDB={auth:{getSession:async()=>{return{error:Object.hasOwn(state,'sdkResultError')?state.sdkResultError:null,data:{session:{user:state.user,access_token:state.sdkToken??state.token??'token-A',expires_at:Object.hasOwn(state,'sdkExpiresAt')?state.sdkExpiresAt:state.expiresAt==null?undefined:state.expiresAt/1000}}};}},from:table=>{const filters={};let cursor=null,limit=200;const q={select:columns=>{q.columns=columns;return q;},eq:(k,v)=>{filters[k]=v;return q;},order:field=>{assert.equal(field,'id');return q;},limit:value=>{limit=value;return q;},gt:(key,value)=>{assert.equal(key,'id');cursor=value;return q;},maybeSingle:()=>{q.singleRole=true;return q;},then:(resolve,reject)=>{const call={table,filters:{...filters},cursor,columns:q.columns};permissionReads.push(call);if(q.singleRole)return Promise.resolve({data:{id:id(50),key:state.profile?.roleKey},error:null}).then(resolve,reject);const rows=table==='role_permissions'?[...state.rights].map((permission_key,i)=>({id:id(100+i),role_id:id(50),permission_key})):state.overrideRights?[...state.overrideRights].map((permission_key,i)=>({id:id(200+i),tenant_id:state.tenantId,role_key:state.profile.roleKey,permission_key})):[];const actualRows=rows.filter(row=>!cursor||row.id.toLowerCase()>cursor.toLowerCase()).slice(0,Math.min(limit,state.permissionCap??2));const response=state.permissionPageOverride?.(table,cursor,actualRows,call)??{data:actualRows,error:state.permissionError??null};return Promise.resolve(response).then(resolve,reject);}};return q;}};
 // Actual native permission loader, session owner and complete paging; no static production grants.
 const fetchPermissions=new Function('carePermissionOwnerIsCurrent','getPermissionsForRole','getSupabaseClient',moduleBody('src/lib/permissions/currentCarePermissions.web.ts')+'return fetchCurrentCarePermissions;')(ownerDomain.carePermissionOwnerIsCurrent,()=>{throw Error('No production fallback allowed');},()=>nativeDb);
 const resolver=new Function('BUSINESS_HOME_ROUTE',moduleBody('src/lib/auth/sessionTarget.ts')+'return resolveEffectiveRoleKey;')('/home');
 const nativePermissions=new Function('useEffect','useRef','useState','ROLE_LABELS','checkPermissionWithList','hasEffectiveModuleGateAccess','isDemoMode','useAuth','resolveEffectiveRoleKey','useServiceTenantId','carePermissionOwner','sameCarePermissionOwner','carePermissionOwnerIsCurrent','fetchCurrentCarePermissions',moduleBody('src/hooks/pflege/useCareRuntimePermissions.web.ts')+'return useCareRuntimePermissions;')(useEffect,useRef,useState,{business_admin:'Admin'},(_role,p,k)=>({allowed:p.includes(k)}),()=>true,()=>false,useAuth,resolver,useServiceTenantId,ownerDomain.carePermissionOwner,ownerDomain.sameCarePermissionOwner,ownerDomain.carePermissionOwnerIsCurrent,fetchPermissions);
 const usePermissions=()=>{const result=nativePermissions();permissionAPIs.push(result);return result;};

 const nativeQuery=new Function('useState','useRef','useMemo','useCallback','useEffect','Platform','AppState','withServiceQueryTimeout','NATIVE_SERVICE_QUERY_TIMEOUT_MS','useLiveRefresh','DEFAULT_LIVE_POLL_MS',strip(queryBody)+';return useAsyncQuery;')(useState,useRef,useMemo,useCallback,useEffect,{OS:'web'}, {},withServiceQueryTimeout,120000,config=>{liveConfigs.push(config);return {isLiveConnected:false};},60000);
 const useAsyncQuery=(...args)=>{let v=nativeQuery(...args);queries.push(v);return v;};
 const reader=compose('src/lib/clients/clientRecordOriginalRead.web.ts',{...nativeOriginal,getSupabaseClient:()=>nativeDb,fromUnknownTable:(db,table)=>db.from(table),toGermanSupabaseError:e=>e.message,withServiceQueryTimeout,mapClientFullDetail:parts=>{mapperCalls.push(parts);return mapper.mapClientFullDetail(parts);}},['fetchClientOriginalReadWeb']);
 const fetchClientOriginalReadWeb=async(t,c,options)=>{reads.push({tenantId:t,clientId:c,actor:state.user?.id});fullArguments.push({tenantId:t,clientId:c,options});return reader.fetchClientOriginalReadWeb(t,c,options);};
 const legacyDenied=name=>(..._args)=>{legacyCalls.push(name);throw Error('Legacy client read is forbidden in this private SELECT composition');};
 const hookDeps={useAuth,useServiceTenantId,usePermissions,clientParentReadScope:ownDomain.clientParentReadScope,captureClientParentRecord:ownDomain.captureClientParentRecord,captureClientParentDetail:(value,current)=>{const captured=ownDomain.captureClientParentDetail(value,current);state.afterDetailCapture?.();return captured;},fetchClientOriginalReadWeb,getClientRecordTabsForClientContext:fieldRules.getClientRecordTabsForClientContext,useRef,useState,useEffect,useCallback,useAsyncQuery,subscribeToClientRecordChanges:()=>()=>{},fetchClientFullDetail:legacyDenied('fetchClientFullDetail'),fetchClientRecord:legacyDenied('fetchClientRecord'),resolveCareContextsForClient:legacyDenied('resolveCareContextsForClient')};
 const useOwnClientParentRead=new Function(...Object.keys(hookDeps),strip(ownHook)+'return useOwnClientParentRead;')(...Object.values(hookDeps));
 const catalog=new Function(moduleBody('src/lib/permissions/staticRolePermissions.ts')+';return {getPermissionsForRole,PERMISSION_DENIED_MESSAGES,PERMISSION_LABELS};')();
 const checks=new Function(...Object.keys(catalog),moduleBody('src/lib/permissions/check.ts')+';return {checkPermissionWithList,permissionError};')(...Object.values(catalog));
 const enforcePermission=new Function(...Object.keys(checks),moduleBody('src/lib/permissions/enforce.ts')+';return enforcePermission;')(...Object.values(checks));
 const nativeReads=[],nativeWrites=[],nativeRequests=[];
 const sdk=(_db,table)=>{
  let mode='select',payload,options,columns,cursorId=null,ordered=false,limitN=Infinity,singleRow=false;const filters=[];
  const q={select(v,o){columns=v;if(o)options=o;return q;},eq(k,v){filters.push([k,v]);return q;},is(k,v){filters.push([k,v]);return q;},not(k,o,v){filters.push([k,o,v]);return q;},order(k){assert.equal(k,'id');ordered=true;return q;},gt(k,v){assert.equal(k,'id');cursorId=v;return q;},limit(n){limitN=n;return q;},single(){singleRow=true;return q;},maybeSingle(){singleRow=true;return q;},
   update(v){mode='update';payload=structuredClone(v);return q;},insert(v){mode='insert';payload=structuredClone(v);return q;},upsert(v,o){mode='upsert';payload=structuredClone(v);options=structuredClone(o);return q;},
   then(resolve,reject){
    // Read-root/pools and action guards share the exact same SDK identity; their counters and intercepts stay separate.
    const privateSelect=mode==='select'&&(ordered||table==='clients'&&columns!=='status');
    const call={table,mode,payload,filters:structuredClone(filters),columns,options,cursor:cursorId};
    if(privateSelect){selectCalls.push(call);if(table==='client_care_contexts')contextReads.push(call);}else{nativeRequests.push(call);if(mode==='select')nativeReads.push(call);else nativeWrites.push({...call,deleteRight:state.rights.has('office.clients.delete')});}
    const actionIndex=privateSelect?null:nativeRequests.length-1;
    return Promise.resolve().then(async()=>{
     if(privateSelect){
      const override=await state.selectIntercept?.(call);if(override!==undefined)return override;
      let rows=(tables[table]??[]).filter(row=>filters.every(([k,v])=>row[k]===v));rows=[...rows].sort((a,b)=>a.id.toLowerCase().localeCompare(b.id.toLowerCase()));if(cursorId)rows=rows.filter(row=>row.id.toLowerCase()>cursorId.toLowerCase());rows=rows.slice(0,Math.min(limitN,state.selectCap??2));
      if(columns!=='*'){const fields=columns.split(',').map(v=>v.trim());rows=rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>fields.includes(key))));}
      return{data:singleRow?rows[0]??null:rows,error:null};
     }
     const override=await state.nativeIntercept?.(table,mode,payload,filters,actionIndex);if(override!==undefined)return override;
     if(mode==='update'&&columns){
      const rows=(tables[table]??[]).filter(row=>filters.every(([key,value])=>row[key]===value));
      rows.forEach(row=>Object.assign(row,structuredClone(payload)));
      const projected=columns==='*'?rows:rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>columns.split(',').includes(key))));
      return{data:projected[0]??null,error:null,status:200,statusText:'OK'};
     }
     if(mode!=='select')return{data:{id:id(40)},error:null};
     if(table==='assignments')return{count:0,data:null,error:null};
     if(table==='clients')return{data:{status:'active'},error:null};
     if(table==='client_intake_documents')return{data:{id:id(40)},error:null};
     return{data:null,error:null};
    }).then(resolve,reject);
   }};return q;
 };
 // One controlled SDK client serves actual private SELECTs, current permission leaves and native action leaves.
 const nativeDb={auth:permissionDB.auth,from:table=>['roles','role_permissions','role_permission_sets'].includes(table)?permissionDB.from(table):sdk(nativeDb,table),rpc:(...args)=>{rpcCalls.push(args);throw Error('Forbidden native RPC');}};
 const status=compose('src/lib/services/clients/clientStatusBridge.ts',{},['REMOTE_CLIENT_DELETED_STATUS']);
 const common={getSupabaseClient:()=>{state.onNativeSdkAccess?.();return state.sdkUnavailable?null:state.sdkOverride??nativeDb;},getServiceMode:()=>state.mode??'supabase',fromUnknownTable:sdk,toGermanSupabaseError:e=>e?.message??'error',SERVICE_ERRORS:{unexpected:'Unexpected native service interruption',supabaseUnavailable:'Unavailable'},...status};
 let editReader,masterSave;
 const {ClientRecordEditController}=compose('src/lib/clients/clientRecordEditController.web.ts',{...nativeOriginal,...ownDomain,...actionDomain,CLIENT_MASTER_DATA_SECTION_KEYS,isOwnClientEditOriginalRead:(...args)=>editReader.isOwnClientEditOriginalRead(...args),recognizeOwnClientMasterDataSaveReceipt:(...args)=>masterSave.recognizeOwnClientMasterDataSaveReceipt(...args)},['ClientRecordEditController']);
 const carrierOriginal=compose('src/lib/clients/clientRecordEditCarrierOriginal.web.ts',{...nativeOriginal,woundUuid,woundInstant},['CLIENT_EDIT_CARRIER_POOLS','captureClientEditCarrierPage','captureClientEditCarrierOriginals']);
 const carrier=compose('src/lib/clients/clientRecordEditCarrierRead.web.ts',{...common,...nativeOriginal,...carrierOriginal,ClientRecordEditController,withServiceQueryTimeout,getServiceMode:()=>state.mode??'supabase'},['fetchClientEditCarrierReadWeb','recognizesClientEditCarrierRuntime']);
 const carrierTypes=compose('src/features/costCarriers/costCarrierTypes.ts',{},['UI_TO_DB_CARRIER_TYPE']);
 const carrierFields=compose('src/lib/clients/clientRecordEditCarrierFields.web.ts',{...nativeOriginal,...carrierOriginal,...carrierTypes},['captureClientEditCarrierFields']);
 editReader=compose('src/lib/clients/clientRecordEditRead.web.ts',{...common,...nativeOriginal,...editMapper,...originalForm,...carrier,...carrierFields,...portalKeys,...funding,parseHomeAccessStoredValue,withServiceQueryTimeout},['fetchClientEditOriginalReadWeb','isOwnClientEditOriginalRead']);
 const coreEdit=compose('src/lib/clients/clientRecordEditCoreWrite.web.ts',{...common,...nativeOriginal,...normalize,...cost,...statusWrite,CLIENT_MASTER_DATA_SECTION_KEYS,isOwnClientEditOriginalRead:editReader.isOwnClientEditOriginalRead,withServiceQueryTimeout},['captureClientEditCoreWriteWeb','executeClientEditCoreWriteWeb','mayContinueClientEditCoreWriteWeb']);
 masterSave=compose('src/lib/clients/clientRecordMasterDataSave.web.ts',{...common,...nativeOriginal,...coreEdit,...validation},['captureClientMasterDataSaveWeb','executeClientMasterDataSaveWeb','recognizeOwnClientMasterDataSaveReceipt','mayFollowupClientMasterDataSaveWeb']);
 const identitySession=compose('src/lib/clients/clientRecordIdentityEditSession.web.ts',{...common,...nativeOriginal,...actionDomain,...masterSave,...editReader,...validation,woundUuid,ClientRecordEditController},['attachClientIdentityEditWeb','detachClientIdentityEditWeb','openClientIdentityEditWeb','subscribeClientIdentityEditWeb','viewClientIdentityEditWeb','chooseClientIdentityEditWeb','updateClientIdentityEditWeb','saveClientIdentityEditWeb','closeClientIdentityEditWeb','clientIdentityEditWorkBlockedWeb']);
 const assignment=compose('src/lib/office/officeDeleteGuard.ts',common,['assertNoActiveAssignmentsForClient']);
 const audit=compose('src/lib/services/clients/clientAuditHelper.ts',common,['writeClientAudit','writeClientHistory']);
 const {supabaseClientRepository}=compose('src/lib/services/clients/clientRepository.supabase.ts',{...common,...assignment,...audit},['supabaseClientRepository']);
 const {runService}=compose('src/lib/services/serviceRunner.ts',common,['runService']);
 const {clientService}=compose('src/lib/services/clients/clientService.ts',{...common,supabaseClientRepository,runService,DEMO_TENANT_ID:id(999)},['clientService']);
 const office=compose('src/lib/office/clientDetailService.ts',{clientService,enforcePermission,guardServiceTenant:()=>null},['archiveClient','deleteClient']);
 const {resolveOfficeDocumentTitle}=compose('src/lib/office/officeDocumentDisplay.ts',{getSystemIntakeTemplateByKey:()=>null},['resolveOfficeDocumentTitle']);
 const {ClientRecordNativeWrites}=compose('src/lib/clients/clientRecordNativeWrites.web.ts',{...common,...ownDomain,woundUuid,enforcePermission,guardServiceTenant:()=>null,DEMO_TENANT_ID:id(999),resolveOfficeDocumentTitle},['ClientRecordNativeWrites']);
 const actualOffice={archiveClient:async(...args)=>{actionCalls.push({kind:'archive',args});return office.archiveClient(...args);},deleteClient:async(...args)=>{actionCalls.push({kind:'delete',args});return state.overrideDelete?state.overrideDelete(...args):office.deleteClient(...args);}};
 const actualAi=new Function('useEffect','setRegisteredPageContext','clearRegisteredPageContext',moduleBody('src/ai/useAiPageContext.ts')+'return useAiPageContext;')(useEffect,aiRegistry.setRegisteredPageContext,aiRegistry.clearRegisteredPageContext);
 const args={...identitySession,ClientTimelineNoteControllerStore,ClientRecordNativeWrites,...actualOffice,...actionDomain,getServiceMode:()=>state.mode??"supabase",DEMO_TENANT_ID:id(999),useOwnClientParentRead,useLocalSearchParams:()=>({id:state.clientId,edit:state.editParam}),useRouter:()=>({setParams:v=>{state.editParam=v.edit;},replace:r=>routes.push(r)}),useAuth,useServiceTenantId,usePermissions,useState,useRef,useEffect,useMemo,useSectionEditModal:()=>({closeSection:()=>{actionCalls.push({kind:"section-close"});}}),resolveClientRecordTabKey:v=>v??null,loadClientIntakeDraft:async()=>typeof draft==='function'?await draft():draft,buildClientRecordOverview:webOverview,buildClientDetailKpis:()=>[],CLIENT_RECORD_TAB_LABELS:{},useAiPageContext:v=>{ai.push(v);actualAi(v);}};
 const screen=new Function(...Object.keys(args),strip(prefix)+'return ClientRecordScreenContent;')(...Object.values(args));
 function render(){cursor=0;queries=[];liveConfigs=[];permissionAPIs=[];api=screen(state.props??{});return api;}
 function flush(){const todo=effects;effects=[];todo.forEach(f=>f());}
 const tick=()=>new Promise(r=>setImmediate(r));
 async function settle(){flush();await tick();render();flush();await tick();render();}
 render();return {get api(){return api;},identitySession,get state(){return state;},set state(x){state=x;},get reads(){return reads;},get selectCalls(){return selectCalls;},get mapperCalls(){return mapperCalls;},get tables(){return tables;},get legacyCalls(){return legacyCalls;},get rpcCalls(){return rpcCalls;},get queries(){return queries;},get liveConfigs(){return liveConfigs;},get ai(){return ai;},get writes(){return writes;},get actionCalls(){return actionCalls;},get routes(){return routes;},get nativeWrites(){return nativeWrites;},get nativeReads(){return nativeReads;},get nativeRequests(){return nativeRequests;},get fullArguments(){return fullArguments;},get contextReads(){return contextReads;},get permissionAPIs(){return permissionAPIs;},get permissionReads(){return permissionReads;},unmount:()=>{for(const slot of slots)slot?.cleanup?.();},remount:()=>{for(const slot of slots)slot?.cleanup?.();slots=[];cursor=0;effects=[];render();},set draft(x){draft=x;},render,flush,tick,settle};
}

// Stateful hook/leaf composition verifies actual source boundaries, not React, layout or a real database.
const rights=(...r)=>new Set(['office.clients.view',...r.map(x=>'office.clients.'+x)]);
async function ready(h){for(let i=0;i<4;i++)await h.settle();assert.equal(h.api.parentRead.ownRead,true);assert.ok(h.permissionReads.some(x=>x.table==='role_permissions'));assert.ok(h.permissionReads.some(x=>x.table==='role_permission_sets'&&x.filters.tenant_id===id(1)));assert.ok(h.mapperCalls.length>=2);assert.ok(h.selectCalls.some(x=>x.table==='clients'));assert.equal(h.legacyCalls.length,0);assert.equal(h.rpcCalls.length,0);assert.ok(h.selectCalls.every(x=>x.mode==='select'&&(x.table==='cost_carrier_system_templates'||x.filters.some(([k,v])=>k==='tenant_id'&&v===id(1)))));}
const signedDraft=()=>({clientId:id(4),form:{intakeContractType:'assist',intakeAssignmentEnabled:false,intakeDocuments:[{templateKey:'privacy_consent_default',documentType:'privacy_consent',title:'Original Datenschutz',version:1,status:'finalized',isRequired:true,source:'system',tenantTemplateId:null,previewHtml:'<p>original</p>',finalizedHtml:'<p>original finalized</p>',renderedPdfPath:null,missingPlaceholders:[],unresolvedKeys:[],previewOpenedAt:'2026-10-11 10:00:00.123456+00:00',finalizedAt:'2026-10-25T02:30:00.654321+02:00',unknownOriginal:{optional:undefined,history:['b','a']},signatures:{client:{role:'client',dataUrl:'data:image/png;base64,ORIGINAL',signedAt:'2026-10-25T02:30:00.123456+02:00',signerName:undefined},employee:{role:'employee',dataUrl:'data:image/png;base64,STAFF',signedAt:'2026-10-11 10:00:00.123456+00:00',signerName:'Staff'}}}]}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const make=(t,options)=>{const h=harness(options);t.after(()=>h.unmount());return h;};
async function until(h,predicate){for(let i=0;i<60&&!predicate();i++)await h.tick();assert.ok(predicate(),'actual async source boundary reached');}
function followup(h){return h.api.deleteFollowup.current;}

test('Actual Parent Delete executes scoped native guards/history/audit and paired ACK without Shared fallback or replay',async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);const controller=h.api.nativeWrites,held=h.api.handleDelete;
 assert.equal((await held()).ok,true);assert.equal(h.nativeRequests.length,6);assert.equal(h.nativeWrites.length,3);assert.equal(h.actionCalls.length,0);
 assert.deepEqual(h.nativeWrites.map(x=>x.table),['clients','client_history_entries','client_audit_entries']);
 assert.deepEqual(h.nativeWrites[0].filters,[['id',id(4)],['tenant_id',id(1)]]);assert.equal(h.nativeWrites[0].payload.updated_by,id(2));
 const f=followup(h);assert.equal(f.outcome.status,'acknowledged');assert.equal(h.api.actions.acknowledged(f.attempt),true);h.api.handleDeleted();h.api.handleDeleted();assert.equal(h.routes.length,1);
 assert.equal((await held()).ok,false);await h.api.parentRead.refresh();await ready(h);assert.equal(h.api.nativeWrites,controller);assert.equal((await h.api.handleDelete()).ok,false);assert.equal(h.nativeWrites.length,3);
});
test('Both actual SensitiveReads and whole frozen original receipt are preserved in the integrated Parent',async t=>{
 const h=make(t,{rights:new Set([...rights('delete'),'office.clients.view_sensitive'])});await ready(h);assert.ok(h.fullArguments.length>=2);assert.ok(h.fullArguments.every(x=>x.options.canViewSensitive===true));
 const r=h.api.parentRead.liveOriginalReceipt();assert.ok(Object.isFrozen(r.record));assert.ok(Object.isFrozen(r.full.core));assert.equal(r.full.core.insuranceNumber,'RAW-SECRET');assert.equal(r.recordNative.parts.history.length,5);assert.equal(r.fullNative.parts.history.length,5);assert.ok(Object.isFrozen(r.recordNative.parts.history));assert.equal(r.recordNative.parts.client.raw_unmapped.time,'2026-10-08 10:00:00.123456+00:00');assert.equal(Object.hasOwn(r.full,'originals'),false);assert.equal(JSON.stringify(r.full).includes('raw_history'),false);
});
for(const hook of [0,1])test(`Native permission hook ${hook} synchronous refresh denies retained Delete before render`,async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);const held=h.api.handleDelete;h.permissionAPIs[hook].refreshPermissions();assert.equal((await held()).ok,false);assert.equal(h.nativeRequests.length,0);assert.equal(h.actionCalls.length,0);
});
for(let boundary=0;boundary<6;boundary++)test(`Delete native await ${boundary} rechecks actual permission source before the next SDK step`,async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);h.state.nativeIntercept=(_table,_mode,_payload,_filters,index)=>{if(index===boundary)h.permissionAPIs[0].refreshPermissions();};
 const result=await h.api.handleDelete(),f=followup(h);assert.equal(result.ok,false);assert.equal(h.nativeRequests.length,boundary+1);assert.equal(h.nativeWrites.length,Math.max(0,boundary-2));assert.equal(h.actionCalls.length,0);
 assert.equal(f.outcome.status,boundary<3?'blocked':boundary===5?'acknowledged':'uncertain');assert.equal(h.api.actions.acknowledged(f.attempt),boundary===5);assert.equal(h.api.actions.mayFollowup(f.attempt),false);h.api.handleDeleted();assert.equal(h.routes.length,0);
 if(boundary<3){assert.equal(h.api.actions.error(f.attempt),null);assert.equal(h.api.nativeWrites.isOwnUnstarted(f.lease,f.outcome),true);}else if(boundary<5)assert.match(h.api.actions.error(f.attempt),/Schreibausgang/);
});
for(const guard of ['deleted','offboarding','assignments'])test(`Actual ${guard} prewrite denial releases only its known-zero-mutation Parent attempt`,async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);h.state.nativeIntercept=(table)=>guard==='deleted'&&table==='clients'?{data:{status:'deleted'},error:null}:guard==='offboarding'&&table==='client_offboarding_cases'?{data:{id:id(70),status:'open'},error:null}:guard==='assignments'&&table==='assignments'?{data:null,count:1,error:null}:undefined;
 const result=await h.api.handleDelete(),f=followup(h);assert.equal(result.ok,false);assert.equal(h.nativeWrites.length,0);assert.equal(f.outcome.writeStarted,false);assert.equal(h.api.actions.error(f.attempt),null);assert.equal(h.api.actions.status().blocked,false);assert.equal(h.api.actions.acknowledged(f.attempt),false);
 h.state.nativeIntercept=undefined;assert.equal((await h.api.handleDelete()).ok,true);assert.equal(h.nativeWrites.length,3);
});
test('Read-only rights cannot be replaced by a signed-looking Recovery payload',async t=>{
 const h=make(t,{rights:rights()});h.draft=signedDraft();await ready(h);assert.equal(h.nativeRequests.length,0);assert.equal(h.api.actions.capture('recovery'),null);
});
test('Unsupported Demo action capture starts neither native SDK mutation nor a Parent uncertainty flight',async t=>{
 const h=make(t,{rights:rights('delete'),mode:'demo'});await ready(h);assert.equal((await h.api.handleDelete()).ok,false);assert.equal(h.nativeRequests.length,0);assert.equal(h.api.actions.status().busy,false);assert.equal(h.api.actions.status().warning,null);assert.equal(h.actionCalls.length,0);
});
for(const race of ['permission','SDKmissing'])test(`After Parent begin, first native ${race} denial is recognized as zero mutation without releasing older journals`,async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);h.state.onNativeSdkAccess=()=>{assert.equal(h.api.actions.status().busy,true);if(race==='permission')h.permissionAPIs[0].refreshPermissions();else h.state.sdkUnavailable=true;};
 assert.equal((await h.api.handleDelete()).ok,false);const f=followup(h);assert.equal(f.outcome.writeStarted,false);assert.equal(h.nativeRequests.length,0);assert.equal(h.api.nativeWrites.isOwnUnstarted(f.lease,f.outcome),true);assert.equal(h.api.actions.error(f.attempt),null);assert.equal(h.api.actions.acknowledged(f.attempt),false);
 h.state.onNativeSdkAccess=undefined;h.state.sdkUnavailable=false;await ready(h);assert.equal((await h.api.handleDelete()).ok,true);assert.equal(h.nativeWrites.length,3);
});
for(let boundary=0;boundary<10;boundary++)test(`Recovery native await ${boundary} checks the latest action permission before the next native step`,async t=>{
 const h=make(t,{rights:rights('edit')}),load=deferred();h.draft=()=>load.promise;await ready(h);
 h.state.nativeIntercept=(_table,_mode,_payload,_filters,index)=>{if(index===boundary)h.permissionAPIs[0].refreshPermissions();};load.resolve(signedDraft());await until(h,()=>h.nativeRequests.length===boundary+1);for(let i=0;i<3;i++)await h.tick();
 assert.equal(h.nativeRequests.length,boundary+1);assert.ok(h.nativeWrites.length>=1);assert.equal(h.actionCalls.length,0);assert.equal(h.api.actions.status().warning===null,boundary===9);
 const originalReads=h.reads.length;for(let i=0;i<2;i++)await h.tick();assert.equal(h.reads.length,originalReads);
});
test('Recovery keeps its own pending action current through a busy rerender and captures all original payloads before await',async t=>{
 const h=make(t,{rights:rights('edit')}),load=deferred(),write=deferred(),draft=signedDraft();h.draft=()=>load.promise;await ready(h);
 h.state.nativeIntercept=(_table,_mode,_payload,_filters,index)=>index===0?write.promise:undefined;load.resolve(draft);await until(h,()=>h.nativeRequests.length===1);
 const originalSigned=draft.form.intakeDocuments[0].signatures.client.signedAt;draft.form.intakeDocuments[0].signatures.client.signedAt='MUTATED';draft.form.intakeDocuments[0].signatures.client.dataUrl='MUTATED';
 h.render();h.flush();assert.equal(h.api.actions.status().busy,true);const ticket=h.api.actions.capture('recovery');assert.equal(h.api.actions.current(ticket),true);assert.equal(h.api.actions.mayLaunch(ticket),false);
 write.resolve(undefined);await until(h,()=>h.nativeRequests.length===10);for(let i=0;i<3;i++)await h.tick();assert.equal(h.nativeWrites.length,7);assert.equal(h.nativeWrites.find(x=>x.table==='client_document_signatures').payload.signed_at,originalSigned);assert.equal(h.nativeWrites.find(x=>x.table==='client_document_signatures').payload.signature_data,'data:image/png;base64,ORIGINAL');assert.equal(h.actionCalls.length,0);assert.equal(h.api.actions.status().warning,null);
});
for(const table of ['client_document_events','client_document_signatures','client_consent_status'])test(`Recovery checks actual ${table} error and never continues or falls back after the failed native mutation`,async t=>{
 const h=make(t,{rights:rights('edit')}),load=deferred();h.draft=()=>load.promise;await ready(h);h.state.nativeIntercept=(t)=>t===table?{data:null,error:{code:'42501',message:'Actual required write denied'}}:undefined;load.resolve(signedDraft());await until(h,()=>h.nativeWrites.some(x=>x.table===table));for(let i=0;i<3;i++)await h.tick();assert.equal(h.nativeWrites.at(-1).table,table);assert.equal(h.api.actions.status().blocked,true);assert.match(h.api.actions.status().warning,/Schreibausgang/);assert.equal(h.actionCalls.length,0);const count=h.nativeRequests.length;h.draft=null;await h.api.parentRead.refresh();await ready(h);assert.equal(h.nativeRequests.length,count);
});
for(const table of ['client_history_entries','client_audit_entries'])test(`Delete checks actual ${table} failure, retains unknown journal and prevents fresh-read replay`,async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);h.state.nativeIntercept=t=>t===table?{data:null,error:{code:'42501',message:'Actual native history/audit denied'}}:undefined;
 assert.equal((await h.api.handleDelete()).ok,false);assert.equal(h.nativeWrites.at(-1).table,table);assert.equal(followup(h).outcome.status,'uncertain');assert.equal(h.api.actions.status().blocked,true);const count=h.nativeRequests.length;await h.api.parentRead.refresh();await ready(h);assert.equal((await h.api.handleDelete()).ok,false);assert.equal(h.nativeRequests.length,count);assert.equal(h.actionCalls.length,0);
});
for(const query of [0,1])test(`Silent ${query===0?'record':'full'} read invalidates exact originals before render during a native mutation`,async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);h.state.nativeIntercept=(_table,_mode,_payload,_filters,index)=>{if(index===3){h.queries[query].refresh();assert.equal(h.api.parentRead.liveOriginalReceipt(),null);}};
 assert.equal((await h.api.handleDelete()).ok,false);assert.equal(h.nativeWrites.length,1);assert.equal(followup(h).outcome.status,'uncertain');assert.equal(h.routes.length,0);
});
for(const boundary of [3,5])test(`Unmount during native Delete await ${boundary} stops continuation and stale navigation while preserving actual final ACK`,async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);h.state.nativeIntercept=(_table,_mode,_payload,_filters,index)=>{if(index===boundary)h.unmount();};
 assert.equal((await h.api.handleDelete()).ok,false);const f=followup(h);assert.equal(h.nativeRequests.length,boundary+1);assert.equal(f.outcome.status,boundary===5?'acknowledged':'uncertain');assert.equal(h.api.actions.acknowledged(f.attempt),boundary===5);h.api.handleDeleted();assert.equal(h.routes.length,0);
});
test('Unknown native owner A→B→A retains both exclusive journals and the same controller instance',async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);const controller=h.api.nativeWrites;h.state.nativeIntercept=(_t,_m,_p,_f,index)=>index===3?{data:null,error:{code:'08006',message:'Unknown actual transport'}}:undefined;assert.equal((await h.api.handleDelete()).ok,false);const count=h.nativeRequests.length;
 h.state.user={id:id(3)};h.state.profile={...h.state.profile,id:id(3)};h.state.token='token-B';await ready(h);assert.equal(h.api.nativeWrites,controller);
 h.state.user={id:id(2)};h.state.profile={...h.state.profile,id:id(2)};h.state.token='token-A';await ready(h);assert.equal(h.api.nativeWrites,controller);h.state.nativeIntercept=undefined;assert.equal((await h.api.handleDelete()).ok,false);assert.equal(h.nativeRequests.length,count);assert.match(h.api.actions.status().warning,/Schreibausgang/);
});
test('Actual final Delete ACK cannot authorize a later follow-up after a silent read refresh',async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);assert.equal((await h.api.handleDelete()).ok,true);const f=followup(h);h.queries[1].refresh();assert.equal(f.outcome.currentAtReturn,true);assert.equal(h.api.nativeWrites.mayFollowup(f.lease,f.outcome),false);h.api.handleDeleted();assert.equal(h.routes.length,0);assert.equal(h.api.actions.acknowledged(f.attempt),true);
});
test('Existing live Archive uses its unchanged hardblock with zero native mutations and no permanent flight',async t=>{
 const h=make(t,{rights:rights('archive')});await ready(h);await h.api.handleArchive();assert.equal(h.actionCalls.length,1);assert.equal(h.actionCalls[0].kind,'archive');assert.equal(h.nativeRequests.length,0);assert.equal(h.api.actions.status().warning,null);assert.equal(h.api.actions.status().blocked,false);
});
test('Malformed whole signed Recovery input supplies only recognized no-mutation evidence, without unknown or replay',async t=>{
 const h=make(t,{rights:rights('edit')}),load=deferred(),draft=signedDraft();delete draft.form.intakeDocuments[0].previewOpenedAt;h.draft=()=>load.promise;await ready(h);load.resolve(draft);for(let i=0;i<4;i++)await h.tick();assert.equal(h.nativeRequests.length,0);assert.equal(h.api.actions.status().busy,false);assert.equal(h.api.actions.status().warning,null);assert.equal(h.api.actions.status().blocked,false);assert.ok(h.api.actions.begin(h.api.actions.capture('delete'))===null);assert.ok(h.api.actions.begin(h.api.actions.capture('recovery')));
});
test('Actual local session expiry after first native mutation prevents the next write without fabricating ACK',async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);const now=Date.now;t.after(()=>{Date.now=now;});h.state.nativeIntercept=(_t,_m,_p,_f,index)=>{if(index===3)Date.now=()=>h.state.expiresAt+1;};try{assert.equal((await h.api.handleDelete()).ok,false);assert.equal(h.nativeRequests.length,4);assert.equal(h.nativeWrites.length,1);assert.equal(followup(h).outcome.status,'uncertain');assert.equal(h.api.actions.acknowledged(followup(h).attempt),false);h.api.handleDeleted();assert.equal(h.routes.length,0);}finally{Date.now=now;}
});
function actualDeleteButton(h,confirm){const source=read('src/components/office/OfficeRecordDeleteButton.tsx'),start=source.indexOf('  async function handlePress()'),end=source.indexOf('\n  return (',start);assert.ok(start>=0&&end>start);const state={errors:[],success:[]};const deps={confirmAction:()=>confirm.promise,onDelete:h.api.handleDelete,onDeleted:h.api.handleDeleted,setError:e=>state.errors.push(e),setLoading:()=>{},setSuccessMessage:e=>state.success.push(e),recordLabel:'Klient',displayName:'Original',confirmTitle:'Confirm',setTimeout:()=>0};return{state,press:new Function(...Object.keys(deps),strip(source.slice(start,end))+';return handlePress;')(...Object.values(deps))};}
for(const change of ['permission','owner'])test(`Actual Shared Delete confirmation await cannot invoke a stale Parent write after ${change} loss`,async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);const confirm=deferred(),button=actualDeleteButton(h,confirm),pending=button.press();if(change==='permission')h.permissionAPIs[0].refreshPermissions();else{h.state.user={id:id(3)};h.state.profile={...h.state.profile,id:id(3)};h.state.token='token-B';h.render();h.flush();}confirm.resolve(true);await pending;assert.equal(h.nativeRequests.length,0);assert.equal(h.routes.length,0);assert.equal(button.state.success.length,0);assert.equal(button.state.errors.filter(Boolean).length,1);
});
test('Recovery unknown survives native owner A→B→A without a new draft replay',async t=>{
 const h=make(t,{rights:rights('edit')}),load=deferred();h.draft=()=>load.promise;await ready(h);const controller=h.api.nativeWrites;h.state.nativeIntercept=(_t,_m,_p,_f,index)=>index===0?{data:null,error:{code:'08006',message:'Unknown recovery transport'}}:undefined;load.resolve(signedDraft());await until(h,()=>h.nativeRequests.length===1);for(let i=0;i<3;i++)await h.tick();assert.match(h.api.actions.status().warning,/Schreibausgang/);h.draft=null;
 h.state.user={id:id(3)};h.state.profile={...h.state.profile,id:id(3)};h.state.token='token-B';await ready(h);h.state.user={id:id(2)};h.state.profile={...h.state.profile,id:id(2)};h.state.token='token-A';await ready(h);assert.equal(h.api.nativeWrites,controller);assert.equal(h.nativeRequests.length,1);assert.equal(h.api.actions.begin(h.api.actions.capture('recovery')),null);assert.equal(h.api.actions.status().blocked,true);
});
test('Recovery lifetime cleanup after a native mutation neither starts another draft nor continues the old native chain',async t=>{
 const h=make(t,{rights:rights('edit')}),load=deferred();h.draft=()=>load.promise;await ready(h);h.state.nativeIntercept=(_t,_m,_p,_f,index)=>{if(index===0)h.unmount();};load.resolve(signedDraft());await until(h,()=>h.nativeRequests.length===1);for(let i=0;i<3;i++)await h.tick();assert.equal(h.nativeWrites.length,1);assert.equal(h.nativeRequests.length,1);assert.equal(h.actionCalls.length,0);
});
test('Malformed native transport after the first Delete mutation remains unknown and cannot use recognized no-write release',async t=>{
 const h=make(t,{rights:rights('delete')});await ready(h);h.state.nativeIntercept=(_t,_m,_p,_f,index)=>index===3?null:undefined;assert.equal((await h.api.handleDelete()).ok,false);const f=followup(h);assert.equal(h.nativeRequests.length,4);assert.equal(h.nativeWrites.length,1);assert.equal(h.api.nativeWrites.isOwnUnstarted(f.lease,f.outcome),false);assert.equal(h.api.actions.status().blocked,true);assert.match(h.api.actions.status().warning,/Schreibausgang/);
});
