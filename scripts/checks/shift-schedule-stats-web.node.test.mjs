import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {woundUuid} from '../../src/lib/pflege/woundCareDomain.ts';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes as strip} from 'node:module';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),hashes={};
const read=p=>{const s=readFileSync(join(root,p),'utf8'),hash=createHash('sha256').update(s).digest('hex');if(hashes[p])assert.equal(hashes[p],hash);hashes[p]=hash;return s};
const whole=(p,names,deps={})=>{const js=strip(read(p).replace(/^import[\s\S]*?;\n/gm,'').replace(/\bexport /g,''));return new Function(...Object.keys(deps),js+';return {'+names.join(',')+'};')(...Object.values(deps))};
const staticRoles=whole('src/lib/permissions/staticRolePermissions.ts',['getPermissionsForRole','PERMISSION_DENIED_MESSAGES','PERMISSION_LABELS']);
const check=whole('src/lib/permissions/check.ts',['permissionError','checkPermissionWithList'],staticRoles),{enforcePermission}=whole('src/lib/permissions/enforce.ts',['enforcePermission'],check);
const {buildShiftScheduleListKpis}=whole('src/lib/pflege/shiftScheduleListStats.web.ts',['buildShiftScheduleListKpis'],{woundUuid,legacyColorsFromPalette:mode=>({violet:mode+'-violet',success:mode+'-success',cyan:mode+'-cyan',orange:mode+'-orange'})});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),tenant=id(1);let data=[],calls=[];
const sdk={from(table){const filters=[];let lo=0,hi=499;const q={select:value=>{assert.equal(value,'*');return q},eq:(key,value)=>{filters.push([key,value]);return q},order:()=>q,range:(a,b)=>{lo=a;hi=b;return q},then:(ok,no)=>{calls.push({table,filters,lo,hi});return Promise.resolve({data:data.filter(r=>filters.every(([k,v])=>r[k]===v)).slice(lo,hi+1),error:null,status:200}).then(ok,no)}};return q},rpc(){throw Error('No writes/RPC allowed')}};
const guardServiceTenant=value=>value===tenant?null:{ok:false,error:'Controlled own tenant boundary'};
const deps={enforcePermission,guardServiceTenant,getServiceMode:()=> 'supabase',getSupabaseClient:()=>sdk,fromUnknownTable:(db,table)=>db.from(table),toGermanSupabaseError:()=> 'Native read error'};
const operations=whole('src/lib/pflege/ambulatoryOperationsService.ts',['readCareRows','callCareOperationsRpc'],deps);
const service=whole('src/lib/pflege/shiftScheduleService.ts',['fetchShiftScheduleList'],{...deps,...operations,syncCalendarEventAsync:()=>{throw Error('No calendar writes')},buildCalendarEventFromShift:()=>{throw Error('No calendar writes')},createDemoShift:()=>{throw Error('No demo writes')},getDemoShiftScheduleListItems:()=>{throw Error('No demo fallback')},isPflegeDemoFunctional:()=>false,validateShift:()=>null});
const row=(n,patch={})=>({id:id(n),tenant_id:tenant,employee_id:id(10),employee_name_snapshot:'Alex Beispiel',role_label_snapshot:'Pflegekraft',shift_date:'2026-10-11',start_time:'06:00:00.123457',end_time:'14:00:00.123458',location:'Ambulant',status:'confirmed',created_by:id(2),updated_by:id(2),created_at:'2026-10-11 05:00:00.123457+02:00',updated_at:'2026-10-11 05:00:00.123458+02:00',...patch});

const active=kpis=>kpis.find(k=>k.id==='active'),unknown=kpis=>kpis.find(k=>k.id==='unresolved_assignments');
async function mapped(rows){data=rows;calls=[];const original=structuredClone(rows),result=await service.fetchShiftScheduleList(tenant,'nurse');assert.equal(result.ok,true);assert.deepEqual(data,original);return result.data;}
const item=(n,patch={})=>({id:id(n),tenantId:tenant,employeeId:id(10),employeeName:'Alex Beispiel',roleLabel:'Pflegekraft',shiftDate:'2026-10-11',startTime:'06:00',endTime:'14:00',location:'Ambulant',status:'bestaetigt',updatedAt:'2026-10-11 05:00:00.123458+02:00',...patch});

