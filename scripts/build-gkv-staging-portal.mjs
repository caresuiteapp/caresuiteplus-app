// Builds and prints the staging transaction. Never opens a network connection.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
export const portalFunctions=[
  'public.employee_portal_release_deferred_signature(uuid,uuid,uuid,text,jsonb,text)',
  'public.client_portal_finalize_assist_proof(uuid,uuid,uuid,text,text,text,text)',
  'public.client_portal_can_read_assist_signature(text)',
  'public.client_portal_can_upload_proof_recovery(text)'
];
export async function portalStatements(){
  const createOnly=sql=>sql.replace(/^CREATE OR REPLACE FUNCTION /gm,'CREATE FUNCTION ');
  const rpcs=portalFunctions.join(', ');
  return [
    await read('docs/gkv/sql/staging-portal-audit.sql'),
    createOnly(await read('docs/gkv/sql/portal-employee-release.sql')),
    createOnly(await read('docs/gkv/sql/portal-client-assist-signature.sql')),
    // Supabase project defaults can grant functions to service_role independently of PUBLIC.
    'REVOKE ALL ON FUNCTION '+rpcs+' FROM PUBLIC, anon, service_role;',
    `DO $verify$ DECLARE f regprocedure; BEGIN
      FOREACH f IN ARRAY ARRAY[${portalFunctions.map(f=>"'"+f+"'::regprocedure").join(',')}] LOOP
        IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('service_role',f,'EXECUTE')
          OR NOT has_function_privilege('authenticated',f,'EXECUTE') THEN
          RAISE EXCEPTION 'Unexpected portal grants on %', f;
        END IF;
      END LOOP;
    END $verify$;`
  ].join('\n');
}
export async function stagingPortalBody(){
  const target=await read('docs/gkv/checks/staging-portal-target.sql');
  return ["SET LOCAL lock_timeout='3s';","SET LOCAL statement_timeout='30s';",
    'SET LOCAL search_path = pg_catalog, public;',target,await portalStatements(),"NOTIFY pgrst, 'reload schema';",''].join('\n');
}
export async function stagingPortalTransaction(){return 'BEGIN;\n'+await stagingPortalBody()+'COMMIT;\n';}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=process.argv.slice(2);
  if(arg.length>1 || (arg.length===1 && arg[0]!=='--migration-body')) throw Error('Use no argument or --migration-body for an externally managed transaction');
  process.stdout.write(await (arg.length?stagingPortalBody():stagingPortalTransaction()));
}
