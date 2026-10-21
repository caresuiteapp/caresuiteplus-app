import { medicationTimeDisplay } from './medicationTimeDisplay.web.ts';
import { parseWoundMaterials, sameWoundJson, woundInstant, woundUuid } from './woundCareDomain.ts';
import { validateTreatmentCorrectionHistory, validateDressingCorrectionLinks } from './treatmentCorrectionDomain.ts';

type Original = Record<string, unknown>;
export type WoundCareHistoryScope = { tenantId: string; clientId: string; woundId: string; dressings: boolean };
export type WoundCareHistoryField = { key: string; label: string; state: 'missing' | 'null' | 'empty' | 'invalid' | 'value'; raw: unknown; display: string };
export type WoundCareHistorySource = { wound: { row: Original; assessments: Original[]; lifecycle: Original[]; clientName: string }; plans: Original[]; orders: Original[]; dressings: Original[]; corrections: Original[]; correctionLinks: Original[] };
export type WoundCareHistoricalEntry = { id: string; original: Original; fields: WoundCareHistoryField[]; times: WoundCareHistoryField[]; author: WoundCareHistoryField[]; plan: WoundCareHistoricalEntry | null };
export type WoundCareHistoricalOriginals = { source: WoundCareHistorySource; plans: WoundCareHistoricalEntry[]; dressings: WoundCareHistoricalEntry[] };
const object = (value: unknown): value is Original => !!value && typeof value === 'object' && !Array.isArray(value);
const metadataInstant = (value: unknown) => typeof value === 'string' ? woundInstant(value.replace(' ', 'T')) : null;
const planFields: Array<[string, string]> = [['changeReason','Änderungsgrund'],['basisReason','Anordnungsbezug / Klärungsstand'],['professionalBasis','Dokumentierte fachliche Grundlage'],['goal','Versorgungsziel'],['plannedCare','Geplante Versorgung'],['plannedMaterials','Vorgesehenes Material'],['frequency','Festgelegtes Wechselintervall'],['hygienePlan','Hygieneplanung'],['painPlan','Schmerzmanagement'],['warningSigns','Damals dokumentierte Warnzeichen / Beobachtungen'],['escalationPath','Damals dokumentierte Kontaktvereinbarung / Vorgehen'],['personDecision','Persönliche Entscheidung / Ressourcen'],['reviewStatus','Historische Kontrollabstimmung'],['reviewPendingReason','Dokumentierter offener Abstimmungsbedarf']];
const dressingFields: Array<[string, string]> = [['basisReason','Dokumentierter ungeklärter Bezug'],['actualCleaning','Dokumentierte tatsächliche Reinigung'],['actualTechnique','Dokumentierte tatsächliche Versorgung / Technik'],['hygiene','Dokumentierte tatsächliche Hygiene'],['noMaterialReason','Grund für fehlenden Verbrauch'],['response','Dokumentiertes Ergebnis / Rückmeldung / Beurteilungsgrenze'],['deviation','Dokumentierte Abweichung'],['contact','Originalbericht zur Rücksprache / offenen Klärung'],['personDecision','Dokumentierte persönliche Entscheidung'],['qualificationBasis','Dokumentierte Qualifikations-/Delegationsgrundlage'],['reviewStatus','Historische Kontrollabstimmung'],['reviewPendingReason','Dokumentierter offener Abstimmungsbedarf']];

