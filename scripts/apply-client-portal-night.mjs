import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const stop=message=>{throw new Error(message);};
const localPath=value=>process.platform==='win32'&&/^\/[a-z]\//i.test(value)?value[1].toUpperCase()+':'+value.slice(2).replaceAll('/',path.sep):path.resolve(value);
function run(command,args,cwd,inherit=false){const result=spawnSync(command,args,{cwd,stdio:inherit?'inherit':'pipe',encoding:'utf8',windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},maxBuffer:16*1024*1024});if(result.error)throw result.error;if(result.status!==0)stop(`${path.basename(command)} konnte nicht erfolgreich abgeschlossen werden (Status ${result.status}).`);return result.stdout;}
function application(value){try{const root=fs.realpathSync(value);return fs.statSync(path.join(root,'package.json')).isFile()&&fs.statSync(path.join(root,'src')).isDirectory()&&fs.statSync(path.join(root,'app/portal/client')).isDirectory()?root:null;}catch{return null;}}
function discover(){const pointer=path.join(os.homedir(),'CareSuite_NEO_Netlify_R3_Arbeitsstand.json');try{const p=JSON.parse(fs.readFileSync(pointer,'utf8'));const record=JSON.parse(fs.readFileSync(path.join(localPath(p.workspace),'neo-prepared.json'),'utf8'));const root=application(localPath(record.root));if(root)return root;}catch{}return application(process.cwd());}
function safeFile(root,relative){if(!/^(?:src|app|docs|scripts|supabase\/migrations)\//.test(relative)||relative.includes('\\')||relative.includes(':')||relative.split('/').some(p=>!p||p==='.'||p==='..'))stop('Ungültiger Paketpfad.');let target=root;for(const part of relative.split('/')){target=path.join(target,part);if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())stop(`Verknüpfter Quelldateipfad wird nicht überschrieben: ${relative}`);}return target;}
export function mergePortalFile(current,base,next,relative,temporary){
 if(current===next)return {status:'already',content:next};
 if(current===base)return {status:'updated',content:next};
 if(base===null)return {status:'conflict',content:null};
 if(current===null)return {status:'conflict',content:null};
 if(relative.startsWith('docs/')&&next.startsWith(base))return {status:'merged',content:current+(current.endsWith('\n')?'':'\n')+next.slice(base.length)};
 const folder=fs.mkdtempSync(path.join(temporary,'merge-'));const names=['current','base','new'];[current,base,next].forEach((text,i)=>fs.writeFileSync(path.join(folder,names[i]),text));
 const result=spawnSync('git',['merge-file','-p',...names.map(name=>path.join(folder,name))],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(result.error)throw result.error;
 return result.status===0?{status:'merged',content:result.stdout}:{status:'conflict',content:result.stdout};
}
export function runClientPortalUpdate(argv=process.argv.slice(2)){
 const options={mode:'prepare'};
 for(let i=0;i<argv.length;i++){const arg=argv[i];if(['--check','--prepare'].includes(arg))options.mode=arg.slice(2);else if(['--repo','--output','--payload'].includes(arg)&&argv[i+1])options[arg.slice(2)]=localPath(argv[++i]);else if(arg==='--help'){console.log('Klientenportal Night: --check prüft die Zusammenführung, --prepare erstellt und prüft eine getrennte Arbeitskopie. Optional --repo bestehender-App-Ordner, --output neuer-Ordner. Keine Veröffentlichung und kein Push.');return;}else stop(`Unbekannte Option: ${arg}`);}
 if(Number(process.versions.node.split('.')[0])!==24)stop('Bitte die bereits verwendete Node-24-Umgebung verwenden.');
 if(!options.payload)stop('Dieses Skript wird über das vollständige Git-Bash-Paket gestartet.');
 const pack=JSON.parse(fs.readFileSync(options.payload,'utf8'));if(pack.version!==1||!Array.isArray(pack.files)||pack.files.length>250)stop('Paketmanifest ist ungültig.');
 const source=options.repo?application(options.repo):discover();if(!source)stop('Der aktuelle App-Quellordner wurde nicht eindeutig gefunden. Bitte --repo mit dem vorhandenen CareSuite-App-Ordner angeben.');
 run('git',['rev-parse','--show-toplevel'],source);
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'caresuite-client-merge-'));
 try{
  const plan=pack.files.map(file=>{const target=safeFile(source,file.path);const current=fs.existsSync(target)?fs.readFileSync(target,'utf8'):null;if(sha(Buffer.from(file.next))!==file.sha256||file.base!==null&&typeof file.base!=='string')stop('Paket-Prüfsumme stimmt nicht.');return {...file,current,...mergePortalFile(current,file.base,file.next,file.path,temporary)};});
  const conflicts=plan.filter(file=>file.status==='conflict');
  console.log(`Geprüfter Quellordner: ${source}`);console.log(`${plan.length} Dateien: ${plan.filter(f=>f.status==='updated').length} direkt anwendbar, ${plan.filter(f=>f.status==='merged').length} mit vorhandenen Änderungen zusammengeführt, ${plan.filter(f=>f.status==='already').length} bereits aktuell.`);
  if(conflicts.length){console.log('Die folgenden Überschneidungen benötigen eine Zusammenführung:');conflicts.forEach(file=>console.log('  '+file.path));stop('Keine Arbeitskopie geändert und nichts veröffentlicht. Der Originalordner bleibt unverändert.');}
  if(options.mode==='check'){console.log('Zusammenführung ohne Konflikte möglich. Originalordner unverändert.');return;}
  if(!fs.existsSync(path.join(source,'node_modules/typescript/bin/tsc'))||!fs.existsSync(path.join(source,'node_modules/vitest/vitest.mjs')))stop('Die vorhandenen Projektabhängigkeiten fehlen in diesem Quellordner. Bitte --repo auf den zuletzt verwendeten, vollständigen App-Arbeitsstand zeigen lassen.');
  const destination=options.output??path.join(os.homedir(),'CareSuite_Klientenportal_Night_R1_'+new Date().toISOString().replace(/[:.]/g,'-')+'_'+crypto.randomBytes(3).toString('hex'));
  if(destination===source||destination.startsWith(source+path.sep)||fs.existsSync(destination))stop('Der neue Arbeitsordner muss außerhalb des Originalordners liegen und darf noch nicht existieren.');
  console.log(`Erstelle getrennte Arbeitskopie: ${destination}`);
  run('git',['-c','core.hooksPath='+path.join(temporary,'no-hooks'),'clone','--no-hardlinks','--quiet',source,destination],path.dirname(source));
  const excluded=/^(?:\.git|node_modules|dist(?:[-.].*)?|web-build|coverage|\.expo|\.cache|\.turbo|\.next|\.vercel|playwright-report|test-results)$/i;
  fs.cpSync(source,destination,{recursive:true,dereference:false,filter:entry=>entry===source||!path.relative(source,entry).split(path.sep).some(part=>excluded.test(part))});
  const tracked=run('git',['ls-files','-z'],destination).split('\0').filter(Boolean);
  for(const name of tracked)if(!fs.existsSync(path.join(source,name)))fs.rmSync(path.join(destination,name),{force:true,recursive:true});
  fs.symlinkSync(path.join(source,'node_modules'),path.join(destination,'node_modules'),process.platform==='win32'?'junction':'dir');
  for(const file of plan){const target=safeFile(destination,file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,file.content);}
  for(const file of plan){const original=safeFile(source,file.path);const now=fs.existsSync(original)?fs.readFileSync(original,'utf8'):null;if(now!==file.current)stop('Der Originalordner wurde während der Vorbereitung geändert. Die neue Kopie wird nicht freigegeben.');}
  run(process.execPath,['scripts/port-native-workspaces.mjs','--write'],destination,true);
  run(process.execPath,['scripts/verify-client-portal-night.mjs'],destination,true);
  const receipt={version:1,source,prepared:destination,baseCommit:pack.baseCommit,verified:true,deployed:false,preparedAt:new Date().toISOString(),files:plan.map(file=>({path:file.path,status:file.status,sha256:sha(fs.readFileSync(safeFile(destination,file.path)))}))};
  fs.writeFileSync(path.join(destination,'client-portal-night-prepared.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
  console.log(`Klientenportal vorbereitet und geprüft: ${destination}`);console.log('Noch nicht veröffentlicht. Der bestehende Netlify-Stand einschließlich NEO und Arbeitszeit wurde nicht verändert.');
  return receipt;
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{runClientPortalUpdate();}catch(error){console.error('Abbruch: '+error.message);process.exitCode=1;}}
