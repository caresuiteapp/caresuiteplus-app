import {assertMedicationOrderRevisionSource,medicationOrderRevisionFieldMap,medicationOrderRevisionOrderIssue,medicationOrderRevisionInstant,type MedicationOrderRevisionOrder,type MedicationOrderRevisionScope} from './medicationOrderRevisionDomain.web.ts';
import {sameWoundJson,woundUuid} from './woundCareDomain.ts';

export type MedicationDailyPlanScope=MedicationOrderRevisionScope;
export type MedicationDailyPlanEntry={id:string;time:string;dose:string;unit:string;route:string};
export type MedicationDailyPlanPacket=MedicationDailyPlanScope&{schemaVersion:1;requestId:string;actorId:string;expectedUpdatedAt:string;orderApplicationId:string;sourceId:string;reason:string;effectiveFrom:string;effectiveUntil:string|null;timezone:'Europe/Berlin';entries:MedicationDailyPlanEntry[]};
type Row=Record<string,unknown>;
const object=(v:unknown):Row|null=>!!v&&typeof v==='object'&&!Array.isArray(v)?v as Row:null;
const exact=(v:Row,keys:readonly string[])=>Object.keys(v).length===keys.length&&keys.every(key=>Object.hasOwn(v,key));
const text=(v:unknown,min=1,max=8000):v is string=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const date=(v:unknown):v is string=>typeof v==='string'&&/^[1-9]\d{3}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const fields=Object.keys(medicationOrderRevisionFieldMap) as Array<keyof MedicationOrderRevisionOrder>;
/** Exact thousandths, never binary floating point or a locale-normalized source value. */
export function medicationDoseThousandths(value:unknown,allowZero=false):bigint|null{
 if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,7})(\.[0-9]{1,3})?$/.test(value))return null;
 const [whole,fraction='']=value.split('.'),amount=BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0'));return amount>0n||allowZero?amount:null;
}
export function medicationDoseDecimal(value:bigint):string{if(value<0n)throw Error('Negative Dosisberechnung unzulässig.');const fraction=(value%1000n).toString().padStart(3,'0').replace(/0+$/,'');return (value/1000n).toString()+(fraction?'.'+fraction:'');}
export function medicationNativeStructuredOrder(native:unknown,scope?:MedicationDailyPlanScope):MedicationOrderRevisionOrder{
 const n=object(native);if(!n||scope&&(n.id!==scope.medicationId||n.tenant_id!==scope.tenantId||n.client_id!==scope.clientId)||!woundUuid(n.id)||!woundUuid(n.tenant_id)||!woundUuid(n.client_id)||medicationOrderRevisionInstant(n.updated_at)===null)throw Error('Vollständiges aktuelles natives Verordnungsoriginal fehlt.');
 const order={} as Record<keyof MedicationOrderRevisionOrder,unknown>;for(const key of fields)order[key]=key==='maximumDoseUnit'&&n.is_prn===false&&(n.maximum_dose_unit===null||n.maximum_dose_unit==='')?'':n[medicationOrderRevisionFieldMap[key]];
 const issue=medicationOrderRevisionOrderIssue(order);if(issue)throw Error(issue);return structuredClone(order) as MedicationOrderRevisionOrder;
}
export function medicationDailyPlanPacketIssue(value:unknown,native?:unknown):string|null{
 const p=object(value);if(!p||!exact(p,['schemaVersion','requestId','tenantId','clientId','medicationId','actorId','expectedUpdatedAt','orderApplicationId','sourceId','reason','effectiveFrom','effectiveUntil','timezone','entries'])||p.schemaVersion!==1||![p.requestId,p.tenantId,p.clientId,p.medicationId,p.actorId,p.orderApplicationId,p.sourceId].every(woundUuid)||medicationOrderRevisionInstant(p.expectedUpdatedAt)===null||!text(p.reason,10,2000)||p.timezone!=='Europe/Berlin'||!date(p.effectiveFrom)||p.effectiveUntil!==null&&(!date(p.effectiveUntil)||String(p.effectiveUntil)<String(p.effectiveFrom))||!Array.isArray(p.entries)||p.entries.length<1||p.entries.length>24)return 'Eigene Verordnung, Originalquelle, begründeter Gültigkeitsbereich und ein vollständiger täglicher Plan sind erforderlich.';
 const ids=new Set<string>(),times=new Set<string>();let previous='';
 for(const value of p.entries){const e=object(value);if(!e||!exact(e,['id','time','dose','unit','route'])||!woundUuid(e.id)||typeof e.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)||e.time<=previous||ids.has(e.id.toLowerCase())||times.has(e.time)||medicationDoseThousandths(e.dose)===null||!text(e.unit)||!text(e.route))return 'Jede tägliche Gabe benötigt eine eindeutige Kennung, aufsteigende Uhrzeit, positive genaue Dosis, Einheit und Applikation.';ids.add(e.id.toLowerCase());times.add(e.time);previous=e.time;}
 if(native!==undefined){try{
  const n=object(native)!,order=medicationNativeStructuredOrder(n,p as MedicationDailyPlanScope);
  if(n.status!=='active'||order.isPrn||medicationOrderRevisionInstant(n.updated_at)!==medicationOrderRevisionInstant(p.expectedUpdatedAt))return 'Tagespläne benötigen dieselbe aktive strukturierte Regelverordnung.';
  if(String(p.effectiveFrom)<order.validFrom||order.validUntil!==null&&(p.effectiveUntil===null||String(p.effectiveUntil)>order.validUntil))return 'Der Plan darf nicht außerhalb der ausdrücklichen Verordnungsgültigkeit liegen.';
  for(const e of p.entries as MedicationDailyPlanEntry[])if(e.unit!==order.unit||e.route!==order.route||e.dose!==order.dose)return 'Tagesplanposition und aktuelle verordnete Dosis, Einheit oder Applikation widersprechen sich.';
 }catch(error){return error instanceof Error?error.message:'Strukturierte Regelverordnung prüfen.';}}
 return null;
}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
export function makeMedicationDailyPlanPacket(input:Omit<MedicationDailyPlanPacket,'schemaVersion'>,native?:unknown):MedicationDailyPlanPacket{const packet=structuredClone({...input,schemaVersion:1 as const});const issue=medicationDailyPlanPacketIssue(packet,native);if(issue)throw Error(issue);return freeze(packet);}
export const sameMedicationDailyPlanOriginal=sameWoundJson;

