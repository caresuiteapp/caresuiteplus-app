import {vitalHistoryOriginalsWeb,vitalHistoryNativeTimeWeb,type VitalHistoryProjectionWeb} from './vitalHistoryProjection.web.ts';
type Row=Readonly<Record<string,unknown>>;
const error=()=>Error('Verlustfreier Originalexport ist für diesen gelieferten Bestand nicht bestätigt.');
function json(value:unknown):string{
 const inspect=(v:unknown)=>{if(v===null||typeof v==='string'||typeof v==='boolean')return;if(typeof v==='number'&&Number.isFinite(v)&&!Object.is(v,-0))return;if(!v||typeof v!=='object')throw error();if(Array.isArray(v)){for(const item of v)inspect(item);return;}for(const item of Object.values(v))inspect(item);};inspect(value);return JSON.stringify(value);
}
function cell(value:unknown){const raw=typeof value==='string'?value:json(value),protectedValue=/^[\s\uFEFF]*[=+\-@]/u.test(raw)||/^[\t\r\n]/.test(raw)?"'"+raw:raw;return '"'+protectedValue.replaceAll('"','""')+'"';}
/** Unbound original-data CSV, no download/current-read/clinical authority. All pools are exported. */
export function vitalHistoryOriginalCsvWeb(model:VitalHistoryProjectionWeb):string|null{
 try{
  const own=vitalHistoryOriginalsWeb(model);if(!own)return null;
  // Test all full originals before constructing a partial CSV. No dropped undefined/NaN/-0 fields.
  json(own);
  const columns=['Record kind','Native record ID','Tenant ID','Client ID','Measurement ID','Native actor ID','Original actor name','Native request ID','Measurement type','Original display value','Original unit','Actual time state','Actual time raw','Recorded time state','Recorded time raw','Legacy time state','Legacy time raw','Control time state','Control time raw','Review agreement state','Review agreement raw','Correction reason','Inspection state','Inspection reasons JSON','Full original row JSON'];
  const output:unknown[][]=[columns];
  const field=(source:Row,key:string)=>Object.hasOwn(source,key)?source[key]:'';
  for(const [kind,pool] of [['measurement',own.measurements],['follow_up',own.followUps],['invalidation',own.invalidations]] as const)for(const native of pool){
   const actual=vitalHistoryNativeTimeWeb(native,'occurred_at','actual')!,recorded=vitalHistoryNativeTimeWeb(native,'created_at','recorded')!,legacy=vitalHistoryNativeTimeWeb(native,'measured_at','legacy')!,control=vitalHistoryNativeTimeWeb(native,'observed_at','control')!,review=vitalHistoryNativeTimeWeb(native,'next_review_at','review_agreement')!;
   const mark=kind==='measurement'?model.marks.find(m=>m.id===native.id):null;
   output.push([kind,native.id,native.tenant_id,native.client_id,kind==='measurement'?native.id:native.measurement_id,field(native,'recorded_by'),field(native,'recorded_by_name'),field(native,kind==='measurement'?'creation_request_id':'request_id'),field(native,'vital_key'),field(native,'display_value'),field(native,'unit'),actual.state,field(native,'occurred_at'),recorded.state,field(native,'created_at'),legacy.state,field(native,'measured_at'),control.state,field(native,'observed_at'),review.state,field(native,'next_review_at'),field(native,'reason'),mark?.state??'original_history_reference',json(mark?.reasons??[]),json(native)]);
  }
  return '\uFEFF'+output.map(line=>line.map(cell).join(';')).join('\r\n')+'\r\n';
 }catch{return null;}
}
