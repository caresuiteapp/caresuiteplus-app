export type WoundRequest={action:'create'|'assessment';subjectId:string;dataJson:string};
export type WoundCaseDraft={bodyLocation:string;side:string;woundType:string;etiology:string;onsetDate:string;onsetUnknownReason:string;acquiredWhere:string;description:string;basisStatus:string;basisReference:string;physician:string;carePlan:string;nextReviewAt:string;reviewStatus:string;reviewPendingReason:string};
export type WoundAssessmentDraft={observedAt:string;measurementMethod:string;lengthState:string;lengthCm:string;lengthReason:string;widthState:string;widthCm:string;widthReason:string;depthState:string;depthCm:string;depthReason:string;woundBed:string;exudate:string;odor:string;woundEdge:string;surroundingSkin:string;painState:string;painScore:string;painReason:string;infectionObservation:string;personalImpact:string;preferences:string;selfManagement:string;actualAction:string;response:string;nextReviewAt:string;reviewStatus:string;reviewPendingReason:string};
export const emptyWoundCase=():WoundCaseDraft=>({bodyLocation:'',side:'',woundType:'',etiology:'',onsetDate:'',onsetUnknownReason:'',acquiredWhere:'',description:'',basisStatus:'',basisReference:'',physician:'',carePlan:'',nextReviewAt:'',reviewStatus:'',reviewPendingReason:''});
export const emptyWoundAssessment=():WoundAssessmentDraft=>({observedAt:'',measurementMethod:'',lengthState:'',lengthCm:'',lengthReason:'',widthState:'',widthCm:'',widthReason:'',depthState:'',depthCm:'',depthReason:'',woundBed:'',exudate:'',odor:'',woundEdge:'',surroundingSkin:'',painState:'',painScore:'',painReason:'',infectionObservation:'',personalImpact:'',preferences:'',selfManagement:'',actualAction:'',response:'',nextReviewAt:'',reviewStatus:'',reviewPendingReason:''});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function day(v:string){const m=/^([1-9]\d{3})-(\d{2})-(\d{2})$/.exec(v);return !!m&&new Date(Date.UTC(+m[1],+m[2]-1,+m[3])).toISOString().slice(0,10)===v;}
function berlinDay(now:number){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-');}
function instant(v:string){return /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v)&&day(v.slice(0,10))&&Number.isFinite(Date.parse(v));}
export function woundDecimal(v:string):number|null{if(!/^\d+(?:[.,]\d+)?$/.test(v.trim()))return null;const n=Number(v.trim().replace(',','.'));return Number.isFinite(n)&&n<=1000000?n:null;}
export function validateWoundRequest(payload:unknown,now=Date.now()):string|null{
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return 'Ungültige Wundanfrage.';
 const p=payload as Record<string,unknown>;
 if(Object.keys(p).some(k=>!['action','subjectId','dataJson'].includes(k))||!uuid(p.subjectId)||!['create','assessment'].includes(String(p.action))||typeof p.dataJson!=='string'||p.dataJson.length>40000)return 'Wundbezug und Anfrage prüfen.';
 let data:unknown;try{data=JSON.parse(p.dataJson);}catch{return 'Wundangaben sind ungültig.';}
 if(!data||typeof data!=='object'||Array.isArray(data))return 'Strukturierte Wundangaben erforderlich.';
 const d=data as Record<string,string>,template=p.action==='create'?emptyWoundCase():emptyWoundAssessment();
 if(Object.keys(d).length!==Object.keys(template).length||Object.keys(d).some(k=>!Object.hasOwn(template,k)||typeof d[k]!=='string'||d[k].length>2000))return 'Wundangaben fehlen oder sind zu umfangreich.';
 if(d.reviewStatus==='scheduled'){if(!instant(d.nextReviewAt)||Date.parse(d.nextReviewAt)<=now||d.reviewPendingReason.trim())return 'Einen tatsächlich vereinbarten zukünftigen Kontrolltermin angeben.';}
 else if(d.reviewStatus==='pending'){if(d.nextReviewAt||!d.reviewPendingReason.trim())return 'Offene Terminabstimmung ohne erfundenen Termin mit tatsächlichem Grund dokumentieren.';}
 else return 'Kontrolltermin oder offene Terminabstimmung ausdrücklich dokumentieren.';
 if(p.action==='create'){
  if(['bodyLocation','woundType','etiology','acquiredWhere','description'].some(k=>!d[k].trim()))return 'Lokalisation, fachliche Einordnung, Entstehung und Beschreibung dokumentieren; Unklarheiten ausdrücklich benennen.';
  if(!['left','right','midline','bilateral','not_applicable'].includes(d.side))return 'Körperseite ausdrücklich auswählen.';
  if(d.onsetDate){if(!day(d.onsetDate)||d.onsetDate>berlinDay(now)||d.onsetUnknownReason.trim())return 'Entstehungsdatum prüfen; unbekanntes Datum nicht gleichzeitig bestätigen.';}
  else if(!d.onsetUnknownReason.trim())return 'Bei unbekanntem Entstehungsdatum den tatsächlichen Kenntnisstand angeben.';
  if(!['documented','pending','not_required'].includes(d.basisStatus)||!d.basisReference.trim()||(d.basisStatus==='documented'&&!d.physician.trim()))return 'Ärztliche Grundlage oder ihren offenen/begründet nicht erforderlichen Status dokumentieren.';
 }else{
  if(!instant(d.observedAt)||Date.parse(d.observedAt)>now)return 'Tatsächlichen Assessmentzeitpunkt prüfen.';
  for(const key of ['length','width','depth']){
   if(d[key+'State']==='measured'){if(woundDecimal(d[key+'Cm'])===null||d[key+'Reason'].trim())return 'Gemessene Größe in cm angeben; fehlende Messung nicht als Null ersetzen.';}
   else if(d[key+'State']==='not_measurable'){if(d[key+'Cm'].trim()||!d[key+'Reason'].trim())return 'Nicht messbare Größe ohne Zahlenwert mit tatsächlichem Grund dokumentieren.';}
   else return 'Messbarkeit jeder Größe ausdrücklich auswählen.';
  }
  if(['measurementMethod','woundBed','exudate','odor','woundEdge','surroundingSkin','infectionObservation','personalImpact','preferences','selfManagement','actualAction','response'].some(k=>!d[k].trim()))return 'Wundsituation, Messmethode, persönliche Auswirkungen, tatsächliche Reaktion und Ergebnis vollständig dokumentieren.';
  if(d.painState==='NRS'){if(!/^\d{1,2}$/.test(d.painScore)||+d.painScore>10||d.painReason.trim())return 'NRS ausschließlich als ausdrücklich erhobene ganze Zahl 0–10 angeben.';}
  else if(d.painState==='not_assessable'){if(d.painScore.trim()||!d.painReason.trim())return 'Nicht beurteilbaren Schmerz ohne erfundenen Score begründen.';}
  else return 'Schmerzerhebung ausdrücklich auswählen.';
 }
 return null;
}
