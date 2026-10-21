// Reuses the project's existing esbuild synthetic-preview pattern. No app server/deploy.
const fs=require('node:fs');const path=require('node:path');const esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');const target=process.env.INTAKE_IDENTITY_QA_DIR||'/tmp/caresuite-intake-identity-qa';
const quote=JSON.stringify;
function resolveSource(base){for(const suffix of ['','.web.tsx','.web.ts','.tsx','.ts','.web.js','.js','.json','/index.web.tsx','/index.web.ts','/index.tsx','/index.ts','/index.js']){const p=base+suffix;if(fs.existsSync(p)&&fs.statSync(p).isFile())return p;}}
const virtual={
 ui:`export {PremiumInput} from ${quote(path.join(root,'src/components/ui/PremiumInput'))};export {InfoBanner} from ${quote(path.join(root,'src/components/ui/InfoBanner'))};export {ErrorState} from ${quote(path.join(root,'src/components/ui/StateViews'))};`,
 router:`export const usePathname=()=>'/business/office/clients/new';export const useRouter=()=>({push(){},replace(){},back(){}});`,
 storage:`export default {getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}};`,
 feedback:`const api={show:()=>'',dismiss(){}};export const useWorkflowFeedback=()=>api;`,
 safe:`export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0});`,
};
(async()=>{fs.mkdirSync(target,{recursive:true});await esbuild.build({absWorkingDir:root,entryPoints:['scripts/fixtures/intake-identity-preview.tsx'],outfile:path.join(target,'intake.js'),bundle:true,minify:true,platform:'browser',jsx:'automatic',mainFields:['browser','module','main'],resolveExtensions:['.web.tsx','.web.ts','.tsx','.ts','.web.js','.js','.json'],loader:{'.js':'jsx','.ttf':'dataurl','.png':'dataurl','.svg':'dataurl'},define:{'process.env':'{}','process.env.NODE_ENV':'"production"','process.browser':'true',global:'globalThis',__DEV__:'false'},plugins:[{name:'existing-synthetic-intake-layout',setup(build){
 build.onResolve({filter:/.*/},args=>{const spec=args.path;let name;if(spec==='@/components/ui')name='ui';else if(spec==='expo-router')name='router';else if(spec==='@react-native-async-storage/async-storage')name='storage';else if(/(^|\/)GlobalWorkflowFeedback$/.test(spec))name='feedback';else if(spec==='react-native-safe-area-context')name='safe';if(name)return{path:name,namespace:'intake-virtual'};if(spec==='react-native')return{path:require.resolve('react-native-web')};if(spec.startsWith('@/'))return{path:resolveSource(path.join(root,'src',spec.slice(2)))};});
 build.onLoad({filter:/.*/,namespace:'intake-virtual'},args=>({contents:virtual[args.path],loader:'tsx',resolveDir:root}));
}}]});fs.writeFileSync(path.join(target,'index.html'),'<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lokale Aufnahmeansicht mit fiktiven Daten</title><div id="preview"></div></html>');console.log(JSON.stringify({ok:true,directory:target,bytes:fs.statSync(path.join(target,'intake.js')).size,scope:'real panel and project UI components; synthetic data, router, storage and feedback'}));})().catch(error=>{console.error(error.message);process.exitCode=1;});
