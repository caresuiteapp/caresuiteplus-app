import {woundInstant,woundUuid,sameWoundJson} from './woundCareDomain.ts';
// Keep protocol validation independent of the control workflow that consumes it.
const controlExact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const dailyProtocolVersion='2026-10-09.1';
export type ProtocolKind='drink'|'meal'|'stool'|'urine'|'fluid_output';
export type ProtocolQuantity={state:'measured'|'estimated'|'not_measured';value:string;unit:'ml'|'g'|'percent'|'';basis:string};
type Common={kind:ProtocolKind;occurredAt:string;source:'observed'|'reported';reportedBy:string;observation:string;reaction:string;reviewState:'scheduled'|'pending'|'not_required';reviewAt:string;reviewReason:string};
export type IntakeEntry=Common&{kind:'drink'|'meal';description:string;outcome:'taken'|'partial'|'none_taken'|'refused'|'omitted'|'not_observed';support:'independent'|'assisted'|'provided'|'unknown';offered:ProtocolQuantity;actual:ProtocolQuantity;reason:string};
export type StoolEntry=Common&{kind:'stool';occurrence:'passed'|'no_stool_observed'|'not_observed';amount:'small'|'medium'|'large'|'not_assessed';consistency:'hard'|'formed'|'soft'|'liquid'|'not_assessed';color:string;reason:string};
type Collection={collectionMode:'single_event'|'interval_collection';collectionRef:string;collectionStartAt:string;collectionEndAt:string};
export type UrineEntry=Common&Collection&{kind:'urine';occurrence:'passed'|'zero_collected'|'no_urine_observed'|'not_observed';method:'spontaneous'|'collection'|'catheter_collection'|'unknown';support:'independent'|'assisted'|'provided'|'unknown';aidsState:'used'|'not_used'|'not_confirmed';aidsDetail:string;color:string;clarity:string;odor:string;symptoms:string;personDecision:string;actual:ProtocolQuantity;reason:string};
export type FluidOutputEntry=Common&Collection&{kind:'fluid_output';occurrence:'collected'|'zero_collected'|'not_observed';route:'emesis'|'drain'|'stoma'|'other_loss';site:string;appearance:string;symptoms:string;actual:ProtocolQuantity;reason:string};
export type ProtocolEntry=IntakeEntry|StoolEntry|UrineEntry|FluidOutputEntry;
export const isOutputProtocol=(kind:unknown)=>kind==='urine'||kind==='fluid_output';
export const outputProtocolFields=['occurrence','actual','collectionMode','collectionRef','collectionStartAt','collectionEndAt','reason'];
export const urineProtocolFields=[...outputProtocolFields,'method','support','aidsState','aidsDetail','color','clarity','odor','symptoms','personDecision'];
export const fluidOutputProtocolFields=[...outputProtocolFields,'route','site','appearance','symptoms'];
export type ProtocolRoot={id:string;tenantId:string;clientId:string;version:string;kind:ProtocolKind};
export type ProtocolDraft={action:'record'|'replace'|'void';entry:ProtocolEntry|null;reason:string};
export type ProtocolEvent={id:string;rootId:string;tenantId:string;clientId:string;sequence:number;previousId:string;actorId:string;requestId:string;recordedAt:string;draft:ProtocolDraft};
export type ProtocolRecord={root:ProtocolRoot;headId:string;eventCount:number;events:ProtocolEvent[];actorNames:Record<string,string>};
export type ProtocolRequest={version:string;clientId:string;rootId:string;expectedHeadId:string;draft:ProtocolDraft};
export const protocolUuid=(v:unknown):v is string=>woundUuid(v)&&v===v.toLowerCase();
function text(v:unknown,label:string,required=true):asserts v is string{if(typeof v!=='string'||v.length>4000||required&&!v.trim())throw Error(label+' fehlt oder ist ungültig.');}
function time(v:unknown,now:number,past=true):bigint{const t=woundInstant(v);if(t===null||!Number.isSafeInteger(now)||past&&t>BigInt(now)*1000n)throw Error('Tatsächlichen Zeitpunkt mit Zeitzone prüfen.');return t;}
export function protocolDecimal(v:unknown):bigint{if(typeof v!=='string'||! /^(0|[1-9]\d{0,5})(\.\d{1,3})?$/.test(v))throw Error('Menge als nichtnegative Dezimalzahl mit höchstens drei Nachkommastellen eingeben.');const [whole,part='']=v.split('.');return BigInt(whole)*1000n+BigInt(part.padEnd(3,'0'));}
export const protocolAmount=(v:bigint)=>{const whole=v/1000n,rest=(v%1000n).toString().padStart(3,'0').replace(/0+$/,'');return whole.toString()+(rest?'.'+rest:'');};
export function validateProtocolQuantity(v:unknown,kind:'drink'|'meal'):asserts v is ProtocolQuantity{
 if(!controlExact(v,['state','value','unit','basis'])||!['measured','estimated','not_measured'].includes(String(v.state)))throw Error('Gemessene, geschätzte oder fehlende Menge ausdrücklich unterscheiden.');
 text(v.basis,'Mess-/Schätzgrundlage oder Grund der fehlenden Erhebung');
 if(v.state==='not_measured'){if(v.value!==''||!(kind==='drink'?v.unit==='ml':['','g','percent'].includes(String(v.unit))))throw Error('Nicht erhobene Menge darf keinen scheinbaren Nullwert enthalten.');return;}
 if(!(kind==='drink'?v.unit==='ml':['g','percent'].includes(String(v.unit))))throw Error('Passende Originaleinheit auswählen.');const amount=protocolDecimal(v.value);if(v.unit==='percent'&&amount>100000n)throw Error('Anteil über 100 Prozent ist ungültig.');
}
export function validateProtocolEntry(v:unknown,now=Date.now()):asserts v is ProtocolEntry{
 const common=['kind','occurredAt','source','reportedBy','observation','reaction','reviewState','reviewAt','reviewReason'];
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Strukturierter Protokolleintrag fehlt.');const e=v as Record<string,unknown>,kind=e.kind;
 if(!['drink','meal','stool','urine','fluid_output'].includes(String(kind))||!controlExact(e,[...common,...(kind==='stool'?['occurrence','amount','consistency','color','reason']:kind==='urine'?urineProtocolFields:kind==='fluid_output'?fluidOutputProtocolFields:['description','outcome','support','offered','actual','reason'])]))throw Error('Protokollart oder Pflichtfelder unvollständig.');
 const occurred=time(e.occurredAt,now);if(!['observed','reported'].includes(String(e.source)))throw Error('Eigene Beobachtung oder Fremdangabe ausdrücklich wählen.');text(e.reportedBy,'Tatsächliche Auskunftsperson',e.source==='reported');if(e.source==='observed'&&e.reportedBy!=='')throw Error('Eigene Beobachtung darf keine fremde Auskunftsperson enthalten.');
 for(const k of ['observation','reaction','reviewReason'])text(e[k],k);if(!['scheduled','pending','not_required'].includes(String(e.reviewState)))throw Error('Weitere Kontrolle ausdrücklich entscheiden.');
 if(e.reviewState==='scheduled'){if(time(e.reviewAt,now,false)<occurred)throw Error('Kontrollvereinbarung liegt vor dem tatsächlichen Ereignis.');}else if(e.reviewAt!=='')throw Error('Unvereinbarte Kontrollfrist entfernen.');
 if(isOutputProtocol(kind)){
  validateOutputProtocol(e as unknown as UrineEntry|FluidOutputEntry,now);
 }else if(kind==='stool'){
  if(!['passed','no_stool_observed','not_observed'].includes(String(e.occurrence))||!['small','medium','large','not_assessed'].includes(String(e.amount))||!['hard','formed','soft','liquid','not_assessed'].includes(String(e.consistency)))throw Error('Tatsächliches Stuhlereignis und Befund ausdrücklich wählen.');
  text(e.color,'Tatsächliche Farbe',false);text(e.reason,'Beobachtungsgrenze / Grund',e.occurrence!=='passed');if(e.occurrence!=='passed'&&(e.amount!=='not_assessed'||e.consistency!=='not_assessed'||e.color!==''))throw Error('Ohne beobachteten Stuhl keine Menge, Konsistenz oder Farbe erfinden.');
 }else{
  text(e.description,'Tatsächliches Getränk / Essen');if(!['taken','partial','none_taken','refused','omitted','not_observed'].includes(String(e.outcome))||!['independent','assisted','provided','unknown'].includes(String(e.support)))throw Error('Tatsächliche Aufnahme und Hilfeumfang auswählen.');
  validateProtocolQuantity(e.offered,kind as 'drink'|'meal');validateProtocolQuantity(e.actual,kind as 'drink'|'meal');text(e.reason,'Abweichungsgrund',e.outcome!=='taken');
  if(!['taken','partial','none_taken'].includes(String(e.outcome))&&e.actual.state!=='not_measured')throw Error('Nichtaufnahme ist kein tatsächlicher positiver oder Null-Aufnahmenachweis.');
  if(e.outcome==='none_taken'&&(e.actual.state!=='measured'||protocolDecimal(e.actual.value)!==0n))throw Error('Bestätigte Nichtaufnahme benötigt ausdrücklich erhobene Nullmenge und tatsächliche Grundlage.');
  if(e.outcome==='not_observed'&&e.source==='observed'&&e.support!=='unknown')throw Error('Nicht beobachtete Unterstützung nicht als eigene Durchführung bestätigen.');
  if(['taken','partial'].includes(String(e.outcome))&&e.actual.state!=='not_measured'&&protocolDecimal(e.actual.value)===0n)throw Error('Tatsächliche Aufnahme und Nullmenge widersprechen sich.');
  if(e.actual.state!=='not_measured'&&e.offered.state!=='not_measured'){
   if(e.actual.unit!==e.offered.unit)throw Error('Unterschiedliche Einheiten ohne bestätigte Umrechnung nicht vergleichen.');
   if(protocolDecimal(e.actual.value)>protocolDecimal(e.offered.value))throw Error('Aufgenommene Menge über Angebot: zusätzliche tatsächliche Angebote einzeln dokumentieren.');
  }
 }
}
function validateOutputProtocol(e:UrineEntry|FluidOutputEntry,now:number):void{
 validateProtocolQuantity(e.actual,'drink');
 const occurred=time(e.occurredAt,now),positive=e.kind==='urine'?e.occurrence==='passed':e.occurrence==='collected';
 const allowed=e.kind==='urine'?['passed','zero_collected','no_urine_observed','not_observed']:['collected','zero_collected','not_observed'];
 if(!allowed.includes(e.occurrence))throw Error('Tatsächliche Ausscheidung, bestätigte Nullmessung oder Beobachtungsgrenze ausdrücklich wählen.');
 text(e.reason,'Ausscheidungsgrund / Beobachtungsgrenze',!positive);text(e.symptoms,'Tatsächliche Beschwerden oder konkrete Beobachtungsgrenze');
 if(positive&&e.actual.state!=='not_measured'&&protocolDecimal(e.actual.value)===0n)throw Error('Tatsächliche positive Ausscheidung widerspricht Nullmenge.');
 if(e.occurrence==='zero_collected'){
  if(e.actual.state!=='measured'||protocolDecimal(e.actual.value)!==0n)throw Error('Bestätigte Nullmessung benötigt gemessene Null und konkrete Grundlage.');
 }else if(!positive&&e.actual.state!=='not_measured')throw Error('Fehlende Beobachtung ist keine positive oder Null-Ausscheidungsmenge.');
 if(!['single_event','interval_collection'].includes(e.collectionMode))throw Error('Einzelereignis oder tatsächlich abgegrenzte Sammlung wählen.');
 text(e.collectionRef,'Eindeutiger tatsächlicher Sammel-/Behälterbezug',e.collectionMode==='interval_collection');
 if(e.collectionMode==='interval_collection'){
  const start=time(e.collectionStartAt,now),end=time(e.collectionEndAt,now);
  if(start>=end||end!==occurred)throw Error('Sammelzeitraum muss positiv sein und am tatsächlichen Ereigniszeitpunkt enden.');
  if(!positive&&e.occurrence!=='zero_collected')throw Error('Unbeobachteter Vorgang ist keine bestätigte Intervallsammlung.');
 }else if(e.collectionStartAt!==''||e.collectionEndAt!=='')throw Error('Einzelereignis besitzt keinen erfundenen Sammelzeitraum.');
 if(e.kind==='urine'){
  if(!['spontaneous','collection','catheter_collection','unknown'].includes(e.method)||!['independent','assisted','provided','unknown'].includes(e.support)||!['used','not_used','not_confirmed'].includes(e.aidsState))throw Error('Ausscheidungsweg, tatsächliche Hilfe und Hilfsmittel ausdrücklich wählen.');
  text(e.personDecision,'Tatsächliche Personenentscheidung / Unterstützungsgrenze');text(e.aidsDetail,'Tatsächlich verwendete Hilfsmittel',e.aidsState==='used');
  if(e.aidsState!=='used'&&e.aidsDetail!=='')throw Error('Unverwendete/unbestätigte Hilfsmittel nicht als eingesetzt beschreiben.');
  for(const field of ['color','clarity','odor'] as const){text(e[field],'Tatsächlicher Urinbefund',false);if(!positive&&e[field]!=='')throw Error('Ohne positive Ausscheidung keinen Urinbefund erfinden.');}
  if(e.collectionMode==='interval_collection'&&!['collection','catheter_collection'].includes(e.method))throw Error('Intervallsammlung benötigt bestätigten Sammelweg.');
  if((positive||e.occurrence==='zero_collected')&&['collection','catheter_collection'].includes(e.method)&&!e.collectionRef.trim())throw Error('Tatsächlichen Sammel-/Behälterbezug festhalten.');
  if((positive||e.occurrence==='zero_collected')&&e.method==='unknown')throw Error('Tatsächliche Ausscheidung benötigt bestätigten Herkunftsweg.');
  if(e.occurrence==='not_observed'&&e.source==='observed'&&(e.support!=='unknown'||e.aidsState!=='not_confirmed'))throw Error('Unbeobachtete Hilfe oder Hilfsmittel nicht als eigene Durchführung bestätigen.');
 }else{
  if(!['emesis','drain','stoma','other_loss'].includes(e.route))throw Error('Tatsächlichen Ausfuhrweg auswählen.');
  text(e.site,'Konkreter Ursprung / Lokalisation');text(e.appearance,'Tatsächliche Beschaffenheit',false);
  if(!positive&&e.appearance!=='')throw Error('Ohne positive Ausfuhr keine tatsächliche Beschaffenheit erfinden.');
 }
}
export function validateProtocolRoot(v:unknown):asserts v is ProtocolRoot{if(!controlExact(v,['id','tenantId','clientId','version','kind'])||![v.id,v.tenantId,v.clientId].every(protocolUuid)||v.version!==dailyProtocolVersion||!['drink','meal','stool','urine','fluid_output'].includes(String(v.kind)))throw Error('Protokollbezug oder Akte ungültig.');}
export function validateProtocolDraft(v:unknown,now=Date.now()):asserts v is ProtocolDraft{
 if(!controlExact(v,['action','entry','reason'])||!['record','replace','void'].includes(String(v.action)))throw Error('Tatsächlichen Eintrag, Berichtigung oder Rücknahme wählen.');text(v.reason,'Berichtigungs-/Rücknahmegrund',v.action!=='record');if(v.action==='record'&&v.reason!=='')throw Error('Ersteintrag besitzt keinen Berichtigungsgrund.');if(v.action==='void'){if(v.entry!==null)throw Error('Rücknahme darf keine neue tatsächliche Aufnahme enthalten.');}else validateProtocolEntry(v.entry,now);
}
export function protocolHistory(root:ProtocolRoot,events:ProtocolEvent[],now=Date.now()){
 validateProtocolRoot(root);if(!Array.isArray(events)||!events.length)throw Error('Vollständiger Protokollverlauf fehlt.');let head='',last:bigint|null=null,entry:ProtocolEntry|null=null,voided=false;const ids=new Set<string>(),requests=new Set<string>();
 for(let i=0;i<events.length;i++){const e=events[i];if(!controlExact(e,['id','rootId','tenantId','clientId','sequence','previousId','actorId','requestId','recordedAt','draft'])||![e.id,e.actorId,e.requestId].every(protocolUuid)||e.rootId!==root.id||e.tenantId!==root.tenantId||e.clientId!==root.clientId||e.sequence!==i+1||e.previousId!==head||ids.has(e.id)||requests.has(e.requestId))throw Error('Protokollverlauf abgeschnitten, doppelt oder fremd.');
  validateProtocolDraft(e.draft,now);const recorded=time(e.recordedAt,now);if(last!==null&&recorded<last||e.draft.entry&&recorded<time(e.draft.entry.occurredAt,now))throw Error('Erfassung liegt vor dem Ereignis oder vor früherer Erfassung.');
  if(i===0?e.draft.action!=='record':e.draft.action==='record'||voided)throw Error('Ersteintrag, aktuelle Berichtigung und zurückgenommenes Original widersprechen sich.');
  if(e.draft.entry){if(e.draft.entry.kind!==root.kind)throw Error('Berichtigung darf Protokollart nicht wechseln.');if(e.draft.action==='replace'&&sameWoundJson(e.draft.entry,entry))throw Error('Keine tatsächliche Berichtigung.');entry=structuredClone(e.draft.entry);}else{entry=null;voided=true;}
  head=e.id;last=recorded;ids.add(e.id);requests.add(e.requestId);
 }
 return {headId:head,eventCount:events.length,entry,voided};
}
export function decodeProtocolSnapshot(v:unknown,tenant:string,client:string,now=Date.now()):ProtocolRecord[]{
 if(!protocolUuid(tenant)||!protocolUuid(client)||!controlExact(v,['version','tenantId','clientId','count','records'])||v.version!==dailyProtocolVersion||v.tenantId!==tenant||v.clientId!==client||!Array.isArray(v.records)||!Number.isSafeInteger(v.count)||v.count!==v.records.length)throw Error('Vollständiger eigener Protokollbestand fehlt.');
 const roots=new Set<string>(),events=new Set<string>(),requests=new Set<string>();return Array.from(v.records).map(r=>{
  if(!controlExact(r,['root','headId','eventCount','events','actorNames']))throw Error('Vollständiger Originalbeleg fehlt.');validateProtocolRoot(r.root);if(r.root.tenantId!==tenant||r.root.clientId!==client||roots.has(r.root.id))throw Error('Fremder oder doppelter Protokollbezug.');roots.add(r.root.id);
  const s=protocolHistory(r.root,r.events as ProtocolEvent[],now);if(s.headId!==r.headId||s.eventCount!==r.eventCount||!controlExact(r.actorNames,(r.events as ProtocolEvent[]).map(e=>e.id)))throw Error('Protokollkopf, Zählung oder historische Personenbelege fehlen.');
  for(const e of r.events as ProtocolEvent[]){if(events.has(e.id)||requests.has(e.requestId))throw Error('Doppelte Original-/Anfragekennung.');events.add(e.id);requests.add(e.requestId);text(r.actorNames[e.id],'Gesicherter historischer Autorenname');}
  return structuredClone(r as ProtocolRecord);
 });
}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
export function snapshotProtocolRequest(v:unknown,now=Date.now()):ProtocolRequest{
 if(!controlExact(v,['version','clientId','rootId','expectedHeadId','draft'])||v.version!==dailyProtocolVersion||![v.clientId,v.rootId].every(protocolUuid)||!(v.expectedHeadId===''||protocolUuid(v.expectedHeadId)))throw Error('Eigene Protokollanfrage oder Revision ungültig.');validateProtocolDraft(v.draft,now);if((v.expectedHeadId==='')!==(v.draft.action==='record'))throw Error('Berichtigung benötigt genau den aktuellen Originalkopf.');return freeze(structuredClone(v as ProtocolRequest));
}
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
export function protocolDay(at:string):string{if(woundInstant(at)===null)throw Error('Originalzeitpunkt fehlt.');const p=dayFormatter.formatToParts(new Date(at));return `${p.find(x=>x.type==='year')!.value}-${p.find(x=>x.type==='month')!.value}-${p.find(x=>x.type==='day')!.value}`;}
export function protocolDaySummary(records:ProtocolRecord[],tenant:string,client:string,day:string,now=Date.now()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||woundInstant(day+'T12:00:00Z')===null)throw Error('Gültigen Auswertungstag auswählen.');const complete=decodeProtocolSnapshot({version:dailyProtocolVersion,tenantId:tenant,clientId:client,count:records.length,records},tenant,client,now);
 const totals={observedMeasured:0n,observedEstimated:0n,reportedMeasured:0n,reportedEstimated:0n};let unknownDrinks=0,zeroIntakes=0,nonIntakes=0,meals=0,stoolEvents=0;const rows: {record:ProtocolRecord;entry:ProtocolEntry}[]=[];
 for(const record of complete){const s=protocolHistory(record.root,record.events,now);if(!s.entry||protocolDay(s.entry.occurredAt)!==day)continue;const entry=s.entry;rows.push({record,entry});if(entry.kind==='meal')meals++;if(entry.kind==='stool'){if(entry.occurrence==='passed')stoolEvents++;continue;}if(entry.kind!=='drink')continue;if(!['taken','partial','none_taken'].includes(entry.outcome)){nonIntakes++;continue;}if(entry.actual.state==='not_measured'){unknownDrinks++;continue;}if(entry.outcome==='none_taken')zeroIntakes++;const key=(entry.source==='observed'?'observed':'reported')+(entry.actual.state==='measured'?'Measured':'Estimated') as keyof typeof totals;totals[key]+=protocolDecimal(entry.actual.value);}
 rows.sort((a,b)=>{const x=woundInstant(a.entry.occurredAt)!,y=woundInstant(b.entry.occurredAt)!;return x<y?1:x>y?-1:a.record.root.id.localeCompare(b.record.root.id);});return {day,rows,drinkMl:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,protocolAmount(v)])) as Record<keyof typeof totals,string>,unknownDrinks,zeroIntakes,nonIntakes,meals,stoolEvents,completeDailyCoverage:false as const,fluidBalance:null};
}