function field(source: Original, key: string, label: string, kind: 'text' | 'review' | 'metadata' | 'actual' | 'id' = 'text'): WoundCareHistoryField {
 const raw=Object.hasOwn(source,key)?structuredClone(source[key]):undefined;
 if(!Object.hasOwn(source,key))return {key,label,raw,state:'missing',display:'Im gelieferten Original nicht enthalten'};
 if(raw===null)return {key,label,raw,state:'null',display:'Originalwert null – nicht angegeben'};
 if(typeof raw==='string'&&!raw.trim())return {key,label,raw,state:'empty',display:`Leerer Originaltext: ${JSON.stringify(raw)}`};
 const valid=kind==='metadata'?metadataInstant(raw)!==null:kind==='actual'?woundInstant(raw)!==null:kind==='id'?woundUuid(raw):kind==='review'?['scheduled','pending'].includes(String(raw))&&typeof raw==='string':typeof raw==='string';
 if(!valid)return {key,label,raw,state:'invalid',display:`Originalformat nicht bestätigt · Original: ${JSON.stringify(raw)}`};
 return {key,label,raw,state:'value',display:kind==='metadata'||kind==='actual'?medicationTimeDisplay(raw as string).display:kind==='review'?raw==='scheduled'?'Termin als vereinbart dokumentiert · Original: scheduled':'Terminabstimmung als offen dokumentiert · Original: pending':raw as string};
}
function jsonOriginal(value: unknown, seen=new Set<object>()): void {
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
 if(!value||typeof value!=='object'||seen.has(value))throw Error('Gelieferter Originalbestand ist kein vollständiger JSON-Beleg.');
 if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw Error('Originalformat nicht bestätigt.');
 seen.add(value);if(Array.isArray(value)){if(Object.keys(value).length!==value.length||Object.keys(value).some((key,index)=>key!==String(index)))throw Error('Originalarray enthält zusätzliche oder fehlende Bestandteile.');for(let i=0;i<value.length;i++){if(!Object.hasOwn(value,i))throw Error('Originalbestand enthält eine Lücke.');jsonOriginal(value[i],seen);}}else for(const item of Object.values(value))jsonOriginal(item,seen);seen.delete(value);
}
function rows(value: unknown, scope: WoundCareHistoryScope, woundScoped: boolean): Original[] {
 if(!Array.isArray(value))throw Error('Vollständiger Originalverlauf fehlt.');const ids=new Set<string>();
 for(let i=0;i<value.length;i++){const row=value[i];if(!Object.hasOwn(value,i)||!object(row)||!woundUuid(row.id)||ids.has(row.id.toLowerCase())||row.tenant_id!==scope.tenantId||row.client_id!==scope.clientId||(woundScoped&&row.wound_case_id!==scope.woundId)||metadataInstant(row.created_at)===null)throw Error('Originalverlauf enthält fremde, doppelte oder ungültige native Zuordnungen.');ids.add(row.id.toLowerCase());if(row.recorded_by!=null&&!woundUuid(row.recorded_by))throw Error('Native Originalautorenkennung ungültig.');}
 return value;
}
function planEntry(plan: Original): WoundCareHistoricalEntry {
 const details=plan.details as Original;
 return {id:plan.id as string,original:structuredClone(plan),fields:planFields.map(([key,label])=>field(details,key,label,key==='reviewStatus'?'review':'text')),times:[field(plan,'effective_from','Gespeicherter Planbeginn','metadata'),field(plan,'effective_until','Gesondertes gespeichertes Planende','metadata'),field(plan,'created_at','Planfassung dokumentiert','metadata'),field(details,'nextReviewAt','Historisch dokumentierter Kontrolltermin','metadata')],author:[field(plan,'recorded_by','Native Originalautorenkennung','id'),field(plan,'recorded_by_name','Gespeicherter Autorenname')],plan:null};
}