for(const [nativeStatus,projected,confirmed] of [['draft','entwurf',0],['published','geplant',0],['confirmed','bestaetigt',1],['in_progress','in_bearbeitung',0],['completed','abgeschlossen',0],['cancelled','archiviert',0]])test(`Actual native ${nativeStatus}→${projected} counts only explicit plan confirmation`,async()=>{
 const items=await mapped([row(20,{status:nativeStatus})]),before=structuredClone(items),nativeReads=calls.length,kpis=buildShiftScheduleListKpis(items);
 assert.equal(items[0].status,projected);assert.equal(active(kpis).value,String(confirmed));assert.equal(unknown(kpis).value,'0');assert.equal(calls.length,nativeReads);assert.deepEqual(items,before);
});
for(const nativeStatus of ['legacy-unknown',null,''])test(`Explicit legacy ${String(nativeStatus)} fallback never becomes a native confirmation`,async()=>{
 const items=await mapped([row(20,{status:nativeStatus})]);assert.equal(items[0].status,'aktiv');assert.equal(active(buildShiftScheduleListKpis(items)).value,'0');
});
test('Two actual native employee UUIDs with the same historical name stay two identities',async()=>{
 const items=await mapped([row(20),row(21,{employee_id:id(11)})]),kpis=buildShiftScheduleListKpis(items);assert.equal(active(kpis).value,'2');assert.equal(active(kpis).subValue,'2 zugeordnete Mitarbeitende');assert.equal(unknown(kpis).value,'0');
});
test('One native employee with different historical names stays one identity',async()=>{
 const items=await mapped([row(20),row(21,{employee_name_snapshot:'Historischer Name'})]);assert.equal(active(buildShiftScheduleListKpis(items)).subValue,'1 zugeordnete Mitarbeitende');assert.equal(active(buildShiftScheduleListKpis(items)).value,'2');
});
test('Deleted nullable employee relation preserves historic text but remains an unresolved shift assignment',async()=>{
 const items=await mapped([row(20,{employee_id:null})]),kpis=buildShiftScheduleListKpis(items);assert.equal(items[0].employeeName,'Alex Beispiel');assert.equal(items[0].employeeId,null);assert.equal(active(kpis).subValue,'0 zugeordnete Mitarbeitende');assert.equal(active(kpis).value,'1');assert.equal(unknown(kpis).value,'1');
});
for(const [description,employeeId]of [['null',null],['undefined',undefined],['empty',''],['readable alias','employee-123'],['numeric',42],['boolean',true],['object',{id:id(10)}],['array',[id(10)]],['whitespace',' '+id(10)+' '],['incomplete','00000000']])test(`Supplied ${description} employee identity remains unresolved without name/role fallback`,()=>{
 const source=[item(20,{employeeId})],before=structuredClone(source),kpis=buildShiftScheduleListKpis(source);assert.equal(active(kpis).subValue,'0 zugeordnete Mitarbeitende');assert.equal(unknown(kpis).value,'1');assert.deepEqual(source,before);
});
test('Same UUID with alternate case deduplicates privately without rewriting the original strings',()=>{
 const employeeId='abcdefab-cdef-4567-89ab-cdefabcdefab',items=[item(20,{employeeId}),item(21,{employeeId:employeeId.toUpperCase()})],before=structuredClone(items),kpis=buildShiftScheduleListKpis(items);assert.equal(active(kpis).subValue,'1 zugeordnete Mitarbeitende');assert.deepEqual(items,before);
});
test('Known native identity is counted despite absent snapshot name; no current name is invented',()=>{
 const items=[item(20,{employeeName:''}),item(21,{employeeId:id(11),employeeName:''})],kpis=buildShiftScheduleListKpis(items);assert.equal(active(kpis).subValue,'2 zugeordnete Mitarbeitende');assert.equal(unknown(kpis).value,'0');assert.equal(items[0].employeeName,'');
});
test('Two unresolved rows with the same name remain two unknown shift assignments, not two inferred employees',()=>{
 const kpis=buildShiftScheduleListKpis([item(20,{employeeId:null}),item(21,{employeeId:null})]);assert.equal(active(kpis).subValue,'0 zugeordnete Mitarbeitende');assert.equal(unknown(kpis).value,'2');
});
test('Mix of actual valid IDs, unresolved assignments and native status classes keeps independent counters',async()=>{
 const items=await mapped([row(20),row(21,{status:'draft'}),row(22,{employee_id:id(11),status:'cancelled'}),row(23,{employee_id:null}),row(24,{employee_id:null,status:'published'})]),kpis=buildShiftScheduleListKpis(items);assert.equal(kpis.find(k=>k.id==='total').value,'5');assert.equal(active(kpis).value,'2');assert.equal(active(kpis).subValue,'2 zugeordnete Mitarbeitende');assert.equal(unknown(kpis).value,'2');
});
test('Empty delivered list means zero counters, no synthesized employee or positive plan status',()=>{
 const kpis=buildShiftScheduleListKpis([]);assert.equal(kpis.find(k=>k.id==='total').value,'0');assert.equal(active(kpis).value,'0');assert.equal(active(kpis).subValue,'0 zugeordnete Mitarbeitende');assert.equal(unknown(kpis).value,'0');assert.equal(kpis.find(k=>k.id==='locations').value,'0');
});
test('Whole supplied frozen DTO fields, unknown extras, raw microsecond metadata and caller order stay unchanged',()=>{
 const items=Object.freeze([Object.freeze(item(21,{updatedAt:'2026-10-11 05:00:00.123458+02:00',startTime:'06:00:00.123457',endTime:'14:00:00.123458',originalExtra:{array:[3,1],author:id(2)}})),Object.freeze(item(20,{updatedAt:'2026-10-11T03:00:00.123457Z'}))]),before=structuredClone(items);
 const kpis=buildShiftScheduleListKpis(items);assert.equal(active(kpis).value,'2');assert.deepEqual(items,before);assert.equal(items[0].id,id(21));assert.equal(Object.hasOwn(kpis[0],'actualWorked'),false);assert.equal(Object.hasOwn(kpis[0],'originalExtra'),false);
});
test('Location count remains literal supplied TEXT distinctness and does not invent native site identity',()=>{
 const items=[item(20,{location:'Ambulant'}),item(21,{location:'Zentrale'}),item(22,{location:'Ambulant'})];assert.equal(buildShiftScheduleListKpis(items).find(k=>k.id==='locations').value,'2');
});
for(const mode of ['dark','light'])test(`Existing requested ${mode} palette is passed through without changing counters or source`,()=>{
 const kpis=buildShiftScheduleListKpis([item(20)],mode);assert.equal(active(kpis).value,'1');assert.equal(active(kpis).accentColor,mode+'-success');assert.equal(unknown(kpis).accentColor,mode+'-orange');
});
test('Actual Hero data-binding expression consumes new result without changing service, Hero or Android contract',async()=>{
 const source=read('src/components/pflege/ShiftScheduleListHero.tsx'),match=source.match(/const kpis = ([^;]+);/);assert.ok(match);const renderKpis=new Function('buildShiftScheduleListKpis','items','mode','return '+match[1]);const items=await mapped([row(20),row(21,{employee_id:null})]);const before=structuredClone(items),kpis=renderKpis(buildShiftScheduleListKpis,items,'dark');assert.equal(active(kpis).value,'2');assert.equal(unknown(kpis).value,'1');assert.equal(kpis.length,4);assert.deepEqual(items,before);
});
test('Existing static permission/controlled tenant denial still makes zero native reads before statistics',async()=>{
 data=[row(20)];calls=[];assert.equal((await service.fetchShiftScheduleList(tenant,null)).ok,false);assert.equal((await service.fetchShiftScheduleList(id(99),'nurse')).ok,false);assert.equal(calls.length,0);
});
