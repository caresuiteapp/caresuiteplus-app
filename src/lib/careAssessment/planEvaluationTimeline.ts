import {decodeEvaluationRecords,planEvaluationVersion,type EvaluationRecord} from './planEvaluationDomain.ts';
import {woundInstant} from '../pflege/woundCareDomain.ts';
import {controlExact} from '../pflege/clinicalControlShape.ts';
export type EvaluationTimelineFilter={query:string;measureId:string;outcome:string;source:string;state:'current'|'withdrawn'|'all';fromAt:string;throughAt:string};
export const emptyEvaluationTimelineFilter=():EvaluationTimelineFilter=>({query:'',measureId:'',outcome:'all',source:'all',state:'current',fromAt:'',throughAt:''});
export const evaluationTimelineOutcomes=['all','effective','partly_effective','not_effective','deteriorated','not_assessable','no_individual_result'];
export function evaluationTimeline(records:EvaluationRecord[],tenant:string,assessment:string,client:string,filter:EvaluationTimelineFilter,now=Date.now()){
 // Validate every record before filtering. A damaged later page must never disappear behind a filter.
 const full=decodeEvaluationRecords({version:planEvaluationVersion,tenantId:tenant,assessmentId:assessment,count:records.length,records},tenant,assessment,client,now);
 if(!controlExact(filter,['query','measureId','outcome','source','state','fromAt','throughAt'])||Object.values(filter).some(v=>typeof v!=='string'||v.length>4000)||!evaluationTimelineOutcomes.includes(filter.outcome)||!['all','observed','reported','no_individual_result'].includes(filter.source)||!['current','withdrawn','all'].includes(filter.state))throw Error('Evaluationsfilter ungültig.');
 const from=filter.fromAt?woundInstant(filter.fromAt):null,through=filter.throughAt?woundInstant(filter.throughAt):null;
 if((filter.fromAt&&from===null)||(filter.throughAt&&through===null)||(from!==null&&through!==null&&from>through))throw Error('Tatsächlichen Evaluationszeitraum mit Zeitzone prüfen; Beginn darf nicht nach Ende liegen.');
 const measures=new Map<string,Set<string>>();for(const r of full)for(const m of r.root.snapshot.measures){if(!measures.has(m.id!))measures.set(m.id!,new Set());measures.get(m.id!)!.add(m.title!);}
 if(filter.measureId&&!measures.has(filter.measureId))throw Error('Ausgewählte Originalmaßnahme ist im vollständig geladenen Bestand nicht enthalten.');
 if(!filter.measureId&&(filter.outcome==='no_individual_result'||filter.source==='no_individual_result'))throw Error('Für fehlende Einzelbewertungen zuerst eine Originalmaßnahme wählen.');
 const query=filter.query.trim().toLocaleLowerCase('de');
 const rows=full.filter(r=>{const head=r.events.at(-1)!,entry=head.draft.entry,withdrawn=entry===null;
  if(filter.state==='current'&&withdrawn||filter.state==='withdrawn'&&!withdrawn)return false;
  if(filter.measureId&&!r.root.snapshot.measures.some(m=>m.id===filter.measureId))return false;
  // Withdrawn originals have no current clinical outcome or actual evaluation time.
  if(withdrawn){if(filter.outcome!=='all'||filter.source!=='all'||from!==null||through!==null)return false;}
  else{const result=filter.measureId?entry.measureReviews?.find(x=>x.measureId===filter.measureId):entry;
   if(filter.outcome!=='all'&&(filter.outcome==='no_individual_result'?!!result:result?.outcome!==filter.outcome))return false;
   if(filter.source!=='all'&&(filter.source==='no_individual_result'?!!result:result?.source!==filter.source))return false;
   const actual=woundInstant(entry.evaluatedAt)!;if(from!==null&&actual<from||through!==null&&actual>through)return false;
  }
  if(query){const selected=filter.measureId?r.root.snapshot.measures.filter(m=>m.id===filter.measureId):r.root.snapshot.measures;
   const findings=filter.measureId?entry?.measureReviews?.filter(x=>x.measureId===filter.measureId):entry;
   const text=JSON.stringify({root:r.root.id,actor:head.actorName,reason:head.draft.reason,measures:selected,findings}).toLocaleLowerCase('de');if(!text.includes(query))return false;
  }return true;
 }).sort((a,b)=>{const ae=a.events.at(-1)!,be=b.events.at(-1)!,at=woundInstant(ae.draft.entry?.evaluatedAt??ae.recordedAt)!,bt=woundInstant(be.draft.entry?.evaluatedAt??be.recordedAt)!;return at===bt?a.root.id.localeCompare(b.root.id):at>bt?-1:1;});
 return {records:rows,total:full.length,matching:rows.length,current:full.filter(r=>r.events.at(-1)!.draft.entry!==null).length,withdrawn:full.filter(r=>r.events.at(-1)!.draft.entry===null).length,measures:Array.from(measures,([id,titles])=>({id,title:Array.from(titles).join(' / ')}))};
}
