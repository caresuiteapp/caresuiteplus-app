import {cloneClientNativeOriginal,freezeClientNativeOriginal,type ClientNativeRow} from '@/lib/clients/clientRecordNativeOriginal.web';
import {woundUuid,woundInstant} from '@/lib/pflege/woundCareDomain';

export type InventoryStatsIssue=Readonly<{kind:'item'|'assignment'|'damage';id:string;reason:string}>;
export type InventoryStatsReturn=Readonly<{id:string;itemId:string;recipientEmployeeId:string}>;
export type InventoryDashboardStatsWeb=Readonly<{
 totalItems:number;availableItems:number;plannedAssignments:number;issuedAssignments:number;overdueReturns:readonly InventoryStatsReturn[];
 openDamageIds:readonly string[];clarification:readonly InventoryStatsIssue[];clockMillis:number;
}>;
export type InventoryDashboardStatsResultWeb=Readonly<{ok:true;data:InventoryDashboardStatsWeb}|{ok:false;error:string}>;
const own=(row:ClientNativeRow,key:string)=>Object.hasOwn(row,key)?row[key]:undefined;
const plain=(v:unknown):v is ClientNativeRow=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const blocked=()=>Error('Der gelieferte Inventarbestand ist im eigenen Mandantenbezug nicht vollständig prüfbar.');
/** Supplied inventory TIMESTAMPTZ may use a native space separator. The raw string is never rewritten. */
function instant(value:unknown):bigint|null{return typeof value==='string'?woundInstant(value.replace(' ','T')):null;}
function rows(value:unknown,tenantId:string,kind:'items'|'assignments'|'damage'):ClientNativeRow[]{
 if(!Array.isArray(value))throw blocked();const seen=new Set<string>();
 for(const row of value){
  if(!plain(row)||!Object.hasOwn(row,'id')||!woundUuid(row.id)||!Object.hasOwn(row,'tenantId')||row.tenantId!==tenantId)throw blocked();
  const id=row.id.toLowerCase();if(seen.has(id))throw blocked();seen.add(id);
  const required=kind==='items'?['categoryId']:kind==='assignments'?['itemId','recipientEmployeeId']:['itemId'];
  if(required.some(key=>!Object.hasOwn(row,key)||!woundUuid(row[key])))throw blocked();
  const optional=kind==='items'?['locationId','vehicleRefId']:kind==='assignments'?['responsibleEmployeeId','issuedByProfileId']:['assignmentId','employeeId','reportedByProfileId'];
  if(optional.some(key=>Object.hasOwn(row,key)&&row[key]!==undefined&&row[key]!==null&&!woundUuid(row[key])))throw blocked();
 }
 return value;
}
const eligible=['issued','acknowledged','return_requested','partially_returned','overdue','disputed'];
const terminal=['returned','lost','archived'];
const itemStatuses=['available','assigned','in_use','reserved','maintenance','damaged','lost','returned','decommissioned','archived'];
const conditions=['new','very_good','good','used','damaged','unusable','lost','unknown'];
const usableConditions=['new','very_good','good','used'];
/** Pure classification of a delivered DTO pool, not a native authority, atomic/full history or medical release.
 * Every supplied row is checked before any positive statistic. Shared mapper losses cannot be recovered here. */