export type MedicationPrnHistory={complete:boolean;from:string;through:string;items:Row[]};
export type MedicationPrnAssessmentInput=MedicationDailyPlanScope&{order:Row;orderApplicationId:string;sourceId:string;occurredAt:string;dose:string;unit:string;route:string;indication:string;now:string;history:MedicationPrnHistory};
export type MedicationPrnAssessment={kind:'assessment_only';writeAllowed:false;withinLimits:boolean;issues:string[];totalBefore:string|null;totalWithCandidate:string|null;maximumObservedWindowDose:string|null;minimumIntervalSatisfied:boolean|null;maximumDoseSatisfied:boolean|null;latestActualId:string|null;followingActualId:string|null;intervalBeforeMicroseconds:string|null;intervalAfterMicroseconds:string|null;historyIds:string[];referenceAt:string;orderVersion:string};
const berlinDay=(instant:string)=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant.replace(' ','T')));return ['year','month','day'].map(key=>parts.find(p=>p.type===key)?.value??'').join('-');};
const berlinClock=(instant:string)=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant.replace(' ','T')));return ['hour','minute'].map(key=>parts.find(p=>p.type===key)?.value??'').join(':');};
/** Recompute limits across past and subsequent actual anchors. Passing math never authorizes a write. */
export function assessMedicationPrnConstraints(input:MedicationPrnAssessmentInput):MedicationPrnAssessment{
 const result:MedicationPrnAssessment={kind:'assessment_only',writeAllowed:false,withinLimits:false,issues:[],totalBefore:null,totalWithCandidate:null,maximumObservedWindowDose:null,minimumIntervalSatisfied:null,maximumDoseSatisfied:null,latestActualId:null,followingActualId:null,intervalBeforeMicroseconds:null,intervalAfterMicroseconds:null,historyIds:[],referenceAt:input?.occurredAt??'',orderVersion:typeof input?.order?.updated_at==='string'?input.order.updated_at:''};
 try{
  if(!input||![input.tenantId,input.clientId,input.medicationId,input.orderApplicationId,input.sourceId].every(woundUuid))throw Error('Eigene Verordnungs- und Originalquellenzuordnung fehlt.');
  const order=medicationNativeStructuredOrder(input.order,input),reference=medicationOrderRevisionInstant(input.occurredAt),now=medicationOrderRevisionInstant(input.now),dose=medicationDoseThousandths(input.dose);
  if(input.order.status!=='active'||!order.isPrn)throw Error('Eine aktive strukturierte Bedarfsverordnung ist erforderlich.');
  if(reference===null||now===null||reference>now||dose===null||input.dose!==order.dose||input.unit!==order.unit||input.route!==order.route||!text(input.indication,3,2000))throw Error('Tatsächlichen Zeitpunkt, genaue Originaldosis, Einheit, Applikation und aktuelle Bedarfsindikation ausdrücklich prüfen.');
  const day=berlinDay(input.occurredAt);if(day<order.validFrom||order.validUntil!==null&&day>order.validUntil)throw Error('Der Ereigniszeitpunkt liegt außerhalb der Bedarfsverordnung.');
  const interval=medicationDoseThousandths(order.minimumIntervalMinutes)!*60_000n,period=medicationDoseThousandths(order.maximumPeriodHours)!*3_600_000n,maximum=medicationDoseThousandths(order.maximumDose)!,lookback=interval>period?interval:period;
  const history=input.history,from=medicationOrderRevisionInstant(history?.from),through=medicationOrderRevisionInstant(history?.through),neededThrough=now<reference+lookback?now:reference+lookback;
  if(!history||history.complete!==true||from===null||through===null||from>reference-lookback||through<neededThrough||!Array.isArray(history.items))throw Error('Der vollständige tatsächliche Gabenbestand für vergangene und nachfolgende Grenzfenster ist nicht bestätigt.');
  const ids=new Set<string>(),actuals:Array<{id:string;at:bigint;dose:bigint}>=[];
  for(const raw of history.items){const event=object(raw);if(!event||!woundUuid(event.id)||ids.has(event.id.toLowerCase())||event.tenant_id!==input.tenantId||event.client_id!==input.clientId||event.medication_id!==input.medicationId)throw Error('Der tatsächliche Gabenbestand enthält fremde oder doppelte Originale.');ids.add(event.id.toLowerCase());
   if(['omitted','refused','held','scheduled'].includes(String(event.status))){if(event.administered_dose!==null&&event.administered_dose!==undefined)throw Error('Ein Nichtgabe- oder Planoriginal enthält widersprüchliche tatsächliche Dosisangaben.');continue;}
   if(event.status!=='administered'&&event.status!=='late')throw Error('Ein ungeklärtes Gabeergebnis verhindert die vollständige Bedarfsprüfung.');
   const occurred=medicationOrderRevisionInstant(event.occurred_at);if(occurred===null||occurred>now)throw Error('Ein tatsächliches Original besitzt keine eindeutige vergangene Ereigniszeit.');
   if(occurred<reference-lookback||occurred>neededThrough)continue;
   const amount=medicationDoseThousandths(event.administered_dose),payload=object(event.creation_payload);if(amount===null||!payload||payload.unit!==order.maximumDoseUnit||event.route!==order.route)throw Error('Ein relevantes tatsächliches Original besitzt keine genaue Dosis oder passende Originaleinheit.');
   actuals.push({id:event.id,at:occurred,dose:amount});result.historyIds.push(event.id);
  }
  actuals.sort((a,b)=>a.at===b.at?a.id.toLowerCase()<b.id.toLowerCase()?-1:a.id===b.id?0:1:a.at<b.at?-1:1);
  const preceding=actuals.filter(a=>a.at<=reference).at(-1),following=actuals.find(a=>a.at>reference);
  result.latestActualId=preceding?.id??null;result.followingActualId=following?.id??null;
  result.intervalBeforeMicroseconds=preceding?(reference-preceding.at).toString():null;result.intervalAfterMicroseconds=following?(following.at-reference).toString():null;
  result.minimumIntervalSatisfied=(!preceding||reference-preceding.at>=interval)&&(!following||following.at-reference>=interval);
  const anchors=[reference,...actuals.filter(a=>a.at>reference&&a.at<=reference+period).map(a=>a.at)];let maxObserved=0n,totalBefore=0n;
  let left=0,right=0,actualTotal=0n;
  for(const anchor of anchors){while(right<actuals.length&&actuals[right].at<=anchor){actualTotal+=actuals[right].dose;right++;}while(left<right&&actuals[left].at<anchor-period){actualTotal-=actuals[left].dose;left++;}const total=actualTotal+dose;if(anchor===reference)totalBefore=actualTotal;if(total>maxObserved)maxObserved=total;}
  result.totalBefore=medicationDoseDecimal(totalBefore);result.totalWithCandidate=medicationDoseDecimal(totalBefore+dose);result.maximumObservedWindowDose=medicationDoseDecimal(maxObserved);result.maximumDoseSatisfied=maxObserved<=maximum;
  if(!result.minimumIntervalSatisfied)result.issues.push('Der Mindestabstand zu einer vorherigen oder nachfolgenden tatsächlichen Gabe ist nicht eingehalten.');
  if(!result.maximumDoseSatisfied)result.issues.push('Die Höchstmenge eines tatsächlichen vergangenen oder nachfolgenden Bezugsfensters wird überschritten.');
  result.withinLimits=result.issues.length===0;
 }catch(error){result.issues.push(error instanceof Error?error.message:'Bedarfsgrenzen konnten nicht vollständig geprüft werden.');}
 return result;
}

