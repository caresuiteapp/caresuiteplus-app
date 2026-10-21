import {cloneClientNativeOriginal as clone,freezeClientNativeOriginal as freeze} from '../clients/clientRecordNativeOriginal.web.ts';
import {getVitalDefinition} from './vitalCatalog.ts';
import {vitalTimeDisplay} from './vitalTimeDisplay.web.ts';
import {woundInstant} from './woundCareDomain.ts';

type Row=Readonly<Record<string,unknown>>;
export type VitalHistorySelectionWeb=Readonly<{type:string;component:string;unit:string}>;
export type VitalHistoryTimeWeb=Readonly<{purpose:'actual'|'recorded'|'legacy'|'control'|'review_agreement';state:'valid'|'missing'|'undefined'|'null'|'empty'|'invalid';raw:string|null|undefined;microseconds:string|null}>;
export type VitalHistoryMarkWeb=Readonly<{id:string;type:string|null;unit:string|null;actual:VitalHistoryTimeWeb;recorded:VitalHistoryTimeWeb;legacy:VitalHistoryTimeWeb;state:'technical_point'|'excluded';reasons:readonly string[];value:number|null;invalidationIds:readonly string[];followUpIds:readonly string[]}>;
export type VitalHistoryProjectionWeb=Readonly<{kind:'unbound_vital_original_history';authority:'inspection_only';scope:Readonly<{tenantId:string;clientId:string}>;selection:VitalHistorySelectionWeb;marks:readonly VitalHistoryMarkWeb[];undatedIds:readonly string[];segments:readonly (readonly Readonly<{id:string;occurredAt:string;microseconds:string;value:number}>[])[];clinicalCompletion:'not_inferred'}>;
export type VitalHistoryOriginalsWeb=Readonly<{scope:Readonly<{tenantId:string;clientId:string}>;measurements:readonly Row[];followUps:readonly Row[];invalidations:readonly Row[]}>;
const originals=new WeakMap<object,VitalHistoryOriginalsWeb>();
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const sameId=(a:unknown,b:unknown)=>uuid(a)&&uuid(b)&&a.toLowerCase()===b.toLowerCase();
const row=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const own=(source:Row,key:string):unknown=>Object.getOwnPropertyDescriptor(source,key)?.value;
const error=()=>Error('Ganze gelieferte Originalpools und eindeutige native Aktenzuordnung zuerst prüfen.');
function time(source:Row,key:string,purpose:VitalHistoryTimeWeb['purpose']):VitalHistoryTimeWeb{if(!Object.hasOwn(source,key))return {purpose,state:'missing',raw:undefined,microseconds:null};const original=source[key],display=vitalTimeDisplay(original);const instant=display.state==='valid'&&typeof original==='string'?woundInstant(original.replace(' ','T')):null;return{purpose,state:display.state==='unreadable'?'invalid':display.state,raw:typeof original==='string'||original===null||original===undefined?original:undefined,microseconds:instant===null?null:instant.toString()};}
function pool(input:unknown,scope:VitalHistoryOriginalsWeb['scope']):readonly Row[]{if(!Array.isArray(input))throw error();const seen=new Set<string>();for(const item of input){if(!row(item))throw error();const id=own(item,'id');if(!uuid(id)||!sameId(own(item,'tenant_id'),scope.tenantId)||!sameId(own(item,'client_id'),scope.clientId))throw error();const key=id.toLowerCase();if(seen.has(key))throw error();seen.add(key);}return input;}
/** Pure inspection of exactly supplied original pools. No native read or write capability. */
export function captureVitalHistoryProjectionWeb(input:unknown,selected:unknown):VitalHistoryProjectionWeb|null{
 try{
  // Capture both arguments before even reading scope, selection or array length.
  const captured=clone({input,selected}) as {input:Row;selected:Row},source=captured.input,selection=captured.selected;
  if(!row(source)||Object.keys(source).length!==4||!['scope','measurements','followUps','invalidations'].every(k=>Object.hasOwn(source,k))||!row(source.scope)||Object.keys(source.scope).length!==2||!uuid(own(source.scope,'tenantId'))||!uuid(own(source.scope,'clientId'))||!row(selection)||Object.keys(selection).length!==3||!['type','component','unit'].every(k=>Object.hasOwn(selection,k)&&typeof selection[k]==='string'&&!!selection[k]))throw error();
  const scope={tenantId:own(source.scope,'tenantId') as string,clientId:own(source.scope,'clientId') as string},measurements=pool(source.measurements,scope),followUps=pool(source.followUps,scope),invalidations=pool(source.invalidations,scope),parents=new Map(measurements.map(r=>[(own(r,'id') as string).toLowerCase(),r]));
  const corrected=new Set<string>();for(const [name,history] of [['followUps',followUps],['invalidations',invalidations]] as const)for(const item of history){const parentId=own(item,'measurement_id');if(!uuid(parentId)||!parents.has(parentId.toLowerCase()))throw error();if(name==='invalidations'){const id=parentId.toLowerCase();if(corrected.has(id))throw error();corrected.add(id);}}
  const definition=getVitalDefinition(selection.type as string),component=definition?.components.find(c=>c.key===selection.component);
  const marks:VitalHistoryMarkWeb[]=measurements.map(native=>{
   const actual=time(native,'occurred_at','actual'),recorded=time(native,'created_at','recorded'),legacy=time(native,'measured_at','legacy'),reasons:string[]=[];
   const nativeId=own(native,'id') as string,type=own(native,'vital_key'),unit=own(native,'unit');
   const relatedInvalid=invalidations.filter(r=>sameId(own(r,'measurement_id'),nativeId)),relatedFollow=followUps.filter(r=>sameId(own(r,'measurement_id'),nativeId));
   if(type!==selection.type)reasons.push('different_measurement_type');
   if(!definition||!component)reasons.push('unknown_selected_component');
   if(unit!==selection.unit||component?.unit!==selection.unit)reasons.push('unit_not_confirmed');
   const snapshot=own(native,'catalog_snapshot'),components=row(snapshot)?own(snapshot,'components'):undefined;
   if(!row(snapshot)||own(snapshot,'key')!==type||own(snapshot,'default_unit')!==unit||!Array.isArray(components)||!definition||components.length!==definition.components.length||components.some((v,i)=>v!==definition.components[i].key))reasons.push('catalog_components_not_confirmed');
   if(actual.state!=='valid'||actual.microseconds===null)reasons.push('actual_time_not_confirmed');
   if(relatedInvalid.length)reasons.push('native_invalidation_reference');
   const values=own(native,'values'),value=row(values)?own(values,selection.component as string):undefined;
   if(typeof value!=='number'||!Number.isFinite(value))reasons.push('numeric_component_not_confirmed');
   const context=own(native,'context');
   if(type==='fluid_balance'&&(!row(context)||own(context,'completeness')!=='complete'))reasons.push('collection_extent_not_confirmed');
   return{id:nativeId,type:typeof type==='string'?type:null,unit:typeof unit==='string'?unit:null,actual,recorded,legacy,state:reasons.length?'excluded':'technical_point',reasons,value:reasons.length?null:value as number,invalidationIds:relatedInvalid.map(r=>own(r,'id') as string),followUpIds:relatedFollow.map(r=>own(r,'id') as string)};
  });
  const ordered=marks.filter(m=>m.actual.microseconds!==null).sort((a,b)=>{const x=BigInt(a.actual.microseconds!),y=BigInt(b.actual.microseconds!);return x<y?-1:x>y?1:a.id.toLowerCase()<b.id.toLowerCase()?-1:a.id.toLowerCase()>b.id.toLowerCase()?1:0;});
  const segments:Array<Array<{id:string;occurredAt:string;microseconds:string;value:number}>>=[];let current:Array<{id:string;occurredAt:string;microseconds:string;value:number}>=[];
  for(const mark of ordered){if(mark.state==='technical_point'){current.push({id:mark.id,occurredAt:mark.actual.raw!,microseconds:mark.actual.microseconds!,value:mark.value!});}else if(mark.type===selection.type){if(current.length)segments.push(current);current=[];}}
  if(current.length)segments.push(current);
  const model=freeze({kind:'unbound_vital_original_history' as const,authority:'inspection_only' as const,scope,selection:selection as VitalHistorySelectionWeb,marks,undatedIds:marks.filter(m=>m.actual.microseconds===null).map(m=>m.id),segments,clinicalCompletion:'not_inferred' as const});
  originals.set(model,freeze({scope,measurements,followUps,invalidations}));return model;
 }catch{return null;}
}
/** Own pure-model provenance only. It neither attests native delivery nor grants rights. */
export function vitalHistoryOriginalsWeb(model:unknown):VitalHistoryOriginalsWeb|null{return !!model&&typeof model==='object'?originals.get(model)??null:null;}
export function vitalHistoryNativeTimeWeb(source:unknown,key:string,purpose:VitalHistoryTimeWeb['purpose']):VitalHistoryTimeWeb|null{try{const captured=clone(source);return row(captured)?freeze(time(captured,key,purpose)):null;}catch{return null;}}
