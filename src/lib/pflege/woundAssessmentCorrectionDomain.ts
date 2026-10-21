import {sameWoundJson,woundUuid,woundInstant} from './woundCareDomain.ts';
type Row=Record<string,unknown>;
const object=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const woundCorrectionSections={observation:'Beobachtungszeit / Zuordnung',measurement:'Messmethode und Wundmaße',appearance:'Wundbett, Exsudat, Geruch, Rand und Umgebung',pain:'Schmerzerhebung',infection:'Infektionsbeobachtung',person:'Persönliche Situation, Wünsche und Ressourcen',action:'Tatsächliche Handlung und Ergebnis',review:'Weitere Kontrolle / Abstimmung'} as const;
export type WoundAssessmentCorrectionRequest={woundId:string;assessmentId:string;expectedSourceJson:string;expectedHeadJson:string;section:string;correctedStatement:string;reason:string;evidenceBasis:string;clinicalImpact:string;communication:string;personDecision:string};
export const emptyWoundAssessmentCorrection=():WoundAssessmentCorrectionRequest=>({woundId:'',assessmentId:'',expectedSourceJson:'',expectedHeadJson:'',section:'',correctedStatement:'',reason:'',evidenceBasis:'',clinicalImpact:'',communication:'',personDecision:''});
/** A narrative erratum is evidence, not a replacement measurement or a newly observed assessment. */
export function woundAssessmentSection(source:Row,section:string):Row{
 const d=object(source.documentation_details)?source.documentation_details:{};
 const pick=(keys:string[])=>Object.fromEntries(keys.map(k=>[k,d[k]??null]));
 switch(section){
  case 'observation':return {observed_at:source.observed_at??null,wound_case_id:source.wound_case_id,client_id:source.client_id};
  case 'measurement':return {...pick(['measurementMethod','lengthState','lengthCm','lengthReason','widthState','widthCm','widthReason','depthState','depthCm','depthReason']),length_cm:source.length_cm??null,width_cm:source.width_cm??null,depth_cm:source.depth_cm??null,unit:'cm'};
  case 'appearance':return {...pick(['woundBed','exudate','odor','woundEdge','surroundingSkin']),wound_bed:source.wound_bed??null,legacy_exudate:source.exudate??null,legacy_odor:source.odor??null,wound_edge:source.wound_edge??null,surrounding_skin:source.surrounding_skin??null};
  case 'pain':return {...pick(['painState','painScore','painReason']),pain_score:source.pain_score??null};
  case 'infection':return {...pick(['infectionObservation']),infection_signs:source.infection_signs??null};
  case 'person':return pick(['personalImpact','preferences','selfManagement']);
  case 'action':return {...pick(['actualAction','response']),intervention:source.intervention??null,legacy_response:source.response??null};
  case 'review':return pick(['nextReviewAt','reviewStatus','reviewPendingReason']);
  default:throw Error('Betroffenen Assessmentinhalt ausdrücklich wählen.');
 }
}
export function validateWoundAssessmentCorrection(payload:unknown):string|null{
 const template=emptyWoundAssessmentCorrection();
 if(!object(payload)||Object.keys(payload).length!==Object.keys(template).length||Object.keys(payload).some(k=>!Object.hasOwn(template,k)||typeof payload[k]!=='string'||String(payload[k]).length>(k==='expectedSourceJson'?80000:k==='expectedHeadJson'?120000:2000)))return 'Berichtigungsangaben fehlen, sind ungültig oder zu umfangreich.';
 const p=payload as unknown as WoundAssessmentCorrectionRequest;
 if(!woundUuid(p.woundId)||!woundUuid(p.assessmentId)||!Object.hasOwn(woundCorrectionSections,p.section))return 'Wundfall, Assessment und betroffenen Inhalt ausdrücklich zuordnen.';
 if(['correctedStatement','reason','evidenceBasis','clinicalImpact','communication','personDecision'].some(k=>!String(payload[k]).trim()))return 'Berichtigte Aussage, Grund, tatsächliche Erkenntnisgrundlage, Auswirkungen, Rücksprache und Personenbezug vollständig dokumentieren.';
 try{
  const original:unknown=JSON.parse(p.expectedSourceJson);
  if(!object(original)||original.id!==p.assessmentId||original.wound_case_id!==p.woundId||!woundUuid(original.tenant_id)||!woundUuid(original.client_id)||woundInstant(original.created_at)===null)return 'Geladener Originalbefund fehlt oder gehört nicht zum gewählten Wundfall.';
  if(p.expectedHeadJson){const head:unknown=JSON.parse(p.expectedHeadJson);if(!object(head)||!woundUuid(head.id)||head.assessment_id!==p.assessmentId||head.wound_case_id!==p.woundId||!Number.isInteger(head.version)||Number(head.version)<1||head.tenant_id!==original.tenant_id||head.client_id!==original.client_id||woundInstant(head.created_at)===null)return 'Vorheriger Berichtigungsstand ungültig.';}
 }catch{return 'Original- oder Berichtigungsstand ungültig.';}
 return null;
}
export function validateWoundAssessmentCorrectionSnapshot(p:WoundAssessmentCorrectionRequest,tenant:string,client:string,source:Row,head:Row|null):string|null{
 const error=validateWoundAssessmentCorrection(p);if(error)return error;
 if(source.id!==p.assessmentId||source.tenant_id!==tenant||source.client_id!==client||source.wound_case_id!==p.woundId)return 'Originalbefund gehört nicht zu dieser Akte.';
 if(!sameWoundJson(source,JSON.parse(p.expectedSourceJson)))return 'Originalbefund seit Beginn der Bearbeitung geändert. Stand neu prüfen.';
 if(head&&(head.tenant_id!==tenant||head.client_id!==client||head.assessment_id!==p.assessmentId||head.wound_case_id!==p.woundId))return 'Berichtigungsstand einer fremden Akte.';
 if(!sameWoundJson(head,p.expectedHeadJson?JSON.parse(p.expectedHeadJson):null))return 'Inzwischen neue oder geänderte Berichtigung. Verlauf neu prüfen.';
 return null;
}
/** Validate the complete chain before displaying any correction as a complete history. */
export function validateWoundAssessmentCorrectionHistory(rows:Row[],tenant:string,client:string,wound:string,assessments:Row[]):void{
 const groups=new Map<string,Row[]>(),seen=new Set<string>(),sourceIds=new Set(assessments.map(a=>a.id));
 for(const r of rows){
  if(!woundUuid(r.id)||seen.has(r.id)||r.tenant_id!==tenant||r.client_id!==client||r.wound_case_id!==wound||!woundUuid(r.assessment_id)||!sourceIds.has(r.assessment_id)||!woundUuid(r.recorded_by)||typeof r.recorded_by_name!=='string'||!r.recorded_by_name.trim()||woundInstant(r.created_at)===null||!Number.isInteger(r.version)||Number(r.version)<1||!Object.hasOwn(woundCorrectionSections,String(r.section)))throw Error('Berichtigungsverlauf unvollständig, ungültig oder fremd.');
  seen.add(r.id);const s=r.original_snapshot;
  if(!object(s)||s.id!==r.assessment_id||s.tenant_id!==tenant||s.client_id!==client||s.wound_case_id!==wound||woundInstant(s.created_at)===null||!sameWoundJson(r.original_section,woundAssessmentSection(s,String(r.section))))throw Error('Unveränderter Originalbezug der Berichtigung fehlt.');
  for(const k of ['corrected_statement','reason','evidence_basis','clinical_impact','communication','person_decision'])if(typeof r[k]!=='string'||!String(r[k]).trim()||String(r[k]).length>2000)throw Error('Berichtigungsnachweis unvollständig.');
  const group=groups.get(r.assessment_id)??[];group.push(r);groups.set(r.assessment_id,group);
 }
 for(const group of groups.values()){
  group.sort((a,b)=>Number(a.version)-Number(b.version));
  for(let i=0;i<group.length;i++)if(group[i].version!==i+1||(group[i].previous_id??null)!==(group[i-1]?.id??null))throw Error('Berichtigungsfassungen fehlen oder widersprechen sich.');
 }
}
export function validateWoundHealingCorrectionBasis(assessmentId:string,corrections:Row[]):string|null{
 return corrections.some(c=>c.assessment_id===assessmentId)?'Befund besitzt Berichtigungsvermerke. Abheilung fachlich neu beurteilen und ein eigenes tatsächlich erhobenes Assessment dokumentieren.':null;
}
