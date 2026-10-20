import {historyRecord} from './plan-amendment-history.mjs';
import {id,time} from './plan-amendment.mjs';
export function currentSource(action='replace'){
 const original=historyRecord().payload.source,current=structuredClone(original),entry=structuredClone(original.events[0].draft.entry);entry.observedEffect='Später begründet berichtigt';
 current.events.push({id:id(1001),rootId:original.root.id,sequence:2,previousId:original.headId,requestId:id(2001),recordedAt:time(12),actorId:id(5),actorName:'Spätere Fachperson',draft:{action,entry:action==='void'?null:entry,reason:'Konkreter Grund der späteren Quellenentscheidung'}});current.headId=id(1001);current.eventCount=2;return current;
}
