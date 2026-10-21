import {woundInstant} from '../pflege/woundCareDomain.ts';
export const continenceProfileKey='caresuite_continence_v1';
export const continenceProfileFields=['assessedAt','source','sourceName','urinarySituation','urinaryGoal','bowelSituation','bowelGoal','personPerspective','resources','urgeRecognition','mobilityTransfer','clothingHandling','toiletAccess','dailyHabits','nightSituation','aids','skinSituation','participation','supportNeeded','counseling','personDecision','coordination','reviewTriggers','nextReviewAt'] as const;
export type ContinenceProfile=Record<typeof continenceProfileFields[number],string>&{version:'1'};
export const emptyContinenceProfile=():ContinenceProfile=>({version:'1',...Object.fromEntries(continenceProfileFields.map(k=>[k,'']))} as ContinenceProfile);
/** Own descriptive profile. No licensed score, inferred diagnosis or default treatment. */
export function decodeContinenceProfile(value:unknown,complete=false,now=Date.now()):ContinenceProfile{
 if(!Number.isSafeInteger(now)||!value||typeof value!=='object'||Array.isArray(value))throw Error('Kontinenzprofilstruktur fehlt.');
 const v=value as Record<string,unknown>,keys=['version',...continenceProfileFields];
 if(Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(v,k))||v.version!=='1')throw Error('Kontinenzprofilfelder oder Fachversion passen nicht.');
 for(const k of continenceProfileFields)if(typeof v[k]!=='string'||(v[k] as string).length>4000)throw Error(`Kontinenzprofil: ${k} ist ungültig.`);
 const p=structuredClone(v) as ContinenceProfile;
 if(p.source&&!['person','reported','professional','not_possible'].includes(p.source))throw Error('Tatsächliche Befundquelle wählen.');
 if(['reported','professional'].includes(p.source)){if(complete&&!p.sourceName.trim())throw Error('Tatsächliche Auskunfts-/Fachperson fehlt.');}
 else if(p.sourceName)throw Error('Unpassende stellvertretende Quellenangabe entfernen.');
 const at=p.assessedAt?woundInstant(p.assessedAt):null,review=p.nextReviewAt?woundInstant(p.nextReviewAt):null;
 if(p.assessedAt&&(at===null||at>BigInt(now)*1000n))throw Error('Tatsächliche Erhebungszeit mit Zeitzone darf nicht in der Zukunft liegen.');
 if(p.nextReviewAt&&(review===null||(at!==null&&review<=at)))throw Error('Prüftermin mit Zeitzone muss nach der Erhebung liegen.');
 if(complete){
  for(const k of continenceProfileFields)if(k!=='sourceName'&&!p[k].trim())throw Error(`Kontinenzprofil: ${k} fehlt; tatsächliche Situation oder konkrete Erhebungsgrenze dokumentieren.`);
  if(review===null||review<=BigInt(now)*1000n)throw Error('Individuell vereinbarter nächster Kontinenzprüftermin fehlt oder ist überfällig.');
 }
 return p;
}
export function continenceProfileIssue(key:unknown,value:unknown,complete=false,now=Date.now()):string|null{
 if(key!==continenceProfileKey)return complete?'Eigenes strukturiertes Kontinenzprofil fehlt; vorhandene andere Vertiefung bleibt erhalten.':null;
 try{decodeContinenceProfile(value,complete,now);return null;}catch(e){return e instanceof Error?e.message:'Kontinenzprofil prüfen.';}
}
