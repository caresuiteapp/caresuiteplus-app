import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { carePermissionOwner, sameCarePermissionOwner, carePermissionOwnerIsCurrent } from '../../src/lib/permissions/carePermissionOwner.web.ts';
import { isUuid } from '../../src/lib/validation/uuid.ts';
const read=path=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
const body=path=>stripTypeScriptTypes(read(path).replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''));
const empty=new Function(`${body('src/types/forms/clientIntakeForm.ts')};return EMPTY_CLIENT_INTAKE_FORM;`)();
const createEmptyIntakeForm=()=>structuredClone(empty);
const hasIntakeDraftContent=({form,stepIndex})=>!!form.firstName||stepIndex>0;
const {ClientIntakeWorkflow}=new Function('isUuid','hasIntakeDraftContent','mergeIntakeFormWithDefaults',`${body('src/lib/clients/clientIntakeWorkflow.web.ts')};return {ClientIntakeWorkflow};`)(isUuid,hasIntakeDraftContent,form=>({...createEmptyIntakeForm(),...form}));
const hookSource=body('src/hooks/pflege/useCareClientIntakeWizard.web.ts');
const identitySource=body('src/lib/clients/clientIntakeIdentitySession.web.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const settle=async()=>{for(let n=0;n<150;n++)await Promise.resolve();};

// Existing Node source-loader pattern: state/effect timing is controlled, no React/DOM/SDK is implied.
function workspace(patch={}){
 const slots=[],effects=[],queue=[],timers=new Map(),store=patch.store??new Map(),calls=[],listeners=new Map();let index=0,clock=0;
 const env={tenant:id(1),allowed:true,permissionLoading:false,options:undefined,candidates:[],realIdentity:false,
  auth:{authReady:true,isAuthenticated:true,isLoading:false,profileBootstrapError:null,profile:{id:id(2),tenantId:id(1),roleKey:'business_admin'},user:{id:id(2),roleKey:'business_admin'},session:{user:{id:id(2),roleKey:'business_admin'},accessToken:'test-only',expiresAt:null},portalSession:null},...patch};
 const useRef=initial=>{const i=index++;return slots[i]??={current:initial};};
 const useState=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
 const memo=(run,deps)=>{const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={deps,value:run()};return slots[i].value;};
 const useEffect=(run,deps)=>{const i=index++;if(!effects[i]||deps.some((v,j)=>v!==effects[i].deps[j])){const prev=effects[i];const entry={deps,run,cleanup:null};effects[i]=entry;queue.push(()=>{prev?.cleanup?.();entry.cleanup=run();});}};
 const storage={async getItem(key){return store.get(key)??null;},async setItem(key,value){store.set(key,value);},async removeItem(key){store.delete(key);}};
 // CP300 queue/owner regressions use an already approved identity port. The
 // explicit-choice cases below compose this same hook with the real reader.
 class ApprovedIdentityPort {
  syncInput(){} dispose(){} permits(){return true;} async assertCurrent(){} decision(){return null;}
  reservationReview(){return{id:id(500),requestId:id(501),tenantId:env.tenant,actorId:env.auth.profile.id,inputKey:'approved-test-input',candidateCount:0,preparedAt:'2026-10-15T09:40:00.000000+00:00',expiresAt:'2026-10-15T09:45:00.000000+00:00'};}
  view(){return{status:'approved',candidates:[],exactConflict:false,error:null};}
  async review(){return true;} approveNew(){return true;} async selectExisting(){throw Error('Not part of isolated queue regressions');}
 }
 const identityDb={async rpc(name,args){
  assert.equal(name,'web_prepare_client_intake_identity_review');calls.push(['reviewPreparation',structuredClone(args)]);await env.prepareGate?.promise;
  const prepared=Date.now();return env.prepareFailure?{data:null,error:{message:'rejected'}}:{data:{review_id:id(500),request_id:args.p_request_id,tenant_id:args.p_tenant_id,actor_profile_id:args.p_actor_profile_id,
   resolution:'create_distinct',candidate_count:args.p_candidates.length,prepared_at:new Date(prepared).toISOString(),expires_at:new Date(prepared+300000).toISOString()},error:null};
 },auth:{getSession:async()=>({data:{session:{user:{id:env.auth.profile?.id},access_token:env.auth.session?.accessToken}},error:null}),getUser:async()=>({data:{user:{id:env.auth.profile?.id}},error:null})},from:table=>{
  assert.equal(table,'clients');const filters=[];let pattern=null,patternKey=null;
  const q={select:()=>q,eq:(key,value)=>{filters.push(['eq',key,value]);return q;},neq:(key,value)=>{filters.push(['neq',key,value]);return q;},gt:(key,value)=>{filters.push(['gt',key,value]);return q;},
   ilike:(key,value)=>{patternKey=key;pattern=value;return q;},order:()=>q,limit:()=>q,then:(resolve,reject)=>(async()=>{
    calls.push(['identityRead']);await env.identityGate?.promise;
    return{data:env.candidates.filter(row=>filters.every(([kind,key,value])=>kind==='eq'?row[key]===value:kind==='neq'?row[key]!==value:row[key]>value))
      .filter(row=>patternKey==='last_name'?String(row.last_name).toLowerCase().includes(pattern.slice(1,-1).toLowerCase()):String(row.insurance_number??'').toLowerCase()===pattern.toLowerCase()).map(row=>structuredClone(row)),error:null};
   })().then(resolve,reject)};return q;
 }};
 const ActualIdentitySession=new Function('getSupabaseClient','isUuid',`${identitySource};return ClientIntakeIdentitySession;`)(()=>identityDb,isUuid);
 const deps={window:{addEventListener:(name,run)=>listeners.set(name,run),removeEventListener:(name,run)=>{if(listeners.get(name)===run)listeners.delete(name);}},useRef,useState,useEffect,useMemo:memo,useCallback:(fn,deps)=>memo(()=>fn,deps),
  createEmptyIntakeForm,hasIntakeDraftContent,carePermissionOwner,sameCarePermissionOwner,carePermissionOwnerIsCurrent,ClientIntakeWorkflow,ClientIntakeIdentitySession:env.realIdentity?ActualIdentitySession:ApprovedIdentityPort,
  withIntakeBrowserLock:async(_key,operation)=>operation(),AsyncStorage:storage,
  useAuth:()=>env.auth,useServiceTenantId:()=>env.tenant,useCareRuntimePermissions:()=>({can:key=>env.allowed&&!(env.deny??[]).includes(key),loading:env.permissionLoading}),
  getServiceMode:()=> 'supabase',isDemoMode:()=>false,
  loadClientIntakeDraft:async()=>env.legacy??null,clearClientIntakeDraft:async()=>calls.push(['clearLegacy']),
  upsertClientIntakeDraft:async(tenant,form,options)=>{
   if(!await options.beforeWrite())return{ok:false,error:'denied'};
   if(env.realIdentity&&!options.clientId){assert.equal(options.identityReview().id,id(500));assert.equal(options.identityReview().requestId,options.newClientId);}
   calls.push(['save',tenant,structuredClone(form),options.clientId??options.newClientId,options.clientId?'update':'insert']);
   await env.saveGate?.promise;return env.saveFailure?{ok:false,error:'lost'}:{ok:true,data:{id:options.clientId??options.newClientId}};
  },
  confirmClientIntakeDraft:async(_tenant,clientId,_form,_actor,options)=>{calls.push(['confirm',clientId,structuredClone(options)]);return{ok:true,data:{id:clientId}};},
  persistClientIntakeDocuments:async(_tenant,_id,_form,_actor,context)=>{calls.push(['documents',context.requestId]);return env.documentFailure?{ok:false,error:'lost'}:{ok:true,data:{requestId:context.requestId}};},
  confirmClientIntakeDocuments:async(_tenant,_id,_form,_actor,context)=>{calls.push(['confirmDocuments',context.requestId]);return env.documentConfirmationFailure?{ok:false,error:'not confirmed'}:{ok:true,data:{requestId:context.requestId}};},
  completeWebClientIntake:async(tenant,clientId,form,actor,requestId,identityReviewId,documentsRequestId,guard)=>{assert.equal(guard(),true);assert.equal(typeof requestId,'string');calls.push(['complete',tenant,clientId,structuredClone(form),actor,requestId,identityReviewId]);await env.completeGate?.promise;return env.completeFailure?{ok:false,error:'partial'}:{ok:true,data:{id:clientId}};},
  confirmClientIntakeCompletion:async(_tenant,clientId,_actor,requestId)=>{calls.push(['confirmCompletion',clientId,requestId]);return env.completionConfirmationFailure?{ok:false,error:'not active'}:{ok:true,data:{id:clientId,requestId}};},
  submitClientIntake:async()=>{throw Error('Native creation must not handle live Web intake');},submitClientIntakeUpdate:async()=>({ok:true,data:{id:id(3)}}),
  getIntakeStepsForContexts:()=>['leistungsart','stammdaten'],getIntakeStepsForServiceTypeKeys:()=>['leistungsart','stammdaten'],
  careContextsToServiceTypeKeys:contexts=>contexts,getServiceIntakeSections:async()=>({ok:true,data:[]}),getSupportOnlyHint:()=>null,
  INTAKE_SECTION_LABELS:{leistungsart:'Leistung',stammdaten:'Stammdaten'},validateIntakeStep:()=>env.validation??{},hasIntakeErrors:errors=>Object.keys(errors).length>0,
  fetchClientIntakeEditData:async()=>({ok:true,data:createEmptyIntakeForm()}),COST_BEARER_FIELD_ERRORS:{},
  setTimeout:run=>{const n=++clock;timers.set(n,run);return n;},clearTimeout:n=>timers.delete(n),
 };
 const hook=new Function(...Object.keys(deps),`${hookSource};return useClientIntakeWizard;`)(...Object.values(deps));
 const render=(flush=true)=>{index=0;const result=hook(env.options);if(flush)while(queue.length)queue.shift()();return result;};
 const dispose=()=>{effects.forEach(entry=>entry?.cleanup?.());timers.clear();};
 const strictReplay=()=>effects.forEach(entry=>{if(entry){entry.cleanup?.();entry.cleanup=entry.run();}});
 const tick=async()=>{const pending=[...timers.values()];timers.clear();for(const run of pending)run();await settle();};
 return{env,calls,store,listeners,render,dispose,strictReplay,tick};
}
async function ready(patch={}){const w=workspace(patch);w.render();await settle();w.render();return w;}
test('explicit wizard recovery confirms the dispatched packet without saving, signing or completing again',async()=>{
 const input={...createEmptyIntakeForm(),firstName:'Fiktive Person',intakeDocuments:[{templateKey:'contract',signatures:{client:{dataUrl:'original'}}}]};
 const w=await ready({documentFailure:true,legacy:{form:input,stepIndex:1,clientId:id(3)}});w.render().updateField('specialNotes','Originaler Prüfstand');w.render();await w.tick();
 const pending=w.render();assert.equal(pending.workflowProgress.stage,'documents-dispatched');const writes=w.calls.filter(call=>['save','documents','complete'].includes(call[0])).length;
 assert.equal(await pending.recoverPendingWrite(),null);const after=w.render();assert.equal(after.workflowProgress.documentsConfirmed,true);
 assert.equal(after.workflowProgress.stage,'ready');assert.equal(w.calls.filter(call=>['save','documents','complete'].includes(call[0])).length,writes);
 assert.equal(w.calls.filter(call=>call[0]==='confirmDocuments').length,1);w.dispose();
});
test('a missing packet receipt keeps the explicit recovery action blocked and does not clear the original form',async()=>{
 const input={...createEmptyIntakeForm(),firstName:'Original',intakeDocuments:[{templateKey:'contract',signatures:{client:{dataUrl:'original'}}}]};
 const w=await ready({documentFailure:true,documentConfirmationFailure:true,legacy:{form:input,stepIndex:1,clientId:id(3)}});w.render().updateField('specialNotes','Originaler Prüfstand');w.render();await w.tick();
 assert.equal(w.render().workflowProgress.stage,'documents-dispatched');assert.equal(await w.render().recoverPendingWrite(),null);const after=w.render();assert.equal(after.draftSaveState,'blocked');
 assert.equal(after.form.firstName,'Original');assert.equal(after.workflowProgress.documentsConfirmed,false);w.dispose();
});
test('manual save recognizes an already completed original request without attempting another save after recovery',async()=>{
 const w=await ready({completeFailure:true});w.render().updateField('firstName','Original');await w.tick();
 assert.equal(await w.render().submit(),null);assert.equal(w.render().workflowProgress.stage,'submit-dispatched');
 const writes=w.calls.filter(call=>call[0]==='save').length;assert.equal(await w.render().saveDraft(),true);
 const after=w.render();assert.ok(after.createdId);assert.equal(after.draftSaveState,'saved');
 assert.equal(w.calls.filter(call=>call[0]==='save').length,writes);assert.equal(w.calls.filter(call=>call[0]==='complete').length,1);w.dispose();
});
test('a prepared but inactive completion cannot be presented as a successful recovery',async()=>{
 const w=await ready({completeFailure:true,completionConfirmationFailure:true});w.render().updateField('firstName','Original');await w.tick();
 await w.render().submit();assert.equal(await w.render().recoverPendingWrite(),null);const after=w.render();
 assert.equal(after.createdId,null);assert.equal(after.workflowProgress.stage,'submit-dispatched');assert.equal(after.draftSaveState,'blocked');w.dispose();
});
test('actual Web wizard loads first, saves in background without replacing the form, and only then reports saved',async()=>{
 const gate=deferred(),w=await ready({saveGate:gate});w.render().updateField('firstName','Anna');w.render();
 assert.equal(w.render().draftSaveState,'pending');await w.tick();assert.equal(w.render().submitting,false);assert.equal(w.render().draftSaveState,'saving');
 gate.resolve();await settle();assert.equal(w.render().draftSaveState,'saved');assert.equal(w.render().form.firstName,'Anna');w.dispose();
});
test('actual Web wizard shows automatic-save errors rather than silently claiming security',async()=>{
 const w=await ready({saveFailure:true});w.render().updateField('firstName','Anna');w.render();await w.tick();
 assert.equal(w.render().draftSaveState,'blocked');assert.equal(w.render().draftSaveFeedback.variant,'warning');w.dispose();
});
test('actual Web wizard submits the final form only after earlier autosave and preserves the reserved id',async()=>{
 const gate=deferred(),w=await ready({saveGate:gate});w.render().updateField('firstName','Old');w.render();await w.tick();
 w.render().updateField('firstName','Final');const final=w.render().submit();await settle();assert.equal(w.calls.some(call=>call[0]==='complete'),false);
 gate.resolve();assert.ok(await final);const writes=w.calls.filter(call=>call[0]==='save');assert.deepEqual(writes.map(call=>call[4]),['insert','update']);
 assert.equal(w.calls.find(call=>call[0]==='complete')[2],writes[0][3]);assert.equal(w.calls.find(call=>call[0]==='complete')[3].firstName,'Final');w.dispose();
});
for(const kind of ['tenant','token','logout'])test(`actual wizard masks its previous form synchronously on ${kind} change and ignores a late old save`,async()=>{
 const gate=deferred(),w=await ready({saveGate:gate});w.render().updateField('firstName','Private old person');w.render();await w.tick();
 if(kind==='tenant'){w.env.tenant=id(9);w.env.auth.profile.tenantId=id(9);}else if(kind==='token')w.env.auth.session.accessToken='new-token';else w.env.auth.isAuthenticated=false;
 const immediate=w.render(false);assert.equal(immediate.form.firstName,'');assert.equal(immediate.draftSaveFeedback,null);assert.equal(immediate.isSuccess,false);
 w.render();gate.resolve();await settle();const after=w.render();assert.notEqual(after.draftSaveState,'saved');assert.equal(w.calls.some(call=>call[0]==='complete'),false);w.dispose();
});
test('actual wizard ignores completion from an obsolete owner and does not navigate to that person',async()=>{
 const gate=deferred(),w=await ready({completeGate:gate});w.render().updateField('firstName','Anna');const pending=w.render().submit();await settle();
 assert.equal(w.calls.some(call=>call[0]==='complete'),true);w.env.auth.session.accessToken='other';w.render();gate.resolve();assert.equal(await pending,null);await settle();assert.equal(w.render().isSuccess,false);assert.equal(w.render().submitting,false);w.dispose();
});
test('actual wizard refuses submit while runtime create permission is unavailable',async()=>{
 const w=await ready({allowed:false,permissionLoading:true});w.render().updateField('firstName','Anna');assert.equal(await w.render().submit(),null);await w.tick();assert.equal(w.calls.length,0);w.dispose();
});
test('actual wizard validates required sections before reserving or dispatching the final person',async()=>{
 const w=await ready({validation:{firstName:'Pflichtfeld'}});assert.equal(await w.render().submit(),null);assert.equal(w.calls.some(call=>call[0]==='save'),false);assert.equal(w.render().submitting,false);w.dispose();
});
test('actual wizard can reconcile a dispatched draft with manual save and keeps the same original person',async()=>{
 const w=await ready({saveFailure:true});w.render().updateField('firstName','Anna');w.render();await w.tick();const first=w.calls.find(call=>call[0]==='save')[3];
 w.env.saveFailure=false;await w.render().saveDraft();assert.equal(w.render().draftSaveState,'saved');const writes=w.calls.filter(call=>call[0]==='save');assert.equal(writes[1][3],first);assert.equal(writes[1][4],'update');w.dispose();
});
test('actual wizard does not clear a live lead when New beginning is pressed while autosave is pending',async()=>{
 const gate=deferred(),w=await ready({saveGate:gate});w.render().updateField('firstName','Anna');w.render();await w.tick();const discard=w.render().discardDraft();gate.resolve();await discard;
 assert.equal(w.render().form.firstName,'Anna');assert.equal(w.render().draftSaveFeedback.variant,'warning');w.dispose();
});
test('Strict Mode effect replay creates a new coordinator and completes restoration',async()=>{
 const w=workspace();w.render();w.strictReplay();await settle();assert.equal(w.render().loading,false);w.render().updateField('firstName','Anna');await w.render().saveDraft();assert.equal(w.render().draftSaveState,'saved');w.dispose();
});
test('actual wizard returns to an empty new intake after durable completion and explicit New person action',async()=>{
 const w=await ready();w.render().updateField('firstName','Anna');assert.ok(await w.render().submit());assert.equal(w.render().isSuccess,true);
 await w.render().discardDraft();assert.equal(w.render().isSuccess,false);assert.equal(w.render().form.firstName,'');w.dispose();
});
test('retained field actions from an old tenant cannot edit the next tenant form',async()=>{
 const w=await ready();const old=w.render();old.updateField('firstName','Old original');w.render();
 w.env.tenant=id(9);w.env.auth.profile.tenantId=id(9);w.render();await settle();w.render();
 old.updateField('firstName','Must not cross');old.replaceForm({...createEmptyIntakeForm(),firstName:'Must not cross either'});
 assert.equal(w.render().form.firstName,'');assert.equal(await old.submit(),null);w.dispose();
});
test('retained submit and mutation actions stop after component unmount',async()=>{
 const w=await ready();const old=w.render();w.dispose();old.updateField('firstName','After unmount');assert.equal(await old.submit(),null);assert.equal(w.calls.length,0);
});
test('an edit route without a client id is unavailable rather than falling through to new intake',async()=>{
 const w=await ready({options:{mode:'edit'}});const state=w.render();assert.equal(state.isEditMode,true);assert.equal(state.notFound,true);
 assert.equal(await state.submit(),null);assert.equal(w.calls.length,0);w.dispose();
});

test('actual dirty intake warns before document unload until a save is acknowledged',async()=>{
 const gate=deferred(),w=await ready({saveGate:gate});assert.equal(w.listeners.has('beforeunload'),false);
 w.render().updateField('firstName','Anna');w.render();const event={preventDefault(){this.prevented=true;}};w.listeners.get('beforeunload')(event);
 assert.equal(event.prevented,true);assert.equal(event.returnValue,'');await w.tick();w.render();assert.equal(w.listeners.has('beforeunload'),true);
 gate.resolve();await settle();w.render();assert.equal(w.listeners.has('beforeunload'),false);w.dispose();
});
// Execute the current form's actual close callback and save(true), including
// their shared synchronous action lock. This controls hook leaves, not layout.
function actualCloseUi(options={}){
 const source=read('src/components/office/clientintakewizardform.web.tsx');
 const request=source.slice(source.indexOf('  const requestClose = useCallback('),source.indexOf('  useEffect(() => { onCloseRequestChange'));
 const save=source.slice(source.indexOf('  async function save('),source.indexOf('  async function reset('));
 assert.ok(request.startsWith('  const requestClose'));assert.ok(save.startsWith('  async function save'));
 const state={closed:0,saves:0,confirmation:null,error:null,action:null,showErrors:false};
 const actionLock={current:false},alive={current:true},lastFocus={current:null},opener={focus(){}};
 const wizard={isEditMode:false,submitting:false,discardingDraft:false,async saveDraft(){state.saves++;return options.gate?await options.gate.promise:options.saved??false;},async saveFirstContact(){throw Error('Not a first-contact leaf');},...options.wizard};
 const deps={useCallback:fn=>fn,actionLock,alive,wizard,dirty:options.dirty??true,onCancel:()=>{state.closed++;options.onCancel?.();},lastFocus,document:{activeElement:opener},
  setActionError:value=>{state.error=value;},setConfirmation:value=>{state.confirmation=value;},setAction:value=>{state.action=value;},setShowErrors:value=>{state.showErrors=value;},firstContact:false};
 const actions=new Function(...Object.keys(deps),stripTypeScriptTypes(request+save)+';return{requestClose,save};')(...Object.values(deps));
 return{...actions,state,actionLock,alive,lastFocus,opener};
}
function actualCloseDelegate(path,deps){
 const source=read(path),start=source.indexOf(path.includes('modal')?'  const closeRequest = useRef':'  const close = useCallback');
 const end=source.indexOf(path.includes('modal')?'  useEffect(':'  return <ScreenShell',start);
 assert.ok(start>=0&&end>start);
 return new Function('useRef','useCallback',...Object.keys(deps),stripTypeScriptTypes(source.slice(start,end))+';return{closeRequest,setCloseRequest};')(value=>({current:value}),fn=>fn,...Object.values(deps));
}
for(const saved of [false,true])test(`actual dirty close ${saved?'closes after explicitly confirmed save':'keeps an unconfirmed draft open after explicit save'}`,async()=>{
 const ui=actualCloseUi({saved});ui.requestClose();assert.equal(ui.state.confirmation,'close');assert.equal(ui.state.saves,0);assert.equal(ui.state.closed,0);assert.equal(ui.lastFocus.current,ui.opener);
 await ui.save(true);assert.equal(ui.state.saves,1);assert.equal(ui.state.closed,saved?1:0);assert.equal(ui.actionLock.current,false);
 if(!saved){assert.equal(ui.state.showErrors,true);assert.match(ui.state.error,/nicht vollständig bestätigt/);}
});
test('actual close skips an unchanged draft and never starts another save',()=>{const ui=actualCloseUi({dirty:false});ui.requestClose();assert.equal(ui.state.closed,1);assert.equal(ui.state.saves,0);assert.equal(ui.state.confirmation,null);});
for(const key of ['submitting','discardingDraft'])test(`actual close remains blocked while wizard ${key}`,()=>{const ui=actualCloseUi({wizard:{[key]:true}});ui.requestClose();assert.equal(ui.state.closed,0);assert.equal(ui.state.confirmation,null);assert.equal(ui.state.saves,0);});
test('actual explicit save is exclusive and cannot close after its form unmounts during await',async()=>{const gate=deferred(),ui=actualCloseUi({gate});const first=ui.save(true);await ui.save(true);assert.equal(ui.state.saves,1);ui.requestClose();assert.equal(ui.state.confirmation,null);ui.alive.current=false;gate.resolve(true);await first;assert.equal(ui.state.closed,0);assert.equal(ui.actionLock.current,false);});

test('restored local clinical intake fields remain hidden until current runtime permission is confirmed',async()=>{
 const w=await ready({allowed:false,permissionLoading:false,legacy:{form:{...createEmptyIntakeForm(),firstName:'Private restored person'},stepIndex:1,clientId:id(3)}});
 assert.equal(w.render().form.firstName,'');assert.match(w.render().loadError,/Berechtigung/);w.dispose();
});
test('revocation masks current form and retained editing callbacks stop before another render',async()=>{
 const w=await ready();w.render().updateField('firstName','Original');const old=w.render();w.env.allowed=false;old.updateField('firstName','Must not replace');
 assert.equal(w.render().form.firstName,'');w.env.allowed=true;assert.equal(w.render().form.firstName,'Original');w.dispose();
});

const person=(patch={})=>({id:id(20),tenant_id:id(1),first_name:'Anna',last_name:'Meyer',date_of_birth:'1940-02-29',insurance_number:'A123456789',status:'active',updated_at:'2026-10-15T06:10:00.123456+00:00',...patch});
function fillIdentity(w,patch={}){w.render().replaceForm({...createEmptyIntakeForm(),firstName:'Anna',lastName:'Meyer',dateOfBirth:'1940-02-29',insuranceNumber:'A123456789',...patch});w.render();}
test('real Web hook and real identity reader keep all initial autosaves local until explicit creation choice',async()=>{
 const w=await ready({realIdentity:true});fillIdentity(w);await w.tick();assert.equal(w.render().draftSaveState,'local');assert.equal(w.calls.some(call=>call[0]==='save'),false);
 assert.equal(await w.render().reviewIdentity(),true);await w.render().saveDraft();assert.equal(w.calls.some(call=>call[0]==='save'),false);
 assert.equal(await w.render().confirmNewPerson(''),true);assert.equal(w.render().draftSaveState,'saved');assert.equal(w.calls.filter(call=>call[0]==='save').length,1);w.dispose();
});
test('real composed intake refuses activation before explicit identity selection and preserves the entire form',async()=>{
 const w=await ready({realIdentity:true});fillIdentity(w);assert.equal(await w.render().submit(),null);assert.equal(w.calls.some(call=>call[0]==='save'||call[0]==='complete'),false);
 assert.equal(w.render().form.insuranceNumber,'A123456789');assert.match(w.render().submitError,/vorhandene Personen/);w.dispose();
});
test('real composed existing-person selection performs no creation, mutation, merge or activation',async()=>{
 const w=await ready({realIdentity:true,candidates:[person()]});fillIdentity(w);await w.tick();await w.render().reviewIdentity();
 assert.equal(w.render().identityReview.exactConflict,true);assert.equal(await w.render().confirmNewPerson('Trotzdem andere Person anlegen'),false);
 assert.equal(await w.render().openExistingPerson(id(20)),id(20));assert.equal(w.render().selectedExistingId,id(20));assert.equal(w.render().createdId,null);assert.equal(w.render().isSuccess,false);
 assert.equal(w.calls.some(call=>call[0]==='save'||call[0]==='complete'),false);const saved=JSON.parse([...w.store.values()][0]);assert.equal(saved.form.firstName,'Anna');assert.equal(saved.stage,'existing-selected');w.dispose();
});
test('real composed similar-name candidates require a reason before a distinct person can be created',async()=>{
 const w=await ready({realIdentity:true,candidates:[person({first_name:'Anne',date_of_birth:'1940-02-28',insurance_number:'B987654321'})]});fillIdentity(w);await w.render().reviewIdentity();
 assert.equal(await w.render().confirmNewPerson(''),false);assert.equal(w.calls.some(call=>call[0]==='save'),false);
 assert.equal(await w.render().confirmNewPerson('Geburtsdatum und Versicherungsnummer sind verschieden.'),true);assert.equal(w.calls.filter(call=>call[0]==='save').length,1);w.dispose();
});
test('real composed candidate change before first dispatch stops insertion while local input remains intact',async()=>{
 const w=await ready({realIdentity:true});fillIdentity(w);await w.render().reviewIdentity();w.env.candidates.push(person());
 assert.equal(await w.render().confirmNewPerson(''),false);assert.equal(w.calls.some(call=>call[0]==='save'),false);assert.equal(w.render().form.lastName,'Meyer');assert.equal(w.render().identityReview.status,'idle');w.dispose();
});
test('changing identity fields after a confirmed first lead returns to local-only saving until explicit review',async()=>{
 const w=await ready({realIdentity:true});fillIdentity(w);await w.render().reviewIdentity();await w.render().confirmNewPerson('');const first=w.calls.find(call=>call[0]==='save')[3];
 w.render().updateField('insuranceNumber','C987654321');w.render();await w.tick();assert.equal(w.render().draftSaveState,'local');assert.equal(w.calls.filter(call=>call[0]==='save').length,1);
 assert.equal(await w.render().submit(),null);assert.equal(w.calls.some(call=>call[0]==='complete'),false);
 await w.render().reviewIdentity();await w.render().confirmNewPerson('');assert.equal(w.calls.filter(call=>call[0]==='save')[1][3],first);assert.equal(w.calls.filter(call=>call[0]==='save')[1][4],'update');w.dispose();
});
test('an old existing-person selection survives reload as a choice requiring current review, never as a created success',async()=>{
 const first=await ready({realIdentity:true,candidates:[person()]});fillIdentity(first);await first.render().reviewIdentity();await first.render().openExistingPerson(id(20));
 const w=await ready({realIdentity:true,candidates:[person()],store:first.store});assert.equal(w.render().selectedExistingId,id(20));assert.equal(w.render().isSuccess,false);
 assert.equal(await w.render().openExistingPerson(id(20)),null);await w.render().reviewIdentity();assert.equal(await w.render().openExistingPerson(id(20)),id(20));
 assert.equal(w.calls.some(call=>call[0]==='save'||call[0]==='complete'),false);first.dispose();w.dispose();
});
test('a persisted local creation choice is not restored as a current permission or candidate receipt',async()=>{
 const first=await ready({realIdentity:true});fillIdentity(first);await first.render().reviewIdentity();await first.render().confirmNewPerson('');
 const w=await ready({realIdentity:true,store:first.store});assert.equal(w.render().identityReview.status,'idle');await w.render().saveDraft();assert.equal(w.render().draftSaveState,'local');assert.equal(w.calls.some(call=>call[0]==='save'),false);first.dispose();w.dispose();
});
test('real identity candidates are immediately hidden on same-owner sensitive-right loss',async()=>{
 const w=await ready({realIdentity:true,candidates:[person()]});fillIdentity(w);await w.render().reviewIdentity();assert.equal(w.render().identityReview.candidates.length,1);
 w.env.allowed=false;assert.equal(w.render().identityReview,null);assert.equal(await w.render().openExistingPerson(id(20)),null);w.dispose();
});
test('late real candidate response after session switch cannot expose original persons to the next session',async()=>{
 const gate=deferred(),w=await ready({realIdentity:true,candidates:[person()],identityGate:gate});fillIdentity(w);const pending=w.render().reviewIdentity();await settle();
 w.env.auth.session.accessToken='different';w.render();gate.resolve();assert.equal(await pending,false);await settle();assert.deepEqual(w.render().identityReview.candidates,[]);w.dispose();
});
test('same-owner permission loss while opening an existing person does not leave the submit lock stuck',async()=>{
 const w=await ready({realIdentity:true,candidates:[person()]});fillIdentity(w);await w.render().reviewIdentity();const gate=deferred();w.env.identityGate=gate;
 const pending=w.render().openExistingPerson(id(20));await settle();w.env.allowed=false;gate.resolve();assert.equal(await pending,null);
 w.env.allowed=true;delete w.env.identityGate;assert.equal(await w.render().reviewIdentity(),true);w.dispose();
});
test('prepared Pflege existing-person selection returns only the selected identity without a false created notification',async()=>{
 const w=await ready({realIdentity:true,candidates:[person()]});fillIdentity(w);await w.render().reviewIdentity();
 assert.equal(await w.render().openExistingPerson(id(20)),id(20));assert.equal(w.render().selectedExistingId,id(20));assert.equal(w.render().createdId,null);assert.equal(w.render().isSuccess,false);
 assert.equal(w.calls.some(call=>['save','documents','complete'].includes(call[0])),false);w.dispose();
});
for(const saved of [false,true])test(`actual modal delegates close to its current form ${saved?'until explicit save confirms':'without treating an unconfirmed save as exit'}`,async()=>{
 let closed=0;const ui=actualCloseUi({saved,onCancel:()=>closed++}),parent=actualCloseDelegate('src/components/office/clientintakemodal.web.tsx',{onClose:()=>closed++});
 parent.setCloseRequest(ui.requestClose);parent.closeRequest.current();assert.equal(closed,0);assert.equal(ui.state.confirmation,'close');
 await ui.save(true);assert.equal(closed,saved?1:0);
 parent.setCloseRequest(null);parent.closeRequest.current();assert.equal(closed,saved?2:1);
});

test('create permission without sensitive read permission keeps the whole intake local and cannot infer no candidates',async()=>{
 const w=await ready({realIdentity:true,deny:['office.clients.view_sensitive']});fillIdentity(w);await w.tick();assert.equal(w.render().draftSaveState,'local');
 assert.equal(w.render().canReviewIdentity,false);assert.equal(w.render().identityReview,null);assert.equal(await w.render().reviewIdentity(),false);
 assert.equal(w.calls.some(call=>['identityRead','save','complete'].includes(call[0])),false);w.dispose();
});
test('manual save cannot authorize closing when newer input was entered during its awaited write',async()=>{
 const gate=deferred(),w=await ready({saveGate:gate});w.render().updateField('firstName','Initial');const pending=w.render().saveDraft();await settle();
 w.render().updateField('firstName','Newer input');w.render();gate.resolve();assert.equal(await pending,false);assert.equal(w.render().form.firstName,'Newer input');assert.equal(w.render().draftSaveFeedback.variant,'warning');w.dispose();
});
test('actual standalone Back delegates to the form confirmation and cannot use a late save after form unmount',async()=>{
 for(const saved of [false,true]){let backed=0;const ui=actualCloseUi({saved,onCancel:()=>backed++}),parent=actualCloseDelegate('src/screens/business/office/ClientIntakeWizardScreen.web.tsx',{router:{back:()=>backed++}});
  parent.setCloseRequest(ui.requestClose);parent.closeRequest.current();assert.equal(backed,0);assert.equal(ui.state.confirmation,'close');await ui.save(true);assert.equal(backed,saved?1:0);
 }
 const gate=deferred();let backed=0;const ui=actualCloseUi({gate,onCancel:()=>backed++}),parent=actualCloseDelegate('src/screens/business/office/ClientIntakeWizardScreen.web.tsx',{router:{back:()=>backed++}});
 parent.setCloseRequest(ui.requestClose);parent.closeRequest.current();const saving=ui.save(true);ui.alive.current=false;parent.setCloseRequest(null);gate.resolve(true);await saving;assert.equal(backed,0);
});

test('real composed first-write preparation failure preserves local input and cannot dispatch a person',async()=>{
 const w=await ready({realIdentity:true,prepareFailure:true});fillIdentity(w);await w.tick();await w.render().reviewIdentity();
 assert.equal(await w.render().confirmNewPerson(''),false);assert.equal(w.calls.some(c=>c[0]==='save'),false);
 assert.equal(w.render().form.firstName,'Anna');assert.ok(w.calls.some(c=>c[0]==='reviewPreparation'));
 assert.equal([...w.store.values()].map(JSON.parse)[0].stage,'ready');w.dispose();
});
test('session loss while real server preparation is pending never dispatches the old form',async()=>{
 const gate=deferred(),w=await ready({realIdentity:true,prepareGate:gate});fillIdentity(w);await w.tick();await w.render().reviewIdentity();
 const pending=w.render().confirmNewPerson('');await settle();assert.ok(w.calls.some(c=>c[0]==='reviewPreparation'));
 w.env.auth.session.accessToken='new-session';w.render();gate.resolve();assert.equal(await pending,false);await settle();
 assert.equal(w.calls.some(c=>c[0]==='save'),false);assert.deepEqual(w.render().identityReview.candidates,[]);w.dispose();
});
