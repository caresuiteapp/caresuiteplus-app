import {isMedicationGiven,validEventInstant} from './medicationAdministrationDomain.ts';
import {woundInstant} from './woundCareDomain.ts';

/** Latest explicitly documented actual administration time; recording order and planned/legacy times stay separate. */
export function latestActualMedicationInstant(events:readonly {status:string;occurredAt:string|null}[]):string|null{
 let latest:string|null=null,best:bigint|null=null;
 for(const event of events){
  const raw=event.occurredAt;
  if(!isMedicationGiven(event.status)||typeof raw!=='string'||!validEventInstant(raw))continue;
  const instant=woundInstant(raw);
  if(instant!==null&&(best===null||instant>best)){best=instant;latest=raw;}
 }
 return latest;
}
