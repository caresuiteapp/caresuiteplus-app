// Builds only a synthetic UI test fixture. Never starts or deploys the app.
const esbuild=require('esbuild');const path=require('node:path');const fs=require('node:fs');
(async()=>{
 const target=path.join(process.env.TEMP||'/tmp','caresuite-support-preview');fs.mkdirSync(target,{recursive:true});
 await esbuild.build({entryPoints:['scripts/fixtures/support-preview.tsx'],outfile:path.join(target,'support.js'),bundle:true,minify:true,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"',__DEV__:'false'},plugins:[{name:'qa-adapter',setup(build){
 build.onResolve({filter:/^react-native$/},()=>({path:require.resolve('react-native-web')}));
 build.onResolve({filter:/^@\/lib\/support\/supportService$/},()=>({path:path.resolve('scripts/fixtures/support-preview-service.ts')}));
 build.onResolve({filter:/^@\//},args=>({path:path.resolve('src',args.path.slice(2)+'.ts')}));
 }}]});
 fs.writeFileSync(path.join(target,'index.html'),'<!doctype html><html lang="de"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CareSuite Support – UI-Test</title><div id="qa">UI-Test mit fiktiven Daten · Support-Layout R2.1 · <a style="color:#86DEFF" href="?platform=0">Unternehmen</a> · <a style="color:#86DEFF" href="?platform=1">Support-Zentrale</a></div><div id="preview"></div><script src="support.js"></script></html>');
 console.log(JSON.stringify({ok:true,bytes:fs.statSync(path.join(target,'support.js')).size,directory:target}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
