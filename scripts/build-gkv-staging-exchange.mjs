// Print the reviewed transaction; never connects to a database.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const read = p => readFile(new URL('../'+p, import.meta.url),'utf8');
const history = '90721fa45a58eaa05675ceb09d054a95013dd633130872a9cb81546627c6c889';
const layout = '0d99e23ec42e8c0d18759f5af00060f0cd5ef0b3dcd62367186c14cb6748990f';
const sources = {
 '20261019214752_gkv_exchange_workspace.sql':'666595d2497d55bcb4cffd1d0f9ebb6358f3cebdb23c2a4a80074a0c35e3bfd0',
 '20261019214802_gkv_revision_history.sql':'373c0f6fb59eef5ee0765f741d254daf1c17420170786c1a408eaad6d27356ac',
 '20261013072827_verified_assignment_service_records.sql':'1913db2a0416b6f47cc685aa4965456110ad90bc5a79423b3fa4d711a53ffab1',
};
export const readTables=['batches','settings','directories','events','revisions'].map(s=>'public.gkv_exchange_'+s);
export const privateTable='care_security.gkv_exchange_requests';
export const callable=[
 'care_security.gkv_exchange_actor(uuid,text)','care_security.gkv_exchange_command(uuid,uuid,text,jsonb)',
 'public.gkv_exchange_command(uuid,uuid,text,jsonb)','public.gkv_exchange_export_allowed(uuid)',
 'care_security.gkv_exchange_copy_revision(uuid,uuid,jsonb)','public.gkv_exchange_copy_revision(uuid,uuid,jsonb)',
];
export const internal=['care_security.gkv_exchange_capture_revision()','public.workflow_record_actor_allowed(uuid,uuid)',
 'public.workflow_task_state(text)','public.workflow_tasks_match(jsonb,uuid,uuid,uuid,boolean)','public.workflow_canonical_json(jsonb)'];
const array = values => 'ARRAY['+values.map(s=>"'"+s+"'").join(',')+']';
export async function exchangeStatements() {
 const contents=[];
 for (const [file,digest] of Object.entries(sources)) {
   const source=await read('supabase/migrations/'+file);
   if(createHash('sha256').update(source).digest('hex')!==digest) throw Error('Review revised source: '+file);
   if(file.startsWith('20261013')){
     const start=source.indexOf('CREATE OR REPLACE FUNCTION public.workflow_canonical_json');
     const end=source.indexOf('REVOKE ALL ON FUNCTION public.workflow_canonical_json',start);
     if(start<0||end<start) throw Error('Canonical JSON contract missing');
     contents.push(source.slice(start,end).replace('CREATE OR REPLACE','CREATE'));
   } else {
     if(!/^BEGIN;$/m.test(source)||!/^COMMIT;\s*$/.test(source.slice(source.lastIndexOf('COMMIT;')))) throw Error('Invalid transaction: '+file);
     // Empty new tables only. No historical migration is re-registered or replaced.
     contents.push(source.replace(/^BEGIN;$/m,'').replace(/^COMMIT;\s*$/m,'')
       .replace(/^DROP POLICY IF EXISTS [^;]+;\n/gm,'').replace(/^(CREATE (?:TABLE|INDEX)) IF NOT EXISTS /gm,'$1 ')
       .replace(/^CREATE OR REPLACE FUNCTION /gm,'CREATE FUNCTION '));
   }
 }
 contents.push(await read('docs/gkv/sql/staging-workflow-helpers.sql'),
   'REVOKE ALL ON TABLE '+[...readTables,privateTable].join(',')+' FROM PUBLIC, anon, authenticated, service_role;',
   'GRANT SELECT ON TABLE '+readTables.join(',')+' TO authenticated;',
   'REVOKE ALL ON FUNCTION '+[...callable,...internal].join(',')+' FROM PUBLIC, anon, authenticated, service_role;',
   'GRANT EXECUTE ON FUNCTION '+callable.join(',')+' TO authenticated;',
   await read('docs/gkv/checks/staging-exchange-acl.sql'));
 return contents.join('\n');
}
export async function stagingExchangeBody(){
 const check=(await read('docs/gkv/checks/staging-exchange-inputs.sql')).trimEnd().replace(/;$/,'');
 return [
 "SET LOCAL lock_timeout='3s';","SET LOCAL statement_timeout='30s';","SET LOCAL search_path=pg_catalog,public;",
 `DO $target$ DECLARE state record; name text; BEGIN
 SELECT * INTO state FROM (${check}) src;
 IF state.history IS DISTINCT FROM '${history}' OR state.layout IS DISTINCT FROM '${layout}' THEN
   RAISE EXCEPTION 'Different staging history, schema or authorization; review the target again'; END IF;
 FOREACH name IN ARRAY ${array([...readTables,privateTable])} LOOP
   IF to_regclass(name) IS NOT NULL THEN RAISE EXCEPTION 'Refusing to replace %',name; END IF; END LOOP;
 FOREACH name IN ARRAY ${array([...callable,...internal])} LOOP
   IF to_regprocedure(name) IS NOT NULL THEN RAISE EXCEPTION 'Refusing to replace %',name; END IF; END LOOP;
 END $target$;`,
 await exchangeStatements(),"NOTIFY pgrst, 'reload schema';",''].join('\n');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);
 if(args.length>1 || (args.length && args[0]!=='--migration-body')) throw Error('Expected no option or --migration-body');
 const body=await stagingExchangeBody();
 process.stdout.write(args.length?body:'BEGIN;\n'+body+'COMMIT;\n');
}
