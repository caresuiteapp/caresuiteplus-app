import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {jsPDF} from 'jspdf';
import {MonthlyOriginalStore} from '../../services/gkv/monthly-original-store.mjs';
import {MonthlyOriginalHost} from '../../services/gkv/monthly-host.mjs';
import {MonthlyOriginalVerifier} from '../../services/gkv/monthly-original-verifier.mjs';
import {monthlyRestDatabase} from '../../services/gkv/monthly-rest-database.mjs';
import {MonthlyCaptureSession} from '../../src/lib/gkvExchange/monthlyCapture.ts';
import {readMonthlyProof} from '../../src/lib/gkvExchange/monthlyProof.ts';
import {readMonthlyOriginalCommand} from '../../src/lib/gkvExchange/monthlyOriginalContract.ts';
import {inspectMonthlyScan} from '../../services/gkv/monthly-scan.mjs';
import {monthlyHostFixture,signingPng} from './monthly-host-fixture.mjs';
import {paperScanFixture} from './monthly-paper-fixture.mjs';

test('paper originals, real PDF rendering, personal review and SQL final consumption',async t=>{
  const f=await monthlyHostFixture(),dir=await mkdtemp(join(tmpdir(),'gkv-paper-')),path=join(dir,'archive.sqlite');
  const store=new MonthlyOriginalStore({path,key:randomBytes(32)}),host=new MonthlyOriginalHost({tenantId:f.tenant,store,supabase:f.config,workerKeyId:f.workerKeyId,workerKey:f.workerKey,http:f.http});
  const send=input=>host.execute(input,'Bearer '+f.token());let variant=100;
  const ready=async(options={})=>{
    const v=await f.proof();
    if(options.long){
      await f.db.query("UPDATE assist_visit_proofs SET payload_snapshot=jsonb_set(payload_snapshot,'{documentationNote}',to_jsonb($1::text)) WHERE id=$2",['Ausführliche synthetische Dokumentation der tatsächlich erbrachten Leistung. '.repeat(140),v.p.payload.records[0].sourceReceipt.proof_id]);
      v.p=await f.command('replace_sources',{id:v.p.id,revision:v.p.revision,source_ids:v.p.payload.records.map(r=>r.recordId),reason:'Ausführliche Testdokumentation'});
    }
    v.input={...v.input,revision:v.p.revision,method:'paper'};v.capture=new MonthlyCaptureSession(v.input,v.p.content_sha256,send);
    await v.capture.prepare();await v.capture.acknowledge();return v;
  };
  const upload=async v=>{const bytes=await paperScanFixture(v.capture.original,++variant);await v.capture.uploadScan(bytes.toString('base64'));return bytes;};
  const review=v=>({scanSha256:v.capture.scan.scanSha256,reviewedPages:v.capture.scan.pages.map(p=>p.sha256),signatureBox:v.capture.original.original.paper.signatureBox,signedAt:new Date().toISOString(),reviewConfirmed:true});
  const confirm=v=>f.command('confirm',{id:v.p.id,revision:v.p.revision,content_sha256:v.p.content_sha256,receipt_id:v.capture.receipt.receiptId});
  try{
    await t.test('complete multi-page scan stays attached to its original, signed crop, reviewer and corrected archive',async()=>{
      const v=await ready({long:true});assert.ok(v.capture.original.original.paper.pageCount>1);
      const bytes=await upload(v),r=review(v);
      for(let page=1;page<=v.capture.scan.pages.length;page++){
        const image=await v.capture.readScanPage(page);assert.equal(image.sha256,createHash('sha256').update(Buffer.from(image.pngBase64,'base64')).digest('hex'));
      }
      await v.capture.reviewScan(r);const final=readMonthlyProof(await confirm(v),f.tenant);
      assert.equal(final.status,'final');assert.equal(final.confirmation.paper.scanSha256,createHash('sha256').update(bytes).digest('hex'));
      assert.equal(final.confirmation.paper.reviewedBy,f.actorId);assert.equal(final.confirmation.paper.signedAt,r.signedAt);
      const {method,...scope}=v.input;
      const archived=await send({...scope,revision:final.revision,action:'archive-scan'});assert.deepEqual(Buffer.from(archived.pdfBase64,'base64'),bytes);
      assert.equal(Object.hasOwn(archived,'pngBase64'),false);
      await f.command('correct',{id:final.id,revision:final.revision,new_id:randomUUID(),reason:'Papierfassung fachlich korrigieren'});
      const invalid=await host.execute({...scope,revision:final.revision+1,action:'archive-scan'},'Bearer '+f.token({sub:f.otherActor,session_id:f.otherSession}));
      assert.equal(invalid.status,'invalidated');assert.deepEqual(invalid.paper,archived.paper);
      await mkdir('/tmp/pdfs/gkv-paper',{recursive:true});
      await writeFile('/tmp/pdfs/gkv-paper/original.pdf',Buffer.from(v.capture.original.pdfBase64,'base64'));
      await writeFile('/tmp/pdfs/gkv-paper/synthetic-scan.pdf',bytes);
      const disk=await readFile(path);assert.equal(disk.includes(Buffer.from('%PDF-')),false);assert.equal(disk.includes(Buffer.from('Fiktive')),false);
    });
    await t.test('every page, current scan hash and truthful time are required; blank crop and canvas downgrade fail',async()=>{
      const v=await ready(),bytes=await upload(v),r=review(v);
      for(const bad of [{...r,reviewedPages:[]},{...r,reviewedPages:['a'.repeat(64)]},{...r,scanSha256:'a'.repeat(64)},
        {...r,reviewConfirmed:false},{...r,signedAt:'2020-01-01T00:00:00Z'},{...r,signedAt:'2099-01-01T00:00:00Z'},
        {...r,signatureBox:{...r.signatureBox,x:995}},{...r,signatureBox:{page:1,x:0,y:0,width:50,height:20}}]){
        await assert.rejects(send({...v.input,action:'review-scan',review:bad}));
      }
      await assert.rejects(send({...v.input,action:'verify',pngBase64:signingPng(3)}));
      const {method,...canvas}=v.input;await assert.rejects(send({...canvas,action:'read'}),/CONTEXT_CHANGED/);
      await assert.rejects(send({...v.input,action:'scan-page',page:2,scanSha256:r.scanSha256}));
      await assert.rejects(send({...v.input,action:'scan-page',page:1,scanSha256:'0'.repeat(64)}));
      const again=await send({...v.input,action:'upload-scan',pdfBase64:bytes.toString('base64')});assert.deepEqual(again.scan,v.capture.scan);
      await assert.rejects(send({...v.input,action:'upload-scan',pdfBase64:(await paperScanFixture(v.capture.original,++variant)).toString('base64')}),/CAPTURE_CONFLICT/);
      assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_monthly_confirmation_receipts WHERE proof_id=$1',[v.p.id])).rows[0].n,0);
    });
    await t.test('passive full PDF required: wrong count, corrupt, blank, encrypted, JavaScript and annotations rejected',async()=>{
      const good=new jsPDF();good.text('Synthetische Scanseite',20,30);const bytes=Buffer.from(good.output('arraybuffer'));
      await assert.rejects(inspectMonthlyScan(bytes,2));await assert.rejects(inspectMonthlyScan(Buffer.from('%PDF-broken'),1));
      await assert.rejects(inspectMonthlyScan(Buffer.alloc(2097153),1));await assert.rejects(inspectMonthlyScan(bytes,21));
      const blank=new jsPDF(),encrypted=new jsPDF({encryption:{userPassword:'private',ownerPassword:'private-owner'}});
      encrypted.text('Private page',20,30);
      const js=new jsPDF();js.text('Active page',20,30);js.addJS('app.alert("test")');
      const link=new jsPDF();link.textWithLink('Link',20,30,{url:'https://example.invalid/'});
      for(const pdf of [blank,encrypted,js,link])await assert.rejects(inspectMonthlyScan(Buffer.from(pdf.output('arraybuffer')),1));
    });
    await t.test('lost scan/review responses recover by status, never resend automatically, and resume exact original',async()=>{
      const v=await ready(),bytes=await paperScanFixture(v.capture.original,++variant),calls=[];let lose='upload-scan';
      const capture=new MonthlyCaptureSession(v.input,v.p.content_sha256,async command=>{calls.push(command.action);const value=await send(command);if(command.action===lose){lose='';throw Error('Response lost');}return value;});
      await capture.resume();assert.deepEqual(capture.original,v.capture.original);
      await assert.rejects(capture.uploadScan(bytes.toString('base64')),/Response lost/);await capture.check();assert.ok(capture.scan);assert.equal(capture.pending,null);
      lose='review-scan';await assert.rejects(capture.reviewScan(review({...v,capture})),/Response lost/);await capture.check();assert.ok(capture.receipt);assert.equal(capture.pending,null);
      assert.equal(calls.filter(x=>x==='upload-scan').length,1);assert.equal(calls.filter(x=>x==='review-scan').length,1);
      const resumed=new MonthlyCaptureSession(v.input,v.p.content_sha256,send);await resumed.resume();assert.deepEqual(resumed.receipt,capture.receipt);
      assert.equal((await confirm({...v,capture:resumed})).status,'final');
    });
    await t.test('scan reuse is rejected locally by bytes/appearance and independently by the database',async()=>{
      const first=await ready(),bytes=await upload(first);await first.capture.reviewScan(review(first));
      const second=await ready();await assert.rejects(send({...second.input,action:'upload-scan',pdfBase64:bytes.toString('base64')}),/SIGNATURE_REUSED/);
      const reencoded=Buffer.from(bytes.toString('latin1').replace(/\/ID \[ <[A-F0-9]+>/,`/ID [ <${'A'.repeat(32)}>`),'latin1');
      assert.notDeepEqual(reencoded,bytes);await assert.rejects(send({...second.input,action:'upload-scan',pdfBase64:reencoded.toString('base64')}),/SIGNATURE_REUSED/);
      // An independently provisioned archive has no local duplicate index. The
      // shared SQL receipt uniqueness must still reject the earlier scan.
      const otherStore=new MonthlyOriginalStore({path:join(dir,'other.sqlite'),key:randomBytes(32)}),other=new MonthlyOriginalHost({tenantId:f.tenant,store:otherStore,supabase:f.config,workerKeyId:f.workerKeyId,workerKey:f.workerKey,http:f.http});
      try{const c=new MonthlyCaptureSession(second.input,second.p.content_sha256,input=>other.execute(input,'Bearer '+f.token()));await c.prepare();await c.acknowledge();await c.uploadScan(bytes.toString('base64'));
        await assert.rejects(c.reviewScan({...review({...second,capture:c}),signatureBox:first.capture.original.original.paper.signatureBox}),/SIGNATURE_REUSED/);
      }finally{other.close();}
    });
    await t.test('private SQL rejects forged paper metadata and duplicate scans atomically across archives',async()=>{
      const v=await ready();await upload(v);await v.capture.reviewScan(review(v));const stored=store.get(f.tenant,v.input.captureId).receipt;
      const database=monthlyRestDatabase({config:f.config,tenantId:f.tenant,principal:{actorId:f.actorId,sessionId:f.sessionId},authorization:'Bearer '+f.token(),workerKeyId:f.workerKeyId,workerKey:f.workerKey,http:f.http});
      try{
        for(const change of [p=>({...p,pageSha256:[]}),p=>({...p,reviewedBy:f.otherActor}),p=>({...p,signatureBox:{...p.signatureBox,page:999}}),
          p=>({...p,scanPath:'tenant/other/scan.pdf'}),p=>({...p,issuedAt:'2099-01-01T00:00:00Z'}),p=>({...p,extra:true}),p=>({...p,reviewedAt:'2020-01-01T00:00:00Z'}),p=>p]){
          const capture=randomUUID(),prefix=`tenant/${f.tenant}/gkv/monthly/${v.p.id}/captures/${capture}`,candidate={...structuredClone(stored),id:randomUUID(),capture_id:capture,
            original_path:prefix+'/original.pdf',signature_path:prefix+'/signature.png',signature_sha256:randomBytes(32).toString('hex'),signature_ink_sha256:randomBytes(32).toString('hex')};
          candidate.paper=change({...candidate.paper,scanPath:prefix+'/scan.pdf'});
          await assert.rejects(database.issue(candidate));
          assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_monthly_confirmation_receipts WHERE id=$1',[candidate.id])).rows[0].n,0);
        }
        const downgraded=structuredClone(stored);delete downgraded.paper;await assert.rejects(database.issue(downgraded));await assert.rejects(database.receiptStatus(downgraded));
      }finally{database.close();}
    });
    await t.test('changed source and revoked representative prevent scan review and final consumption',async()=>{
      const v=await ready();await upload(v);
      await f.db.query("UPDATE assist_visit_proofs SET payload_snapshot=jsonb_set(payload_snapshot,'{documentationNote}','\"Geändert\"') WHERE id=$1",[v.p.payload.records[0].sourceReceipt.proof_id]);
      await assert.rejects(v.capture.reviewScan(review(v)),/STALE/);
      const a=await f.proof(),id=randomUUID();await f.authority(a.p.id,'register',{id,signerName:'Fiktive Vertretung',basis:'vollmacht',evidenceReference:'Fiktive Prüfakte',reviewNote:'Fiktive Identität und Befugnis geprüft',validFrom:new Date(Date.now()-60000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),reviewed:true});
      a.input={...a.input,method:'paper',authorityId:id};a.capture=new MonthlyCaptureSession(a.input,a.p.content_sha256,send);await a.capture.prepare();await a.capture.acknowledge();await upload(a);await a.capture.reviewScan(review(a));
      await f.authority(a.p.id,'revoke',{id,reason:'Widerruf vor endgültigem Abschluss'});await assert.rejects(confirm(a),e=>e.code==='40001');
      assert.equal((await f.db.query('SELECT consumed_at FROM care_security.gkv_monthly_confirmation_receipts WHERE id=$1',[a.capture.receipt.receiptId])).rows[0].consumed_at,null);
    });
    await t.test('paper expiry, personal session and private SQL permissions remain enforced',async()=>{
      const v=await ready(),database=monthlyRestDatabase({config:f.config,tenantId:f.tenant,principal:{actorId:f.actorId,sessionId:f.sessionId},authorization:'Bearer '+f.token(),workerKeyId:f.workerKeyId,workerKey:f.workerKey,http:f.http});
      try{for(const days of [0.1,8]){
        const verifier=new MonthlyOriginalVerifier({store,database:{...database,context:async input=>({...await database.context(input),checkedAt:new Date(Date.now()+days*86400000).toISOString()})}});
        if(days<7)assert.ok((await verifier.readOriginal(v.input)).paper);else await assert.rejects(verifier.readOriginal(v.input),/CAPTURE_EXPIRED/);
      }}finally{database.close();}
      const nextSession=randomUUID();await f.db.query('INSERT INTO auth.sessions VALUES($1,$2,NULL)',[nextSession,f.actorId]);
      await assert.rejects(host.execute({...v.input,action:'read'},'Bearer '+f.token({session_id:nextSession})),/CONTEXT_CHANGED/);
      for(const sql of ['SELECT * FROM care_security.gkv_monthly_paper_receipts',`SELECT care_security.gkv_monthly_receipt_paper('${randomUUID()}')`,`SELECT care_security.gkv_monthly_bind_paper('{}','{}')`])await assert.rejects(f.as(f.claims(),sql),e=>e.code==='42501');
      assert.throws(()=>readMonthlyOriginalCommand({...v.input,action:'review-scan',review:{},actorId:f.actorId}));
    });
  }finally{host.close();await f.close();await rm(dir,{recursive:true,force:true});}
});
