import { test } from 'vitest';
import assert from 'node:assert/strict';
import { provisionBusinessRegistration } from '../../../../supabase/functions/register-business-tenant/provision.ts';
const body = {companyName:'Neue Firma', legalForm:'GmbH',industry:'Ambulante Alltagsbegleitung',street:'Testweg 1',zip:'10115',city:'Berlin',phone:'030123456',email:'firma@example.com',adminFirstName:'Test',adminLastName:'Admin',adminEmail:'admin@example.com',adminPassword:'long-test-password',termsAccepted:true};
const company={name:body.companyName,legal_form:body.legalForm,industry:body.industry,street:body.street,postal_code:body.zip,city:body.city,email:body.email};
function fixture({existing=true,mismatch=false,lookupError=false,race=false}={}) {
 let calls=0; let written=false;
 const client={auth:{admin:{createUser:async()=>existing?{data:null,error:{code:'email_exists'}}:{data:{user:{id:'auth'}},error:null},deleteUser:async()=>{throw Error('Unexpected deletion')}}},
 from(table){const q={select(){return q},eq(){return q},async maybeSingle(){if(lookupError)return {data:null,error:{code:'unavailable'}};return {error:null,data:table==='tenant_users'?((existing||written)?{tenant_id:'tenant'}:null):table==='tenants'?{...company,name:(mismatch||race)?'Andere Firma':company.name}:null}}};return q},
 async rpc(){calls++;written=true;return {data:{ok:true,tenantId:'tenant'},error:null}}};
 return {client,calls:()=>calls};
}
const options={verifyExistingIdentity:async()=> 'auth'};
test('different company with existing verified email returns conflict without provisioning',async()=>{const f=fixture({mismatch:true});const r=await provisionBusinessRegistration(f.client,body,options);assert.equal(r.status,409);assert.equal(r.body.ok,false);assert.equal(f.calls(),0)});
test('identical company retry succeeds',async()=>{const f=fixture();const r=await provisionBusinessRegistration(f.client,body,options);assert.equal(r.status,201);assert.equal(f.calls(),1)});
test('new identity provisions normally',async()=>{const f=fixture({existing:false});const r=await provisionBusinessRegistration(f.client,body,options);assert.equal(r.status,201);assert.equal(f.calls(),1)});
test('lookup failure cannot report success',async()=>{const f=fixture({lookupError:true});const r=await provisionBusinessRegistration(f.client,body,options);assert.equal(r.status,503);assert.equal(f.calls(),0)});
test('concurrent conflicting workspace cannot report success',async()=>{const f=fixture({existing:false,race:true});const r=await provisionBusinessRegistration(f.client,body,options);assert.equal(r.status,409)});
test('unverified existing identity remains rejected',async()=>{const f=fixture();const r=await provisionBusinessRegistration(f.client,body,{verifyExistingIdentity:async()=>null});assert.equal(r.status,409);assert.equal(f.calls(),0)});

