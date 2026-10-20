import {medicationHistoryCursor} from './medicationHistoryPagination.ts';

export type WoundLifecycleRequest={woundId:string;dataJson:string};
export type WoundLifecycleDraft={action:string;occurredAt:string;reason:string;decisionBasis:string;handover:string;closureKind:string;expectedUpdatedAt:string;expectedStatus:string;expectedAssessmentId:string};
export const emptyWoundLifecycle=():WoundLifecycleDraft=>({action:'',occurredAt:'',reason:'',decisionBasis:'',handover:'',closureKind:'',expectedUpdatedAt:'',expectedStatus:'',expectedAssessmentId:''});
export const openWoundStatuses=['draft','active','healing','deteriorated'];
export const closedWoundStatuses=['healed','archived'];
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const stamp=(v:string)=>{try{return medicationHistoryCursor({id:'00000000-0000-0000-0000-000000000001',created_at:v}).microseconds;}catch{return null;}};
export function validateWoundLifecycle(payload:unknown,now=Date.now()):string|null{
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return 'Ungültige Fallstatusanfrage.';
 const p=payload as Record<string,unknown>;
 if(Object.keys(p).length!==2||Object.keys(p).some(k=>!['woundId','dataJson'].includes(k))||!uuid(p.woundId)||typeof p.dataJson!=='string'||p.dataJson.length>16000)return 'Wundbezug und Anfrage prüfen.';
 let parsed:unknown;try{parsed=JSON.parse(p.dataJson);}catch{return 'Fallstatusangaben sind ungültig.';}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return 'Fallstatusangaben fehlen.';
 const d=parsed as WoundLifecycleDraft,template=emptyWoundLifecycle();
 if(Object.keys(d).length!==Object.keys(template).length||Object.keys(d).some(k=>!Object.hasOwn(template,k)||typeof d[k as keyof WoundLifecycleDraft]!=='string'||d[k as keyof WoundLifecycleDraft].length>2000))return 'Fallstatusangaben fehlen oder sind zu umfangreich.';
 const at=stamp(d.occurredAt);
 if(at===null||at>BigInt(now)*1000n||stamp(d.expectedUpdatedAt)===null)return 'Tatsächlichen Entscheidungszeitpunkt und geladenen Fallstand prüfen.';
 if(!d.reason.trim()||!d.decisionBasis.trim()||!d.handover.trim())return 'Grund, tatsächliche Entscheidungsgrundlage und weitere Versorgung / Übergabe ausdrücklich dokumentieren.';
 if(d.expectedAssessmentId&&!uuid(d.expectedAssessmentId))return 'Assessmentbezug ist ungültig.';
 if(d.action==='close'){
  if(!openWoundStatuses.includes(d.expectedStatus)||!['healed','transfer','care_ended','other'].includes(d.closureKind))return 'Offenen Fall und tatsächlichen Abschlussgrund auswählen.';
  if(d.closureKind==='healed'&&!d.expectedAssessmentId)return 'Abheilung benötigt einen ausdrücklich zugeordneten Befund; fehlenden Befund zuerst dokumentieren.';
 }else if(d.action==='reopen'){
  if(!closedWoundStatuses.includes(d.expectedStatus)||d.closureKind!=='')return 'Nur einen abgeschlossenen Fall ohne neuen Abschlussgrund wiederöffnen.';
 }else return 'Fallabschluss oder Wiederöffnung ausdrücklich auswählen.';
 return null;
}

/** Validates the freshly read snapshot; SQL repeats these checks under a parent lock. */
export function validateWoundLifecycleSnapshot(d:WoundLifecycleDraft,w:Record<string,unknown>,latest:Record<string,unknown>|null,lastEvent:Record<string,unknown>|null,assessments:Record<string,unknown>[] = latest?[latest]:[]):string|null{
 if(w.updated_at!==d.expectedUpdatedAt||w.status!==d.expectedStatus||(latest?.id??'')!==d.expectedAssessmentId)return 'Fall oder Assessment geändert. Aktuellen Verlauf laden und Entscheidung erneut prüfen.';
 const at=stamp(d.occurredAt);
 if(at===null)return 'Entscheidungszeitpunkt ungültig.';
 if(lastEvent){const previous=typeof lastEvent.occurred_at==='string'?stamp(lastEvent.occurred_at):null;if(previous===null||at<previous)return 'Entscheidung darf nicht vor dem letzten Fallstatusereignis liegen.';}
 if(d.action==='close'&&d.closureKind==='healed'&&(!latest||latest.observed_at==null))return 'Abheilung benötigt einen zugeordneten tatsächlich erhobenen Befund.';
 if(d.action==='close')for(const a of assessments){if(a.observed_at==null)continue;const observed=typeof a.observed_at==='string'?stamp(a.observed_at):null;if(observed===null||at<observed)return 'Abschluss darf nicht vor einem tatsächlich dokumentierten Befund liegen.';}
 return null;
}
