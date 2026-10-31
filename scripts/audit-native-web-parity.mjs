import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const source = file => readFileSync(resolve(root, file), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const walk = dir => readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
const files = walk('app').filter(file => /\.(?:tsx|jsx)$/.test(file) && !/(?:^|\/)(?:_layout|\+[^/]+)(?:\.[^.]+)?\.[jt]sx$/.test(file));
const stems = [...new Set(files.map(file => file.replace(/(?:\.(?:web|native|android|ios))?\.[jt]sx$/, '')))];
const select = (stem, platform) => (platform === 'web' ? [stem + '.web.tsx', stem + '.tsx', stem + '.jsx'] : [stem + '.android.tsx', stem + '.native.tsx', stem + '.tsx', stem + '.jsx']).find(file => existsSync(resolve(root, file)));
const normalize = text => ts.createPrinter({ removeComments: true }).printFile(ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)).replace(/\.web(?=['"])/g, '').replace(/\.native(?=['"])/g, '');

function facade(file) {
  if (!file) return null;
  const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = ast.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text);
  const exports = ast.statements.filter(node => ts.isExportDeclaration(node) && node.moduleSpecifier).map(node => node.moduleSpecifier.text);
  const redirects = [];
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'Redirect') redirects.push(node.attributes.getText(ast));
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { imports, exports, redirects };
}

const routes = stems.sort().map(stem => {
  const web = select(stem, 'web');
  const android = select(stem, 'android');
  const route = stem.replace(/^app/, '').replace(/\/\([^/]+\)/g, '').replace(/\/index$/, '') || '/';
  return {
    route, webEntry: web ?? null, androidEntry: android ?? null,
    entrySourceMatches: Boolean(web && android && normalize(source(web)) === normalize(source(android))),
    webSourceHash: web ? hash(source(web)) : null, androidSourceHash: android ? hash(source(android)) : null,
    web: facade(web), android: facade(android),
    // Equal entry files still resolve platform-specific children. Never turn
    // this structural inventory into a claim of visual acceptance.
    visualAcceptance: 'not-verified',
  };
});
const differences = routes.filter(row => !row.entrySourceMatches);
const result = {
  kind: 'source-inventory-not-visual-acceptance',
  totalEntries: routes.length, differingEntries: differences.length,
  missingAndroidEntries: routes.filter(row => !row.androidEntry).length,
  missingWebEntries: routes.filter(row => !row.webEntry).length,
  releaseReady: false,
  reason: 'Separate page implementations and actual Android/Web images require review before a new release.',
  routes,
};
const index = process.argv.indexOf('--report');
const output = resolve(index >= 0 ? process.argv[index + 1] : '/tmp/caresuite-native-web-parity.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ totalEntries: result.totalEntries, differingEntries: result.differingEntries, missingAndroidEntries: result.missingAndroidEntries, releaseReady: false, report: relative(root, output) }));
if (process.argv.includes('--require-visual-acceptance')) process.exitCode = 1;
