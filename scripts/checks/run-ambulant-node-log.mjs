import {readdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';

const output=process.argv[2];
if(!output||!output.startsWith('docs/audit/checks/ambulant-node-checkpoint')||!output.endsWith('.log'))throw Error('A checkpoint audit log path is required.');
const tests=(await readdir('scripts/checks')).filter(name=>name.endsWith('.node.test.mjs')).sort().map(name=>path.join('scripts/checks',name));
const child=spawn(process.execPath,['--experimental-strip-types','--test',...tests],{stdio:['ignore','pipe','pipe']});
const chunks=[];child.stdout.on('data',chunk=>chunks.push(chunk));child.stderr.on('data',chunk=>chunks.push(chunk));
const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
const data=Buffer.concat(chunks);await writeFile(output,data);process.stdout.write(data.subarray(Math.max(0,data.length-4000)));
if(code!==0)process.exitCode=Number(code)||1;
