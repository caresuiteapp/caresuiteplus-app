// BRANCH-ONLY synthetic PostgreSQL fixture, NOT a full RPC execution/authorization
// or proof/Storage/WFM test. Preserve exact captured complete definitions separately.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
const require=createRequire(import.meta.url),{PGlite}=require('@electric-sql/pglite');
const metadata=JSON.parse(readFileSync(new URL('../../docs/workflow-server-write-rpc-metadata-20261011.json',import.meta.url),'utf8'));
const draft=readFileSync(new URL('../../docs/workflow-server-overlap-confirmation-draft.sql',import.meta.url),'utf8');
const oldCondition='v_overlap > 0 AND NOT p_confirm_overlap';
const newCondition='v_overlap > 0 AND p_confirm_overlap IS NOT TRUE';
const names=['employee_portal_correct_open_visit_times','admin_correct_assist_visit_times'];
const db=new PGlite();
for(const [index,name] of names.entries()){
 const row=metadata.functions.find(f=>(f.name??f.proname)===name);
 assert.ok(row,'confirmed captured definition exists');
 const original=row.definition;
 const expected=original.replace(oldCondition,newCondition).trimEnd();
 const start=draft.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');
 assert.ok(start>=0,'exact original RPC signature must remain');
 const closing=draft.indexOf('$function$',draft.indexOf('$function$',start)+10)+10;
 const actual=draft.slice(start,closing);
 await test(name+' preserves exact full signature/defaults/rest body except the confirmed NULL branch',()=>{
  assert.equal(original.split(oldCondition).length-1,1);
  assert.equal(actual,expected);
  assert.equal(actual.replace(newCondition,oldCondition),original.trimEnd());
 });
 // Extract the exact confirmation block from each preserved definition. Replace
 // only its condition for the before model; no other RPC behavior is simulated.
 const match=actual.match(/IF (v_overlap > 0 AND p_confirm_overlap IS NOT TRUE) THEN([\s\S]*?)END IF;/);
 assert.ok(match,'confirmed single overlap-return block exists');
 const block=match[0];
 for(const [version,sqlBlock] of [['before',block.replace(newCondition,oldCondition)],['after',block]]){
  await db.exec(`CREATE FUNCTION branch_${index}_${version}(v_overlap integer,p_confirm_overlap boolean)
   RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN ${sqlBlock}
   RETURN jsonb_build_object('branchContinued',true); END $$;`);
 }
 const branch=async(version,overlap,confirm)=>(await db.query('SELECT branch_'+index+'_'+version+'($1,$2) AS result',[overlap,confirm])).rows[0].result;
 await test(name+' reproduces old explicit-NULL confirmation bypass in PostgreSQL branch',async()=>{
  assert.deepEqual(await branch('before',2,null),{branchContinued:true});
 });
 for(const [label,overlap,confirm,blocked] of [['NULL',2,null,true],['false',2,false,true],['true',2,true,false],['zero NULL',0,null,false],['zero false',0,false,false]]){
  await test(name+' bounded confirmation branch '+label,async()=>{
   assert.deepEqual(await branch('after',overlap,confirm),blocked?{ok:false,overlap:true,count:overlap}:{branchContinued:true});
  });
 }
}
await db.close();