/** Capture all supplied native pools before selecting visible originals. This is no new clinical or backend confirmation. */
export function captureWoundCareHistoricalOriginals(input: unknown, scope: WoundCareHistoryScope): WoundCareHistoricalOriginals {
 if(!scope||![scope.tenantId,scope.clientId,scope.woundId].every(woundUuid)||typeof scope.dressings!=='boolean'||!object(input)||!object(input.wound)||!object(input.wound.row))throw Error('Eigener vollständiger Wund-Originalbezug fehlt.');
 jsonOriginal(input);const source=structuredClone(input) as WoundCareHistorySource,w=source.wound.row;
 if(w.id!==scope.woundId||w.tenant_id!==scope.tenantId||w.client_id!==scope.clientId||metadataInstant(w.created_at)===null||metadataInstant(w.updated_at)===null||(w.recorded_by!=null&&!woundUuid(w.recorded_by)))throw Error('Eigener Wundfall nicht bestätigt.');
 const assessments=rows(source.wound.assessments,scope,true),lifecycle=rows(source.wound.lifecycle,scope,true),plans=rows(source.plans,scope,true),orders=rows(source.orders,scope,false),dressings=rows(source.dressings,scope,true),corrections=rows(source.corrections,scope,true),links=rows(source.correctionLinks,scope,true);
 for(const assessment of assessments)if(assessment.observed_at!=null&&woundInstant(assessment.observed_at)===null)throw Error('Original-Beobachtungszeit ungültig.');
 for(const event of lifecycle)if(woundInstant(event.occurred_at)===null||!['close','reopen'].includes(String(event.action)))throw Error('Original-Fallstatusereignis ungültig.');
 const versions=[...plans].sort((a,b)=>Number(b.version)-Number(a.version));
 for(let i=0;i<versions.length;i++){const plan=versions[i],previous=versions[i+1];if(!object(plan.details)||plan.version!==versions.length-i||(plan.previous_id??null)!==(previous?.id??null)||metadataInstant(plan.effective_from)===null||(plan.effective_until!=null&&(metadataInstant(plan.effective_until)===null||metadataInstant(plan.effective_until)!<=metadataInstant(plan.effective_from)!))||(previous&&metadataInstant(plan.effective_from)!<=metadataInstant(previous.effective_from)!))throw Error('Ganzer ursprünglicher Planverlauf ist widersprüchlich.');if(plan.basis_state==='linked'){const order=plan.order_snapshot;if(!object(order)||!woundUuid(plan.medical_order_id)||order.id!==plan.medical_order_id||order.tenant_id!==scope.tenantId||order.client_id!==scope.clientId)throw Error('Historische Anordnungsfassung ist fremd oder nicht zugeordnet.');}else if(!['pending','not_required'].includes(String(plan.basis_state))||plan.medical_order_id!=null||plan.order_snapshot!=null)throw Error('Historischer Planbezug widersprüchlich.');}
 if(!scope.dressings&&(dressings.length||corrections.length||links.length))throw Error('Versorgungsoriginale ohne eigenes Behandlungspflege-Leserecht.');
 const executionIds=new Set<string>();for(const dressing of dressings){if(!object(dressing.details)||!woundUuid(dressing.execution_id)||executionIds.has(dressing.execution_id.toLowerCase())||woundInstant(dressing.occurred_at)===null||!['performed','partial','omitted','refused','failed'].includes(String(dressing.outcome)))throw Error('Ganzer tatsächlicher Versorgungsverlauf ist ungültig.');executionIds.add(dressing.execution_id.toLowerCase());if(typeof dressing.details.materialsJson!=='string')throw Error('Ganzer Materialoriginalbeleg fehlt.');parseWoundMaterials(dressing.details.materialsJson);for(const moment of ['painBefore','painAfter']){const details=dressing.details;if(details[moment+'State']==='NRS'){if(typeof details[moment+'Score']!=='string'||!/^\d{1,2}$/.test(details[moment+'Score'] as string)||Number(details[moment+'Score'])>10)throw Error('Original-Schmerzangabe ungültig.');}else if(details[moment+'State']!=='not_assessable'||typeof details[moment+'Reason']!=='string'||!(details[moment+'Reason'] as string).trim())throw Error('Original-Schmerznachweis fehlt.');}if(dressing.plan_id!=null){if(!woundUuid(dressing.plan_id)||!plans.some(plan=>plan.id===dressing.plan_id&&sameWoundJson(plan,dressing.plan_snapshot)))throw Error('Ganzes damaliges Planoriginal fehlt oder wurde verändert.');}else if(dressing.plan_snapshot!=null)throw Error('Historisches Planoriginal ohne native Zuordnung.');}
 // Current hidden execution rows are not supplied by this reader. Validate only
 // the original execution identities actually delivered in correction snapshots.
 for(const correction of corrections)if(!dressings.some(dressing=>dressing.id===correction.dressing_id&&dressing.execution_id===correction.execution_id))throw Error('Native Berichtigung und ganzer Verbandwechsel gehören nicht zusammen.');
 const validationCorrections=structuredClone(corrections),validationLinks=structuredClone(links);
 const normalizeTime=(row:Original,key:string)=>{if(typeof row[key]==='string')row[key]=(row[key] as string).replace(' ','T');};
 for(const correction of validationCorrections){normalizeTime(correction,'created_at');if(object(correction.execution_snapshot)){normalizeTime(correction.execution_snapshot,'created_at');}}
 for(const link of validationLinks){normalizeTime(link,'created_at');if(object(link.dressing_snapshot)){normalizeTime(link.dressing_snapshot,'created_at');}}
 const originalExecutions=new Map<string,Original>();for(const correction of validationCorrections){if(!object(correction.execution_snapshot))throw Error('Ganzes Berichtigungsoriginal fehlt.');originalExecutions.set(String(correction.execution_snapshot.id),correction.execution_snapshot);}
 validateTreatmentCorrectionHistory(validationCorrections,scope.tenantId,[...originalExecutions.values()]);validateDressingCorrectionLinks(validationCorrections,validationLinks,scope.tenantId,scope.clientId,scope.woundId,dressings);
 const entries=versions.map(planEntry),byPlan=new Map(entries.map(plan=>[plan.id,plan]));
 return {source,plans:entries,dressings:dressings.map(dressing=>({id:dressing.id as string,original:structuredClone(dressing),fields:dressingFields.map(([key,label])=>field(dressing.details as Original,key,label,key==='reviewStatus'?'review':'text')),times:[field(dressing,'occurred_at','Originalangabe zum tatsächlichen Versorgungsereignis','actual'),field(dressing,'created_at','Versorgungsnachweis erfasst','metadata'),field(dressing.details as Original,'nextReviewAt','Historisch dokumentierter Kontrolltermin','metadata')],author:[field(dressing,'recorded_by','Native Originalautorenkennung','id'),field(dressing,'recorded_by_name','Gespeicherter Autorenname')],plan:dressing.plan_id==null?null:structuredClone(byPlan.get(dressing.plan_id as string)!)}))};
}
export function sameWoundCareHistoricalOriginals(original: WoundCareHistorySource, current: unknown): boolean {
 try{jsonOriginal(current);return sameWoundJson(original,current);}catch{return false;}
}
