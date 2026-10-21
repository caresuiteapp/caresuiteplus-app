import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import * as native from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';import {woundUuid,woundInstant} from '../../src/lib/pflege/woundCareDomain.ts';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes as strip} from 'node:module';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),hashes={};
const read=p=>{const s=readFileSync(join(root,p),'utf8'),hash=createHash('sha256').update(s).digest('hex');if(hashes[p])assert.equal(hashes[p],hash,'Source changed: '+p);hashes[p]=hash;return s};
const whole=(p,names,deps={})=>new Function(...Object.keys(deps),strip(read(p).replace(/^import[\s\S]*?;\n/gm,'').replace(/^export\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];\s*/gm,'').replace(/\bexport /g,''))+';return {'+names.join(',')+'};')(...Object.values(deps));
const roles=whole('src/lib/permissions/staticRolePermissions.ts',['getPermissionsForRole','PERMISSION_LABELS','PERMISSION_DENIED_MESSAGES']);const check=whole('src/lib/permissions/check.ts',['permissionError','checkPermissionWithList'],roles);const enforcement=whole('src/lib/permissions/enforce.ts',['enforcePermission'],check);
const permission=whole('src/lib/inventory/inventoryPermissions.ts',['enforceInventoryPermission','INVENTORY_VIEW','INVENTORY_AUDIT_VIEW','INVENTORY_MANAGE_ITEMS','INVENTORY_ISSUE','INVENTORY_RETURN_MANAGE','PORTAL_EMPLOYEE_INVENTORY_VIEW'],enforcement);
const mappingNames=['mapDeviceManagementProfile','mapInventoryAssignment','mapInventoryCategory','mapInventoryDamageReport','mapInventoryItem','mapInventoryLocation','mapInventoryReturnProtocol','mapInventoryReturnRecord'];const mapper=whole('src/lib/inventory/inventoryMapper.ts',mappingNames);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),tenant=id(1);let tables={},calls=[],writes=0;const now='2026-10-11T12:00:00.123Z';class ClockDate extends Date{constructor(value){super(arguments.length?value:now)}}
const sdk={from(table){const filters=[];let selection='*';const q={select:v=>{selection=v;return q},eq:(key,value)=>{filters.push([key,value]);return q},order:()=>q,is:(key,value)=>{filters.push([key,value]);return q},maybeSingle:()=>q,single:()=>q,then(ok,no){calls.push({table,selection,filters});const data=(tables[table]??[]).filter(row=>filters.every(([k,v])=>row[k]===v));return Promise.resolve({data,error:null,status:200}).then(ok,no)},insert(){writes++;throw Error('No write permitted in this probe')},update(){writes++;throw Error('No write permitted in this probe')}};return q},rpc(){writes++;throw Error('No RPC')}};
const repo=whole('src/lib/inventory/inventoryRepository.supabase.ts',['inventorySupabaseRepository'],{getSupabaseClient:()=>sdk,fromUnknownTable:(db,table)=>db.from(table),toGermanSupabaseError:()=> 'Controlled native error',SERVICE_ERRORS:{supabaseUnavailable:'Unavailable'},buildDefaultCategoryRows:()=>{throw Error('No seed')},...mapper});
const service=whole('src/lib/inventory/inventoryService.ts',['fetchInventoryItems','fetchInventoryAssignments','fetchInventoryDamageReports'],{guardServiceTenant:t=>t===tenant?null:{ok:false,error:'Controlled own tenant'},getSupabaseClient:()=>sdk,toGermanSupabaseError:()=> 'Controlled native error',fromUnknownTable:(db,table)=>db.from(table),inventorySupabaseRepository:repo.inventorySupabaseRepository,inventoryDemoRepository:{},peekInventoryAuditEvents:()=>{throw Error('No Demo')},getServiceMode:()=> 'supabase',...permission,INVENTORY_PREPARED_MESSAGE:'Not ready',isInventoryLiveReady:()=>true});
const dashboard=read('src/screens/inventory/InventoryDashboardScreen.tsx'),start=dashboard.indexOf('  const items = query.data?.items'),end=dashboard.indexOf('\n  return (',start);assert.ok(start>=0&&end>start);const derive=new Function('query','c','Date',strip(dashboard.slice(start,end))+';return {items,assignments,openAssignments,overdue,openDamage,kpis,itemMap};');
const emptyMatch=dashboard.match(/\{(overdue\.length === 0 && openDamage\.length === 0) \?/);assert.ok(emptyMatch);const empty=new Function('overdue','openDamage','return '+emptyMatch[1]);
const row=(patch={})=>({id:id(10),tenant_id:tenant,category_id:id(4),inventory_categories:{group_key:'keys_access'},name:'Dienstschlüssel',status:'assigned',condition:'good',created_at:'2026-10-11 10:00:00.123457+02:00',updated_at:'2026-10-11 10:00:00.123458+02:00',...patch});
const assignment=(patch={})=>({id:id(20),tenant_id:tenant,item_id:id(10),recipient_employee_id:id(3),issued_by_profile_id:id(2),issued_at:null,expected_return_at:'2026-10-10 10:00:00.123457+02:00',acknowledged_at:null,status:'planned',issue_condition:'good',return_required:true,created_at:'2026-10-11 10:00:00.123457+02:00',updated_at:'2026-10-11 10:00:00.123458+02:00',...patch});

const {buildInventoryDashboardStatsWeb:stats}=whole('src/lib/inventory/inventoryDashboardStats.web.ts',['buildInventoryDashboardStatsWeb'],{...native,woundUuid,woundInstant});
const clock=Date.parse(now);
const dataset=(itemPatch={},assignmentPatch={})=>({items:[mapper.mapInventoryItem(row(itemPatch))],assignments:[mapper.mapInventoryAssignment(assignment(assignmentPatch))],damage:[]});
const good=input=>{const before=structuredClone(input),r=stats(input,tenant,clock);assert.equal(r.ok,true);assert.deepEqual(input,before);assert.ok(Object.isFrozen(r.data));return r.data};
const damage=(patch={})=>({id:id(30),tenantId:tenant,itemId:id(10),assignmentId:null,employeeId:null,reportType:'damage',description:'Gespeicherte Meldung',condition:'damaged',reportedAt:'2026-10-11 10:00:00.123457+02:00',reportedByProfileId:id(2),resolvedAt:null,createdAt:'2026-10-11 10:00:00.123457+02:00',...patch});
async function fetched(items,assignments,damageRows=[]){tables={inventory_items:items,inventory_assignments:assignments,inventory_damage_reports:damageRows};calls=[];const nativeBefore=structuredClone(tables),results=await Promise.all([service.fetchInventoryItems(tenant,'business_admin'),service.fetchInventoryAssignments(tenant,'business_admin'),service.fetchInventoryDamageReports(tenant,'business_admin')]);results.forEach(r=>assert.equal(r.ok,true));assert.deepEqual(tables,nativeBefore);return{items:results[0].data,assignments:results[1].data,damage:results[2].data}}

for(const [status,planned,issued,due,unclear]of [['planned',1,0,0,0],['issued',0,1,1,0],['acknowledged',0,1,1,0],['return_requested',0,1,1,0],['partially_returned',0,1,1,0],['overdue',0,1,1,0],['disputed',0,1,1,0],['returned',0,0,0,0],['damaged_returned',0,0,0,1],['lost',0,0,0,0],['archived',0,0,0,0]])test(`Actual native ${status} keeps planning/issuance/return due/clarification separate`,async()=>{
 const data=await fetched([row()],[assignment({status,issued_at:status==='planned'?null:'2026-10-09T08:00:00.123457Z'})]),v=good(data);assert.equal(v.plannedAssignments,planned);assert.equal(v.issuedAssignments,issued);assert.equal(v.overdueReturns.length,due);assert.equal(v.clarification.length,unclear);assert.equal(writes,0);assert.equal(data.assignments[0].updatedAt,'2026-10-11 10:00:00.123458+02:00');
});
for(const [label,issuedAt]of [['missing',undefined],['null',null],['empty',''],['invalid','2026-02-30T10:00:00Z'],['legacyAlias','yesterday'],['dateOnly','2026-10-09'],['object',{secret:'no serialization'}],['future','2026-10-12T10:00:00.123457Z']])test(`Acknowledged ${label} issue evidence never confirms physical issuance or due`,()=>{
 const data=dataset({}, {status:'acknowledged'});if(issuedAt===undefined)delete data.assignments[0].issuedAt;else data.assignments[0].issuedAt=issuedAt;
 const v=good(data);assert.equal(v.issuedAssignments,0);assert.equal(v.overdueReturns.length,0);assert.equal(v.clarification.length,1);assert.equal(JSON.stringify(v).includes('secret'),false);
});
test('Planned with supplied issue evidence is a contradiction, not a completed issuance',()=>{
 const v=good(dataset({}, {status:'planned',issued_at:'2026-10-09T08:00:00.123457Z'}));assert.equal(v.plannedAssignments,0);assert.equal(v.issuedAssignments,0);assert.equal(v.overdueReturns.length,0);assert.equal(v.clarification.length,1);
});
test('Return obligation false prevents date-derived overdue but does not erase valid recorded issuance',()=>{
 const v=good(dataset({}, {status:'issued',issued_at:'2026-10-09T08:00:00.123457Z',return_required:false}));assert.equal(v.issuedAssignments,1);assert.equal(v.overdueReturns.length,0);assert.equal(v.clarification.length,0);
});
test('Saved overdue without required return remains contradictory instead of minting a return grant',()=>{
 const v=good(dataset({}, {status:'overdue',issued_at:'2026-10-09T08:00:00.123457Z',return_required:false}));assert.equal(v.issuedAssignments,1);assert.equal(v.overdueReturns.length,0);assert.equal(v.clarification.length,1);
});
for(const required of [undefined,null,'false',0])test(`Unknown supplied return obligation ${String(required)} stays unresolved, never Boolean-coerced`,()=>{
 const data=dataset({}, {status:'issued',issued_at:'2026-10-09T08:00:00.123457Z'});if(required===undefined)delete data.assignments[0].returnRequired;else data.assignments[0].returnRequired=required;
 const v=good(data);assert.equal(v.issuedAssignments,1);assert.equal(v.overdueReturns.length,0);assert.equal(v.clarification.length,1);
});
for(const [raw,due]of [['2026-10-11T12:00:00.122999Z',1],['2026-10-11T12:00:00.123000Z',0],['2026-10-11T12:00:00.123001Z',0],['2026-10-11 14:00:00.122999+02:00',1],['2026-10-11 14:00:00.123001+02:00',0],['2026-10-11T08:00:00.122999-04:00',1]])test(`Exact raw return agreement ${raw} retains microseconds/offset and separate clock precision`,()=>{
 const input=dataset({}, {status:'issued',issued_at:'2026-10-09T08:00:00.123457Z',expected_return_at:raw}),v=good(input);assert.equal(v.overdueReturns.length,due);assert.equal(input.assignments[0].expectedReturnAt,raw);assert.equal(v.clockMillis,clock);
});
for(const [description,value,unclear]of [['missing',undefined,0],['null',null,0],['empty','',0],['badcalendar','2026-02-30T10:00:00Z',1],['badzone','2026-10-10T10:00:00',1],['legacy','later',1],['object',{raw:'future'},1]])test(`Expected return ${description} never becomes completion or an invented deadline`,()=>{
 const data=dataset({}, {status:'issued',issued_at:'2026-10-09T08:00:00.123457Z'});if(value===undefined)delete data.assignments[0].expectedReturnAt;else data.assignments[0].expectedReturnAt=value;const v=good(data);assert.equal(v.issuedAssignments,1);assert.equal(v.overdueReturns.length,0);assert.equal(v.clarification.length,unclear);
});
test('Agreement earlier than recorded issuance and saved overdue with future agreement remain contradictions',()=>{
 let v=good(dataset({}, {status:'issued',issued_at:'2026-10-10T08:00:00Z',expected_return_at:'2026-10-09T08:00:00Z'}));assert.equal(v.overdueReturns.length,0);assert.equal(v.clarification.length,1);
 v=good(dataset({}, {status:'overdue',issued_at:'2026-10-09T08:00:00Z',expected_return_at:'2026-10-12T08:00:00Z'}));assert.equal(v.overdueReturns.length,0);assert.equal(v.clarification.length,1);
});
for(const raw of [undefined,null,''])test(`Saved overdue with missing agreement ${String(raw)} remains a distinct diagnostic, never calculated due`,()=>{
 const data=dataset({}, {status:'overdue',issued_at:'2026-10-09T08:00:00Z',expected_return_at:null});if(raw===undefined)delete data.assignments[0].expectedReturnAt;else data.assignments[0].expectedReturnAt=raw;
 const v=good(data);assert.equal(v.overdueReturns.length,0);assert.equal(v.clarification.length,1);assert.equal(v.issuedAssignments,1);assert.equal(data.assignments[0].status,'overdue');
});
for(const [condition,available,unclear]of [['new',1,0],['very_good',1,0],['good',1,0],['used',1,0],['damaged',0,1],['unusable',0,1],['lost',0,1],['unknown',0,1]])test(`Native available/${condition} never silently overrides stored condition`,()=>{
 const v=good(dataset({status:'available',condition},{status:'returned'}));assert.equal(v.availableItems,available);assert.equal(v.clarification.length,unclear);
});
for(const status of ['assigned','in_use','reserved','maintenance','damaged','lost','returned','decommissioned','archived'])test(`Native ${status} never becomes available because condition is good`,()=>{
 const v=good(dataset({status,condition:'good'},{status:'returned'}));assert.equal(v.availableItems,0);
});
for(const field of ['status','condition'])for(const value of [undefined,null,'',{},'legacyUnknown'])test(`Unknown item ${field}/${String(value)} stays unresolved without mapper/default reconstruction`,()=>{
 const data=dataset({}, {status:'returned'});if(value===undefined)delete data.items[0][field];else data.items[0][field]=value;const v=good(data);assert.equal(v.availableItems,0);assert.equal(v.clarification.length,1);
});
test('Both actual Shared producers use damaged_returned, so neither case can mint an automatic terminal conclusion',()=>{
 const source=read('src/lib/inventory/inventoryRepository.supabase.ts'),start=source.indexOf('    let newAssignmentStatus = assignment.status;'),end=source.indexOf('\n    const { data, error } =',start);const classify=new Function('assignment','itemResult','capture',strip(source.slice(start,end))+';return newAssignmentStatus;');
 const afterDamage=source.slice(source.indexOf('  async reportDamage(')).match(/\.update\(\{ status: ([^\n]+) \}\)/),patch=new Function('report','return '+afterDamage[1]);assert.equal(classify({status:'issued'},{data:{status:'assigned'}},{returned:true,complete:true,condition:'damaged'}),'damaged_returned');assert.equal(patch({reportType:'damage'}),'damaged_returned');
 for(const state of [classify({status:'issued'},{data:{status:'assigned'}},{returned:true,complete:true,condition:'damaged'}),patch({reportType:'damage'})]){const v=good(dataset({}, {status:state,issued_at:'2026-10-09T08:00:00Z'}));assert.equal(v.issuedAssignments,0);assert.equal(v.overdueReturns.length,0);assert.equal(v.clarification.length,1)}assert.equal(writes,0);
});
for(const kind of ['items','assignments','damage'])test(`Hidden foreign ${kind} row blocks the whole supplied statistic before any partial count`,()=>{
 const data=dataset();data.damage=[damage()];data[kind].push({...data[kind][0],id:id(99),tenantId:id(88)});const r=stats(data,tenant,clock);assert.equal(r.ok,false);assert.equal(Object.hasOwn(r,'data'),false);
});
for(const [kind,field]of [['items','id'],['items','tenantId'],['items','categoryId'],['assignments','id'],['assignments','tenantId'],['assignments','itemId'],['assignments','recipientEmployeeId'],['damage','id'],['damage','tenantId'],['damage','itemId']])test(`Mandatory own native ${kind}/${field} cannot come from missing or inherited data`,()=>{
 const data=dataset();data.damage=[damage()];const proto=Object.prototype;const old=Object.getOwnPropertyDescriptor(proto,field);try{const value=data[kind][0][field];delete data[kind][0][field];Object.defineProperty(proto,field,{value,configurable:true});assert.equal(stats(data,tenant,clock).ok,false)}finally{if(old)Object.defineProperty(proto,field,old);else delete proto[field]}
});
for(const kind of ['items','assignments','damage'])test(`Duplicate native ${kind} UUID rejects whole source, not a fabricated extra asset`,()=>{
 const data=dataset();data.damage=[damage()];data[kind].push({...data[kind][0]});assert.equal(stats(data,tenant,clock).ok,false);
});
test('Casefolded duplicate ids are still one native identity and cannot evade duplicate denial',()=>{
 const data=dataset();const key='abcdefab-cdef-4567-89ab-cdefabcdefab';data.items=[{...data.items[0],id:key},{...data.items[0],id:key.toUpperCase()}];assert.equal(stats(data,tenant,clock).ok,false);
});
for(const value of ['tenant-demo',null,undefined,{},''])test(`Invalid current native tenant ${String(value)} cannot authorize a statistic`,()=>assert.equal(stats(dataset(),value,clock).ok,false));
for(const value of [NaN,Infinity,1.5,'2026-10-11',8640000000000001])test(`Invalid supplied clock ${String(value)} cannot infer a deadline`,()=>assert.equal(stats(dataset(),tenant,value).ok,false));
for(const shape of ['getter','hidden','symbol','sparse','extraArrayKey','class'])test(`Whole DTO ${shape} is rejected descriptor-first with zero getter calls`,()=>{
 const data=dataset();let gets=0;if(shape==='getter')Object.defineProperty(data.items[0],'extra',{enumerable:true,get(){gets++;return'private'}});if(shape==='hidden')Object.defineProperty(data.items[0],'extra',{value:'private'});if(shape==='symbol')data.items[0][Symbol('extra')]='private';if(shape==='sparse')data.assignments=Array(2);if(shape==='extraArrayKey')data.items.extra='private';if(shape==='class')data.items[0].extra=new(class{})();assert.equal(stats(data,tenant,clock).ok,false);assert.equal(gets,0);
});
test('Unlisted item reference remains a diagnostic, not an inferred completed or foreign-issued asset',()=>{
 const data=dataset();data.assignments[0].itemId=id(99);const v=good(data);assert.equal(v.plannedAssignments,0);assert.equal(v.issuedAssignments,0);assert.equal(v.overdueReturns.length,0);assert.equal(v.clarification.length,1);
});
test('Unknown status cannot be interpreted as issued, returned or planned',()=>{
 const data=dataset();data.assignments[0].status='legacyUnknown';const v=good(data);assert.equal(v.plannedAssignments,0);assert.equal(v.issuedAssignments,0);assert.equal(v.clarification.length,1);
});
for(const [resolved,open,unclear]of [[null,1,0],[undefined,0,1],['',0,1],['2026-10-10T10:00:00.123457Z',0,0],['2026-10-12T10:00:00Z',0,1],['not-a-time',0,1]])test(`Damage resolution ${String(resolved)} stays separate from actual asset or clinical release`,()=>{
 const data=dataset();data.damage=[damage({resolvedAt:resolved})];const v=good(data);assert.equal(v.openDamageIds.length,open);assert.equal(v.clarification.length,unclear);
});
test('Missing damage reference and unknown report kind remain honest diagnostics',()=>{
 const data=dataset();data.damage=[damage({assignmentId:id(99)}),damage({id:id(31),reportType:'legacyUnknown'})];const v=good(data);assert.equal(v.openDamageIds.length,0);assert.equal(v.clarification.length,2);
});
test('Frozen full DTO unknown extras/raw authors/microseconds/order remain unchanged and private',()=>{
 const data=dataset({}, {status:'issued',issued_at:'2026-10-09 10:00:00.123457+02:00'});data.items[0].unknown={raw:'PRIVATE_EXTRA',order:[3,1],actor:id(2)};native.freezeClientNativeOriginal(data);const before=structuredClone(data),v=good(data);assert.deepEqual(data,before);assert.equal(data.assignments[0].issuedAt,'2026-10-09 10:00:00.123457+02:00');assert.equal(JSON.stringify(v).includes('PRIVATE_EXTRA'),false);
});
test('Genuinely empty delivered arrays stay empty without creating a return, closed task or positive availability',()=>{
 const v=good({items:[],assignments:[],damage:[]});assert.equal(v.totalItems,0);assert.equal(v.availableItems,0);assert.equal(v.plannedAssignments,0);assert.equal(v.issuedAssignments,0);assert.deepEqual(v.overdueReturns,[]);assert.deepEqual(v.clarification,[]);assert.equal(Object.hasOwn(v,'allTasksDone'),false);
});

test('Actual independent Item/Assignment damage FKs that contradict the delivered assignment pair remain diagnostic',()=>{
 const data=dataset();data.items.push({...data.items[0],id:id(11)});data.damage=[damage({itemId:id(11),assignmentId:id(20)})];const before=structuredClone(data),v=good(data);assert.equal(v.openDamageIds.length,0);assert.equal(v.clarification.length,1);assert.deepEqual(data,before);
});
test('Matching delivered damage item/assignment pair can remain open without inferring return or task completion',()=>{
 const data=dataset();data.damage=[damage({itemId:id(10),assignmentId:id(20)})];const v=good(data);assert.deepEqual(v.openDamageIds,[id(30)]);assert.equal(v.clarification.length,0);assert.equal(v.issuedAssignments,0);assert.equal(v.plannedAssignments,1);
});
