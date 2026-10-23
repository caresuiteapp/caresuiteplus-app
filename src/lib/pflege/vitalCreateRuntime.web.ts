import {assertVitalSdkOwnerWeb} from './vitalSdkOwner.web.ts';
import {cloneClientNativeOriginal as clone,freezeClientNativeOriginal as freeze,sameClientNativeOriginal as same} from '../clients/clientRecordNativeOriginal.web.ts';
import {carePermissionOwnerIsCurrent,type CarePermissionOwner} from '../permissions/carePermissionOwner.web.ts';
import {getSupabaseClient} from '@/lib/supabase/client';
import {getServiceMode} from '@/lib/services/mode';
import {getVitalDefinition} from './vitalCatalog.ts';
import {validateVitalMeasurement,type VitalMeasurementPayload} from './vitalMeasurementDomain.ts';
import {executeVitalCreateNativeWeb,isOwnVitalCreateWriteResultWeb,isSettledVitalCreateWriteResultWeb} from './vitalCreateNativeWrite.web.ts';
import {isOwnVitalCreateDeliveryWeb} from './vitalCreateOriginalRead.web.ts';
import type {VitalClient,VitalChoice} from './vitalDocumentationService';
import type {VitalNativeReceiptScopeWeb} from './vitalNativeWriteReceipt.web';

