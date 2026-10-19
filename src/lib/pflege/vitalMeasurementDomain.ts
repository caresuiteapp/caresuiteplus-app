export type VitalMeasurementPayload = {clientId:string;type:string;occurredAt:string;valuesJson:string;contextJson:string;note:string;catalogVersion:string;configurationVersion:string};
export type VitalDefinition = {key:string;components:readonly {key:string;label:string;unit:string}[]};
export type VitalLimits = Record<string,{min?:number;max?:number}>;
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function parseVitalNumber(raw:string):number|null{
  const normalized=raw.trim().replace(',','.');
  if(!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized))return null;
  const value=Number(normalized);return Number.isFinite(value)&&Math.abs(value)<=1_000_000_000?value:null;
}
export function requiredVitalComponents(definition:VitalDefinition):string[]{
  if(['blood_pressure','arterial_pressure'].includes(definition.key))return ['systolic','diastolic'];
  if(definition.key==='gcs')return ['eyes','verbal','motor'];
  if(definition.key==='fluid_balance')return ['intake','output'];
  return definition.components.map(c=>c.key);
}
export function deriveVitalValues(type:string,values:Record<string,number>):Record<string,number>{
  const derived={...values};
  if(type==='gcs'&&['eyes','verbal','motor'].every(k=>Number.isFinite(values[k])))derived.total=values.eyes+values.verbal+values.motor;
  if(type==='fluid_balance'&&Number.isFinite(values.intake)&&Number.isFinite(values.output))derived.balance=values.intake-values.output;
  return derived;
}
export function validateVitalMeasurement(payload:VitalMeasurementPayload,definition:VitalDefinition,now=Date.now()):string|null{
  if(!uuid(payload.clientId)||payload.type!==definition.key)return 'Klient:in und Messart eindeutig auswählen.';
  if(!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(payload.occurredAt)||!Number.isFinite(Date.parse(payload.occurredAt))||Date.parse(payload.occurredAt)>now)return 'Tatsächlichen Messzeitpunkt mit Zeitzone prüfen; er darf nicht in der Zukunft liegen.';
  const date=payload.occurredAt.slice(0,10),[y,m,d]=date.split('-').map(Number),calendar=new Date(Date.UTC(y,m-1,d));
  if(calendar.toISOString().slice(0,10)!==date)return 'Das Messdatum ist ungültig.';
  if(!payload.catalogVersion||!Number.isFinite(Date.parse(payload.catalogVersion))||!(payload.configurationVersion==='none'||Number.isFinite(Date.parse(payload.configurationVersion))))return 'Katalog- und Konfigurationsstand neu laden.';
  if(payload.note.length>4000||payload.valuesJson.length>4096||payload.contextJson.length>8192)return 'Messangaben oder Notiz sind zu umfangreich.';
  let values:unknown,context:unknown;try{values=JSON.parse(payload.valuesJson);context=JSON.parse(payload.contextJson);}catch{return 'Messwerte und Messkontext sind ungültig.';}
  if(!object(values)||!object(context))return 'Messwerte und Messkontext müssen strukturierte Angaben sein.';
  const keys=definition.components.map(c=>c.key);
  if(Object.keys(values).some(k=>!keys.includes(k)))return 'Die Messung enthält Angaben einer anderen Messart.';
  if(requiredVitalComponents(definition).some(k=>values[k]===undefined))return 'Erforderliche Messkomponenten fehlen.';
  if(Object.values(values).some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1_000_000_000))return 'Messwerte müssen gültige begrenzte Zahlen sein.';
  if(Object.keys(context).length>20||Object.entries(context).some(([k,v])=>!k.trim()||k.length>80||typeof v!=='string'||v.length>500))return 'Messkontext ist unvollständig oder zu umfangreich.';
  const n=values as Record<string,number>;
  if(['blood_pressure','arterial_pressure'].includes(payload.type)&&(n.systolic<0||n.diastolic<0||n.systolic<n.diastolic))return 'Systolischen und diastolischen Wert prüfen.';
  if(['oxygen','fio2','svv'].includes(payload.type)&&(n.value<0||n.value>100))return 'Prozentangaben müssen zwischen 0 und 100 liegen.';
  if(payload.type==='pain_score'&&(!Number.isInteger(n.value)||n.value<0||n.value>10||context.scale!=='NRS'))return 'Hier ist ausschließlich NRS 0–10 zulässig; verwendete Skala ausdrücklich bestätigen.';
  if(payload.type==='rass'&&(!Number.isInteger(n.value)||n.value< -5||n.value>4))return 'RASS muss eine ganze Zahl zwischen −5 und +4 sein.';
  if(payload.type==='gcs'&&[['eyes',4],['verbal',5],['motor',6]].some(([key,max])=>!Number.isInteger(n[String(key)])||n[String(key)]<1||n[String(key)]>Number(max)))return 'GCS-Komponenten außerhalb der zulässigen Skalenwerte.';
  if(payload.type==='gcs'&&n.total!==n.eyes+n.verbal+n.motor)return 'GCS-Summe stimmt nicht mit den Einzelkomponenten überein.';
  if(payload.type==='fluid_balance'&&(!context.period||!['complete','incomplete','unknown'].includes(String(context.completeness))||(context.completeness!=='complete'&&!String(context.incompleteReason??'').trim())))return 'Bilanzzeitraum, Erfassungsumfang und fehlende Angaben ausdrücklich dokumentieren.';
  if(payload.type==='urine_output'&&!String(context.period??'').trim())return 'Zeitraum der Urinausscheidung dokumentieren.';
  if(payload.type==='fluid_balance'&&(n.intake<0||n.output<0||n.balance!==n.intake-n.output))return 'Ein-/Ausfuhr und berechnete Bilanz prüfen.';
  if(['weight','height','bmi','body_surface_area','head_circumference','blood_glucose','blood_ketones','capillary_refill','urine_output','pupils','pulse','respiratory_rate','oxygen_flow','tidal_volume','minute_ventilation','ventilator_rate','lactate'].includes(payload.type)&&Object.values(n).some(v=>v<0))return 'Diese Messgröße darf nicht negativ sein.';
  return null;
}
// A configured range is not a diagnosis. Missing/partial limits never imply all values are normal.
export function assessVitalLimits(values:Record<string,number>,limits:unknown):'unrated'|'within_configured_range'|'outside_configured_range'{
  if(!object(limits))return 'unrated';let all=true,outside=false;
  for(const [key,value] of Object.entries(values)){
    const limit=limits[key];if(!object(limit)){all=false;continue;}
    const min=limit.min,max=limit.max;
    if((min!==undefined&&(typeof min!=='number'||!Number.isFinite(min)))||(max!==undefined&&(typeof max!=='number'||!Number.isFinite(max)))||(typeof min==='number'&&typeof max==='number'&&min>max))return 'unrated';
    if(min===undefined&&max===undefined){all=false;continue;}
    if((typeof min==='number'&&value<min)||(typeof max==='number'&&value>max))outside=true;
  }
  return outside?'outside_configured_range':all&&Object.keys(values).length>0?'within_configured_range':'unrated';
}