export type MedicationDailyPlan=Row&{id:string;tenant_id:string;client_id:string;medication_id:string;order_application_id:string;source_id:string;request_id:string;recorded_by:string;recorded_by_name:string;recorded_at:string;expected_updated_at:string;native_snapshot:Row;order_application_snapshot:Row;source_snapshot:Row;archive_snapshot:Row;effective_from:string;effective_until:string|null;timezone:'Europe/Berlin';entries:MedicationDailyPlanEntry[];reason:string;state:'proposed'|'authorized';authorization:Row|null;withdrawal:Row|null};
export type MedicationDailyPlanContext={order:Row;orderApplication:Row|null;source:{source:Row;archive:Row}|null;ledgerFingerprint:string};
function nativeScope(value:unknown,scope:MedicationDailyPlanScope):Row{const native=object(value);if(!native||![scope.tenantId,scope.clientId,scope.medicationId].every(woundUuid)||native.id!==scope.medicationId||native.tenant_id!==scope.tenantId||native.client_id!==scope.clientId||medicationOrderRevisionInstant(native.updated_at)===null)throw Error('Das vollständige eigene native Verordnungsoriginal fehlt.');return native;}
function applicationScope(value:unknown,native:Row,sourceId:unknown,scope:MedicationDailyPlanScope):Row{const application=object(value);if(!application||![application.id,application.revision_id,application.authorization_id,application.recorded_by,application.request_id,application.source_id].every(woundUuid)||application.tenant_id!==scope.tenantId||application.client_id!==scope.clientId||application.medication_id!==scope.medicationId||application.source_id!==sourceId||medicationOrderRevisionInstant(application.recorded_at)===null||!text(application.reason,10,2000)||!sameWoundJson(application.after_snapshot,native))throw Error('Der aktuelle native Stand ist nicht an eine autorisierte strukturierte Übernahme gebunden.');return application;}
// Source/archival validation is shared with structured transcription; historical original
// bytes may remain the source of a newer native application without becoming a new original.
export function assertMedicationDailyPlanContext(value:unknown,scope:MedicationDailyPlanScope):MedicationDailyPlanContext{
 const c=object(value);if(!c||!exact(c,['order','orderApplication','source','ledgerFingerprint'])||typeof c.ledgerFingerprint!=='string'||!/^sha256:[0-9a-f]{64}$/.test(c.ledgerFingerprint))throw Error('Vollständiger Tagesplanarbeitsbereich mit bestätigtem Gesamtstand fehlt.');
 const order=nativeScope(c.order,scope);
 if(c.orderApplication===null){if(c.source!==null)throw Error('Originalquelle ohne aktuelle strukturierte Übernahme ist widersprüchlich.');return {order:structuredClone(order),orderApplication:null,source:null,ledgerFingerprint:c.ledgerFingerprint};}
 const pair=assertMedicationOrderRevisionSource(c.source,scope),application=applicationScope(c.orderApplication,order,pair.source.id,scope);medicationNativeStructuredOrder(order,scope);
 return structuredClone({order,orderApplication:application,source:pair,ledgerFingerprint:c.ledgerFingerprint});
}
export function assertMedicationDailyPlan(value:unknown,scope:MedicationDailyPlanScope,own?:MedicationDailyPlanPacket):MedicationDailyPlan{
 const row=object(value);if(!row||![row.id,row.order_application_id,row.source_id,row.request_id,row.recorded_by].every(woundUuid)||row.tenant_id!==scope.tenantId||row.client_id!==scope.clientId||row.medication_id!==scope.medicationId||!text(row.recorded_by_name)||medicationOrderRevisionInstant(row.recorded_at)===null||!text(row.reason,10,2000))throw Error('Das vollständige Tagesplanoriginal fehlt.');
 const native=nativeScope(row.native_snapshot,scope),pair=assertMedicationOrderRevisionSource({source:row.source_snapshot,archive:row.archive_snapshot},scope),application=applicationScope(row.order_application_snapshot,native,row.source_id,scope);
 if(application.id!==row.order_application_id||pair.source.id!==row.source_id)throw Error('Tagesplan und ursprünglicher Quellen-/Übernahmebezug widersprechen sich.');
 const original={schemaVersion:1,tenantId:scope.tenantId,clientId:scope.clientId,medicationId:scope.medicationId,actorId:row.recorded_by,requestId:row.request_id,expectedUpdatedAt:row.expected_updated_at,orderApplicationId:row.order_application_id,sourceId:row.source_id,reason:row.reason,effectiveFrom:row.effective_from,effectiveUntil:row.effective_until,timezone:row.timezone,entries:row.entries};
 const issue=medicationDailyPlanPacketIssue(original,native);if(issue)throw Error(issue);
 if(own&&(medicationDailyPlanPacketIssue(own)||own.actorId!==row.recorded_by||own.requestId!==row.request_id||own.orderApplicationId!==row.order_application_id||own.sourceId!==row.source_id||own.reason.trim()!==row.reason||medicationOrderRevisionInstant(own.expectedUpdatedAt)!==medicationOrderRevisionInstant(row.expected_updated_at)||own.effectiveFrom!==row.effective_from||own.effectiveUntil!==row.effective_until||own.timezone!==row.timezone||!sameWoundJson(own.entries,row.entries)))throw Error('Das gespeicherte Tagesplanoriginal bestätigt den eigenen Auftrag nicht.');
 if(row.state==='proposed'){if(row.authorization!==null)throw Error('Tagesplanentwurf enthält eine widersprüchliche Autorisierung.');}
 else if(row.state==='authorized'){const authorization=object(row.authorization);if(!authorization||![authorization.id,authorization.reviewed_by,authorization.review_request_id,authorization.request_id].every(woundUuid)||typeof authorization.plan_fingerprint!=='string'||!/^sha256:[0-9a-f]{64}$/.test(authorization.plan_fingerprint)||authorization.reviewed_by===row.recorded_by||authorization.plan_id!==row.id||!text(authorization.review_reference,10,2000)||medicationOrderRevisionInstant(authorization.recorded_at)===null||medicationOrderRevisionInstant(authorization.recorded_at)!<medicationOrderRevisionInstant(row.recorded_at)!)throw Error('Der unabhängig autorisierte Planbezug fehlt.');}
 else throw Error('Unbekannter Tagesplanstatus.');
 if(row.withdrawal!==null){const withdrawal=object(row.withdrawal);if(row.state!=='authorized'||!withdrawal||![withdrawal.id,withdrawal.review_request_id,withdrawal.request_id,withdrawal.reviewed_by].every(woundUuid)||withdrawal.plan_id!==row.id||!date(withdrawal.effective_from)||!text(withdrawal.reason,10,2000)||!text(withdrawal.review_reference,10,2000)||typeof withdrawal.plan_fingerprint!=='string'||!/^sha256:[0-9a-f]{64}$/.test(withdrawal.plan_fingerprint)||medicationOrderRevisionInstant(withdrawal.recorded_at)===null||String(withdrawal.effective_from)<=berlinDay(withdrawal.recorded_at as string))throw Error('Der zukünftige unabhängig bestätigte Planwiderruf ist unvollständig.');}
 return structuredClone(row) as MedicationDailyPlan;
}

