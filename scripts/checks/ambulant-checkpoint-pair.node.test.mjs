import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { calculateMilestone, accepted } from './ambulant-milestone-progress.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const fixture=path.join(root,'scripts/checks/fixtures/ambulant-checkpoint-pair');
const baseline=JSON.parse(fs.readFileSync(path.join(fixture,'matching-catalog.json'),'utf8'));
const provenance=JSON.parse(fs.readFileSync(path.join(fixture,'provenance.json'),'utf8'));
const originalLog=fs.readFileSync(path.join(root,'docs/audit/checks/ambulant-node-checkpoint258-2026-10-14.log'),'utf8');
const originalBook=path.join(fixture,'checkpoint258-original.xlsx');
function verify(change=()=>{},log=originalLog,progressChange=()=>{},book=originalBook,useDeclaredLog=false){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'care-pair-check-'));
 try{
  const catalog=structuredClone(baseline);change(catalog);
  const progress=calculateMilestone(catalog);progressChange(progress);
  fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify(catalog));
  fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify(progress));
  fs.writeFileSync(path.join(dir,'run.log'),log);
  const args=[path.join(root,'scripts/verify-ambulant-checkpoint-inputs.py'),book,'--root',root,'--catalog',path.join(dir,'catalog.json'),'--progress',path.join(dir,'progress.json')];
  if(!useDeclaredLog)args.push('--log',path.join(dir,'run.log'));
  return spawnSync('python3',args,{cwd:root,encoding:'utf8',timeout:30000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function rejected(result,reason){assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,reason);assert.equal(result.stdout,'');}

test('Read-only gate verifies every matching native task, packet, gate/source row and all 264 acceptance formulas without changing the original XLSX',()=>{
 const before=fs.readFileSync(originalBook),hash=createHash('sha256').update(before).digest('hex');
 assert.equal(hash,provenance.originalWorkbookSha256);
 const r=verify();assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);
 assert.deepEqual([result.checkpoint,result.tasks,result.packets,result.gates,result.sources,result.accepted,result.goalReached,result.nodeTests],[258,262,97,28,15,1,false,9890]);
 assert.equal(result.workbookSha256,hash);assert.deepEqual(fs.readFileSync(originalBook),before);
});
for(const field of ['title','data','criterion','packet','depends','implementation','function','care','design','legal','evidence','next'])test(`Actual workbook gate refuses source-only ${field} drift instead of embedding an unrelated worksheet`,()=>{
 rejected(verify(c=>{c.tasks[0][field]+=' changed';}),/Workbook\/source mismatch/);
});
test('A claimed complete new acceptance with a recomputed source milestone cannot borrow the old workbook acceptance cache',()=>{
 rejected(verify(c=>Object.assign(c.tasks[0],{implementation:'Umgesetzt',function:'Bestanden',care:'Bestanden',design:'Bestanden',legal:'Bestanden',evidence:'separate claimed acceptance'})),/Workbook\/source mismatch/);
});
test('Current source identity cannot replace an older native task identity',()=>{
 rejected(verify(c=>{c.tasks[0].id='A-99';}),/identities in Aufgaben/);
});
test('Source-only packet status and follow-up drift are both rejected',()=>{
 for(const index of [5,6])rejected(verify(c=>{c.packets[0][index]+=' changed';}),/Workbook\/source mismatch/);
});
test('Gate meaning and public source provenance must still match their native rows',()=>{
 rejected(verify(c=>{c.gates[0][3]+=' changed';}),/Workbook\/source mismatch/);
 rejected(verify(c=>{c.sources[0][4]+=' changed';}),/Workbook\/source mismatch/);
});
test('A separately edited saved milestone cannot assert a reached target or extra acceptances',()=>{
 for(const mutate of [p=>{p.reached=true;},p=>{p.accepted++;},p=>{p.areas[0].accepted++;},p=>{p.reached=0;}])rejected(verify(()=>{},originalLog,mutate),/Saved milestone does not match/);
});
for(const [name,log] of [
 ['failure',originalLog.replace('ℹ fail 0','ℹ fail 1')],
 ['cancelled run',originalLog.replace('ℹ cancelled 0','ℹ cancelled 1')],
 ['skipped cases',originalLog.replace('ℹ skipped 0','ℹ skipped 1')],
 ['todo cases',originalLog.replace('ℹ todo 0','ℹ todo 1')],
 ['different test and pass totals',originalLog.replace('ℹ pass 9890','ℹ pass 9889')],
 ['unfinished log',originalLog.replace(/^ℹ todo 0\r?\n/gm,'')],
 ['concatenated passing runs',originalLog+'\n'+originalLog],
 ['earlier pass followed by failure',originalLog+'\n'+originalLog.replace('ℹ fail 0','ℹ fail 1')],
])test(`Full-run evidence refuses ${name}`,()=>{rejected(verify(()=>{},log),/Node (summary|run)/);});
test('Truncated or non-ZIP input is rejected without an output workbook',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'care-pair-truncated-'));
 try{const p=path.join(dir,'damaged.xlsx');fs.writeFileSync(p,fs.readFileSync(originalBook).subarray(0,100));rejected(verify(()=>{},originalLog,()=>{},p),/not a zip file/);assert.deepEqual(fs.readdirSync(dir),['damaged.xlsx']);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Original CP258 metadata discrepancies stay visible; fixture alignment never edits the real source catalog',()=>{
 const current=JSON.parse(fs.readFileSync(path.join(root,'docs/audit/ambulant-az-katalog-2026-10-08.json'),'utf8'));
 // This regression is tied to the archived CP258 baseline, not future catalogs.
 const old=structuredClone(baseline);
 for(const adjustment of provenance.fixtureOnlyCatalogAdjustments){
  const [group,key,field]=adjustment.fixtureField.split('.');
  if(group==='tasks')old.tasks.find(t=>t.id===key)[field]=adjustment.originalSource;
  else old.packets.find(p=>p[0]===key)[Number(field)]=adjustment.originalSource;
 }
 const r=verify(c=>{Object.assign(c,old);});
 rejected(r,/mismatch in 4 cells: Aufgaben!O164, Aufgaben!O201, Pakete!F11, Pakete!G11/);
 if(current.version===258)assert.deepEqual(current,old);
});
test('Authoritative milestone keeps the per-area requirement and rejects partial or evidence-free acceptance',()=>{
 const c=structuredClone(baseline);
 for(const t of c.tasks)Object.assign(t,{implementation:'Bestand zu prüfen',function:'Offen',care:'Offen',design:'Offen',legal:'Offen',evidence:''});
 for(const t of c.tasks.slice(0,131))Object.assign(t,{implementation:'Umgesetzt',function:'Bestanden',care:'Bestanden',design:'Bestanden',legal:'Bestanden',evidence:'test fixture only'});
 const p=calculateMilestone(c);assert.equal(p.accepted,131);assert.equal(p.reached,false);assert.equal(p.required,131);
 assert.equal(accepted({...c.tasks[0],evidence:'  '}),false);assert.equal(accepted({...c.tasks[0],design:'Offen'}),false);
});
test('An explicitly identified complete run preserves the historical log and binds its native SHA-256',()=>{
 const relative='docs/audit/checks/ambulant-node-checkpoint258-2026-10-14.log';
 const r=verify(c=>{c.checkpointNodeLog=relative;},originalLog,()=>{},originalBook,true);
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).nodeLogSha256,createHash('sha256').update(fs.readFileSync(path.join(root,relative))).digest('hex'));
});
for(const declared of ['../outside.log','docs/audit/checks/../../outside.log','docs/audit/checks/ambulant-node-checkpoint259-2026-10-14.log',false])test(`An invalid declared run cannot substitute unrelated evidence: ${String(declared)}`,()=>{
 rejected(verify(c=>{c.checkpointNodeLog=declared;},originalLog,()=>{},originalBook,true),/Invalid declared checkpoint Node log/);
});
test('A missing explicitly declared run never silently borrows the older passing log',()=>{
 rejected(verify(c=>{c.checkpointNodeLog='docs/audit/checks/ambulant-node-checkpoint258-missing-run.log';},originalLog,()=>{},originalBook,true),/No such file/);
});