export type VitalFollowUpPayload={measurementId:string;observedAt:string;observation:string;action:string;responsiblePerson:string;outcome:'ongoing'|'resolved';nextReviewAt:string};
function validFollowUpTime(value:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)||!Number.isFinite(Date.parse(value)))return false;
  const date=value.slice(0,10),[y,m,d]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)===date;
}
export function validateVitalFollowUp(payload:VitalFollowUpPayload,occurredAt:string|null,now=Date.now()):string|null{
  if(!uuid(payload.measurementId))return 'Messungsbezug ist ungültig.';
  if(!validFollowUpTime(payload.observedAt)||Date.parse(payload.observedAt)>now||(occurredAt!==null&&(!Number.isFinite(Date.parse(occurredAt))||Date.parse(payload.observedAt)<Date.parse(occurredAt))))return 'Kontrollzeitpunkt darf nicht vor der tatsächlichen Messung oder in der Zukunft liegen.';
  if(!['ongoing','resolved'].includes(payload.outcome))return 'Ergebnis ausdrücklich auswählen.';
  if(!payload.observation.trim()||!payload.action.trim()||!payload.responsiblePerson.trim()||payload.observation.length>2000||payload.action.length>2000||payload.responsiblePerson.length>200)return 'Beobachtung, tatsächliche Reaktion und zuständige Person vollständig dokumentieren.';
  if(payload.outcome==='ongoing'&&(!validFollowUpTime(payload.nextReviewAt)||Date.parse(payload.nextReviewAt)<=Date.parse(payload.observedAt)))return 'Bei weiterem Kontrollbedarf einen späteren Kontrollzeitpunkt festlegen.';
  if(payload.outcome==='resolved'&&payload.nextReviewAt!=='')return 'Beim dokumentierten Abschluss keinen offenen Kontrolltermin als erledigt übernehmen.';
  return null;
}
