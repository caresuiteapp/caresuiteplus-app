import {captureWoundComparisonOriginals,type WoundComparisonScope,type WoundComparisonOriginals} from './woundAssessmentComparison.web.ts';
import {woundUuid} from './woundCareDomain.ts';
type Row=Record<string,unknown>;
export type WoundPhotoReferenceSnapshot={assessmentId:string;original:Row;state:'missing'|'empty'|'opaque';references:unknown[]|undefined;correction:Row|null;provenance:'unverified'};
export type WoundPhotoReferenceEvidence={scope:WoundComparisonScope;originals:WoundComparisonOriginals;assessments:{assessmentId:string;snapshots:WoundPhotoReferenceSnapshot[]}[]};
/** Reject lossy non-JSON original data without evaluating an accessor before the existing whole native scope validator. */
function originalJson(value:unknown,seen=new Set<object>()):void{
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
 if(!value||typeof value!=='object'||seen.has(value))throw Error('Vollständiger Referenzoriginalstand ist nicht verlustfrei lesbar.');
 const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
 if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw Error('Referenzoriginal enthält kein natives JSON.');
 seen.add(value);const descriptors=Object.getOwnPropertyDescriptors(value);
 for(const key of Reflect.ownKeys(descriptors)){
  if(array&&key==='length')continue;const d=typeof key==='string'?descriptors[key]:null;
  if(typeof key!=='string'||!d||!d.enumerable||!('value' in d)||array&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=(value as unknown[]).length))throw Error('Referenzoriginal enthält ungeklärte eigene Datenfelder.');
  originalJson(d.value,seen);
 }
 if(array)for(let i=0;i<(value as unknown[]).length;i++)if(!Object.hasOwn(value,i))throw Error('Referenzoriginal enthält fehlende Arraypositionen.');
 seen.delete(value);
}
function snapshot(original:Row,correction:Row|null):WoundPhotoReferenceSnapshot{
 const references=Object.hasOwn(original,'photo_refs')?structuredClone(original.photo_refs) as unknown[]:undefined;
 return{assessmentId:original.id as string,original:structuredClone(original),references,state:references===undefined?'missing':references.length===0?'empty':'opaque',correction:correction?structuredClone(correction):null,provenance:'unverified'};
}
/** A reference is opaque supplied JSON, never an image, capture-time, authorization or consent-original receipt. */
export function captureWoundPhotoReferenceEvidence(input:unknown,scope:WoundComparisonScope):WoundPhotoReferenceEvidence{
 originalJson(input);const originals=captureWoundComparisonOriginals(input,scope);
 const assessments=originals.assessments.map(a=>({assessmentId:a.id as string,snapshots:[snapshot(a,null),...originals.corrections.filter(c=>c.assessment_id===a.id).map(c=>snapshot(c.original_snapshot as Row,c))]}));
 return{scope:{...scope},originals,assessments};
}
export function selectWoundPhotoReferenceEvidence(input:unknown,scope:WoundComparisonScope,assessmentId:string){
 const evidence=captureWoundPhotoReferenceEvidence(input,scope);
 if(!woundUuid(assessmentId))throw Error('Originalbefund ausdrücklich anhand seiner nativen Kennung auswählen.');
 const selected=evidence.assessments.find(a=>a.assessmentId===assessmentId);if(!selected)throw Error('Gewählter Befund fehlt im vollständigen eigenen Originalstand.');
 return selected;
}
