import {readFile} from 'node:fs/promises';
const dir=new URL('../docs/gkv/',import.meta.url);
const read=f=>readFile(new URL(f,dir),'utf8');
const opt=process.argv[2];
if(process.argv.length!==3)throw Error('Expected --migration-body or --native-replay');
if(opt==='--migration-body'){
 const layout=(await read('checks/staging-portal-storage-layout.sql')).trimEnd().replace(/;$/,'');
 process.stdout.write(`SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s'; SET LOCAL search_path=pg_catalog,public;
DO $target$ BEGIN
 IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version='20261104140126' AND name='gkv_staging_bind_portal_original_hashes'
 AND encode(sha256(convert_to(statements[1],'UTF8')),'hex')='6bb249a43181b4f3d55037008a62d7d84f422838ac8d81e2f5f766631842cc3d')
 OR (SELECT digest FROM (\n${layout}\n) s) IS DISTINCT FROM 'd7b40583d20fc89148504aa1f4eda090043d862e278346b979065abfb39d87a1'
 OR to_regprocedure('care_security.gkv_portal_object_allowed(text,text,text)') IS NOT NULL THEN RAISE EXCEPTION 'Unreviewed staging storage target'; END IF;
END $target$;
`+await read('../../supabase/migrations/20261104141643_guard_portal_assist_original_storage.sql')+`
DO $acl$ DECLARE p oid:='care_security.gkv_portal_object_allowed(text,text,text)'::regprocedure;
BEGIN
 IF has_function_privilege('anon',p,'EXECUTE') OR has_function_privilege('service_role',p,'EXECUTE') OR NOT has_function_privilege('authenticated',p,'EXECUTE')
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='storage.objects'::regclass AND NOT polpermissive AND polname IN('gkv_portal_original_read','gkv_portal_original_insert','gkv_portal_original_update','gkv_portal_original_delete','gkv_portal_original_no_anon'))<>5
 THEN RAISE EXCEPTION 'Incorrect object grants or restrictive policies'; END IF;
END $acl$;
NOTIFY pgrst, 'reload schema';
`);
}else if(opt==='--native-replay'){
 const previous=await read('checks/staging-employee-release-replay.sql'),end="SELECT 'passed' AS staging_employee_account_release_rolled_back;\nROLLBACK;";
 if(!previous.trimEnd().endsWith(end))throw Error('Expected the transactional account fixture');
 process.stdout.write(previous.trimEnd().slice(0,-end.length)+await read('checks/staging-portal-integrity-cases.sql')+'\n'+await read('checks/staging-portal-storage-replay.sql')+'\nROLLBACK;\n');
}else throw Error('Use --migration-body or --native-replay');
