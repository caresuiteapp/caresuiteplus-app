import {sameWoundJson,woundUuid,woundInstant} from './woundCareDomain.ts';
export type TreatmentRow=Record<string,unknown>;
const object=(v:unknown):v is TreatmentRow=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const treatmentCorrectionSections={event:'Zeitpunkt, Art und Ergebnis der Durchführung',basis:'Anordnungs- und Qualifikationsbezug',action:'Tatsächliche Handlung / Abweichung',communication:'Rücksprache / Eskalation',wound_materials:'Verbandwechsel: tatsächlicher Materialverbrauch',wound_pain:'Verbandwechsel: Schmerz vor / nach Versorgung',wound_technique:'Verbandwechsel: Reinigung, Technik, Hygiene und Verträglichkeit',wound_review:'Verbandwechsel: weitere Kontrolle / Personenbezug'} as const;
export type TreatmentCorrectionRequest={executionId:string;expectedExecutionJson:string;expectedDressingJson:string;expectedHeadJson:string;section:string;correctedStatement:string;reason:string;evidenceBasis:string;clinicalImpact:string;communication:string;personDecision:string};
export const emptyTreatmentCorrection=():TreatmentCorrectionRequest=>({executionId:'',expectedExecutionJson:'',expectedDressingJson:'',expectedHeadJson:'',section:'',correctedStatement:'',reason:'',evidenceBasis:'',clinicalImpact:'',communication:'',personDecision:''});
export function treatmentSection(e:TreatmentRow,section:string):TreatmentRow{
 const pick=(keys:string[])=>Object.fromEntries(keys.map(k=>[k,e[k]??null]));
 switch(section){case 'event':return pick(['performed_at','treatment_type','title','outcome']);case 'basis':return pick(['medical_order_id','qualification_snapshot']);case 'action':return pick(['details','deviation_reason']);case 'communication':return pick(['escalation']);default:if(Object.hasOwn(treatmentCorrectionSections,section)&&section.startsWith('wound_'))return pick(['id','performed_at','outcome','details']);throw Error('Betroffenen Nachweisinhalt ausdrücklich wählen.');}
}
export function dressingCorrectionSection(d:TreatmentRow,section:string):TreatmentRow{
 const details=object(d.details)?d.details:{};
 const keys=section==='wound_materials'?['materialsJson','noMaterialReason']:section==='wound_pain'?['painBeforeState','painBeforeScore','painBeforeReason','painAfterState','painAfterScore','painAfterReason']:section==='wound_technique'?['actualCleaning','actualTechnique','hygiene','response','deviation']:section==='wound_review'?['reviewStatus','nextReviewAt','reviewPendingReason','personDecision','contact']:['occurredAt','outcome','basisState','planId','basisReason','qualificationBasis','actualCleaning','actualTechnique','hygiene','materialsJson','noMaterialReason','response','deviation','contact','personDecision'];
 return Object.fromEntries(keys.map(k=>[k,details[k]??null]));
}
export function validateTreatmentSource(e:TreatmentRow):void{
 if(!woundUuid(e.id)||!woundUuid(e.tenant_id)||!woundUuid(e.client_id)||woundInstant(e.created_at)===null||woundInstant(e.performed_at)===null||!['performed','partial','omitted','refused','failed'].includes(String(e.outcome))||typeof e.treatment_type!=='string'||!e.treatment_type.trim()||typeof e.title!=='string'||!e.title.trim())throw Error('Behandlungspflegenachweis ungültig.');
}
export function validateTreatmentCorrection(payload:unknown):string|null{
 const template=emptyTreatmentCorrection();
 if(!object(payload)||Object.keys(payload).length!==Object.keys(template).length||Object.keys(payload).some(k=>!Object.hasOwn(template,k)||typeof payload[k]!=='string'||String(payload[k]).length>(k==='expectedExecutionJson'?80000:k==='expectedHeadJson'?120000:k==='expectedDressingJson'?180000:2000)))return 'Berichtigungsangaben fehlen, sind ungültig oder zu umfangreich.';
 const p=payload as unknown as TreatmentCorrectionRequest;
 if(!woundUuid(p.executionId)||!Object.hasOwn(treatmentCorrectionSections,p.section))return 'Nachweis und betroffenen Inhalt ausdrücklich zuordnen.';
 if(['correctedStatement','reason','evidenceBasis','clinicalImpact','communication','personDecision'].some(k=>!String(payload[k]).trim()))return 'Berichtigte Aussage, Grund, Erkenntnisbasis, Auswirkungen, Rücksprache und Personenbezug vollständig dokumentieren.';
 try{
  const e=JSON.parse(p.expectedExecutionJson);if(!object(e)||e.id!==p.executionId)return 'Geladener Originalnachweis fehlt.';validateTreatmentSource(e);
  if(p.expectedHeadJson){const h=JSON.parse(p.expectedHeadJson);if(!object(h)||!woundUuid(h.id)||h.execution_id!==e.id||h.tenant_id!==e.tenant_id||h.client_id!==e.client_id||!Number.isInteger(h.version)||Number(h.version)<1||woundInstant(h.created_at)===null)return 'Vorheriger Berichtigungsstand ungültig.';}
  if(p.expectedDressingJson){const d=JSON.parse(p.expectedDressingJson);if(!object(d)||!woundUuid(d.id)||!woundUuid(d.wound_case_id)||d.execution_id!==e.id||d.tenant_id!==e.tenant_id||d.client_id!==e.client_id||woundInstant(d.created_at)===null||woundInstant(d.occurred_at)!==woundInstant(e.performed_at)||d.outcome!==e.outcome||e.treatment_type!=='wound_dressing')return 'Original-Verbandwechsel und Behandlungspflegenachweis gehören nicht zusammen.';}
  else if(p.section.startsWith('wound_'))return 'Wundbezogene Berichtigung benötigt den tatsächlichen Original-Verbandwechsel.';
 }catch{return 'Original- oder Berichtigungsstand ungültig.';}
 return null;
}
export function validateTreatmentCorrectionSnapshot(p:TreatmentCorrectionRequest,tenant:string,client:string,e:TreatmentRow,d:TreatmentRow|null,head:TreatmentRow|null):string|null{
 const error=validateTreatmentCorrection(p);if(error)return error;
 if(e.id!==p.executionId||e.tenant_id!==tenant||e.client_id!==client)return 'Originalnachweis einer fremden Akte.';
 if(!sameWoundJson(e,JSON.parse(p.expectedExecutionJson)))return 'Behandlungspflegenachweis geändert. Original neu prüfen.';
 if(d&&(d.tenant_id!==tenant||d.client_id!==client||d.execution_id!==e.id))return 'Verbandwechsel einer fremden Akte.';
 if(!sameWoundJson(d,p.expectedDressingJson?JSON.parse(p.expectedDressingJson):null))return 'Verbandwechselbezug geändert oder nicht vollständig geladen.';
 if(head&&(head.tenant_id!==tenant||head.client_id!==client||head.execution_id!==e.id))return 'Berichtigungsstand einer fremden Akte.';
 if(!sameWoundJson(head,p.expectedHeadJson?JSON.parse(p.expectedHeadJson):null))return 'Inzwischen neue oder geänderte Berichtigung. Verlauf neu prüfen.';
 return null;
}
export function validateTreatmentCorrectionHistory(rows:TreatmentRow[],tenant:string,sources:TreatmentRow[]):void{
 const byId=new Map<string,TreatmentRow>();for(const e of sources){validateTreatmentSource(e);if(e.tenant_id!==tenant||byId.has(String(e.id)))throw Error('Originalnachweise fremd oder doppelt.');byId.set(String(e.id),e);}
 const groups=new Map<string,TreatmentRow[]>(),seen=new Set<string>();
 for(const c of rows){const e=byId.get(String(c.execution_id));if(!e||!woundUuid(c.id)||seen.has(c.id)||c.tenant_id!==tenant||c.client_id!==e.client_id||!woundUuid(c.recorded_by)||typeof c.recorded_by_name!=='string'||!c.recorded_by_name.trim()||woundInstant(c.created_at)===null||!Number.isInteger(c.version)||Number(c.version)<1||!Object.hasOwn(treatmentCorrectionSections,String(c.section)))throw Error('Berichtigungsverlauf unvollständig, ungültig oder fremd.');seen.add(c.id);
  const original=c.execution_snapshot;if(!object(original)||original.id!==e.id||original.tenant_id!==tenant||original.client_id!==e.client_id)throw Error('Originalnachweisbezug fehlt.');validateTreatmentSource(original);
  if(!sameWoundJson(c.original_section,treatmentSection(original,String(c.section))))throw Error('Ursprünglicher Nachweisabschnitt verändert.');
  if((c.dressing_id==null)!==(c.wound_case_id==null)||(c.dressing_id!=null&&(!woundUuid(c.dressing_id)||!woundUuid(c.wound_case_id)))||(String(c.section).startsWith('wound_')&&c.dressing_id==null))throw Error('Wundbezug der Berichtigung widersprüchlich.');
  for(const k of ['corrected_statement','reason','evidence_basis','clinical_impact','communication','person_decision'])if(typeof c[k]!=='string'||!String(c[k]).trim()||String(c[k]).length>2000)throw Error('Berichtigungsvermerk unvollständig.');
  const group=groups.get(String(e.id))??[];group.push(c);groups.set(String(e.id),group);
 }
 for(const group of groups.values()){group.sort((a,b)=>Number(a.version)-Number(b.version));for(let i=0;i<group.length;i++)if(group[i].version!==i+1||(group[i].previous_id??null)!==(group[i-1]?.id??null))throw Error('Berichtigungsfolge fehlt oder widerspricht sich.');}
}
export function validateDressingCorrectionLinks(corrections:TreatmentRow[],links:TreatmentRow[],tenant:string,client:string,wound:string,dressings:TreatmentRow[]):void{
 const applicable=corrections.filter(c=>c.wound_case_id===wound),byCorrection=new Map<string,TreatmentRow>(), applicableById=new Map(applicable.map(c=>[String(c.id),c]));
 for(const l of links){const c=applicableById.get(String(l.correction_id));if(!c||!woundUuid(l.id)||byCorrection.has(String(l.correction_id))||l.tenant_id!==tenant||l.client_id!==client||l.wound_case_id!==wound||l.dressing_id!==c.dressing_id||l.execution_id!==c.execution_id||woundInstant(l.created_at)===null)throw Error('Wund-Berichtigungsbezug unvollständig oder fremd.');
  const s=l.dressing_snapshot;if(!object(s)||!object(s.details)||woundInstant(s.created_at)===null||s.id!==l.dressing_id||s.tenant_id!==tenant||s.client_id!==client||s.wound_case_id!==wound||s.execution_id!==c.execution_id||!dressings.some(d=>d.id===s.id)||!sameWoundJson(l.original_section,dressingCorrectionSection(s,String(c.section))))throw Error('Ursprünglicher Wundnachweisbezug fehlt.');
  const e=c.execution_snapshot as TreatmentRow;if(woundInstant(s.occurred_at)!==woundInstant(e.performed_at)||s.outcome!==e.outcome)throw Error('Ursprüngliche Wundversorgung und Behandlungspflege widersprechen sich.');byCorrection.set(String(c.id),l);
 }
 if(applicable.some(c=>!byCorrection.has(String(c.id))))throw Error('Gemeinsamer Berichtigungsbeleg fehlt im Wundverlauf.');
}
