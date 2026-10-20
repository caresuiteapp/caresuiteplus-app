import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const checks=[
 ['--test','supabase/tests/consultation_workspace.test.mjs','supabase/tests/consultation_legacy_access.test.mjs','src/__tests__/beratung/workspaceModel.test.mjs','src/__tests__/beratung/workspaceNavigation.test.mjs'],
 ['scripts/verify-consultation-interaction.mjs'],
 ['scripts/generate-web-route-parents.mjs','--check'],
];
for(const args of checks){const result=spawnSync(process.execPath,args,{cwd,stdio:'inherit',env:{...process.env,TZ:'Europe/Berlin'}});if(result.error||result.status!==0)process.exit(result.status||1);}
console.log('Consultation data and DOM workflow checks passed with isolated data. Browser layout, real pointer signatures and deployed Supabase auth remain separate release gates.');