export type MedicationExecutionAssessmentPacket=MedicationDailyPlanScope&{schemaVersion:1;requestId:string;actorId:string;expectedUpdatedAt:string;orderApplicationId:string;kind:'regular'|'prn';planId:string|null;entryId:string|null;occurredAt:string;actualDose:string;unit:string;route:string;prnIndication:string};
export function medicationExecutionAssessmentPacketIssue(value:unknown,native?:unknown):string|null{
 const p=object(value);if(!p||!exact(p,['schemaVersion','requestId','tenantId','clientId','medicationId','actorId','expectedUpdatedAt','orderApplicationId','kind','planId','entryId','occurredAt','actualDose','unit','route','prnIndication'])||p.schemaVersion!==1||![p.requestId,p.tenantId,p.clientId,p.medicationId,p.actorId,p.orderApplicationId].every(woundUuid)||medicationOrderRevisionInstant(p.expectedUpdatedAt)===null||typeof p.occurredAt!=='string'||!p.occurredAt.includes('T')||medicationOrderRevisionInstant(p.occurredAt)===null||medicationDoseThousandths(p.actualDose)===null||!text(p.unit)||!text(p.route))return 'Eigene Verordnung, tatsächliche Prüfzeit und genaue Dosisangaben fehlen.';
 if(p.kind==='regular'){if(![p.planId,p.entryId].every(woundUuid)||p.prnIndication!=='')return 'Regelgabenprüfung benötigt den ausdrücklich ausgewählten Plan und seine konkrete Position.';}
 else if(p.kind==='prn'){if(p.planId!==null||p.entryId!==null||!text(p.prnIndication,3,2000))return 'Bedarfsprüfung benötigt die aktuelle Indikation und darf keine Regelplanposition vortäuschen.';}
 else return 'Regel- oder Bedarfsprüfung ausdrücklich auswählen.';
 if(native!==undefined){try{const order=medicationNativeStructuredOrder(native,{tenantId:p.tenantId as string,clientId:p.clientId as string,medicationId:p.medicationId as string}),n=object(native)!;if(n.status!=='active'||order.isPrn!==(p.kind==='prn')||medicationOrderRevisionInstant(p.expectedUpdatedAt)!==medicationOrderRevisionInstant(n.updated_at)||p.actualDose!==order.dose||p.unit!==order.unit||p.route!==order.route)return 'Prüfauftrag stimmt nicht mit derselben aktuellen aktiven strukturierten Verordnung überein.';}catch(error){return error instanceof Error?error.message:'Aktuelle strukturierte Verordnung prüfen.';}}
 return null;
}
export function makeMedicationExecutionAssessmentPacket(input:Omit<MedicationExecutionAssessmentPacket,'schemaVersion'>,native?:unknown):MedicationExecutionAssessmentPacket{const packet=structuredClone({...input,schemaVersion:1 as const});const issue=medicationExecutionAssessmentPacketIssue(packet,native);if(issue)throw Error(issue);return freeze(packet);}

