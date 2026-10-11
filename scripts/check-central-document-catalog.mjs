import { writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Scope TypeScript to this feature and its real imports. The full repository
// checker exceeds the available executor memory; this does not replace it.
const baseRef = process.env.CENTRAL_CATALOG_BASE_REF || '3ad95a7087828d7acaf44593ba6bd0f9de5cc353';
await mkdir('tmp/central-catalog', { recursive: true });
const config = path.resolve('tmp/central-catalog/tsconfig.json');
await writeFile(config, JSON.stringify({ extends: path.resolve('tsconfig.json'), include: [], files: [
  'src/data/seeds/documentCatalog/centralCatalog.ts', 'src/lib/documents/centralCatalogModel.ts',
  'src/lib/documents/centralCatalogPdf.ts', 'src/lib/documents/centralCatalogService.ts',
  'src/components/documents/CentralCatalogWorkspace.web.tsx', 'src/screens/office/CentralDocumentCatalogScreen.web.tsx',
  'src/components/documents/CentralDocumentCatalogAction.tsx', 'src/liquid-command/screens/CommandCenterScreen.web.tsx',
  'src/liquid-command/navigation/moduleCatalog.ts', 'src/lib/navigation/moduleNav/officeNav.ts',
  'supabase/functions/central-document-record/payload.ts',
].map((file) => path.resolve(file)) }, null, 2));
const result = spawnSync(process.execPath, ['--max-old-space-size=2560', 'node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false', '-p', config], { encoding:'utf8', maxBuffer:32*1024*1024 });
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
await writeFile('tmp/central-catalog/typecheck.log',output);
const diagnostics = output.split('\n').filter((line) => /error TS\d+:/.test(line));
if (result.signal || result.error || (result.status && !diagnostics.length)) { console.error(output || result.error || result.signal); process.exit(1); }
const introduced=[]; const outside=[];
for (const diagnostic of diagnostics) {
  const match=diagnostic.match(/^(.+?)\((\d+),\d+\):/); if(!match){introduced.push(diagnostic);continue;}
  const file=match[1]; const line=Number(match[2]);
  const existsAtBase=spawnSync('git',['cat-file','-e',`${baseRef}:${file}`],{encoding:'utf8'}).status===0;
  if(!existsAtBase){introduced.push(diagnostic);continue;}
  const diff=spawnSync('git',['diff','--unified=0',baseRef,'--',file],{encoding:'utf8'}).stdout;
  const ranges=[...diff.matchAll(/^@@ .*?\+(\d+)(?:,(\d+))? @@/gm)].map((m)=>[Number(m[1]),Number(m[1])+Number(m[2]??1)-1]);
  (ranges.some(([start,end])=>line>=start&&line<=end)?introduced:outside).push(diagnostic);
}
await writeFile('tmp/central-catalog/typecheck-results.json',JSON.stringify({scope:'feature and real dependencies',introduced,outsideChangedLines:outside,fullRepositoryCheck:'exceeded executor memory'},null,2));
console.log(`Feature TypeScript: ${introduced.length} diagnostics in added/modified lines; ${outside.length} diagnostics elsewhere (see tmp/central-catalog/typecheck.log).`);
if(introduced.length){console.error(introduced.join('\n'));process.exit(1);}