export function buildInventoryDashboardStatsWeb(input:unknown,tenantId:unknown,clockMillis:number=Date.now()):InventoryDashboardStatsResultWeb{
 try{
  if(!woundUuid(tenantId)||!Number.isSafeInteger(clockMillis)||Math.abs(clockMillis)>8640000000000000)throw blocked();
  const whole=cloneClientNativeOriginal(input);if(!plain(whole)||!['items','assignments','damage'].every(key=>Object.hasOwn(whole,key)))throw blocked();
  const items=rows(whole.items,tenantId,'items'),assignments=rows(whole.assignments,tenantId,'assignments'),damage=rows(whole.damage,tenantId,'damage');
  const itemIds=new Set(items.map(row=>String(row.id).toLowerCase())),assignmentMap=new Map(assignments.map(row=>[String(row.id).toLowerCase(),row]));
  const clarification:InventoryStatsIssue[]=[],overdueReturns:InventoryStatsReturn[]=[],openDamageIds:string[]=[];
  const add=(kind:InventoryStatsIssue['kind'],row:ClientNativeRow,reason:string)=>clarification.push({kind,id:String(row.id),reason});
  let availableItems=0,plannedAssignments=0,issuedAssignments=0;const now=BigInt(clockMillis)*1000n;
  for(const row of items){
   const status=own(row,'status'),condition=own(row,'condition');
   if(typeof status!=='string'||!itemStatuses.includes(status)||typeof condition!=='string'||!conditions.includes(condition)){add('item',row,'Gespeicherter Status oder Zustand ungeklärt');continue;}
   if(status==='available'){if(usableConditions.includes(condition))availableItems++;else add('item',row,'Verfügbarkeit und gespeicherter Zustand widersprechen sich');}
  }
  for(const row of assignments){
   const status=own(row,'status'),issuedRaw=own(row,'issuedAt'),issued=instant(issuedRaw);
   if(!itemIds.has(String(row.itemId).toLowerCase())){add('assignment',row,'Inventarposten nicht im gelieferten Bestand enthalten');continue;}
   if(status==='planned'){
    if(issuedRaw===undefined||issuedRaw===null||issuedRaw==='')plannedAssignments++;
    else add('assignment',row,'Geplante Zuordnung mit ungeklärtem Ausgabebezug');
    continue;
   }
   // BOTH actual Shared producers use this status: complete damaged return AND damage report without return.
   if(status==='damaged_returned'){add('assignment',row,'Beschädigter Rückgabestatus ohne eindeutigen Retourbeleg');continue;}
   if(typeof status==='string'&&terminal.includes(status))continue;
   if(typeof status!=='string'||!eligible.includes(status)){add('assignment',row,'Gespeicherter Zuordnungsstatus ungeklärt');continue;}
   if(issued===null||issued>now){add('assignment',row,'Tatsächlicher Ausgabebezug nicht bestätigt');continue;}
   issuedAssignments++;
   const required=own(row,'returnRequired'),dueRaw=own(row,'expectedReturnAt'),due=instant(dueRaw);
   if(typeof required!=='boolean'){add('assignment',row,'Rückgabepflicht ungeklärt');continue;}
   if(!required){if(status==='overdue')add('assignment',row,'Gespeicherte Überfälligkeit ohne bestätigte Rückgabepflicht');continue;}
   const explicitlyOverdue=status==='overdue';
   if(dueRaw!==undefined&&dueRaw!==null&&dueRaw!==''&&due===null){add('assignment',row,'Gespeicherte Rückgabefrist ungeklärt');continue;}
   if(due!==null&&due<issued){add('assignment',row,'Rückgabefrist liegt vor gespeicherter Ausgabe');continue;}
   if(explicitlyOverdue&&due===null){add('assignment',row,'Gespeicherte Überfälligkeit ohne bestätigte Rückgabefrist');continue;}
   if(explicitlyOverdue&&due!==null&&due>=now){add('assignment',row,'Gespeicherte Überfälligkeit und vereinbarte Frist widersprechen sich');continue;}
   if(due!==null&&due<now)overdueReturns.push({id:String(row.id),itemId:String(row.itemId),recipientEmployeeId:String(row.recipientEmployeeId)});
  }
  for(const row of damage){
   const assignmentId=own(row,'assignmentId'),reportType=own(row,'reportType');
   if(typeof reportType!=='string'||!['damage','loss','missing_return'].includes(reportType)){add('damage',row,'Gespeicherte Meldungsart ungeklärt');continue;}
   const linkedAssignment=typeof assignmentId==='string'?assignmentMap.get(assignmentId.toLowerCase()):null;
   if(!itemIds.has(String(row.itemId).toLowerCase())||typeof assignmentId==='string'&&(!linkedAssignment||String(linkedAssignment.itemId).toLowerCase()!==String(row.itemId).toLowerCase())){add('damage',row,'Meldungsbezug nicht im gelieferten Bestand enthalten');continue;}
   const resolved=own(row,'resolvedAt');
   if(resolved===null)openDamageIds.push(String(row.id));
   else if(instant(resolved)===null||instant(resolved)!>now)add('damage',row,'Gespeicherter Auflösungszeitpunkt ungeklärt');
  }
  return freezeClientNativeOriginal({ok:true,data:{totalItems:items.length,availableItems,plannedAssignments,issuedAssignments,overdueReturns,openDamageIds,clarification,clockMillis}});
 }catch{return{ok:false,error:blocked().message};}
}
