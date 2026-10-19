import {medicationHistoryCursor} from './medicationHistoryPagination.ts';
export type WoundCareRequest={action:'plan'|'dressing';woundId:string;dataJson:string};
export type WoundPlanDraft={expectedPreviousId:string;effectiveFrom:string;effectiveUntil:string;basisState:string;medicalOrderId:string;expectedOrderJson:string;basisReason:string;professionalBasis:string;changeReason:string;goal:string;plannedCare:string;plannedMaterials:string;frequency:string;hygienePlan:string;painPlan:string;warningSigns:string;escalationPath:string;personDecision:string;reviewStatus:string;nextReviewAt:string;reviewPendingReason:string};
export type WoundDressingDraft={occurredAt:string;outcome:string;basisState:string;planId:string;basisReason:string;actualCleaning:string;actualTechnique:string;hygiene:string;materialsJson:string;noMaterialReason:string;painBeforeState:string;painBeforeScore:string;painBeforeReason:string;painAfterState:string;painAfterScore:string;painAfterReason:string;response:string;deviation:string;contact:string;personDecision:string;qualificationBasis:string;reviewStatus:string;nextReviewAt:string;reviewPendingReason:string};
export type WoundMaterial={name:string;quantity:string;unit:string;purpose:string};
export const emptyWoundPlan=():WoundPlanDraft=>({expectedPreviousId:'',effectiveFrom:'',effectiveUntil:'',basisState:'',medicalOrderId:'',expectedOrderJson:'',basisReason:'',professionalBasis:'',changeReason:'',goal:'',plannedCare:'',plannedMaterials:'',frequency:'',hygienePlan:'',painPlan:'',warningSigns:'',escalationPath:'',personDecision:'',reviewStatus:'',nextReviewAt:'',reviewPendingReason:''});
export const emptyWoundDressing=():WoundDressingDraft=>({occurredAt:'',outcome:'',basisState:'',planId:'',basisReason:'',actualCleaning:'',actualTechnique:'',hygiene:'',materialsJson:'[]',noMaterialReason:'',painBeforeState:'',painBeforeScore:'',painBeforeReason:'',painAfterState:'',painAfterScore:'',painAfterReason:'',response:'',deviation:'',contact:'',personDecision:'',qualificationBasis:'',reviewStatus:'',nextReviewAt:'',reviewPendingReason:''});
export const woundUuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const woundInstant=(v:unknown):bigint|null=>{try{return medicationHistoryCursor({id:'00000000-0000-0000-0000-000000000001',created_at:v}).microseconds;}catch{return null;}};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const calendar=(v:unknown):v is string=>typeof v==='string'&&/^[1-9]\d{3}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export function woundBerlinDate(at:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-');}
function review(d:{reviewStatus:string;nextReviewAt:string;reviewPendingReason:string},now:number){
 if(d.reviewStatus==='pending'&&!d.nextReviewAt&&d.reviewPendingReason.trim())return null;
 const time=woundInstant(d.nextReviewAt);
 if(d.reviewStatus==='scheduled'&&time!==null&&time>BigInt(now)*1000n&&!d.reviewPendingReason.trim())return null;
 return 'Kontrolltermin oder offene Abstimmung ausdrücklich und widerspruchsfrei dokumentieren.';
}
export function parseWoundMaterials(json:string):WoundMaterial[]{
 const rows:unknown=JSON.parse(json);if(!Array.isArray(rows)||rows.length>20)throw Error('Höchstens 20 tatsächliche Materialpositionen dokumentieren.');
 for(const row of rows){if(!object(row)||Object.keys(row).length!==4||Object.keys(row).some(k=>!['name','quantity','unit','purpose'].includes(k)||typeof row[k]!=='string'||(row[k] as string).length>200)||!String(row.name).trim()||!String(row.unit).trim()||!/^\d+(?:[.,]\d+)?$/.test(String(row.quantity))||+String(row.quantity).replace(',','.')<=0||+String(row.quantity).replace(',','.')>1000000||!['wound','preparation','waste'].includes(String(row.purpose)))throw Error('Material mit tatsächlicher Bezeichnung, positiver Menge, Einheit und Verwendungszweck dokumentieren.');}
 return rows as WoundMaterial[];
}
export function validateWoundCare(payload:unknown,now=Date.now()):string|null{
 if(!object(payload)||Object.keys(payload).length!==3||Object.keys(payload).some(k=>!['action','woundId','dataJson'].includes(k))||!woundUuid(payload.woundId)||!['plan','dressing'].includes(String(payload.action))||typeof payload.dataJson!=='string'||payload.dataJson.length>120000)return 'Ungültige Wundversorgungsanfrage.';
 let parsed:unknown;try{parsed=JSON.parse(payload.dataJson);}catch{return 'Wundversorgungsangaben ungültig.';}
 const template=payload.action==='plan'?emptyWoundPlan():emptyWoundDressing();
 if(!object(parsed)||Object.keys(parsed).length!==Object.keys(template).length||Object.keys(parsed).some(k=>!Object.hasOwn(template,k)||typeof parsed[k]!=='string'||(parsed[k] as string).length>(k==='expectedOrderJson'?80000:k==='materialsJson'?20000:2000)))return 'Wundversorgungsangaben fehlen oder sind zu umfangreich.';
 const d=parsed as Record<string,string>;const control=review(d as unknown as WoundPlanDraft,now);if(control)return control;
 if(payload.action==='plan'){
  const p=d as unknown as WoundPlanDraft,from=woundInstant(p.effectiveFrom),until=p.effectiveUntil?woundInstant(p.effectiveUntil):null;
  if(from===null||(p.effectiveUntil&&(until===null||until<=from))||(p.expectedPreviousId&&!woundUuid(p.expectedPreviousId)))return 'Planzeitraum und vorherige Planfassung prüfen.';
  if(['professionalBasis','changeReason','goal','plannedCare','plannedMaterials','frequency','hygienePlan','painPlan','warningSigns','escalationPath','personDecision'].some(k=>!d[k].trim()))return 'Plan, Änderungsgrund, fachliche Grundlage und persönliche Entscheidung vollständig dokumentieren.';
  if(p.basisState==='linked'){
   let order:unknown;try{order=JSON.parse(p.expectedOrderJson);}catch{return 'Geladene Anordnung fehlt.';}
   if(!woundUuid(p.medicalOrderId)||!object(order)||order.id!==p.medicalOrderId||!p.basisReason.trim())return 'Vorhandene Anordnung ausdrücklich zuordnen und Wundbezug dokumentieren.';
  }else if(!['pending','not_required'].includes(p.basisState)||p.medicalOrderId||p.expectedOrderJson||!p.basisReason.trim())return 'Offene oder nicht erforderliche Grundlage ohne erfundenen Anordnungsbezug begründen.';
 }else{
  const p=d as unknown as WoundDressingDraft,at=woundInstant(p.occurredAt);
  if(at===null||at>BigInt(now)*1000n)return 'Tatsächlichen Versorgungszeitpunkt prüfen.';
  if(!['performed','partial','omitted','refused','failed'].includes(p.outcome))return 'Tatsächliches Durchführungsergebnis ausdrücklich wählen.';
  if(p.basisState==='linked'){if(!woundUuid(p.planId)||p.basisReason.trim())return 'Planfassung auswählen; unbestätigte Grundlage getrennt begründen.';}
  else if(p.basisState!=='unconfirmed'||p.planId||!p.basisReason.trim()||!p.deviation.trim()||!p.contact.trim())return 'Unbestätigte Grundlage mit tatsächlicher Abweichung und Klärungsbedarf dokumentieren.';
  if(['actualCleaning','actualTechnique','hygiene','response','contact','personDecision','qualificationBasis'].some(k=>!d[k].trim()))return 'Tatsächliche Handlung / begründete Nichtdurchführung, Ergebnis, persönliche Entscheidung und Qualifikationsgrundlage dokumentieren.';
  if(p.outcome!=='performed'&&!p.deviation.trim())return 'Teilweise, ausgebliebene, abgelehnte oder fehlgeschlagene Versorgung tatsächlich begründen.';
  try{const materials=parseWoundMaterials(p.materialsJson);if(materials.length?p.noMaterialReason.trim():!p.noMaterialReason.trim())return 'Verbrauch ohne Material ausdrücklich begründen; Materialliste und fehlenden Verbrauch nicht gleichzeitig bestätigen.';}catch(e){return e instanceof Error?e.message:'Materialangaben ungültig.';}
  for(const moment of ['painBefore','painAfter']){
   if(d[moment+'State']==='NRS'){if(!/^\d{1,2}$/.test(d[moment+'Score'])||+d[moment+'Score']>10||d[moment+'Reason'].trim())return 'Schmerz vor und nach der Versorgung nur als tatsächlich erhobene NRS 0–10 dokumentieren.';}
   else if(d[moment+'State']==='not_assessable'){if(d[moment+'Score'].trim()||!d[moment+'Reason'].trim())return 'Nicht erhobenen Schmerz ohne erfundenen Score begründen.';}
   else return 'Schmerzerhebung vor und nach der Versorgung ausdrücklich dokumentieren.';
  }
 }
 return null;
}
/** Clinical/source relation only. Insurer approval is retained separately, never fabricated. */
export function validateWoundOrder(order:Record<string,unknown>,tenant:string,client:string,id:string,from:string,until=''):string|null{
 if(order.tenant_id!==tenant||order.client_id!==client||order.id!==id||!woundUuid(id))return 'Anordnung gehört nicht zu dieser Akte.';
 if(order.status!=='active'||!calendar(order.valid_from)||(order.valid_until!=null&&!calendar(order.valid_until))||(order.valid_until!=null&&String(order.valid_until)<order.valid_from)||!calendar(order.ordered_at)||typeof order.ordering_physician!=='string'||!order.ordering_physician.trim()||typeof order.description!=='string'||!order.description.trim())return 'Aktive Anordnung mit tatsächlicher Herkunft und gültigem Zeitraum erforderlich.';
 if(woundInstant(from)===null||(until&&woundInstant(until)===null))return 'Versorgungs-/Planzeitpunkt ungültig.';
 const first=woundBerlinDate(from),last=until?woundBerlinDate(until):first;
 if(first<String(order.valid_from)||first<String(order.ordered_at)||(order.valid_until!=null&&last>String(order.valid_until)))return 'Anordnung deckt den angegebenen Zeitraum nicht ab.';
 return null;
}
/** Latest effective version wins, even when expired. Never fall back to an older plan. */
export function woundPlanAt(plans:Record<string,unknown>[],at:string):Record<string,unknown>|null{
 const time=woundInstant(at);if(time===null)throw Error('Versorgungszeitpunkt ungültig.');let found:Record<string,unknown>|null=null,best:bigint|null=null;
 const seen=new Set<string>();for(const p of plans){const from=woundInstant(p.effective_from),end=p.effective_until==null?null:woundInstant(p.effective_until);if(!woundUuid(p.id)||seen.has(p.id)||from===null||(p.effective_until!=null&&(end===null||end<=from)))throw Error('Planverlauf ist ungültig.');seen.add(p.id);if(from<=time&&(best===null||from>best)){found=p;best=from;}else if(from<=time&&from===best)throw Error('Mehrere gleichzeitig wirksame Planfassungen.');}
 if(found?.effective_until!=null&&time>=woundInstant(found.effective_until)!)return null;return found;
}
/** JSON object key order has no source/version meaning; array order remains meaningful. */
export function sameWoundJson(a:unknown,b:unknown):boolean{
 const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
}
export function validateWoundPlanChange(d:WoundPlanDraft,previous:Record<string,unknown>|null,dressings:Record<string,unknown>[]):string|null{
 const from=woundInstant(d.effectiveFrom);
 if(from===null||(previous?.id??'')!==d.expectedPreviousId)return 'Planfassung geändert oder Beginn ungültig. Aktuellen Stand erneut prüfen.';
 if(previous){const old=woundInstant(previous.effective_from);if(old===null||from<=old)return 'Neue Fassung muss nach dem Beginn der vorherigen Fassung liegen.';}
 for(const e of dressings){if(e.plan_id==null)continue;const at=woundInstant(e.occurred_at);if(at===null||at>=from)return 'Neue Planung darf bereits dokumentierte planbezogene Versorgung nicht rückwirkend ersetzen.';}
 return null;
}
export function validateWoundDressingSnapshot(d:WoundDressingDraft,tenant:string,client:string,wound:string,plans:Record<string,unknown>[],orders:Record<string,unknown>[],status:unknown,lastLifecycle:Record<string,unknown>|null):string|null{
 if(d.basisState==='unconfirmed')return null;
 let p:Record<string,unknown>|null;try{p=woundPlanAt(plans,d.occurredAt);}catch(e){return e instanceof Error?e.message:'Planverlauf ungültig.';}
 if(!p||p.id!==d.planId||p.tenant_id!==tenant||p.client_id!==client||p.wound_case_id!==wound||p.basis_state!=='linked')return 'Passende Planfassung mit zugeordneter Anordnung dieser Wunde fehlt.';
 const at=woundInstant(d.occurredAt)!;
 if(['healed','archived'].includes(String(status))){const closed=lastLifecycle?.action==='close'?woundInstant(lastLifecycle.occurred_at):null;if(closed===null||at>closed)return 'Versorgung nach Fallabschluss mit tatsächlichem Klärungsbedarf dokumentieren oder Fall begründet wiederöffnen.';}
 if(lastLifecycle?.action==='reopen'){const reopened=woundInstant(lastLifecycle.occurred_at),recorded=woundInstant(lastLifecycle.created_at),planRecorded=woundInstant(p.created_at);if(reopened===null||recorded===null||planRecorded===null||(at>=reopened&&planRecorded<recorded))return 'Nach Wiederöffnung die Versorgung erneut beurteilen und eine neue Planfassung dokumentieren.';}
 const order=orders.find(o=>o.id===p!.medical_order_id);
 if(!order||!sameWoundJson(order,p.order_snapshot))return 'Anordnung gegenüber der Planfassung geändert. Planung prüfen oder ungeklärte Grundlage dokumentieren.';
 return validateWoundOrder(order,tenant,client,String(p.medical_order_id),d.occurredAt);
}
