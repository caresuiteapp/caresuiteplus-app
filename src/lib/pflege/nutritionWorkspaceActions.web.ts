import {cloneClientNativeOriginal} from '../clients/clientRecordNativeOriginal.web.ts';
import {nutritionEliminationOriginalIssue,nutritionReviewOriginalIssue,nutritionInstantMicros,nutritionStable,blankNutritionEliminationEntry,type NutritionEliminationEntry,type NutritionEliminationOriginal,type NutritionReviewOriginal} from './nutritionEliminationPacket.web.ts';

export const nutritionPlanningKinds=['nutrition_assessment','meal_support','drink_protocol','swallowing_support','stool_protocol','weight_followup'] as const;
/** New writes remain a technical open plan; historical actual facts use separate readers. */
export function nutritionPlanningWriteIssue(value:NutritionEliminationEntry):string|null{
 try{const entry=cloneClientNativeOriginal(value);
 if(!nutritionPlanningKinds.some(kind=>kind===entry.kind)||entry.execution.outcome!=='planned'||entry.lifecycle!=='open')return 'Neue Einträge bleiben auf offene Planung begrenzt. Tatsächliche Durchführung, Geräteversorgung und Abschluss bleiben gesperrt.';
 if(entry.occurredAt!==null||entry.decision.state!=='not_asked'||entry.decision.recordedAt!==null||entry.decision.reason!==''||entry.decision.consultation!==''||entry.execution.performedBy.length||entry.execution.result!==''||entry.intake.offered!==null||entry.intake.actual!==null||entry.elimination.input!==null||entry.elimination.output!==null||entry.elimination.complete||entry.elimination.profileId!==null)return 'Die offene Planung darf keine tatsächliche Entscheidung, Aufnahme, Ausfuhr oder Durchführung enthalten.';
 const blank=blankNutritionEliminationEntry(entry.kind,'');if(nutritionStable(entry.device)!==nutritionStable(blank.device)||nutritionStable(entry.enteral)!==nutritionStable(blank.enteral))return 'Neue offene Planung darf keine ungeklärten Geräte- oder enteralen Versorgungsangaben enthalten.';
 if(entry.followUp.state==='closed'||entry.followUp.taskId!==null||entry.followUp.closureEvidence!=='')return 'Ein neuer Folgeauftrag bleibt geplant; tatsächlicher Auftrag und Abschluss benötigen einen eigenen belegten Ablauf.';
 return null;
 }catch{return 'Die offene Planung ist unvollständig oder nicht verlustfrei lesbar.';}
}
type Plan=Pick<NutritionEliminationEntry,'planVersionId'|'measureId'|'visitId'|'assessmentId'|'planSnapshotSha256'|'kind'|'title'|'plannedAt'>;
export function nutritionPlanMatches(entry:NutritionEliminationEntry,plan:Plan):boolean{return(['planVersionId','measureId','visitId','assessmentId','planSnapshotSha256','kind','title','plannedAt'] as const).every(key=>entry[key]===plan[key]);}
type Workspace={stateFingerprint:string;prerequisites:{stateFingerprint:string;plans:readonly Plan[]};careOriginals:readonly unknown[];reviewOriginals:readonly unknown[]};
/** Validate the joined proof and bind every review to a real current or historical care event. */
export function nutritionWorkspaceIssue(value:unknown,scope:{tenantId:string;clientId:string},selected?:unknown):string|null{
 try{
  const workspace=cloneClientNativeOriginal(value) as Workspace;
  if(!workspace||typeof workspace.stateFingerprint!=='string'||workspace.stateFingerprint.length!==71||!/^sha256:[0-9a-f]{64}$/.test(workspace.stateFingerprint)||workspace.prerequisites?.stateFingerprint!==workspace.stateFingerprint||!Array.isArray(workspace.prerequisites.plans)||!Array.isArray(workspace.careOriginals)||!Array.isArray(workspace.reviewOriginals))return 'Gemeinsamer Bestandsnachweis für Planung, Pflege- und Prüfverlauf fehlt.';
  const roots=new Set<string>();
  for(const care of workspace.careOriginals){if(nutritionEliminationOriginalIssue(care,scope))return 'Ein Pflegeoriginal im gemeinsamen Bestand ist unvollständig.';const row=care as NutritionEliminationOriginal;if(roots.has(row.rootId.toLowerCase()))return 'Ein Pflegeoriginal ist im gemeinsamen Bestand doppelt.';roots.add(row.rootId.toLowerCase());}
  const reviews=new Set<string>();
  for(const review of workspace.reviewOriginals){if(nutritionReviewOriginalIssue(review,scope))return 'Ein Prüforiginal im gemeinsamen Bestand ist unvollständig.';const row=review as NutritionReviewOriginal;if(reviews.has(row.rootId.toLowerCase()))return 'Ein Prüforiginal ist im gemeinsamen Bestand doppelt.';reviews.add(row.rootId.toLowerCase());const care=(workspace.careOriginals as readonly NutritionEliminationOriginal[]).find(item=>item.rootId===row.careRootId);const event=care?.history.find(item=>item.id===row.careHeadId&&item.contentFingerprint===row.careFingerprint&&item.payload.kind===row.careKind);if(!event||nutritionInstantMicros(row.history[0].recordedAt)!<nutritionInstantMicros(event.recordedAt)!)return 'Die Prüfung ist nicht an eine aufbewahrte Pflegefassung mit ihrem ursprünglichen Zeitpunkt gebunden.';}
  if(selected&&!workspace.careOriginals.some(item=>nutritionStable(item)===nutritionStable(cloneClientNativeOriginal(selected))))return 'Die ausgewählte Pflegefassung gehört nicht zu diesem gemeinsamen Bestand.';
  return null;
 }catch{return 'Der gemeinsame Bestand ist unvollständig oder nicht lesbar.';}
}
