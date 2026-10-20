import {sameWoundJson,validateWoundOrder,woundInstant,woundUuid} from './woundCareDomain.ts';

/** Pure documentation rules. This module neither operates a pump nor authorizes therapy. */
export const infusionCourseVersion='2026-10-09.1';
export const infusionEventLabels={start:'Beginn',check:'Verlaufskontrolle',pause:'Unterbrechung',resume:'Wiederaufnahme',parameters:'Parameteränderung',container:'Behälterwechsel',device:'Gerätewechsel',alarm:'Alarm / Zwischenfall',finish:'Abschluss',abort:'Abbruch',review:'Nachkontrolle',correction:'Berichtigung'} as const;
type Row=Record<string,unknown>;
export type InfusionEpisode={id:string;tenantId:string;clientId:string;version:string;route:string;purpose:string;title:string};
export type InfusionEventDraft={kind:string;occurredAt:string;observation:string;accessReview:string;communication:string;personDecision:string;qualificationBasis:string;deviation:string;orderState:string;orderId:string;orderSnapshotJson:string;orderRelation:string;orderReason:string;medicationDocumentation:string;medicationReason:string;deviceMode:string;deviceId:string;deviceModel:string;deviceCheck:string;checkerId:string;rateMlHour:string;parameterBasis:string;containerId:string;solution:string;concentration:string;preparedMl:string;remainingState:string;remainingMl:string;remainingReason:string;deliveredState:string;deliveredMl:string;deliveredReason:string;volumeException:string;alarmAction:string;closure:string;reviewState:string;reviewAt:string;reviewReason:string;targetEventId:string;expectedCorrectionId:string;correctionReason:string};
export type InfusionEvent={id:string;episodeId:string;tenantId:string;clientId:string;sequence:number;previousId:string;actorId:string;requestId:string;recordedAt:string;draft:InfusionEventDraft};
export type InfusionCourse={status:'not_started'|'running'|'paused'|'finished'|'aborted';headId:string;sequence:number;containerId:string;configuration:Pick<InfusionEventDraft,'deviceMode'|'deviceId'|'deviceModel'|'rateMlHour'>|null;runningMicroseconds:bigint;lastKnownDeliveredMl:string|null;latestAmountState:string|null;amountsComplete:boolean;reviewRequired:boolean;reviewCompleted:boolean;corrections:Map<string,InfusionEvent[]>};
const object=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v);
function exact(v:unknown,keys:string[]):v is Row{return object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
function fail(message:string): never {throw Error(message);}
const nonempty=(v:string)=>!!v.trim();
/** Up to six decimal places, exact microlitre fractions. Bounds are technical, not clinical. */
export function infusionDecimal(v:string):bigint|null{
 if(typeof v!=='string'||!/^\d{1,7}(?:[.,]\d{1,6})?$/.test(v))return null;
 const [whole,fraction='']=v.replace(',','.').split('.'),n=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));
 return n<=1000000000000n?n:null;
}
export function emptyInfusionEvent():InfusionEventDraft{return {kind:'',occurredAt:'',observation:'',accessReview:'',communication:'',personDecision:'',qualificationBasis:'',deviation:'',orderState:'',orderId:'',orderSnapshotJson:'',orderRelation:'',orderReason:'',medicationDocumentation:'',medicationReason:'',deviceMode:'',deviceId:'',deviceModel:'',deviceCheck:'',checkerId:'',rateMlHour:'',parameterBasis:'',containerId:'',solution:'',concentration:'',preparedMl:'',remainingState:'',remainingMl:'',remainingReason:'',deliveredState:'',deliveredMl:'',deliveredReason:'',volumeException:'',alarmAction:'',closure:'',reviewState:'',reviewAt:'',reviewReason:'',targetEventId:'',expectedCorrectionId:'',correctionReason:''};}
const configurationKeys=['deviceMode','deviceId','deviceModel','deviceCheck','checkerId','rateMlHour','parameterBasis'] as const;
const containerKeys=['containerId','solution','concentration','preparedMl'] as const;
const quantityKeys=['remainingState','remainingMl','remainingReason','deliveredState','deliveredMl','deliveredReason','volumeException'] as const;
const sourceKeys=['orderState','orderId','orderSnapshotJson','orderRelation','orderReason','medicationDocumentation','medicationReason'] as const;
const clinicalKeys=['observation','accessReview','communication','personDecision','qualificationBasis','deviation'] as const;
const terminalKinds=['finish','abort'];
export function validateInfusionEpisode(value:unknown):asserts value is InfusionEpisode{
 const keys=['id','tenantId','clientId','version','route','purpose','title'];
 if(!exact(value,keys)||keys.some(k=>typeof value[k]!=='string')||['id','tenantId','clientId'].some(k=>!woundUuid(value[k]))||value.version!==infusionCourseVersion||!['iv','sc'].includes(String(value.route))||!['fluid','nutrition','medication'].includes(String(value.purpose))||!String(value.title).trim()||String(value.title).length>2000)fail('Infusionsfall, Aktenbezug oder Dokumentationsfassung ungültig.');
}
function blank(p:InfusionEventDraft,keys:readonly (keyof InfusionEventDraft)[],message:string){if(keys.some(k=>nonempty(p[k])))fail(message);}
function required(p:InfusionEventDraft,keys:readonly (keyof InfusionEventDraft)[],message:string){if(keys.some(k=>!nonempty(p[k])))fail(message);}
function quantity(state:string,value:string,reason:string,label:string){
 if(state==='measured'){if(infusionDecimal(value)===null||nonempty(reason))fail(`${label}: tatsächlichen Messwert einschließlich null dokumentieren.`);}
 else if(state!=='not_measured'||nonempty(value)||!nonempty(reason))fail(`${label}: fehlende Messung ausdrücklich begründen.`);
}
function snapshot(p:InfusionEventDraft,episode:InfusionEpisode){
 if(p.orderState==='linked'){
  let source:unknown;try{source=JSON.parse(p.orderSnapshotJson);}catch{fail('Anordnungsfassung beschädigt.');}
  if(!object(source)||source.id!==p.orderId||!woundUuid(p.orderId)||!nonempty(p.orderRelation)||nonempty(p.orderReason))fail('Unveränderte ärztliche Anordnungsfassung und konkreten Bezug dokumentieren.');
  const error=validateWoundOrder(source,episode.tenantId,episode.clientId,p.orderId,p.occurredAt);if(error)fail(error);
 }else if(p.orderState!=='unconfirmed'||nonempty(p.orderId)||nonempty(p.orderSnapshotJson)||nonempty(p.orderRelation)||!nonempty(p.orderReason)||!nonempty(p.deviation))fail('Ungeklärte Anordnungsgrundlage und Abweichung ausdrücklich dokumentieren.');
 const needed=episode.purpose==='medication';
 if(p.medicationDocumentation!==(needed?'separate_required':'not_applicable')||!nonempty(p.medicationReason))fail('Medikamentengabe gesondert dokumentieren; dieser Verlauf ersetzt keinen Gabenachweis.');
}
export function validateInfusionEventDraft(value:unknown,episode:InfusionEpisode,now=Date.now()):asserts value is InfusionEventDraft{
 validateInfusionEpisode(episode);const template=emptyInfusionEvent(),keys=Object.keys(template);
 if(!exact(value,keys)||keys.some(k=>typeof value[k]!=='string'||String(value[k]).length>(k==='orderSnapshotJson'?180000:2000)))fail('Infusionsereignis unvollständig, ungültig oder zu umfangreich.');
 const p=value as unknown as InfusionEventDraft,at=woundInstant(p.occurredAt);
 if(!Object.hasOwn(infusionEventLabels,p.kind)||at===null||at>BigInt(now)*1000n)fail('Ereignisart und tatsächlichen Zeitpunkt ausdrücklich angeben.');
 if(['containerId','deviceId','deviceModel'].some(k=>p[k as keyof InfusionEventDraft]!==p[k as keyof InfusionEventDraft].trim()))fail('Behälter- und Gerätekennung ohne unbeabsichtigte Rand-Leerzeichen dokumentieren.');
 if(p.kind==='correction'){
  if(!woundUuid(p.targetEventId)||(p.expectedCorrectionId!==''&&!woundUuid(p.expectedCorrectionId))||!nonempty(p.correctionReason)||!clinicalKeys.some(k=>nonempty(p[k])))fail('Originalbezug, letzten Berichtigungsstand, Grund und berichteten Inhalt angeben.');
  // Narrative correction only: dose, event time, state, parameters, volumes and source remain original.
  blank(p,[...configurationKeys,...containerKeys,...quantityKeys,...sourceKeys,'alarmAction','closure','reviewState','reviewAt','reviewReason'],'Berichtigung darf keine Mengen, Parameter, Quellen oder Status nachträglich überschreiben.');return;
 }
 blank(p,['targetEventId','expectedCorrectionId','correctionReason'],'Originalereignis darf keinen Berichtigungsbezug tragen.');
 required(p,['observation','accessReview','communication','personDecision','qualificationBasis'],'Beobachtung, Zugangsbefund, Rücksprache, Personenentscheidung und Qualifikationsgrundlage fehlen.');
 if(['pause','abort','alarm'].includes(p.kind)&&!nonempty(p.deviation))fail('Unterbrechung, Abbruch oder Zwischenfall tatsächlich begründen.');
 snapshot(p,episode);
 const config=['start','parameters','device'].includes(p.kind),container=['start','container'].includes(p.kind);
 if(config){
  if(!['pump','gravity'].includes(p.deviceMode)||infusionDecimal(p.rateMlHour)===null||infusionDecimal(p.rateMlHour)===0n||!nonempty(p.parameterBasis)||!nonempty(p.deviceCheck)||!woundUuid(p.checkerId))fail('Tatsächliche Rate in ml/h, Einstellung, Geräteprüfung und prüfende Person dokumentieren.');
  if(p.deviceMode==='pump')required(p,['deviceId','deviceModel'],'Gerätekennung und Modell der tatsächlich verwendeten Pumpe fehlen.');
  else blank(p,['deviceId','deviceModel'],'Schwerkraftinfusion darf keine Pumpenkennung vortäuschen.');
 }else blank(p,configurationKeys,'Einstellungen nur bei Beginn oder ausdrücklicher Parameter-/Geräteänderung dokumentieren.');
 if(container){required(p,containerKeys,'Behälterkennung, tatsächliche Lösung, Konzentration und vorbereitete Menge fehlen.');if(infusionDecimal(p.preparedMl)===null||infusionDecimal(p.preparedMl)===0n)fail('Tatsächlich vorbereitete Menge in ml dokumentieren.');}
 else blank(p,containerKeys,'Behälterdaten nur bei Beginn oder Behälterwechsel dokumentieren.');
 if(p.kind==='review')blank(p,quantityKeys,'Nachkontrolle darf keine rückwirkend infundierte Menge eintragen.');
 else {quantity(p.remainingState,p.remainingMl,p.remainingReason,'Behälterrest in ml');quantity(p.deliveredState,p.deliveredMl,p.deliveredReason,'Kumulativ tatsächlich infundierte Menge dieses Verlaufs in ml');}
 if(p.kind==='alarm')required(p,['alarmAction'],'Alarm und tatsächliche Reaktion dokumentieren.');else blank(p,['alarmAction'],'Alarmhandlung benötigt eigenes Alarmereignis.');
 if(terminalKinds.includes(p.kind))required(p,['closure'],'Tatsächlichen Zugangsabschluss / Spülung / Verbleib dokumentieren.');else blank(p,['closure'],'Abschlussangaben benötigen Abschluss oder Abbruch.');
 if(p.kind==='review'){if(p.reviewState!=='completed'||p.reviewAt||!nonempty(p.reviewReason))fail('Tatsächlich erfolgte Nachkontrolle und Ergebnis/Zuständigkeit dokumentieren.');}
 else if(p.reviewState==='scheduled'){const t=woundInstant(p.reviewAt);if(t===null||t<=at||!nonempty(p.reviewReason))fail('Späteren Kontrolltermin und verantwortliche Zuständigkeit dokumentieren.');}
 else if(!['pending','not_required'].includes(p.reviewState)||p.reviewAt||!nonempty(p.reviewReason))fail('Offene Kontrolle oder begründet entfallenden Bedarf ausdrücklich dokumentieren.');
}
const eventKeys=['id','episodeId','tenantId','clientId','sequence','previousId','actorId','requestId','recordedAt','draft'];
/** Validate an entire, contiguous append chain; input order is authoritative and is never silently sorted. */
export function infusionCourse(episode:InfusionEpisode,events:readonly InfusionEvent[],now=Date.now()):InfusionCourse{
 validateInfusionEpisode(episode);
 const state:InfusionCourse={status:'not_started',headId:'',sequence:0,containerId:'',configuration:null,runningMicroseconds:0n,lastKnownDeliveredMl:null,latestAmountState:null,amountsComplete:true,reviewRequired:false,reviewCompleted:false,corrections:new Map()};
 const ids=new Set<string>(),requests=new Set<string>(),containers=new Set<string>();let lastAt:bigint|null=null,lastRecorded:bigint|null=null,lastKnown:bigint|null=null,prepared:bigint|null=null;
 for(const e of events){
  if(!exact(e,eventKeys)||!['id','episodeId','tenantId','clientId','actorId','requestId'].every(k=>woundUuid(e[k as keyof InfusionEvent]))||e.episodeId!==episode.id||e.tenantId!==episode.tenantId||e.clientId!==episode.clientId||e.sequence!==state.sequence+1||e.previousId!==state.headId||ids.has(e.id)||requests.has(e.requestId))fail('Verlaufskette lückenhaft, doppelt oder einer fremden Akte zugeordnet.');
  validateInfusionEventDraft(e.draft,episode,now);const recorded=woundInstant(e.recordedAt),at=woundInstant(e.draft.occurredAt)!;
  if(recorded===null||recorded<at||recorded>BigInt(now)*1000n||(lastRecorded!==null&&recorded<lastRecorded))fail('Erfassungszeit fehlt, liegt vor der Handlung oder ist nicht in Erfassungsreihenfolge.');
  const p=e.draft;
  if(p.kind==='correction'){
   const target=events.find(x=>x.id===p.targetEventId&&x.sequence<e.sequence);if(!target||target.draft.kind==='correction'||at<woundInstant(target.draft.occurredAt)!)fail('Berichtigung benötigt ein vorheriges Originalereignis dieses Verlaufs.');
   const list=state.corrections.get(target.id)??[];if(p.expectedCorrectionId!==(list.at(-1)?.id??''))fail('Zwischenzeitliche Berichtigung vorhanden; aktuellen Stand ausdrücklich übernehmen.');
   state.corrections.set(target.id,[...list,structuredClone(e)]);
  }else {
   if(lastAt!==null&&at<lastAt)fail('Rückdatierte Handlung würde den laufenden Verlauf ändern; eigenen geprüften Nachtrag verwenden.');
   if(state.status==='not_started'&&p.kind!=='start')fail('Verlauf benötigt zuerst einen tatsächlichen Beginn.');
   if(state.status!=='not_started'&&p.kind==='start')fail('Beginn darf nicht doppelt dokumentiert werden.');
   if(['finished','aborted'].includes(state.status)&&p.kind!=='review')fail('Abgeschlossener Verlauf erlaubt nur eigene Nachkontrolle oder Berichtigung.');
   if(p.kind==='review'&&!['finished','aborted'].includes(state.status))fail('Abschließende Nachkontrolle benötigt einen abgeschlossenen Verlauf.');
   if(p.kind==='pause'&&state.status!=='running')fail('Nur laufende Infusion ausdrücklich unterbrechen.');
   if(p.kind==='resume'&&state.status!=='paused')fail('Wiederaufnahme benötigt tatsächliche vorherige Unterbrechung.');
   if(['parameters','container','device'].includes(p.kind)&&!['running','paused'].includes(state.status))fail('Änderung benötigt einen begonnenen, noch offenen Verlauf.');
   if(state.status==='running'&&lastAt!==null)state.runningMicroseconds+=at-lastAt;
   if(['start','container'].includes(p.kind)){
    if(containers.has(p.containerId))fail('Behälterkennung bereits verwendet; Wechsel nicht doppelt zählen.');
    containers.add(p.containerId);state.containerId=p.containerId;prepared=infusionDecimal(p.preparedMl);
   }
   if(['start','parameters','device'].includes(p.kind)){
    const next={deviceMode:p.deviceMode,deviceId:p.deviceId,deviceModel:p.deviceModel,rateMlHour:p.rateMlHour};
    if(p.kind==='parameters'&&(!state.configuration||next.deviceMode!==state.configuration.deviceMode||next.deviceId!==state.configuration.deviceId||next.deviceModel!==state.configuration.deviceModel))fail('Gerätewechsel als eigenes Ereignis dokumentieren.');
    if(p.kind==='device'&&state.configuration&&next.deviceMode===state.configuration.deviceMode&&next.deviceId===state.configuration.deviceId&&next.deviceModel===state.configuration.deviceModel)fail('Gerätewechsel muss tatsächlich anderes Gerät / andere Betriebsart benennen.');
    if(p.kind==='parameters'&&state.configuration&&infusionDecimal(p.rateMlHour)===infusionDecimal(state.configuration.rateMlHour))fail('Unveränderte Rate als Kontrolle dokumentieren.');
    state.configuration=next;
   }
   if(p.kind!=='review'){
    const measured=p.deliveredState==='measured',n=measured?infusionDecimal(p.deliveredMl):null;
    if(n!==null&&lastKnown!==null&&n<lastKnown)fail('Kumulative tatsächlich verabreichte Menge darf nicht rückwärts laufen.');
    if(state.status==='paused'&&n!==null&&lastKnown!==null&&n!==lastKnown&&!nonempty(p.volumeException))fail('Mengenanstieg während Unterbrechung ausdrücklich als tatsächliche Abweichung erklären.');
    if(p.remainingState==='measured'&&prepared!==null&&infusionDecimal(p.remainingMl)!>prepared&&!nonempty(p.volumeException))fail('Behälterrest über vorbereiteter Menge benötigt ausdrückliche Abweichung.');
    if(n!==null){lastKnown=n;state.lastKnownDeliveredMl=p.deliveredMl;}
    if(!measured)state.amountsComplete=false;
    state.latestAmountState=p.deliveredState;
    state.reviewRequired=p.reviewState!=='not_required';state.reviewCompleted=false;
   }else {state.reviewCompleted=true;state.reviewRequired=false;}
   if(['start','resume'].includes(p.kind))state.status='running';else if(p.kind==='pause')state.status='paused';else if(p.kind==='finish')state.status='finished';else if(p.kind==='abort')state.status='aborted';
   lastAt=at;
  }
  ids.add(e.id);requests.add(e.requestId);state.headId=e.id;state.sequence=e.sequence;lastRecorded=recorded;
 }
 return state;
}
export type InfusionAppendContext={tenantId:string;clientId:string;actorId:string;requestId:string;eventId:string;recordedAt:string;expectedHeadId:string;currentOrder:Row|null};
/** Reference append operation; a database writer must enforce the same rules inside one transaction. */
export function appendInfusionEvent(episode:InfusionEpisode,events:readonly InfusionEvent[],draft:InfusionEventDraft,context:InfusionAppendContext,now=Date.now()):InfusionEvent{
 const state=infusionCourse(episode,events,now);
 if(context.tenantId!==episode.tenantId||context.clientId!==episode.clientId||!woundUuid(context.actorId)||!woundUuid(context.requestId))fail('Authentifizierten Akten- und Personenbezug prüfen.');
 const prior=events.find(e=>e.requestId===context.requestId);
 // Confirmed receipt replays its original payload before evaluating today's mutable order/head.
 if(prior){if(prior.actorId!==context.actorId||!sameWoundJson(prior.draft,draft)||prior.previousId!==context.expectedHeadId)fail('Anfrage-ID bereits mit anderer Person, Quelle oder Inhalt verwendet.');return structuredClone(prior);}
 if(context.expectedHeadId!==state.headId)fail('Verlauf zwischenzeitlich ergänzt; aktuellen Stand ausdrücklich übernehmen.');
 validateInfusionEventDraft(draft,episode,now);
 if(draft.kind!=='correction'){
  const source=draft.orderState==='linked'?JSON.parse(draft.orderSnapshotJson):null;
  if(!sameWoundJson(source,context.currentOrder))fail('Anordnungsfassung zwischenzeitlich geändert oder nicht zugänglich.');
 }
 const event:InfusionEvent={id:context.eventId,episodeId:episode.id,tenantId:episode.tenantId,clientId:episode.clientId,sequence:state.sequence+1,previousId:state.headId,actorId:context.actorId,requestId:context.requestId,recordedAt:context.recordedAt,draft:structuredClone(draft)};
 infusionCourse(episode,[...events,event],now);return event;
}
/** Only narrative projection; original numerical values and source snapshots remain untouched. */
export function effectiveInfusionNarrative(original:InfusionEvent,course:InfusionCourse):Record<(typeof clinicalKeys)[number],string>{
 const result=Object.fromEntries(clinicalKeys.map(k=>[k,original.draft[k]])) as Record<(typeof clinicalKeys)[number],string>;
 for(const correction of course.corrections.get(original.id)??[])for(const key of clinicalKeys)if(nonempty(correction.draft[key]))result[key]=correction.draft[key];return result;
}

