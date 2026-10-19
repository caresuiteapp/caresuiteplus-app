import {woundUuid} from '../pflege/woundCareDomain.ts';
/** Missing ID denotes a new measure. A supplied ID must remain an explicit native identity. */
export function assessmentMeasureIdentityIssue(measures:unknown):string|null{
 if(!Array.isArray(measures)||measures.length>200)return 'Maßnahmenliste fehlt oder ist zu umfangreich.';
 const seen=new Set<string>();
 for(const m of measures){
  if(!m||typeof m!=='object'||Array.isArray(m))return 'Maßnahme ist kein gültiger Datensatz.';
  if(Object.hasOwn(m,'id')){
   if(!woundUuid(m.id))return 'Bestehende Maßnahmen benötigen ihre gültige native Kennung; neue Maßnahmen erhalten die Kennung beim Speichern.';
   const id=m.id.toLowerCase();if(seen.has(id))return 'Dieselbe Originalmaßnahme wurde doppelt in den Entwurf aufgenommen.';seen.add(id);
  }
 }
 return null;
}
