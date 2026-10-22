import test from 'node:test';
import assert from 'node:assert/strict';
import {createMedicationArchiveGateway} from '../../supabase/functions/medication-source-archive/gateway.ts';
import {archiveMedicationSource} from '../../supabase/functions/medication-source-archive/core.ts';
import {createArchiveHandler} from '../../supabase/functions/medication-source-archive/handler.ts';
const uuid=n=>`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const source=uuid('1'),request=uuid('2'),tenant=uuid('3'),client=uuid('4'),medication=uuid('5'),document=uuid('6'),actor=uuid('7'),session=uuid('8'),authUser=uuid('9');
const hash='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';const fp='sha256:'+'a'.repeat(64);
const caller={sub:authUser,role:'authenticated',session_id:session,exp:2_000_000_000};
const token=c=>`Bearer header.${Buffer.from(JSON.stringify(c)).toString('base64url')}.signature`;
const authorization=token(caller);
const environment={url:'https://example.invalid',anonKey:'test-anon',serviceKey:'test-service'};
const prepared={sourceId:source,tenantId:tenant,clientId:client,medicationId:medication,documentId:document,actorId:actor,documentVersion:'2026-10-08T12:00:00.123456Z',originalPath:`tenant/${tenant}/clients/${client}/documents/original.pdf`,sha256:hash,sizeBytes:3,sourceFingerprint:fp,orderFingerprint:fp,documentFingerprint:fp,archiveId:null};
const archivePath=`tenant/${tenant}/clients/${client}/medication-sources/${source}/${hash}.bin`;
function setup(changes={}){
 const calls=[];let archiveId=changes.ready?request:null,stored=changes.ready?new Blob(['abc']):null,proof=null,lostUpload=false,lostCommit=false;
 const factory=(url,key,options)=>{
  const role=key===environment.anonKey?'user':'admin';calls.push([role,'create',url,structuredClone(options)]);
  return {
   auth:{getUser:async()=>{calls.push([role,'getUser']);assert.equal(role,'user');return changes.identity??{data:{user:{id:authUser,is_anonymous:false}},error:null};}},
   rpc:async(name,args)=>{
    calls.push([role,'rpc',name,structuredClone(args)]);
    if(name==='recover_ambulatory_medication_source_proof'){
     assert.equal(role,'user');assert.equal(args.source_id,source);
     if(changes.recoverError)return {data:null,error:Error('private receipt scope')};
     return {data:proof&&args.request_id===request?{...prepared,archiveId}:null,error:null};
    }
    if(name==='prepare_ambulatory_medication_source_proof'){
     assert.equal(role,'user');assert.deepEqual(args,{source_id:source});
     if(changes.prepareError||changes.currentChangedAfterCommit&&proof)return {data:null,error:Error('private lookup')};
     return {data:{...prepared,archiveId},error:null};
    }
    assert.equal(role,'admin');assert.equal(name,'commit_ambulatory_medication_source_proof');
    assert.equal(stored?.size,3);proof=args.packet;
    if(changes.commitError)return {data:null,error:Error('private commit')};
    archiveId=request;
    if(changes.loseCommit&&!lostCommit){lostCommit=true;throw Error('response lost');}
    return {data:request,error:null};
   },
   storage:{from:bucket=>({
    download:async path=>{
     calls.push([role,'download',bucket,path]);
     if(bucket==='office-documents'){
      assert.equal(role,'user');assert.equal(path,prepared.originalPath);
      if(changes.originalError)return {data:null,error:Error('private original')};
      return {data:changes.wrongOriginal?new Blob(['abd']):new Blob(['abc']),error:null};
     }
     assert.equal(role,'admin');assert.equal(bucket,'medication-source-archives');assert.equal(path,archivePath);
     if(changes.archiveError)return {data:null,error:Error('private archive')};
     return {data:changes.wrongArchive?new Blob(['abd']):stored,error:null};
    },
    upload:async(path,blob,options)=>{
     calls.push([role,'upload',bucket,path,options]);assert.equal(role,'admin');assert.equal(bucket,'medication-source-archives');assert.equal(path,archivePath);
     assert.deepEqual(options,{upsert:false,contentType:'application/octet-stream'});
     if(changes.uploadDenied)return {error:Error('private denied')};
     assert.equal(stored,null);stored=blob;
     if(changes.loseUpload&&!lostUpload){lostUpload=true;throw Error('response lost');}
     return {data:{path},error:null};
    },
   })},
  };
 };
 return {calls,factory,proof:()=>proof,gateway:()=>createMedicationArchiveGateway(environment,authorization,factory)};
}
test('Actual adapter verifies Auth before admin creation and isolates caller original reads from archive service operations',async()=>{
 const f=setup();const gateway=await f.gateway();assert.deepEqual(await archiveMedicationSource(source,request,gateway),{id:request,reused:false});
 assert.deepEqual(f.calls.slice(0,3).map(c=>c.slice(0,2)),[['user','create'],['user','getUser'],['admin','create']]);
 const userOptions=f.calls[0][3],adminOptions=f.calls[2][3];assert.equal(userOptions.global.headers.Authorization,authorization);assert.equal('global' in adminOptions,false);
 assert.deepEqual(f.calls.filter(c=>c[1]==='rpc').map(c=>c.slice(0,3)),[['user','rpc','recover_ambulatory_medication_source_proof'],['user','rpc','prepare_ambulatory_medication_source_proof'],['user','rpc','prepare_ambulatory_medication_source_proof'],['admin','rpc','commit_ambulatory_medication_source_proof'],['user','rpc','prepare_ambulatory_medication_source_proof']]);
 const packet=f.proof();assert.deepEqual(packet.caller,caller);assert.equal(packet.record.actorId,actor);assert.notEqual(packet.record.actorId,packet.caller.sub);assert.equal(packet.verifiedSha256,hash);assert.equal(packet.verifiedSize,3);assert.equal(packet.requestId,request);assert.equal(JSON.stringify(packet).includes('signature'),false);
});
for(const identity of [{data:{user:null},error:null},{data:{user:{id:authUser}},error:Error('auth failed')},{data:{user:{id:actor}},error:null},{data:{user:{id:authUser,is_anonymous:true}},error:null}])test('Auth failure, another verified user or anonymous identity prevents admin creation',async()=>{const f=setup({identity});await assert.rejects(f.gateway());assert.equal(f.calls.some(c=>c[0]==='admin'),false);});
test('Absent server configuration does not construct any client',async()=>{for(const key of ['url','anonKey','serviceKey']){let calls=0;await assert.rejects(createMedicationArchiveGateway({...environment,[key]:undefined},authorization,()=>{calls++;}),/nicht eingerichtet/);assert.equal(calls,0);}});
test('Ready archive uses archive service download and reissues an atomic proof without reading or uploading an original',async()=>{const f=setup({ready:true});assert.deepEqual(await archiveMedicationSource(source,request,await f.gateway()),{id:request,reused:true});assert.equal(f.calls.some(c=>c[1]==='upload'||c[2]==='office-documents'),false);assert.equal(f.calls.filter(c=>c[1]==='download').length,1);assert.notEqual(f.proof(),null);});
test('A lost upload acknowledgment is resolved by actual adapter archive readback',async()=>{const f=setup({loseUpload:true});assert.equal((await archiveMedicationSource(source,request,await f.gateway())).id,request);assert.notEqual(f.proof(),null);});
test('A lost commit response is resolved through the same actual adapter request without a second upload',async()=>{const f=setup({loseCommit:true});const gateway=await f.gateway();await assert.rejects(archiveMedicationSource(source,request,gateway),/response lost/);assert.deepEqual(await archiveMedicationSource(source,request,gateway),{id:request,reused:true});assert.equal(f.calls.filter(c=>c[1]==='upload').length,1);assert.equal(f.calls.filter(c=>c[2]==='commit_ambulatory_medication_source_proof').length,1);});
for(const change of [{prepareError:true},{originalError:true},{wrongOriginal:true},{archiveError:true},{wrongArchive:true},{uploadDenied:true}])test('Actual adapter failure or wrong bytes prevents completion '+JSON.stringify(change),async()=>{const f=setup(change);await assert.rejects(archiveMedicationSource(source,request,await f.gateway()));assert.equal(f.proof(),null);});
test('Actual HTTP handler and Supabase adapter keep a backend commit failure uncertain without leaking backend errors',async()=>{const f=setup({commitError:true});const handler=createArchiveHandler(auth=>createMedicationArchiveGateway(environment,auth,f.factory));const response=await handler(new Request('https://example.invalid/archive',{method:'POST',headers:{authorization},body:JSON.stringify({sourceId:source,requestId:request})}));assert.equal(response.status,409);const body=await response.text();assert.equal(JSON.parse(body).uncertain,true);assert.doesNotMatch(body,/private commit|test-service/);});

test('Production gateway recovers a lost committed request after the current order changed without issuing a new proof',async()=>{const f=setup({loseCommit:true,currentChangedAfterCommit:true});const gateway=await f.gateway();await assert.rejects(archiveMedicationSource(source,request,gateway),/response lost/);assert.deepEqual(await archiveMedicationSource(source,request,gateway),{id:request,reused:true});assert.equal(f.calls.filter(c=>c[2]==='commit_ambulatory_medication_source_proof').length,1);assert.equal(f.calls.filter(c=>c[1]==='upload').length,1);await assert.rejects(archiveMedicationSource(source,uuid('a'),gateway));assert.equal(f.calls.filter(c=>c[2]==='commit_ambulatory_medication_source_proof').length,1);});
test('Receipt authorization failure is not treated as an absent receipt or a current-source fallback',async()=>{const f=setup({recoverError:true});await assert.rejects(archiveMedicationSource(source,request,await f.gateway()),/Prüfauftrag nicht zugänglich/);assert.equal(f.calls.some(c=>c[2]==='prepare_ambulatory_medication_source_proof'||c[1]==='download'),false);});
test('HTTP historical recovery acknowledges only the previously committed request after a lost response and changed current order',async()=>{const f=setup({loseCommit:true,currentChangedAfterCommit:true});const handler=createArchiveHandler(auth=>createMedicationArchiveGateway(environment,auth,f.factory));const send=()=>handler(new Request('https://example.invalid/archive',{method:'POST',headers:{authorization},body:JSON.stringify({sourceId:source,requestId:request})}));const first=await send();assert.equal(first.status,409);assert.equal((await first.json()).uncertain,true);const recovered=await send();assert.equal(recovered.status,200);assert.deepEqual((await recovered.json()).data,{id:request,reused:true});assert.equal(f.calls.filter(c=>c[2]==='commit_ambulatory_medication_source_proof').length,1);});