export type MedicationExecutionAssessment=Row&{state:'blocked';executionAllowed:false;requestId:string;kind:'regular'|'prn';assessedAt:string;historyWindow:{from:string;through:string};order:Row;orderApplication:Row;plan:MedicationDailyPlan|null;actuals:Row[];violations:string[];checks:{nativeBound:true;slotMatched:boolean|null;historyComplete:boolean;intervalSatisfied:boolean|null;cumulativeSatisfied:boolean|null;precedingActualId:string|null;followingActualId:string|null;intervalBeforeMicroseconds:string|null;intervalAfterMicroseconds:string|null;intervalBeforeMinutes:string|null;intervalAfterMinutes:string|null;rollingDose:string|null;maximumObservedWindowDose:string|null;maximumDose:string|null;maximumPeriodHours:string|null;minimumIntervalMinutes:string|null};fingerprint:string};
function exactCalculatedDecimal(value:unknown,expected:string){if(typeof value!=='string'||!/^\d+(?:\.\d+)?$/.test(value))return false;const trim=(s:string)=>s.includes('.')?s.replace(/0+$/,'').replace(/\.$/,''):s;return trim(value)===trim(expected);}
/** PostgreSQL numeric minutes may repeat. Bind its decimal rounding to exact microseconds. */
function exactCalculatedMinutes(value:unknown,microseconds:string|null){
 if(microseconds===null)return value===null;if(typeof value!=='string'||value.length>80||!/^\d+(?:\.\d+)?$/.test(value))return false;
 const [whole,fraction='']=value.split('.'),scale=10n**BigInt(fraction.length),numerator=BigInt(microseconds)*scale,denominator=60_000_000n,claimed=BigInt(whole+fraction);
 if(numerator%denominator===0n)return claimed===numerator/denominator;
 // Eight decimal minute places distinguish each whole microsecond. PostgreSQL's
 // numeric projection retains at least this scale throughout the bounded window.
 return fraction.length>=8&&claimed===(numerator+denominator/2n)/denominator;
}
export function assertMedicationExecutionAssessment(value:unknown,packet:MedicationExecutionAssessmentPacket):MedicationExecutionAssessment{
 const issue=medicationExecutionAssessmentPacketIssue(packet);if(issue)throw Error(issue);
 const r=object(value),checks=object(r?.checks),window=object(r?.historyWindow);if(!r||r.state!=='blocked'||r.executionAllowed!==false||r.requestId!==packet.requestId||r.kind!==packet.kind||!checks||checks.nativeBound!==true||typeof checks.historyComplete!=='boolean'||!window||!exact(window,['from','through'])||medicationOrderRevisionInstant(window.from)===null||medicationOrderRevisionInstant(window.through)===null||medicationOrderRevisionInstant(r.assessedAt)===null||!Array.isArray(r.actuals)||!Array.isArray(r.violations)||r.violations.some(code=>!text(code,1,2000))||typeof r.fingerprint!=='string'||!/^sha256:[0-9a-f]{64}$/.test(r.fingerprint))throw Error('Der verbindlich gesperrte Prüfbeleg ist unvollständig.');
 const native=nativeScope(r.order,packet),application=applicationScope(r.orderApplication,native,object(r.orderApplication)?.source_id,packet);if(application.id!==packet.orderApplicationId||medicationExecutionAssessmentPacketIssue(packet,native)||medicationOrderRevisionInstant(packet.occurredAt)!>medicationOrderRevisionInstant(r.assessedAt)!)throw Error('Prüfbeleg und aktuelle native Verordnung stimmen nicht überein.');
 const ids=new Set<string>();for(const raw of r.actuals){const actual=object(raw);if(!actual||!woundUuid(actual.id)||ids.has(actual.id.toLowerCase())||actual.tenant_id!==packet.tenantId||actual.client_id!==packet.clientId||actual.medication_id!==packet.medicationId)throw Error('Der tatsächliche Prüfbestand enthält fremde oder doppelte Originale.');ids.add(actual.id.toLowerCase());}
 for(const key of ['slotMatched','intervalSatisfied','cumulativeSatisfied'])if(checks[key]!==null&&typeof checks[key]!=='boolean')throw Error('Ein Grenzprüfungsergebnis ist nicht ausdrücklich belegt.');
 for(const key of ['precedingActualId','followingActualId'])if(checks[key]!==null&&!woundUuid(checks[key]))throw Error('Die tatsächliche Vorgänger-/Nachfolgegabe ist nicht eindeutig.');
 for(const key of ['intervalBeforeMicroseconds','intervalAfterMicroseconds'])if(checks[key]!==null&&(typeof checks[key]!=='string'||!/^(0|[1-9]\d{0,18})$/.test(checks[key] as string)))throw Error('Das genaue tatsächliche Zeitintervall ist nicht belegt.');
 for(const key of ['intervalBeforeMinutes','intervalAfterMinutes','rollingDose','maximumObservedWindowDose','maximumDose','maximumPeriodHours','minimumIntervalMinutes'])if(checks[key]!==null&&(typeof checks[key]!=='string'||!/^\d+(?:\.\d+)?$/.test(checks[key] as string)))throw Error('Ein Grenzwert oder eine berechnete Menge ist unvollständig.');
 const order=medicationNativeStructuredOrder(native,packet),day=berlinDay(packet.occurredAt),reference=medicationOrderRevisionInstant(packet.occurredAt)!,assessedAt=medicationOrderRevisionInstant(r.assessedAt)!;
 if(day<order.validFrom||order.validUntil!==null&&day>order.validUntil)throw Error('Der tatsächliche Prüfzeitpunkt liegt außerhalb der ursprünglichen Verordnung.');
 const interval=packet.kind==='prn'?medicationDoseThousandths(order.minimumIntervalMinutes)!*60_000n:0n,period=packet.kind==='prn'?medicationDoseThousandths(order.maximumPeriodHours)!*3_600_000n:0n,lookback=packet.kind==='prn'?(interval>period?interval:period):93_600_000_000n,through=assessedAt<reference+lookback?assessedAt:reference+lookback;
 if(medicationOrderRevisionInstant(window.from)!==reference-lookback||medicationOrderRevisionInstant(window.through)!==through)throw Error('Das tatsächliche serverseitige Prüfzeitfenster wurde verändert.');
 let complete=true;
 for(const raw of r.actuals){const actual=raw as Row;if(['scheduled','omitted','refused','held'].includes(String(actual.status))){if(actual.administered_dose!==null&&actual.administered_dose!==undefined)complete=false;continue;}
  const at=medicationOrderRevisionInstant(actual.occurred_at);if(!['administered','late'].includes(String(actual.status))||at===null||at>assessedAt){complete=false;continue;}if(at<reference-lookback||at>through)continue;
  const payload=object(actual.creation_payload);if(medicationDoseThousandths(actual.administered_dose)===null||!payload||payload.unit!==order.unit||actual.route!==order.route)complete=false;
 }
 if(checks.historyComplete!==complete)throw Error('Der behauptete vollständige tatsächliche Prüfbestand widerspricht seinen Originalzeilen.');
 const calculatedKeys=['intervalSatisfied','cumulativeSatisfied','precedingActualId','followingActualId','intervalBeforeMicroseconds','intervalAfterMicroseconds','intervalBeforeMinutes','intervalAfterMinutes','rollingDose','maximumObservedWindowDose'];
 if((!complete||packet.kind==='regular')&&calculatedKeys.some(key=>checks[key]!==null))throw Error('Ohne vollständige Bedarfsgrundlage darf kein erfolgreich berechneter Dosis- oder Zeitbeleg erscheinen.');
 if(packet.kind==='prn'){
  if(r.plan!==null||checks.slotMatched!==null)throw Error('Bedarfsprüfung darf keine Regelplanposition verwenden.');
  if(checks.maximumDose!==order.maximumDose||checks.maximumPeriodHours!==order.maximumPeriodHours||checks.minimumIntervalMinutes!==order.minimumIntervalMinutes)throw Error('Bedarfsgrenzen wurden gegenüber dem nativen Original verändert.');
  if(checks.historyComplete){const calculation=assessMedicationPrnConstraints({...packet,order:native,sourceId:application.source_id as string,occurredAt:packet.occurredAt,dose:packet.actualDose,indication:packet.prnIndication,now:r.assessedAt as string,history:{complete:true,from:window.from as string,through:window.through as string,items:r.actuals as Row[]}});
   if(calculation.minimumIntervalSatisfied===null||calculation.maximumDoseSatisfied===null||checks.intervalSatisfied!==calculation.minimumIntervalSatisfied||checks.cumulativeSatisfied!==calculation.maximumDoseSatisfied||checks.precedingActualId!==calculation.latestActualId||checks.followingActualId!==calculation.followingActualId||checks.intervalBeforeMicroseconds!==calculation.intervalBeforeMicroseconds||checks.intervalAfterMicroseconds!==calculation.intervalAfterMicroseconds||!exactCalculatedMinutes(checks.intervalBeforeMinutes,calculation.intervalBeforeMicroseconds)||!exactCalculatedMinutes(checks.intervalAfterMinutes,calculation.intervalAfterMicroseconds)||!exactCalculatedDecimal(checks.rollingDose,calculation.totalWithCandidate!)||!exactCalculatedDecimal(checks.maximumObservedWindowDose,calculation.maximumObservedWindowDose!))throw Error('Serverprüfung widerspricht dem vollständigen tatsächlichen Dosis- und Zeitfenster.');
  }
 }else{
  const plan=r.plan===null?null:assertMedicationDailyPlan(r.plan,packet);if(plan&&plan.id!==packet.planId)throw Error('Die ausgewählte Regelplanfassung wurde ausgetauscht.');
  if(['maximumDose','maximumPeriodHours','minimumIntervalMinutes'].some(key=>checks[key]!==null))throw Error('Eine Regelprüfung darf keine Bedarfsgrenzen vortäuschen.');
  const entry=plan?.entries.find(e=>e.id===packet.entryId),matched=!!plan&&plan.state==='authorized'&&sameWoundJson(plan.native_snapshot,native)&&plan.order_application_id===packet.orderApplicationId&&!!entry&&entry.time===berlinClock(packet.occurredAt)&&entry.dose===packet.actualDose&&entry.unit===packet.unit&&entry.route===packet.route&&day>=plan.effective_from&&(plan.effective_until===null||day<=plan.effective_until)&&(plan.withdrawal===null||day<String(plan.withdrawal.effective_from));
  if(checks.slotMatched!==matched)throw Error('Regelplanposition und tatsächliche Prüfzeit widersprechen sich.');
 }
 return structuredClone(r) as MedicationExecutionAssessment;
}

