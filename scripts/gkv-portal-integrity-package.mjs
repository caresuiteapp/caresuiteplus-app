// Print SQL for the existing staging database. This script does not open a connection.
import {readFile} from 'node:fs/promises';
const files=new URL('../docs/gkv/',import.meta.url);
const read=path=>readFile(new URL(path,files),'utf8');
const arg=process.argv.slice(2);
if(arg.length!==1 || !['--migration-body','--native-replay'].includes(arg[0]))throw Error('Use --migration-body or --native-replay');
if(arg[0]==='--migration-body'){
 const blocks=await Promise.all(['checks/staging-portal-integrity-target.sql','sql/portal-source-integrity.sql','checks/staging-portal-integrity-acl.sql'].map(read));
 process.stdout.write(blocks.join('\n')+"\nNOTIFY pgrst, 'reload schema';\n");
}else{
 const previous=await read('checks/staging-employee-release-replay.sql'),end="SELECT 'passed' AS staging_employee_account_release_rolled_back;\nROLLBACK;";
 if(!previous.trimEnd().endsWith(end))throw Error('Expected the transactional account fixture');
 process.stdout.write(previous.trimEnd().slice(0,-end.length)+await read('checks/staging-portal-integrity-cases.sql')+'\nROLLBACK;\n');
}
