import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes as strip} from 'node:module';
import * as native from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';
import {captureClientParentDetail} from '../../src/lib/clients/clientRecordRead.web.ts';
import {woundInstant} from '../../src/lib/pflege/woundCareDomain.ts';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const clean=s=>strip(s.replace(/^import[\s\S]*?;\n/gm,'').replace(/\bexport /g,''));
const compose=(s,deps,names)=>new Function(...Object.keys(deps),clean(s)+';return {'+names.join(',')+'};')(...Object.values(deps));
const {EMPTY_CLIENT_INTAKE_FORM}=compose(read('src/types/forms/clientIntakeForm.ts'),{},['EMPTY_CLIENT_INTAKE_FORM']);
const {splitStreetLine}=compose(read('src/lib/clients/clientEditAddressUtils.ts'),{},['splitStreetLine']);
const {parseHomeAccessStoredValue}=compose(read('src/lib/clients/clientIntakeHomeAccess.ts'),{},['parseHomeAccessStoredValue']);
const {mapClientEditLoadToIntakeForm:mapSharedForm}=compose(read('src/lib/clients/clientIntakeFormMappers.ts'),{EMPTY_CLIENT_INTAKE_FORM,createEmptyIntakeForm:()=>({...EMPTY_CLIENT_INTAKE_FORM}),splitStreetLine,parseHomeAccessStoredValue},['mapClientEditLoadToIntakeForm']);
const {captureClientIntakeEditOriginalForm:capture}=compose(read('src/lib/clients/clientIntakeEditOriginalForm.web.ts'),{mapSharedForm,captureClientParentDetail,...native,woundInstant},['captureClientIntakeEditOriginalForm']);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={key:'current-own-read',tenantId:id(1),clientId:id(3),actorId:id(2),role:'business_admin',canRead:true,canSensitive:true,canEdit:false};
function fixture(){
 const row={id:id(3),tenant_id:id(1),admission_date:'1999-03-17',service_start:'2011-02-08',created_at:'2026-10-08 10:00:00.123456+00:00',updated_at:'2026-10-09T10:00:00.123457Z',unknownRaw:{author:'  Original  ',history:[{at:'.000001',value:false},{at:'.000002',value:0}],nil:null,absent:undefined}};
 const form={...structuredClone(EMPTY_CLIENT_INTAKE_FORM),firstName:'Native',lastName:'Original',notes:' Original notes ',careLevel:'pg2',costCarrier:'',accessCode:'',mobilityNotes:'',communicationNotes:'',familyDoctorName:'',portalModules:[],unknownForm:{whole:[false,0,null,'  Raw  ']}};
 const detail={id:id(3),tenantId:id(1),street:'Native Street 4',unknownDetail:{proof:undefined}};
 const fullClient={id:id(3),tenantId:id(1),core:{id:id(3),tenantId:id(1),diagnoses:['Raw narrative']},addresses:[],careLevels:[{id:id(8),tenantId:id(1),clientId:id(3),validFrom:'2022-04-09'}],billingProfile:null,contacts:[],preferences:null,consents:[],unknownFull:{microsecond:'.123456',history:['First','Second']}};
 const input={detail,fullClient,careContexts:['ambulatory_care'],form,intakeSnapshot:{admissionDate:'1999-03-17',serviceStart:'2011-02-08',unknownSnapshot:{label:' Original ',time:'.123457'}},unknownInput:{all:[true,undefined,null,0,'']}};
 return{input,row};
}
for(const [admission,start] of [['1999-03-17','2011-02-08'],['2000-02-29','2024-02-29'],['0001-01-01','9999-12-31']])test(`Actual shared mapper parity with separate original DATE ${admission}/${start}`,()=>{
 const {input,row}=fixture();row.admission_date=admission;row.service_start=start;
 const shared=mapSharedForm(input),result=capture(input,row,scope);assert.deepEqual(result.form,{...shared,admissionDate:admission,serviceStart:start});assert.equal(result.originals.nativeClient.admission_date,admission);assert.equal(result.originals.nativeClient.service_start,start);assert.equal(result.form.admissionDate,row.admission_date);assert.equal(result.form.serviceStart,row.service_start);
});
for(const value of [null,''])for(const key of ['admission_date','service_start'])test(`Known native ${key} ${JSON.stringify(value)} is empty input with separate exact original`,()=>{
 const {input,row}=fixture();row[key]=value;const result=capture(input,row,scope);assert.equal(result.form[key==='admission_date'?'admissionDate':'serviceStart'],'');assert.equal(result.originals.nativeClient[key],value);assert.equal(Object.hasOwn(result.originals.nativeClient,key),true);assert.notEqual(result.form.admissionDate,EMPTY_CLIENT_INTAKE_FORM.admissionDate);
});
for(const value of [undefined,' ',false,0,{},[],new Date(),'2026-02-30','1900-02-29','0000-01-01','2026-2-01','2026-10-08T00:00:00Z','2026-10-08 00:00:00','2026-10-08Z'])for(const key of ['admission_date','service_start'])test(`Unresolved native ${key} ${String(value)} cannot receive a default historical agreement`,()=>{
 const {input,row}=fixture();row[key]=value;assert.throws(()=>capture(input,row,scope));
});
for(const key of ['admission_date','service_start'])test(`Undeclared native ${key} never borrows a projected snapshot or care level date`,()=>{const {input,row}=fixture();delete row[key];assert.throws(()=>capture(input,row,scope));});
for(const [target,key,value] of [['row','tenant_id',id(99)],['row','id',id(99)],['detail','id',id(99)],['detail','tenantId',id(99)],['full','id',id(99)],['full','tenantId',id(99)]])test(`Actual whole mapper source ${target}/${key} requires original native owner`,()=>{const {input,row}=fixture();const object=target==='row'?row:target==='detail'?input.detail:input.fullClient;object[key]=value;assert.throws(()=>capture(input,row,scope));});
for(const change of [{canRead:false},{actorId:'bad'},{role:'foo'},{tenantId:'bad'},{clientId:'bad'}])test(`Projection has no own supplied read scope for ${JSON.stringify(change)}`,()=>{const {input,row}=fixture();assert.throws(()=>capture(input,row,{...scope,...change}));});
test('Whole unselected delivered history cannot hide a foreign client behind the two valid raw dates',()=>{const {input,row}=fixture();input.fullClient.careLevels.push({id:id(9),tenantId:id(1),clientId:id(99),validFrom:'2023-01-01'});assert.throws(()=>capture(input,row,scope));});
test('Duplicate unselected native history never appears as a confirmed whole mapping input',()=>{const {input,row}=fixture();input.fullClient.careLevels.push({...input.fullClient.careLevels[0]});assert.throws(()=>capture(input,row,scope));});
for(const place of ['input','raw','scope'])test(`Unsupported whole ${place} descriptors are rejected without executing a getter`,()=>{const {input,row}=fixture();const currentScope={...scope};let reads=0;Object.defineProperty(place==='input'?input:place==='raw'?row:currentScope,'unknownGetter',{enumerable:true,get(){reads++;return 'lost original';}});assert.throws(()=>capture(input,row,currentScope));assert.equal(reads,0);});
for(const bad of [()=>Object.assign([1],{unknown:'extra'}),()=>Array(2),()=>{const a={};a.self=a;return a;},()=>new Map(),()=>NaN,()=>{const a={};Object.defineProperty(a,'hidden',{value:'raw'});return a;},()=>({[Symbol('native')]:true})])test(`Unsupported unknown original cannot disappear: ${bad.toString()}`,()=>{const {input,row}=fixture();input.extra=bad();assert.throws(()=>capture(input,row,scope));});
test('Actual complete original captures preserve raw microseconds, unknown/undefined/null, array order and cannot be mutated by editable form',()=>{
 const {input,row}=fixture(),beforeInput=structuredClone(input),beforeRow=structuredClone(row);const result=capture(input,row,scope);assert.deepEqual(input,beforeInput);assert.deepEqual(row,beforeRow);assert.deepEqual(result.originals.input,beforeInput);assert.deepEqual(result.originals.nativeClient,beforeRow);assert.ok(Object.isFrozen(result.originals.input.fullClient.unknownFull.history));assert.ok(Object.isFrozen(result.originals.nativeClient.unknownRaw.history));assert.ok(Object.hasOwn(result.originals.nativeClient.unknownRaw,'absent'));
 input.fullClient.unknownFull.history.reverse();row.unknownRaw.history.reverse();result.form.careContexts.push('consulting');result.form.supportWishes.push('Edited');assert.deepEqual(result.originals.input.careContexts,['ambulatory_care']);assert.deepEqual(result.originals.nativeClient.unknownRaw.history,beforeRow.unknownRaw.history);assert.equal(Object.hasOwn(result.form,'originals'),false);assert.equal(Object.hasOwn(result.form,'nativeClient'),false);
});
test('Raw native dates override misleading projected admission/start without using plan, creation, service or grade fallbacks',()=>{const {input,row}=fixture();input.intakeSnapshot.admissionDate='2039-01-01';input.intakeSnapshot.serviceStart='2040-01-01';input.fullClient.createdAt='2026-10-08T10:00:00.123456Z';const result=capture(input,row,scope);assert.equal(result.form.admissionDate,'1999-03-17');assert.equal(result.form.serviceStart,'2011-02-08');assert.equal(result.originals.input.intakeSnapshot.admissionDate,'2039-01-01');});