export type InfusionReadModel={statusLabel:string;allowedKinds:string[];recordedRunningDuration:string;deliveredLabel:string;remainingLabel:string;control:{status:'open'|'scheduled'|'overdue'|'completed'|'not_required'|'absent';at:string|null;reason:string|null};warnings:string[];entries:{id:string;label:string;occurredAt:string;recordedAt:string;actorId:string;original:InfusionEventDraft;effectiveNarrative:ReturnType<typeof effectiveInfusionNarrative>;correctionIds:string[]}[]};
/** Validated view model for a future connected screen; absence never becomes a completed control. */
export function infusionReadModel(episode:InfusionEpisode,events:readonly InfusionEvent[],now=Date.now()):InfusionReadModel{
 const state=infusionCourse(episode,events,now),latest=[...events].reverse().find(e=>e.draft.kind!=='correction'),p=latest?.draft;
 const labels={not_started:'Noch nicht begonnen',running:'Laufend',paused:'Unterbrochen',finished:'Abgeschlossen',aborted:'Abgebrochen'};
 const allowedKinds=state.status==='not_started'?['start']:['finished','aborted'].includes(state.status)?['review','correction']:[...(state.status==='running'?['check','pause']:['check','resume']),'parameters','container','device','alarm','finish','abort','correction'];
 let control:InfusionReadModel['control']={status:'absent',at:null,reason:null};
 if(p){if(p.kind==='review')control={status:'completed',at:p.occurredAt,reason:p.reviewReason};else if(p.reviewState==='scheduled')control={status:woundInstant(p.reviewAt)!<BigInt(now)*1000n?'overdue':'scheduled',at:p.reviewAt,reason:p.reviewReason};else control={status:p.reviewState==='pending'?'open':'not_required',at:null,reason:p.reviewReason};}
 const amountEvent=[...events].reverse().find(e=>!['review','correction'].includes(e.draft.kind)),amount=amountEvent?.draft;
 const warnings:string[]=[];
 if(!state.amountsComplete)warnings.push('Mindestens eine tatsächliche Mengenmessung fehlt. Ein späterer Messwert schließt diese Dokumentationslücke nicht automatisch.');
 if(state.latestAmountState==='not_measured')warnings.push('Letzte tatsächliche Mengenmessung fehlt; letzter bekannter Wert ist kein aktueller Gesamtabschluss.');
 if(events.some(e=>e.draft.orderState==='unconfirmed'))warnings.push('Mindestens ein Ereignis hat eine ungeklärte Anordnungsgrundlage.');
 if(episode.purpose==='medication')warnings.push('Dieser Verlauf enthält keinen Gabenachweis. Die tatsächliche Medikamentengabe benötigt gesonderte Dokumentation.');
 if(control.status==='overdue')warnings.push('Dokumentierter Kontrolltermin überschritten; dies löst hier keine Benachrichtigung oder terminierte Aufgabe aus.');
 if(state.corrections.size)warnings.push('Berichtigungen vorhanden. Originale und Erfassungszeiten bleiben neben dem berichteten Text sichtbar.');
 const seconds=state.runningMicroseconds/1000000n,fraction=(state.runningMicroseconds%1000000n).toString().padStart(6,'0');
 return {statusLabel:labels[state.status],allowedKinds,recordedRunningDuration:`${seconds.toString()}.${fraction} Sekunden bis zum letzten tatsächlichen Verlaufseintrag`,deliveredLabel:state.lastKnownDeliveredMl===null?'Keine tatsächlich gemessene Gesamtmenge':`${state.lastKnownDeliveredMl} ml · ${state.latestAmountState==='measured'?'zuletzt tatsächlich dokumentiert':'letzter bekannter Stand; aktuelle Menge fehlt'}`,remainingLabel:!amount?'Noch kein Behälterrest dokumentiert':amount.remainingState==='measured'?`${amount.remainingMl} ml · zuletzt tatsächlich dokumentierter Behälterrest`:`Nicht gemessen: ${amount.remainingReason}`,control,warnings,entries:events.map(e=>({id:e.id,label:infusionEventLabels[e.draft.kind as keyof typeof infusionEventLabels],occurredAt:e.draft.occurredAt,recordedAt:e.recordedAt,actorId:e.actorId,original:structuredClone(e.draft),effectiveNarrative:effectiveInfusionNarrative(e,state),correctionIds:(state.corrections.get(e.id)??[]).map(c=>c.id)}))};
}
