import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=new Set(process.argv.slice(2));
if([...args].some(arg=>!['--types-only','--skip-types'].includes(arg)))throw new Error('Unbekannte Option. Erlaubt: --types-only, --skip-types');
const run=(command,argv)=>{const result=spawnSync(command,argv,{cwd:root,stdio:'inherit',env:process.env,windowsHide:true});if(result.error)throw result.error;if(result.status!==0)throw new Error(`Prüfung fehlgeschlagen: ${path.basename(command)} ${argv.join(' ')} (Status ${result.status})`);};
if(!args.has('--types-only')){
 const portal=path.join(root,'src/__tests__/portal');
 const cases=fs.readdirSync(portal).filter(name=>/^client.*\.test\.tsx?$/.test(name)).map(name=>`src/__tests__/portal/${name}`);
 cases.push('src/__tests__/auth/accountSecurityService.test.ts', 'src/__tests__/auth/accountSecurityReceipt.test.ts', 'src/__tests__/auth/mfaSettingsCard.test.tsx', 'src/__tests__/offline/deviceSyncOverview.test.ts');
 cases.push('src/__tests__/akademie', 'src/__tests__/portal/nativeAcademyPortalBoundary.test.tsx', 'src/__tests__/auth/academyFamilyWebLogin.test.tsx', 'src/__tests__/auth/academyFamilyAccess.test.ts', 'src/__tests__/auth/academyFamilyAccessDatabase.test.ts');
 cases.push(...['src/__tests__/auth/clientPortalAccess.test.ts','src/__tests__/portal/portalAsyncInteraction.test.tsx','src/__tests__/portal/portalNewChatInteraction.test.tsx','src/__tests__/portal/employeePortalDesign.test.ts','src/__tests__/portal/employeePortalResponsiveVisualGate.test.ts','src/__tests__/design/applyLlganGlassDom.test.ts','src/__tests__/navigation/nativeModalContrast.test.tsx','src/__tests__/ui/workflowFeedbackOverlay.test.ts']);
 run(process.execPath,['node_modules/vitest/vitest.mjs','run',...cases,'--maxWorkers=2']);
 run(process.execPath,['scripts/port-native-workspaces.mjs','--check']);
 run(process.execPath,['scripts/verify-widget-artwork.mjs']);
}
if(!args.has('--skip-types')){
 const scope=JSON.parse(fs.readFileSync(path.join(root,'scripts/client-portal-night-scope.json'),'utf8'));
 const temporary=path.join(root,`.client-portal-night-types-${process.pid}.json`);
 try{
  fs.writeFileSync(temporary,JSON.stringify({extends:'./tsconfig.json',compilerOptions:{skipLibCheck:true},files:scope.sourceFiles,include:['src/**/*.d.ts','expo-env.d.ts'],exclude:['node_modules','supabase/functions','src/__tests__']},null,2));
  run(process.execPath,['--max-old-space-size=5800','node_modules/typescript/bin/tsc','-p',temporary,'--noEmit','--pretty','false']);
  console.log(`TypeScript: ${scope.sourceFiles.length} betroffene Quelldateien und ihre vollständigen Importabhängigkeiten ohne Fehler geprüft.`);
 }finally{fs.rmSync(temporary,{force:true});}
}
console.log('Klientenportal: Funktions-, Native-, Motiv- und Typprüfungen abgeschlossen. Produktive Ende-zu-Ende-Prüfungen sind gesondert zu dokumentieren.');