export type MedicationDailyPlanReviewItem={request:Row;plan:MedicationDailyPlan;currentOrder:Row;currentOrderApplication:Row|null;state:'pending'|'authorized'|'expired'|'stale';canReview:boolean;reviewFingerprint:string};
export type MedicationDailyPlanAuthorizationPacket={planId:string;reviewRequestId:string;requestId:string;reviewReference:string;expectedReviewFingerprint:string};
export type MedicationDailyPlanWithdrawalPacket={planId:string;requestId:string;effectiveFrom:string;reason:string};
export function assertMedicationDailyPlanReviewItem(value:unknown,scope:MedicationDailyPlanScope):MedicationDailyPlanReviewItem{
 const item=object(value),request=object(item?.request);if(!item||!request||![request.id,request.tenant_id,request.plan_id,request.request_id,request.actor_id].every(woundUuid)||request.tenant_id!==scope.tenantId||medicationOrderRevisionInstant(request.recorded_at)===null||medicationOrderRevisionInstant(request.expires_at)===null||medicationOrderRevisionInstant(request.expires_at)!<=medicationOrderRevisionInstant(request.recorded_at)!||typeof request.plan_fingerprint!=='string'||!/^sha256:[0-9a-f]{64}$/.test(request.plan_fingerprint)||typeof item.reviewFingerprint!=='string'||!/^sha256:[0-9a-f]{64}$/.test(item.reviewFingerprint)||!['pending','authorized','expired','stale'].includes(String(item.state))||typeof item.canReview!=='boolean')throw Error('Vollständige ursprüngliche Tagesplan-Prüfanfrage fehlt.');
 const plan=assertMedicationDailyPlan(item.plan,scope),currentOrder=nativeScope(item.currentOrder,scope);if(request.plan_id!==plan.id||request.action==='authorize'&&request.actor_id!==plan.recorded_by)throw Error('Prüfanfrage gehört nicht zur ursprünglichen eigenen Planerfassung.');
 if(request.action==='authorize'){if(request.effective_from!==null||request.reason!==null)throw Error('Planfreigabe enthält einen widersprüchlichen Widerrufsauftrag.');}
 else if(request.action==='withdraw'){if(!date(request.effective_from)||!text(request.reason,10,2000)||String(request.effective_from)<=berlinDay(request.recorded_at as string))throw Error('Prospektiver Planwiderruf benötigt einen ausdrücklichen zukünftigen Tag und Grund.');}
 else throw Error('Unbekannte Tagesplan-Prüfart.');
 if(item.canReview&&item.state!=='pending')throw Error('Eine abgeschlossene oder veraltete Prüfanfrage darf keine neue Entscheidung anbieten.');
 const currentApplication=item.currentOrderApplication===null?null:applicationScope(item.currentOrderApplication,currentOrder,object(item.currentOrderApplication)?.source_id,scope);
 if(item.state==='pending'&&(request.action==='authorize'&&(!currentApplication||!sameWoundJson(plan.native_snapshot,currentOrder)||!sameWoundJson(plan.order_application_snapshot,currentApplication)||plan.state!=='proposed')||request.action==='withdraw'&&(plan.state!=='authorized'||plan.withdrawal!==null)))throw Error('Offene Prüfanfrage gehört nicht zur aktuellen ursprünglichen Verordnungs- und Planfassung.');
 return structuredClone({...item,plan,currentOrder,currentOrderApplication:currentApplication}) as MedicationDailyPlanReviewItem;
}
export function medicationDailyPlanAuthorizationPacketIssue(value:unknown):string|null{const p=object(value);return !p||!exact(p,['planId','reviewRequestId','requestId','reviewReference','expectedReviewFingerprint'])||![p.planId,p.reviewRequestId,p.requestId].every(woundUuid)||!text(p.reviewReference,10,2000)||typeof p.expectedReviewFingerprint!=='string'||!/^sha256:[0-9a-f]{64}$/.test(p.expectedReviewFingerprint)?'Eigener Prüfauftrag, ausdrücklicher Originalstand und dokumentierter Prüfbezug fehlen.':null;}
export function medicationDailyPlanWithdrawalPacketIssue(value:unknown):string|null{const p=object(value);return !p||!exact(p,['planId','requestId','effectiveFrom','reason'])||![p.planId,p.requestId].every(woundUuid)||!date(p.effectiveFrom)||!text(p.reason,10,2000)?'Eigener Plan, ausdrücklicher zukünftiger Widerrufstag und Grund fehlen.':null;}
