import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const runtimeModules = process.env.CARESUITE_BABEL_NODE_MODULES;
const output = process.env.CARESUITE_SYNTAX_RESULT;
if (!runtimeModules || !output) throw Error('Babel module root and result path are required.');
const require = createRequire(import.meta.url);
const babel = require(`${runtimeModules}/@babel/core`);
const presetTypescript = require(`${runtimeModules}/@babel/preset-typescript`);
const transformReactJsx = require(`${runtimeModules}/@babel/plugin-transform-react-jsx`);
const files = [
  'app/pflege/einsatz.web.tsx',
  'src/lib/pflege/tourPlanningInbox.web.ts',
  'src/lib/pflege/tourPlanningWorkspaceDomain.web.ts',
  'src/lib/pflege/tourPlanningWorkspaceDraft.web.ts',
  'src/lib/pflege/tourPlanningWorkspaceForm.web.ts',
  'src/lib/pflege/tourPlanningWorkspaceRepository.web.ts',
  'src/lib/pflege/tourPlanningWorkspaceRules.web.ts',
  'src/lib/pflege/tourPlanningWorkspaceWorkflow.web.ts',
  'src/lib/pflege/visitExecutionWorkspaceDomain.web.ts',
  'src/lib/pflege/visitExecutionWorkspaceDraft.web.ts',
  'src/lib/pflege/visitExecutionWorkspaceForm.web.ts',
  'src/lib/pflege/visitExecutionWorkspaceRepository.supabase.web.ts',
  'src/lib/pflege/visitExecutionWorkspaceRepository.web.ts',
  'src/lib/pflege/visitExecutionWorkspaceWorkflow.web.ts',
  'src/screens/pflege/TourPlanningInbox.web.tsx',
  'src/screens/pflege/TourPlanningPresentation.web.tsx',
  'src/screens/pflege/TourPlanningWorkspace.web.tsx',
  'src/screens/pflege/VisitExecutionWorkspace.web.tsx',
];
for (const file of files) {
  const code = await fs.readFile(file, 'utf8');
  const tsx = file.endsWith('.tsx');
  const result = babel.transformSync(code, {
    filename: file,
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    presets: [[presetTypescript, { allExtensions: true, isTSX: tsx }]],
    plugins: tsx ? [[transformReactJsx, { runtime: 'automatic' }]] : [],
  });
  if (!result || typeof result.code !== 'string') throw Error(`No transformed output for ${file}`);
}
const report = {
  checkpoint: 329,
  kind: 'babel-parse-transform-only',
  files,
  passed: files.length,
  semanticTypecheck: false,
};
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