type SDK=NonNullable<ReturnType<typeof getSupabaseClient>>;
type Can=(key:'pflege.vitals.view'|'pflege.vitals.manage')=>unknown;
type Kind='clients'|'choices';
type Row=Record<string,unknown>;
export type VitalCreateLiveAccess={owner:CarePermissionOwner|null;can:Can};
export type VitalCreateReadEnvelope<T>={view:readonly T[]};
export type VitalCreateReadScope=Readonly<Record<string,never>>;
export type VitalCreateReadTicket={kind:Kind;clientId:string|null};
type Ticket={public:VitalCreateReadTicket;scope:VitalCreateReadScope;kind:Kind;clientId:string|null;id:number;can:Can;owner:CarePermissionOwner};
type Receipt={ticket:Ticket;envelope:object;original:unknown;view:unknown};
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const roles=new Set(['business_admin','business_manager','billing','dispatch','nurse','caregiver','counselor','akademie_admin']);
const ownOwner=(input:unknown):CarePermissionOwner=>{const owner=clone(input) as CarePermissionOwner;if(!owner||typeof owner!=='object'||Array.isArray(owner)||Object.keys(owner).length!==6||!uuid(owner.tenantId)||!uuid(owner.profileId)||!roles.has(owner.roleKey)||owner.demo!==false||typeof owner.accessToken!=='string'||!owner.accessToken||owner.expiresAt!==null&&(!Number.isSafeInteger(owner.expiresAt)||owner.expiresAt<=Date.now()))throw Error('Aktueller eigener nativer Benutzerbezug fehlt.');return freeze(owner);};
const identity=(owner:CarePermissionOwner)=>JSON.stringify([owner.tenantId,owner.profileId,owner.roleKey]);
const wholePayload=(value:unknown):VitalMeasurementPayload=>{const payload=clone(value) as VitalMeasurementPayload,keys=['clientId','type','occurredAt','valuesJson','contextJson','note','catalogVersion','configurationVersion'];if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length!==keys.length||keys.some(key=>!Object.hasOwn(payload,key)||typeof (payload as unknown as Row)[key]!=='string')||!uuid(payload.clientId))throw Error('Ganze ursprüngliche Messanfrage fehlt.');return freeze(payload);};
const liveField=(value:unknown,key:string):unknown=>{if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Aktuelle native Rechte fehlen.');const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('Aktuelle native Rechte fehlen.');return descriptor.value;};
type OriginalStore={journal:{id:string;payload:VitalMeasurementPayload}|null;acknowledged:string|null;flight:{token:object;runtime:VitalCreateRuntimeWeb;version:number}|null;draftEpoch:number;uncertain:boolean;version:number;listeners:Set<()=>void>};
const originalStores=new Map<string,OriginalStore>();
const receiptScopes=new WeakMap<object,{owner:CarePermissionOwner;store:OriginalStore;rawAuthId:string|null}>();
const newDraftTokens=new WeakMap<object,{runtime:VitalCreateRuntimeWeb;store:OriginalStore;ack:string;version:number;can:Can;owner:CarePermissionOwner}>();
const retryTokens=new WeakMap<object,{runtime:VitalCreateRuntimeWeb;store:OriginalStore;id:string;payload:VitalMeasurementPayload}>();
const notify=(store:OriginalStore)=>{for(const listener of [...store.listeners])try{listener();}catch{}};
const blockedFlags=(input:unknown)=>{const flags=clone(input) as Row;return !flags||typeof flags!=='object'||Array.isArray(flags)||['loading','refreshing','error','refreshError','previewData','tableMissing','fromCache','partialDetail','usedDemoFallback'].some(key=>!Object.hasOwn(flags,key)||flags[key]!==false);};

/** Private current Web editor. Original request identity is independent of read receipts. */
export class VitalCreateRuntimeWeb {
 private readonly owner:CarePermissionOwner;private readonly live:()=>unknown;private readonly sdk:SDK|null;
 private alive=true;private closed=false;private counter=0;
 private tickets=new Map<Kind,Ticket>();private receipts=new Map<Kind,Receipt>();private views=new Map<Kind,{envelope:unknown;blocked:boolean}>();
 private readScope:{token:VitalCreateReadScope;can:Can;owner:CarePermissionOwner;id:number}|null=null;
 private closeReceipts=new WeakMap<object,{scope:VitalCreateReadScope;counter:number;originalVersion:number}>();
 private prepared:{payload:VitalMeasurementPayload;clients:Receipt;choices:Receipt}|null=null;
 private readonly originalStore:OriginalStore;
 private get journal(){return this.originalStore.journal;}private set journal(value:{id:string;payload:VitalMeasurementPayload}|null){this.originalStore.journal=value;}
 private get acknowledged(){return this.originalStore.acknowledged;}private set acknowledged(value:string|null){this.originalStore.acknowledged=value;}
 constructor(owner:CarePermissionOwner,live:()=>unknown){this.owner=ownOwner(owner);if(typeof live!=='function'||Object.getPrototypeOf(live)!==Function.prototype)throw Error('Ursprünglicher eigener Rechteaufruf fehlt.');this.live=live;this.sdk=getSupabaseClient();if(!this.sdk||getServiceMode()!=='supabase')this.closed=true;const key=identity(this.owner);let store=originalStores.get(key);if(!store){store={journal:null,acknowledged:null,flight:null,draftEpoch:0,uncertain:false,version:0,listeners:new Set()};originalStores.set(key,store);}this.originalStore=store;receiptScopes.set(this,{owner:this.owner,store,rawAuthId:null});}
 get originalDraftVersion(){return this.originalStore.draftEpoch;}
 get tenantId(){return this.owner.tenantId;}get role(){return this.owner.roleKey;}
 mount(){if(!this.closed)this.alive=true;}dispose(){this.alive=false;this.invalidateReads();}
 private invalidateReads(){this.counter++;this.tickets.clear();this.receipts.clear();this.prepared=null;this.readScope=null;}
 /** Callback/getter checks precede the last SDK accessor and Mode. The final
  * local lifetime check must still run after those potentially reentrant calls. */
 assertCurrent(manage=false,ticket?:VitalCreateReadTicket):{sdk:SDK;can:Can;owner:CarePermissionOwner}{
  if(ticket&&this.tickets.get(ticket.kind)?.public!==ticket)throw Error('Eine frühere Lesegeneration ist beendet.');
  try{
   if(!this.alive||this.closed)throw Error('Eigener Editor ist nicht aktuell.');
   const value=this.live(),owner=ownOwner(liveField(value,'owner')),can=liveField(value,'can');
   if(typeof can!=='function'||Object.getPrototypeOf(can)!==Function.prototype)throw Error('Native Rechteabfrage fehlt.');
   if(identity(owner)!==identity(this.owner)){this.closed=true;throw Error('Ursprünglicher Eigentümer wurde gewechselt.');}
   if(can('pflege.vitals.view')!==true||manage&&can('pflege.vitals.manage')!==true)throw Error('Aktuelle native Vitalwertrechte fehlen.');
   const held=ticket&&this.tickets.get(ticket.kind);if(ticket&&(!held||held.public!==ticket||this.readScope?.token!==held.scope||held.can('pflege.vitals.view')!==true||!same(held.owner,owner)))throw Error('Ursprünglicher Lesebezug ist nicht aktuell.');
   const sdk=getSupabaseClient();if(sdk!==this.sdk){this.closed=true;throw Error('Ursprüngliche Verbindung wurde gewechselt.');}
   if(can('pflege.vitals.view')!==true||manage&&can('pflege.vitals.manage')!==true||held&&held.can('pflege.vitals.view')!==true)throw Error('Native Rechte nach dem Verbindungszugriff fehlen.');
   const currentOwner=carePermissionOwnerIsCurrent(owner);
   const mode=getServiceMode();if(mode!=='supabase'){this.closed=true;throw Error('Live-Verbindung fehlt.');}
   // The Mode accessor can reenter a controlled runtime boundary. Bind the
   // same captured SDK after it and before the final native Can inspections.
   if(getSupabaseClient()!==sdk){this.closed=true;throw Error('Letzte ursprüngliche Verbindung wurde gewechselt.');}
   // Native hook Can is the source-defined synchronous current read/owner
   // inspection. A later Mode accessor must not reopen its last grant check.
   if(can('pflege.vitals.view')!==true||manage&&can('pflege.vitals.manage')!==true||held&&held.can('pflege.vitals.view')!==true)throw Error('Letzte native Rechte fehlen.');
   if(!currentOwner||!this.alive||this.closed||ticket&&this.tickets.get(ticket.kind)?.public!==ticket)throw Error('Eigener letzter Lese-/Lebenszeitbezug fehlt.');
   return {sdk:sdk!,can:can as Can,owner};
  }catch(error){this.invalidateReads();throw error;}
 }
 canRead(){try{this.assertCurrent();return true;}catch{return false;}}
 canManage(){try{this.assertCurrent(true);return true;}catch{return false;}}
 /** Captured native Can survives ordinary rerenders, but the actual Hook's
  * closed old read cannot revive when another permission generation is ready. */
 captureReadScope():VitalCreateReadScope|null{
  try{const current=this.assertCurrent(),held=this.readScope;if(held&&same(held.owner,current.owner)&&held.can('pflege.vitals.view')===true&&this.alive&&!this.closed)return held.token;
   this.invalidateReads();const token=Object.freeze({});this.readScope={token,can:current.can,owner:current.owner,id:++this.counter};this.assertReadScope(token);return token;
  }catch{return null;}
 }
 get readScopeVersion(){return this.readScope?.id??0;}
 assertReadScope(scope:VitalCreateReadScope|null){const held=this.readScope;if(!held||held.token!==scope)throw Error('Ursprüngliche native Lesegeneration fehlt.');const current=this.assertCurrent();if(this.readScope!==held||!same(held.owner,current.owner)||held.can('pflege.vitals.view')!==true||!this.alive||this.closed){if(this.readScope===held)this.invalidateReads();throw Error('Ursprüngliche native Lesegeneration wurde beendet.');}}
 beginRead(kind:Kind,clientId:string|null=null,scope:VitalCreateReadScope|null=null):VitalCreateReadTicket{
  if(kind==='choices'&&!uuid(clientId))throw Error('Klient:in ausdrücklich auswählen.');this.assertReadScope(scope);const current=this.assertCurrent();this.assertReadScope(scope);
  const publicTicket=Object.freeze({kind,clientId}),ticket={public:publicTicket,scope:scope!,kind,clientId,id:++this.counter,can:current.can,owner:current.owner};
  this.tickets.set(kind,ticket);this.receipts.delete(kind);this.prepared=null;return publicTicket;
 }
 clearChoices(){this.tickets.delete('choices');this.receipts.delete('choices');this.prepared=null;this.counter++;}
 acceptRead<T>(ticket:VitalCreateReadTicket,original:unknown,view:T[],delivery:unknown):VitalCreateReadEnvelope<T>{
  if(!isOwnVitalCreateDeliveryWeb(delivery,this,ticket,original,view))throw Error('Eigene native Readerprovenienz fehlt.');this.assertCurrent(false,ticket);const raw=freeze(clone(original)),projected=freeze(clone(view));this.assertCurrent(false,ticket);
  const envelope=Object.freeze({view:projected}),held=this.tickets.get(ticket.kind)!;this.receipts.set(ticket.kind,{ticket:held,envelope,original:raw,view:projected});return envelope;
 }
 setView(kind:Kind,envelope:unknown,flags:unknown){let blocked=true;try{blocked=blockedFlags(flags);}catch{}this.views.set(kind,{envelope,blocked});}
 canShow(kind:Kind,envelope:unknown):boolean{
  try{const receipt=this.receipts.get(kind),view=this.views.get(kind);if(!receipt||!view||view.blocked||view.envelope!==envelope||receipt.envelope!==envelope)return false;this.assertCurrent(false,receipt.ticket.public);const captured=clone(envelope);if(!same(captured,{view:receipt.view}))return false;this.assertCurrent(false,receipt.ticket.public);return this.receipts.get(kind)===receipt&&this.views.get(kind)===view&&!view.blocked;}catch{return false;}
 }
 visible<T>(kind:Kind,envelope:VitalCreateReadEnvelope<T>|null):readonly T[]|null{return this.canShow(kind,envelope)?envelope!.view:null;}
 maySelect(kind:Kind,envelope:unknown){return !this.journal&&!this.acknowledged&&this.canManage()&&this.canShow(kind,envelope);}
 private readyPayload(payload:VitalMeasurementPayload,clients:Receipt,choices:Receipt):boolean{
  if(!this.canShow('clients',clients.envelope)||!this.canShow('choices',choices.envelope)||!this.canManage()||choices.ticket.clientId!==payload.clientId)return false;
  const people=clients.view as VitalClient[],options=choices.view as VitalChoice[],person=people.filter(row=>row.id===payload.clientId),choice=options.filter(row=>row.key===payload.type),definition=getVitalDefinition(payload.type);
  if(person.length!==1||choice.length!==1||choice[0].enabled!==true||choice[0].catalogVersion!==payload.catalogVersion||choice[0].configurationVersion!==payload.configurationVersion||!definition||validateVitalMeasurement(payload,definition))return false;
  return this.canShow('clients',clients.envelope)&&this.canShow('choices',choices.envelope)&&this.canManage();
 }
 prepare(value:unknown,clientsEnvelope:unknown,choicesEnvelope:unknown){
  try{if(this.journal||this.acknowledged)return false;const payload=wholePayload(value),clients=this.receipts.get('clients'),choices=this.receipts.get('choices');if(!clients||!choices||clients.envelope!==clientsEnvelope||choices.envelope!==choicesEnvelope||!this.readyPayload(payload,clients,choices))return false;this.prepared={payload,clients,choices};return true;}catch{return false;}
 }
 beginRequest(id:string,value:unknown,replay:boolean){
  if(this.originalStore.flight)throw Error('Die ursprüngliche Anfrage läuft noch.');if(!uuid(id))throw Error('Ungültige ursprüngliche Anfragekennung.');const payload=wholePayload(value);this.assertCurrent(true);
  if(replay){if(!this.journal||this.journal.id!==id||!same(this.journal.payload,payload))throw Error('Unveränderte ursprüngliche Messanfrage fehlt.');}
  else{const prepared=this.prepared;if(this.journal||this.acknowledged||!prepared||!same(prepared.payload,payload)||!this.readyPayload(payload,prepared.clients,prepared.choices))throw Error('Aktuelle ganze Auswahl zuerst bestätigen.');this.journal={id,payload};}
  try{this.assertRequest(id,payload);}catch(error){if(!replay)this.journal=null;throw error;}this.originalStore.version++;this.originalStore.flight={token:Object.freeze({}),runtime:this,version:this.originalStore.version};this.originalStore.uncertain=false;notify(this.originalStore);return payload;
 }
 assertRequest(id:string,value:unknown):SDK{const payload=wholePayload(value);if(this.originalStore.flight&&this.originalStore.flight.runtime!==this)throw Error('Eine andere ursprüngliche Transportphase läuft.');if(!this.journal||this.journal.id!==id||!same(this.journal.payload,payload))throw Error('Ursprüngliche Messanfrage geändert.');const current=this.assertCurrent(true);if(!this.journal||this.journal.id!==id||!same(this.journal.payload,payload)||!this.alive||this.closed)throw Error('Letzter eigener Anfragebezug fehlt.');return current.sdk;}
 writeFlight(id:string){const flight=this.originalStore.flight;return this.journal?.id===id&&flight?.runtime===this?flight.token:null;}
 settleRequest(id:string,result:{ok:boolean;uncertain?:boolean;data?:{id:string}},replay:boolean,token:object|null=null){const store=this.originalStore;if(!token||store.flight?.token!==token||store.flight.runtime!==this||store.flight.version!==store.version||!isOwnVitalCreateWriteResultWeb(result,this,id,replay,token)||this.journal?.id!==id)return;if(!isSettledVitalCreateWriteResultWeb(result,this,id,replay,token)){if(!result.ok&&result.uncertain===true){store.uncertain=true;notify(store);}return;}if(result.ok&&uuid(result.data?.id)){this.acknowledged=result.data!.id;this.journal=null;this.prepared=null;}else if(!replay&&result.uncertain!==true){this.journal=null;this.prepared=null;}store.flight=null;store.uncertain=!!this.journal;store.version++;notify(store);}
 originalRequestState(){const store=this.originalStore;return Object.freeze({pending:!!store.journal,busy:!!store.flight,uncertain:!!store.journal&&store.uncertain});}
 subscribeOriginal(listener:()=>void){const own=()=>{if(this.alive&&!this.closed)listener();};this.originalStore.listeners.add(own);return()=>{this.originalStore.listeners.delete(own);};}
 captureOriginalRetry(){try{const store=this.originalStore;if(!store.journal||store.flight||!this.canManage())return null;const token=Object.freeze({});retryTokens.set(token,{runtime:this,store,id:store.journal.id,payload:store.journal.payload});return token;}catch{return null;}}
 async retryOriginal(token:unknown){const entry=token&&typeof token==='object'?retryTokens.get(token):null,store=this.originalStore;if(!entry||entry.runtime!==this||entry.store!==store||store.flight||!store.journal||entry.id!==store.journal.id||entry.payload!==store.journal.payload||!this.canManage())return {ok:false as const,uncertain:!!store.journal,error:'Die unveränderte ursprüngliche Anfrage benötigt aktuelle eigene Rechte.'};return executeVitalCreateNativeWeb(this,entry.id,entry.payload,true);}
 captureNewDraft(){try{const store=this.originalStore;if(!store.acknowledged||store.journal||store.flight)return null;const current=this.assertCurrent(true);const token=Object.freeze({});newDraftTokens.set(token,{runtime:this,store,ack:store.acknowledged,version:store.version,can:current.can,owner:current.owner});return token;}catch{return null;}}
 startNewDraft(token:unknown){try{const entry=token&&typeof token==='object'?newDraftTokens.get(token):null,store=this.originalStore;if(!entry||entry.runtime!==this||entry.store!==store||entry.ack!==store.acknowledged||entry.version!==store.version||store.journal||store.flight||entry.can('pflege.vitals.view')!==true||entry.can('pflege.vitals.manage')!==true)return false;const current=this.assertCurrent(true);if(!same(entry.owner,current.owner)||entry.can('pflege.vitals.view')!==true||entry.can('pflege.vitals.manage')!==true||!this.alive||this.closed||entry.ack!==store.acknowledged||entry.version!==store.version||store.journal||store.flight)return false;store.acknowledged=null;store.version++;store.draftEpoch++;this.invalidateReads();notify(store);return true;}catch{return false;}}
 confirmedReceipt(){return this.acknowledged&&this.mayConfirm(this.acknowledged)?this.acknowledged:null;}
 mayConfirm(id:string){return this.acknowledged===id&&this.canManage()&&this.alive&&!this.closed;}
 mayClose(){return !this.journal&&this.canRead()&&this.alive&&!this.closed;}
 captureClose(){try{const scope=this.readScope?.token;if(!scope||!this.mayClose())return null;this.assertReadScope(scope);const token=Object.freeze({});this.closeReceipts.set(token,{scope,counter:this.counter,originalVersion:this.originalStore.version});return token;}catch{return null;}}
 mayCloseCaptured(token:unknown){try{const receipt=token&&typeof token==='object'?this.closeReceipts.get(token):null;if(!receipt||receipt.counter!==this.counter||receipt.originalVersion!==this.originalStore.version||!this.mayClose())return false;this.assertReadScope(receipt.scope);return receipt.counter===this.counter&&receipt.originalVersion===this.originalStore.version&&!this.journal&&this.alive&&!this.closed;}catch{return false;}}

}
/** Constructor-owned profile scope cannot be replaced by UI-supplied receipt metadata. */
export function captureVitalCreateReceiptScopeWeb(runtime:VitalCreateRuntimeWeb,id:string,payload:VitalMeasurementPayload):VitalNativeReceiptScopeWeb{
 const own=receiptScopes.get(runtime);if(!own||own.store.journal?.id!==id||!same(own.store.journal.payload,payload))throw Error('Eigener ursprünglicher Messquittungsbezug fehlt.');return freeze({tenantId:own.owner.tenantId,actorId:own.owner.profileId,clientId:payload.clientId});
}
export async function assertVitalCreateRequestSessionWeb(runtime:VitalCreateRuntimeWeb,id:string,payload:VitalMeasurementPayload):Promise<void>{
 const own=receiptScopes.get(runtime);if(!own)throw Error('Eigener ursprünglicher Sitzungsbezug fehlt.');captureVitalCreateReceiptScopeWeb(runtime,id,payload);const sdk=runtime.assertRequest(id,payload);
 const rawAuthId=await assertVitalSdkOwnerWeb({client:sdk,owner:own.owner,pinnedAuthId:own.rawAuthId,current:()=>{if(runtime.assertRequest(id,payload)!==sdk)throw Error('Eigener ursprünglicher Sitzungsbezug fehlt.');}});
 if(runtime.assertRequest(id,payload)!==sdk)throw Error('Eigener ursprünglicher Sitzungsbezug fehlt.');own.rawAuthId=rawAuthId;
}
