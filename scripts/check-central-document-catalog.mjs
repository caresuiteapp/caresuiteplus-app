import { writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Scope TypeScript to this feature and its real imports. The full repository
// checker exceeds the available executor memory; this does not replace it.
const baseRef = process.env.CENTRAL_CATALOG_BASE_REF || spawnSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).stdout.trim();
await mkdir('tmp/central-catalog', { recursive: true });
const config = path.resolve('tmp/central-catalog/tsconfig.json');
await writeFile(config, JSON.stringify({ extends: path.resolve('tsconfig.json'), include: [], files: [
  'src/data/seeds/documentCatalog/centralCatalog.ts', 'src/lib/documents/centralCatalogModel.ts',
  'src/lib/documents/centralCatalogPdf.ts', 'src/lib/documents/centralCatalogService.ts',
  'src/components/documents/CentralCatalogWorkspace.web.tsx', 'src/screens/office/CentralDocumentCatalogScreen.web.tsx',
  'src/components/documents/CentralDocumentCatalogAction.tsx', 'src/liquid-command/screens/CommandCenterScreen.web.tsx',
  'src/liquid-command/navigation/moduleCatalog.ts', 'src/lib/navigation/moduleNav/officeNav.ts',
  'src/types/jspdf.d.ts', 'src/lib/documents/documentRecommendations.ts',
  'src/components/documents/DocumentRecommendations.web.tsx', 'src/components/documents/ModuleDocumentsSection.web.tsx',
  'src/components/documents/DocumentModuleTemplatesPanel.web.tsx',
  'src/screens/business/office/ClientRecordTabPanels.web.tsx', 'src/screens/business/office/ClientRecordScreen.tsx',
  'src/components/office/ClientRecordOverviewPanel.tsx',
  'src/components/office/ClientRecordDocumentsPanel.tsx', 'src/components/office/ClientRecordContractsPanel.tsx',
  'src/components/office/EmployeePersonnelFilePanel.tsx', 'src/components/office/ClientBudgetCorePanel.tsx',
  'src/screens/office/InvoiceDetailScreen.tsx', 'src/screens/office/AppointmentDetailScreen.tsx',
  'src/screens/office/OfficeDocumentsListScreen.tsx', 'src/screens/office/OfficeIndexScreen.tsx',
  'src/screens/pflege/WoundDocumentationDetailScreen.tsx', 'src/screens/pflege/MedicationDetailScreen.tsx',
  'src/screens/pflege/WoundDocumentationListScreen.tsx', 'src/screens/pflege/MedicationListScreen.tsx',
  'src/screens/stationaer/HandoverReportScreen.tsx', 'src/screens/privacy/PrivacyComplianceHubScreen.tsx',
  'src/screens/inventory/InventoryDashboardScreen.tsx', 'src/liquid-command/screens/ModuleWorkspaceScreen.tsx',
  'src/liquid-command/screens/PflegeHomeWorkspace.tsx', 'src/liquid-command/screens/administrationDesktopCatalog.ts',
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
await writeFile('tmp/central-catalog/typecheck-results.json',JSON.stringify({scope:'feature and real dependencies',introduced,outsideChangedLines:outside,fullRepositoryCheck:'Run separately with npm run typecheck; this script checks the feature and its dependencies.'},null,2));
console.log(`Feature TypeScript: ${introduced.length} diagnostics in added/modified lines; ${outside.length} diagnostics elsewhere (see tmp/central-catalog/typecheck.log).`);
if(introduced.length){console.error(introduced.join('\n'));process.exit(1);}
