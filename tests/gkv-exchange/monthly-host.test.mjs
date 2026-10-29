import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {once} from 'node:events';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {MonthlyOriginalStore} from '../../services/gkv/monthly-original-store.mjs';
import {MonthlyOriginalHost,createMonthlyHostServer} from '../../services/gkv/monthly-host.mjs';
import {createMonthlyHostHandler} from '../../api/_lib/monthly-host-handler.mjs';
import {callMonthlyHost} from '../../api/_lib/monthly-host-transport.mjs';
import {monthlyRestDatabase} from '../../services/gkv/monthly-rest-database.mjs';
import {postMonthlyOriginalCommand} from '../../src/lib/gkvExchange/monthlyOriginalClient.ts';
import {MonthlyCaptureSession} from '../../src/lib/gkvExchange/monthlyCapture.ts';
import {monthlyHostFixture,signingPng} from './monthly-host-fixture.mjs';
import {testPki} from './pki-fixture.mjs';
import {hash,raw,connectorFixture} from './connector-fixture.mjs';

test('monthly browser contract, gateway, real mTLS host and SQL worker/session bridge',async t=>{
  const f=await monthlyHostFixture(),pki=await testPki(),dir=await mkdtemp(join(tmpdir(),'monthly-host-'));
  const store=new MonthlyOriginalStore({path:join(dir,'originals.sqlite'),key:randomBytes(32)});
  const host=new MonthlyOriginalHost({tenantId:f.tenant,store,supabase:f.config,workerKeyId:f.workerKeyId,workerKey:f.workerKey,http:f.http});
  const server=createMonthlyHostServer({host,tls:{...pki.tls,ca:pki.roots},clientSha256:hash(raw(pki.sender.certificate))});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const env={EXPO_PUBLIC_SUPABASE_URL:f.config.url,EXPO_PUBLIC_SUPABASE_ANON_KEY:f.config.key,
    GKV_MONTHLY_HOST_URL:`https://localhost.test:${server.address().port}/v1/monthly-originals`,GKV_MONTHLY_HOST_CONNECT_ADDRESS:'127.0.0.1',
    GKV_MONTHLY_HOST_SHA256:hash(raw(pki.tls.cert)),GKV_MONTHLY_HOST_CA:pki.roots,GKV_MONTHLY_CLIENT_CERT:pki.sender.certificate,
    GKV_MONTHLY_CLIENT_KEY:await readFile(pki.sender.privateKeyPath),GKV_MONTHLY_CLIENT_PASSPHRASE:pki.password.toString()};
  const handler=createMonthlyHostHandler({env,fetch:f.http});
  const gateway=async(_url,options)=>{
    const result={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(value){this.value=value;}};
    await handler({method:options.method,headers:{authorization:options.headers.Authorization,'content-type':options.headers['Content-Type']},body:options.body},result);
    return new Response(JSON.stringify(result.value),{status:result.code,headers:{...result.headers,'Content-Type':'application/json'}});
  };
  let auth=f.token(),count=0;
  const send=input=>postMonthlyOriginalCommand(input,auth,f.actorId,undefined,gateway);
  const ready=async()=>{const v=await f.proof(),capture=new MonthlyCaptureSession(v.input,v.p.content_sha256,send);await capture.prepare();await capture.acknowledge();return {...v,capture};};
  const confirm=(v,requestId=randomUUID(),identity=f.claims())=>f.command('confirm',{id:v.p.id,revision:v.p.revision,content_sha256:v.p.content_sha256,receipt_id:v.capture.receipt.receiptId},requestId,identity);
  try{
    await t.test('complete flow uses actual original bytes, consumes one receipt and retains invalidated archive',async()=>{
      const v=await ready();await v.capture.verify(signingPng(++count));const requestId=randomUUID();
      const final=await confirm(v,requestId),again=await confirm(v,requestId);assert.equal(final.status,'final');assert.equal(again.id,final.id);
      assert.equal(again.replayed,true);assert.equal(final.confirmation.receiptId,v.capture.receipt.receiptId);
      const successor=await f.command('correct',{id:final.id,revision:final.revision,new_id:randomUUID(),reason:'Fachliche Korrektur'});
      const old=(await f.db.query('SELECT * FROM gkv_monthly_proofs WHERE id=$1',[final.id])).rows[0];
      const archive=await postMonthlyOriginalCommand({...v.input,revision:old.revision,action:'archive'},f.token({sub:f.otherActor,session_id:f.otherSession}),f.otherActor,undefined,gateway);
      assert.equal(archive.archive.status,'invalidated');assert.equal(archive.pdfBase64,v.capture.original.pdfBase64);assert.equal(successor.confirmation,null);
      assert.equal(JSON.stringify(archive).includes('pngBase64'),false);
    });
    await t.test('unknown verification response is checked without another issuance; exact receipt is recovered',async()=>{
      const v=await f.proof();let lose=true,writes=0;
      const capture=new MonthlyCaptureSession(v.input,v.p.content_sha256,async command=>{const result=await send(command);if(command.action==='verify'){writes++;if(lose){lose=false;throw Error('lost');}}return result;});
      await capture.prepare();await capture.acknowledge();await assert.rejects(capture.verify(signingPng(++count)),/lost/);
      assert.ok(capture.pending);await capture.check();assert.equal(capture.pending,null);assert.ok(capture.receipt);assert.equal(writes,1);
    });
    await t.test('an absent response permits only an explicit retry of the identical request and PNG',async()=>{
      const v=await f.proof();let lose=true;const commands=[];
      const capture=new MonthlyCaptureSession(v.input,v.p.content_sha256,async command=>{commands.push(structuredClone(command));if(command.action==='verify'&&lose){lose=false;throw Error('not sent');}return send(command);});
      await capture.prepare();await capture.acknowledge();await assert.rejects(capture.verify(signingPng(++count)));
      assert.throws(()=>capture.retry(),/zuerst/);await capture.check();assert.equal(capture.checked,true);await capture.retry();
      const sent=commands.filter(c=>c.action==='verify');assert.deepEqual(sent[0],sent[1]);assert.ok(capture.receipt);
    });
    await t.test('lost prepare and acknowledgment replies recover through read-only status',async()=>{
      for(const action of ['prepare','acknowledge']){
        const v=await f.proof();let loss=true,writes=0;const capture=new MonthlyCaptureSession(v.input,v.p.content_sha256,async command=>{
          const value=await send(command);if(command.action===action){writes++;if(loss){loss=false;throw Error('lost');}}return value;
        });
        if(action==='prepare')await assert.rejects(capture.prepare());else{await capture.prepare();await assert.rejects(capture.acknowledge());}
        await capture.check();assert.ok(capture.original);assert.equal(capture.pending,null);assert.equal(writes,1);
      }
    });
    await t.test('same actor in another login cannot continue a capture or consume its receipt',async()=>{
      const v=await ready();await v.capture.verify(signingPng(++count));const next=randomUUID();
      await f.db.query('INSERT INTO auth.sessions VALUES($1,$2,NULL)',[next,f.actorId]);auth=f.token({session_id:next});
      await assert.rejects(send({...v.input,action:'read'}),/Anmeldung|Fassung/);
      await assert.rejects(confirm(v,randomUUID(),f.claims({session_id:next})),e=>e.code==='42501');auth=f.token();
      assert.equal((await confirm(v)).status,'final');
    });
    await t.test('deleted and expired sessions fail even while their JWT is unexpired',async()=>{
      const v=await ready();await v.capture.verify(signingPng(++count));
      await f.db.query("UPDATE auth.sessions SET not_after=now()-interval '1 minute' WHERE id=$1",[f.sessionId]);
      await assert.rejects(send({...v.input,action:'status'}),/Anmeldung|Beauftragung/);await assert.rejects(confirm(v),e=>e.code==='42501');
      await f.db.query('DELETE FROM auth.sessions WHERE id=$1',[f.sessionId]);await assert.rejects(confirm(v),e=>e.code==='42501');
      await f.db.query('INSERT INTO auth.sessions VALUES($1,$2,NULL)',[f.sessionId,f.actorId]);assert.equal((await confirm(v)).status,'final');
    });
    await t.test('a user token alone, another tenant key and an altered or stale envelope cannot mint receipts',async()=>{
      const v=await f.proof();const base={version:1,tenantId:f.tenant,actorId:f.actorId,sessionId:f.sessionId,keyId:f.workerKeyId,issuedAt:Date.now(),nonce:randomUUID(),operation:'context',args:v.input};
      const call=async(envelope,mac)=>(await f.as(f.claims(),'SELECT public.gkv_monthly_worker_command($1,$2)',[envelope,mac]));
      const sign=e=>createHmac('sha256',f.workerKey).update('gkv-monthly-worker-v1\n').update(e).digest('hex');
      const original=JSON.stringify(base);await assert.rejects(call(original,'0'.repeat(64)),e=>e.code==='42501');
      for(const patch of [{tenantId:randomUUID()},{actorId:f.otherActor},{sessionId:f.otherSession},{issuedAt:Date.now()-180000},{issuedAt:Date.now()+0.5},{nonce:null},{nonce:42},{operation:'arbitrary-sql'},{extra:true}]){
        const changed=JSON.stringify({...base,...patch});await assert.rejects(call(changed,sign(changed)),e=>e.code==='42501');
      }
      await assert.rejects(call(JSON.stringify({...base,nonce:randomUUID()}),sign(original)),e=>e.code==='42501');
      await f.db.query('UPDATE care_security.gkv_monthly_worker_keys SET revoked_at=now()');
      await assert.rejects(call(original,sign(original)),e=>e.code==='42501');await f.db.query('UPDATE care_security.gkv_monthly_worker_keys SET revoked_at=NULL');
    });
    await t.test('personal scope and write delegation are checked on every request, including final consumption',async()=>{
      const v=await ready();await v.capture.verify(signingPng(++count));
      await f.db.query('UPDATE fixture_access SET can_write=false WHERE actor_id=$1',[f.actorId]);
      await assert.rejects(send({...v.input,action:'status'}),/Beauftragung/);await assert.rejects(confirm(v),e=>e.code==='42501');
      await f.db.query('UPDATE fixture_access SET can_write=true WHERE actor_id=$1',[f.actorId]);
      await assert.rejects(send({...v.input,tenantId:randomUUID(),action:'read'}),/Beauftragung/);
    });
    await t.test('a changed canonical source prevents host verification and no new receipt is inserted',async()=>{
      const v=await ready();await f.db.query('UPDATE service_records SET actual_minutes=99 WHERE id=$1',[v.p.payload.records[0].recordId]);
      await assert.rejects(v.capture.verify(signingPng(++count)),/geändert/);
      assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_monthly_confirmation_receipts WHERE proof_id=$1',[v.p.id])).rows[0].n,0);
    });
    await t.test('mTLS requires both the pinned server and pinned authorized client before any data is accepted',async()=>{
      const v=await f.proof();const before=f.calls.length;
      await assert.rejects(callMonthlyHost({...env,GKV_MONTHLY_HOST_SHA256:'0'.repeat(64)},{...v.input,action:'prepare'},'Bearer '+auth),/UNAVAILABLE/);
      const alien={...env,GKV_MONTHLY_CLIENT_CERT:pki.recipient.certificate,GKV_MONTHLY_CLIENT_KEY:await readFile(pki.recipient.privateKeyPath)};
      await assert.rejects(callMonthlyHost(alien,{...v.input,action:'prepare'},'Bearer '+auth),/FORBIDDEN/);assert.equal(f.calls.length,before);
    });
    await t.test('unknown fields, portal/anonymous credentials and invalid tokens do not reach the host database',async()=>{
      const v=await f.proof();const before=f.calls.filter(c=>c.url.includes('/rpc/')).length;
      for(const token of ['invalid',f.token({role:'service_role'}),f.token({is_anonymous:true}),f.token({exp:1}),f.token({session_id:'fake'})])
        await assert.rejects(postMonthlyOriginalCommand({...v.input,action:'prepare'},token,f.actorId,undefined,gateway));
      await assert.rejects(send({...v.input,action:'prepare',signerName:'Forged'}));
      assert.equal(f.calls.filter(c=>c.url.includes('/rpc/')).length,before);
    });
    await t.test('public roles cannot read worker keys, receipt sessions or directly invoke the private issuer',async()=>{
      for(const sql of ['SELECT * FROM care_security.gkv_monthly_worker_keys','SELECT * FROM care_security.gkv_monthly_receipt_sessions',"SELECT care_security.gkv_monthly_accept_verified_receipt('{}')"])
        await assert.rejects(f.as(f.claims(),sql),e=>e.code==='42501');
      for(const role of ['anon','service_role']){
        await f.db.exec('SET ROLE '+role);try{await assert.rejects(f.db.query("SELECT public.gkv_monthly_worker_command('{}',repeat('0',64))"),e=>e.code==='42501');}finally{await f.db.exec('RESET ROLE');}
      }
      const wrappers=(await f.db.query("SELECT prosecdef FROM pg_proc WHERE oid='public.gkv_monthly_worker_command(text,text)'::regprocedure")).rows;
      assert.equal(wrappers[0].prosecdef,false);
    });
    await t.test('conflicting host results and altered PDF bytes are rejected by the browser contract',async()=>{
      const v=await f.proof(),input={...v.input,action:'prepare'},value=await send(input);
      for(const change of [r=>{r.actorId=randomUUID();},r=>{r.captureId=randomUUID();},r=>{r.original.contentSha256='b'.repeat(64);},r=>{r.pdfBase64=Buffer.from('%PDF- changed').toString('base64');}]){
        const copy=structuredClone(value);change(copy);
        if(copy.original.contentSha256!==value.original.contentSha256){const capture=new MonthlyCaptureSession(v.input,v.p.content_sha256,async()=>copy);await assert.rejects(capture.prepare());}
        else await assert.rejects(postMonthlyOriginalCommand(input,auth,f.actorId,undefined,async()=>new Response(JSON.stringify(copy),{headers:{'Content-Type':'application/json'}})));
      }
    });
    await t.test('redirected, compressed and oversized host replies are not trusted or followed',async()=>{
      const v=await f.proof();for(const mode of ['redirect','compressed','oversize']){
        const peer=await connectorFixture(pki,({response})=>{response.writeHead(mode==='redirect'?302:200,{'Content-Type':'application/json',...(mode==='redirect'?{Location:'https://other.test'}:mode==='compressed'?{'Content-Encoding':'gzip'}:{})});response.end(mode==='oversize'?'x'.repeat(2_850_001):'{}');});
        try{await assert.rejects(callMonthlyHost({...env,GKV_MONTHLY_HOST_URL:peer.options.url.replace('/CertificateService','/v1/monthly-originals')},{...v.input,action:'status'},'Bearer '+auth),/UNAVAILABLE/);}finally{await peer.close();}
      }
    });
  }finally{await new Promise(resolve=>server.close(resolve));host.close();await f.close();await pki.close();await rm(dir,{recursive:true,force:true});}
});
