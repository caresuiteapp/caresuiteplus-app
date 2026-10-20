import {dailyProtocolVersion,decodeProtocolSnapshot,protocolDecimal,protocolAmount,isOutputProtocol,type ProtocolRecord,type ProtocolEntry,type ProtocolQuantity,type UrineEntry,type FluidOutputEntry} from './dailyProtocolDomain.ts';
import {woundInstant} from './woundCareDomain.ts';
type Quality='observedMeasured'|'observedEstimated'|'reportedMeasured'|'reportedEstimated';
export const fluidQualityKeys:Quality[]=['observedMeasured','observedEstimated','reportedMeasured','reportedEstimated'];
type Output=UrineEntry|FluidOutputEntry;
type Selection={record:ProtocolRecord;entry:ProtocolEntry;state:'included'|'boundary_crossing'|'unquantified'|'no_observation';direction:'input'|'urine'|'other_output'};
const signed=(n:bigint)=>(n<0n?'-':'')+protocolAmount(n<0n?-n:n);
const collectionKey=(e:Output)=>e.collectionRef.trim()?JSON.stringify([e.collectionRef.trim()]):'';
const range=(e:Output)=>({start:woundInstant(e.collectionMode==='interval_collection'?e.collectionStartAt:e.occurredAt)!,end:woundInstant(e.collectionMode==='interval_collection'?e.collectionEndAt:e.occurredAt)!,interval:e.collectionMode==='interval_collection'});
function overlapping(a:Output,b:Output){const x=range(a),y=range(b);return x.interval&&y.interval?x.start<y.end&&y.start<x.end:x.interval?y.start>=x.start&&y.start<=x.end:y.interval?x.start>=y.start&&x.start<=y.end:x.start===y.start;}
/** Actual documented subset only. No prescription, coverage attestation, prorating or physiological balance. */
export function protocolFluidWindow(records:ProtocolRecord[],tenant:string,client:string,from:string,to:string,now=Date.now()){
 const start=woundInstant(from),end=woundInstant(to);
 if(!Number.isSafeInteger(now)||start===null||end===null||start>=end||end>BigInt(now)*1000n)throw Error('Abgegrenzten vergangenen Zeitraum mit Zeitzone wählen: Beginn vor Ende.');
 const full=decodeProtocolSnapshot({version:dailyProtocolVersion,tenantId:tenant,clientId:client,count:records.length,records},tenant,client,now);
 const selected:Selection[]=[],collections: {record:ProtocolRecord;entry:Output}[]=[];
 const unknown={observedInput:0,reportedInput:0,observedOutput:0,reportedOutput:0};
 let outsideCount=0,unsupportedCount=0,withdrawnCount=0;
 for(const record of full){
  const entry=record.events.at(-1)!.draft.entry;if(!entry){withdrawnCount++;continue;}
  if(entry.kind==='stool'||entry.kind==='meal'){unsupportedCount++;continue;}
  const at=woundInstant(entry.occurredAt)!;let within=at>=start&&at<end,boundary=false;
  if(isOutputProtocol(entry.kind)){
   const e=entry as Output,r=range(e);
   if(r.interval){within=r.start>=start&&r.end<=end;boundary=!within&&r.start<end&&r.end>start;}
   if((within||boundary)&&['passed','collected','zero_collected'].includes(e.occurrence))collections.push({record,entry:e});
  }
  if(!within&&!boundary){outsideCount++;continue;}
  const direction=entry.kind==='drink'?'input':entry.kind==='urine'?'urine':'other_output';
  let state:Selection['state']='included';const actual=(entry as {actual:ProtocolQuantity}).actual;
  const positive=entry.kind==='drink'?['taken','partial','none_taken'].includes(entry.outcome):['passed','collected','zero_collected'].includes((entry as Output).occurrence);
  if(boundary)state='boundary_crossing';else if(!positive)state='no_observation';else if(actual.state==='not_measured')state='unquantified';
  if(state==='unquantified')unknown[(entry.source==='observed'?'observed':'reported')+(direction==='input'?'Input':'Output') as keyof typeof unknown]++;
  selected.push({record:structuredClone(record),entry:structuredClone(entry),state,direction});
 }
 // Distinct IDs do not prove distinct physical collections. Explicit same origin/ref + overlapping windows blocks arithmetic.
 const byCollection=new Map<string,typeof collections>();for(const item of collections){const key=collectionKey(item.entry);if(!key)continue;const list=byCollection.get(key)??[];list.push(item);byCollection.set(key,list);}
 const conflicts:{rootIds:string[];collectionRef:string}[]=[];
 for(const items of byCollection.values()){
  items.sort((a,b)=>{const x=range(a.entry).start,y=range(b.entry).start;return x<y?-1:x>y?1:a.record.root.id.localeCompare(b.record.root.id);});
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
   const a=items[i],b=items[j],x=range(a.entry),y=range(b.entry);if(y.start>x.end)break;
   if(overlapping(a.entry,b.entry))conflicts.push({rootIds:[a.record.root.id,b.record.root.id],collectionRef:a.entry.collectionRef});
  }
 }
 const accum=Object.fromEntries(fluidQualityKeys.map(k=>[k,{input:0n,urine:0n,other:0n,inputCount:0,urineCount:0,otherCount:0}])) as Record<Quality,{input:bigint;urine:bigint;other:bigint;inputCount:number;urineCount:number;otherCount:number}>;
 for(const row of selected){if(row.state!=='included')continue;const e=row.entry,actual=(e as {actual:ProtocolQuantity}).actual,key=(e.source==='observed'?'observed':'reported')+(actual.state==='measured'?'Measured':'Estimated') as Quality,a=accum[key],amount=protocolDecimal(actual.value);if(row.direction==='input'){a.input+=amount;a.inputCount++;}else if(row.direction==='urine'){a.urine+=amount;a.urineCount++;}else{a.other+=amount;a.otherCount++;}}
 const blocked=conflicts.length>0,groups=Object.fromEntries(fluidQualityKeys.map(k=>{const a=accum[k],outputCount=a.urineCount+a.otherCount;return [k,{inputMl:!blocked&&a.inputCount?protocolAmount(a.input):null,urineMl:!blocked&&a.urineCount?protocolAmount(a.urine):null,otherOutputMl:!blocked&&a.otherCount?protocolAmount(a.other):null,documentedDifferenceMl:!blocked&&a.inputCount&&outputCount?signed(a.input-a.urine-a.other):null,inputCount:a.inputCount,urineCount:a.urineCount,otherOutputCount:a.otherCount}];}));
 selected.sort((a,b)=>{const x=woundInstant(a.entry.occurredAt)!,y=woundInstant(b.entry.occurredAt)!;return x<y?1:x>y?-1:a.record.root.id.localeCompare(b.record.root.id);});
 return {from,to,groups:groups as Record<Quality,{inputMl:string|null;urineMl:string|null;otherOutputMl:string|null;documentedDifferenceMl:string|null;inputCount:number;urineCount:number;otherOutputCount:number}>,rows:selected,unknown,blocked,conflicts,boundaryCrossingCount:selected.filter(r=>r.state==='boundary_crossing').length,noObservationCount:selected.filter(r=>r.state==='no_observation').length,outsideCount,unsupportedCount,withdrawnCount,completeCoverage:false as const,clinicalFluidBalance:null,excludedSources:['infusion_courses','enteral_intake','food_water','unmeasured_losses']};
}
