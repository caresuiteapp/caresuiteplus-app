import {existsSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),reportIndex=args.indexOf('--report');
const allowIncomplete=args.includes('--allow-incomplete');
const reportPath=reportIndex<0?null:args[reportIndex+1];
const known=new Set(['--allow-incomplete','--report']);
if(args.includes('--help')){
 console.log('Usage: node scripts/verify-pflege-medication-workspace.mjs [--report file.json] [--allow-incomplete]\nRuns medication, shared clinical-authority and locked-deployment Node checks, existing medication/module-access Vitest suites and Edge syntax checks, then separate Web and Edge type checks with installed tools. No install, network dependency fetch, deployment or activation. Default exit 2 when a required compiler is unavailable; --allow-incomplete permits development checks while the report still says complete=false.');
 process.exit(0);
}
if(reportIndex>=0&&(!reportPath||reportPath.startsWith('--'))||args.some((arg,index)=>!(reportIndex>=0&&index===reportIndex+1)&&!known.has(arg))){console.error('Invalid verification options. Use --help.');process.exit(1);}
const stages=[];
const git=(...params)=>spawnSync('git',params,{cwd:root,encoding:'utf8'});
const head=git('rev-parse','HEAD');
const changes=git('status','--porcelain');
const report={schemaVersion:1,verificationScope:'local_automated_checks',releaseAcceptance:'not_assessed',startedAt:new Date().toISOString(),head:head.status===0?head.stdout.trim():null,dirty:changes.status===0?changes.stdout.length>0:null,complete:false,stages};
function run(label,command,params,extra={}){
 console.log(`\n[pflege-medication] ${label}`);
 const result=spawnSync(command,params,{cwd:root,stdio:'inherit',env:process.env});
 const passed=!result.error&&result.status===0;
 stages.push({name:label,status:passed?'passed':'failed',command:[command,...params],exitCode:result.status,signal:result.signal??null,...extra,...(result.error?{error:result.error.message}:{})});
 return passed;
}
function unavailable(name,reason,extra={}){console.error(`[pflege-medication] ${name}: NOT RUN — ${reason}`);stages.push({name,status:'not_run',reason,...extra});}
const checksDirectory=path.join(root,'scripts/checks');
const suites=existsSync(checksDirectory)?readdirSync(checksDirectory).filter(name=>/^medication.*\.node\.test\.mjs$/.test(name)||['pflege-locked-deployment.node.test.mjs','care-workspace-authority-web.node.test.mjs'].includes(name)).sort().map(name=>`scripts/checks/${name}`):[];
if(suites.length===0)unavailable('Medication Node regression suites','No medication suites are present in this checkout.');
else run('Medication and shared-authority Node regression suites',process.execPath,['--test',...suites],{suiteCount:suites.length});
// Keep the existing project-level database/domain and release-visibility suites
// visible even in a sparse checkout. A Node-only pass cannot silently omit them.
const indexedSuites=git('ls-files','src/__tests__');
const vitestSuites=indexedSuites.status===0?indexedSuites.stdout.split('\n').filter(file=>/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)&&(/medication/i.test(path.basename(file))||/unreleasedModules(?:GlobalLock|VisibilityLock)\.test\.ts$/.test(file))).sort():[];
const vitest=path.join(root,'node_modules/vitest/vitest.mjs');
const missingVitestSuites=vitestSuites.filter(file=>!existsSync(path.join(root,file)));
if(indexedSuites.status!==0)unavailable('Medication project regression suites','The tracked test inventory could not be read.');
else if(vitestSuites.length===0)unavailable('Medication project regression suites','No matching project-level medication/module-lock suites were found.');
else if(!existsSync(vitest)||missingVitestSuites.length)unavailable('Medication project regression suites',[
 !existsSync(vitest)?'The project Vitest runner is not installed.':null,
 missingVitestSuites.length?'Required project tests are not materialized in this checkout.':null,
].filter(Boolean).join(' '),{suiteCount:vitestSuites.length,suites:vitestSuites,missingFiles:missingVitestSuites});
else run('Medication project regression suites',process.execPath,[vitest,'run','--maxWorkers=2',...vitestSuites],{suiteCount:vitestSuites.length});
const edgeDirectory=path.join(root,'supabase/functions/medication-source-archive');
const edgeFiles=existsSync(edgeDirectory)?readdirSync(edgeDirectory).filter(name=>name.endsWith('.ts')).sort().map(name=>`supabase/functions/medication-source-archive/${name}`):[];
if(edgeFiles.length===0)unavailable('Edge syntax','Archive worker files are missing from this checkout.');
else for(const file of edgeFiles)run(`Edge syntax: ${path.basename(file)}`,process.execPath,['--check',file],{scope:'syntax_only'});
const typescript=path.join(root,'node_modules/typescript/bin/tsc');
if(existsSync(typescript))run('Web TypeScript',process.execPath,['--max-old-space-size=8192',typescript,'--noEmit','--skipLibCheck']);
else unavailable('Web TypeScript','The project TypeScript compiler is not installed. Node syntax checks and test execution do not prove type correctness.');
const denoVersion=spawnSync('deno',['--version'],{cwd:root,encoding:'utf8'});
if(denoVersion.error||denoVersion.status!==0)unavailable('Edge TypeScript','Deno is not installed. The project tsconfig excludes supabase/functions, so Web TypeScript does not cover the worker.');
else{
 const help=spawnSync('deno',['check','--help'],{cwd:root,encoding:'utf8'});
 if(help.status!==0||!help.stdout.includes('--cached-only'))unavailable('Edge TypeScript','Installed Deno does not advertise cached-only checking; verification will not fetch dependencies.');
 else run('Edge TypeScript','deno',['check','--cached-only','supabase/functions/medication-source-archive/index.ts'],{scope:'cached_dependencies_only'});
}
report.completedAt=new Date().toISOString();
report.complete=stages.length>0&&stages.every(stage=>stage.status==='passed');
report.failed=stages.some(stage=>stage.status==='failed');
if(reportPath){const absolute=path.resolve(root,reportPath);mkdirSync(path.dirname(absolute),{recursive:true});writeFileSync(absolute,JSON.stringify(report,null,2)+'\n');console.log(`[pflege-medication] Report: ${absolute}`);}
console.log(`[pflege-medication] Local automated checks complete: ${report.complete}. Passed: ${stages.filter(s=>s.status==='passed').length}. Failed: ${stages.filter(s=>s.status==='failed').length}. Not run: ${stages.filter(s=>s.status==='not_run').length}.`);
process.exitCode=report.failed?1:report.complete||allowIncomplete?0:2;
