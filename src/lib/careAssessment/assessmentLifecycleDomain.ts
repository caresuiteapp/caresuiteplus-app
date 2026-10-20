export type AssessmentLifecycleRequest={action:'create'|'return';subjectId:string;assessmentId:string;expectedRevision:string;expectedVersion:string;reason:string;reasonDetail:string;returnReason:string};
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const integer=(v:string,min:number)=>/^(?:0|[1-9]\d{0,9})$/.test(v)&&Number(v)>=min&&Number(v)<=2147483647;
export const assessmentReasonChoices=[{key:'initial',label:'Erstassessment'},{key:'scheduled_review',label:'Geplante Neubewertung'},{key:'event_triggered',label:'Anlassbezogene Neubewertung'},{key:'hospital_return',label:'Nach Krankenhausaufenthalt'},{key:'care_level_change',label:'Änderung des Pflegegrades'},{key:'other',label:'Anderer Anlass'}] as const;
export function validateAssessmentLifecycleRequest(p:AssessmentLifecycleRequest):string|null{
 if(!p||!['action','subjectId','assessmentId','expectedRevision','expectedVersion','reason','reasonDetail','returnReason'].every(k=>typeof p[k as keyof AssessmentLifecycleRequest]==='string')||!['create','return'].includes(p.action)||!uuid(p.subjectId))return 'Aktion und Pflegefall ausdrücklich auswählen.';
 if(p.action==='create'){
  if(p.assessmentId!==''||p.expectedRevision!==''||p.expectedVersion!==''||p.returnReason!=='')return 'Neues Assessment darf keinen bestehenden Bearbeitungsstand behaupten.';
  if(!assessmentReasonChoices.some(r=>r.key===p.reason))return 'Anlass des Assessments auswählen.';
  if(p.reason!=='initial'&&!p.reasonDetail.trim())return 'Den konkreten Anlass der Neubewertung beschreiben.';
 }else{
  if(!uuid(p.assessmentId)||!integer(p.expectedRevision,0)||!integer(p.expectedVersion,1))return 'Assessment- und Änderungsstand fehlen.';
  if(!p.returnReason.trim())return 'Rückgabe zur Bearbeitung begründen.';
  if(p.reason!==''||p.reasonDetail!=='')return 'Rückgabe darf keinen neuen Aufnahmegrund setzen.';
 }
 if(p.reasonDetail.length>2000||p.returnReason.length>2000)return 'Begründung ist zu lang (maximal 2.000 Zeichen).';return null;
}
export function assertAssessmentLifecycleReceipt(p:AssessmentLifecycleRequest,value:unknown){
 const r=value as {assessmentId?:unknown;subjectId?:unknown;action?:unknown;draftRevision?:unknown;version?:unknown;status?:unknown};
 if(!r||typeof r!=='object'||!uuid(r.assessmentId)||r.subjectId!==p.subjectId||r.action!==p.action||!Number.isSafeInteger(r.draftRevision)||Number(r.draftRevision)<0||!Number.isSafeInteger(r.version)||Number(r.version)<1)throw Error('Ergebnisbeleg gehört nicht zum gewählten Pflegefall.');
 if(p.action==='return'&&(r.assessmentId!==p.assessmentId||Number(r.draftRevision)<=Number(p.expectedRevision)||r.version!==Number(p.expectedVersion)+1||r.status!=='in_progress'))throw Error('Rückgabe oder neuer Bearbeitungsstand ist nicht bestätigt.');
 if(p.action==='create'&&(r.status!=='draft'||r.version!==1))throw Error('Neues Assessment ist nicht als eigener Entwurf bestätigt.');
 return {id:String(r.assessmentId),draftRevision:Number(r.draftRevision),version:Number(r.version)};
}
export async function runAssessmentLifecycleRequest(p:AssessmentLifecycleRequest,invoke:()=>Promise<{data:unknown;error:unknown}>,classify:(error:unknown)=>{message:string;definite:boolean}){
 const error=validateAssessmentLifecycleRequest(p);if(error)return {ok:false as const,error};
 try{const result=await invoke();if(result.error){const failure=classify(result.error);return {ok:false as const,error:failure.message,uncertain:!failure.definite};}return {ok:true as const,id:assertAssessmentLifecycleReceipt(p,result.data).id};}
 catch{return {ok:false as const,uncertain:true,error:'Die Antwort fehlt oder passt nicht zum Auftrag. Dieselbe Anfrage erneut prüfen.'};}
}
