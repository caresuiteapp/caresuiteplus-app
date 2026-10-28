import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

// Conservative import reachability, never a runtime call graph or acceptance.
// No application modules, backend clients or business RPCs are executed.
const root = process.cwd();
const require = createRequire(import.meta.url);
const sourceExts = require('../metro.config.js').resolver.sourceExts;
const inventoryPath = 'docs/audit/native-portal-route-matrix.json';
const outputPath = 'docs/audit/native-portal-backend-dependencies.json';
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
const productionPath = process.argv.find(arg => arg.startsWith('--catalog='))?.slice(10);
const production = productionPath ? JSON.parse(readFileSync(productionPath, 'utf8')) : null;
const live = production ? new Map(production.rows.map(row => [row.name, production.rows.filter(item => item.name === row.name)])) : null;
const modules = new Map();
const slash = value => value.replaceAll('\\', '/');
const sha = value => createHash('sha256').update(value).digest('hex');
const unbox = node => node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) ? unbox(node.expression) : node;
const literal = node => { node = unbox(node); return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null; };
const aliases = [
  ['@/product-workflows/screens', 'src/screens'],
  ['@/product-workflows/components', 'src/components'],
  ['@/product-workflows/design', 'src/design'],
  ['@/product-workflows/theme', 'src/theme'],
  ['@', 'src'],
];
function sourcePath(specifier, importer) {
  let base;
  const alias = aliases.find(([name]) => specifier === name || specifier.startsWith(name + '/'));
  if (alias) base = resolve(root, alias[1], specifier.slice(alias[0].length).replace(/^\//, ''));
  else if (specifier.startsWith('.')) base = resolve(root, dirname(importer), specifier);
  else return { external: specifier };
  const explicit = sourceExts.includes(extname(base).slice(1));
  const candidates = explicit ? [base] : [base, ...sourceExts.flatMap(ext => [base + '.android.' + ext, base + '.native.' + ext, base + '.' + ext]), ...sourceExts.flatMap(ext => [join(base, 'index.android.' + ext), join(base, 'index.native.' + ext), join(base, 'index.' + ext)])];
  const file = candidates.find(path => existsSync(path) && !existsSync(join(path, 'package.json')) && extname(path));
  return file ? { file: slash(relative(root, file)) } : { unresolved: specifier };
}
function inspect(file) {
  if (modules.has(file)) return modules.get(file);
  const text = readFileSync(file, 'utf8');
  const result = { file, sha256: sha(text), imports: [], endpoints: [], dynamic: [] };
  modules.set(file, result);
  if (!/\.[cm]?[jt]sx?$/.test(file)) return result;
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const calls = [], wrappers = [];
  const line = node => ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
  const importSource = (specifier, node) => result.imports.push({ specifier, line: line(node), ...sourcePath(specifier, file) });
  function visit(node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      const named = node.importClause?.namedBindings;
      const allTypeOnly = named && ts.isNamedImports(named) && !node.importClause.name && named.elements.length && named.elements.every(element => element.isTypeOnly);
      if (!allTypeOnly) importSource(node.moduleSpecifier.text, node);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && !node.isTypeOnly) importSource(node.moduleSpecifier.text, node);
    if (ts.isCallExpression(node)) {
      calls.push(node);
      if ((node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === 'require') && literal(node.arguments[0])) importSource(literal(node.arguments[0]), node);
      const expression = unbox(node.expression);
      const method = ts.isPropertyAccessExpression(expression) ? expression.name.text : ts.isElementAccessExpression(expression) ? literal(expression.argumentExpression) : null;
      if (['rpc', 'from', 'invoke'].includes(method)) {
        const receiver = expression.expression.getText(ast);
        if (method === 'from' && !/(?:supabase|client|sdk|\bdb\b|storage)/i.test(receiver)) return ts.forEachChild(node, visit);
        if (method === 'invoke' && !/functions/.test(receiver)) return ts.forEachChild(node, visit);
        const kind = method === 'rpc' ? 'rpc' : method === 'invoke' ? 'edge_function' : /storage/.test(receiver) ? 'storage_bucket' : 'table_candidate';
        const name = literal(node.arguments[0]);
        if (name) result.endpoints.push({ kind, name, line: line(node), receiver, evidence: 'literal_call_in_module' });
        else {
          result.dynamic.push({ kind, line: line(node), expression: node.arguments[0]?.getText(ast) ?? '', receiver });
          if (method === 'rpc' && ts.isIdentifier(unbox(node.arguments[0]))) {
            let parent = node.parent;
            while (parent && !ts.isFunctionDeclaration(parent) && !ts.isFunctionExpression(parent) && !ts.isArrowFunction(parent)) parent = parent.parent;
            const arg = unbox(node.arguments[0]).text;
            const index = parent?.parameters.findIndex(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === arg) ?? -1;
            const wrapperName = parent?.name?.text ?? (parent?.parent && ts.isVariableDeclaration(parent.parent) ? parent.parent.name.getText(ast) : null);
            if (wrapperName && index >= 0) wrappers.push({ wrapperName, index, rpcLine: line(node) });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const wrapper of wrappers) for (const call of calls) {
    if (!ts.isIdentifier(call.expression) || call.expression.text !== wrapper.wrapperName) continue;
    const name = literal(call.arguments[wrapper.index]);
    if (name) result.endpoints.push({ kind: 'rpc', name, line: line(call), wrapper: wrapper.wrapperName, rpcLine: wrapper.rpcLine, evidence: 'literal_argument_to_local_dynamic_rpc_wrapper' });
  }
  for (const dependency of result.imports) if (dependency.file) inspect(dependency.file);
  return result;
}
function closure(start) {
  const seen = new Set(), pending = [...start];
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const edge of inspect(file).imports) if (edge.file && !seen.has(edge.file)) pending.push(edge.file);
  }
  return [...seen].sort();
}
const rpcCandidateSets = new Map();
const rows = inventory.rows.map(row => {
  const rootModuleFiles = [...new Set([row.selectedFile, ...row.guards.map(guard => guard.file)])].sort();
  const files = closure(rootModuleFiles);
  const endpoints = files.flatMap(file => inspect(file).endpoints.map(endpoint => ({ file, ...endpoint })));
  const rpcCandidates = [...new Set(endpoints.filter(endpoint => endpoint.kind === 'rpc').map(endpoint => endpoint.name))].sort();
  const rpcCandidateSetId = sha(JSON.stringify(rpcCandidates));
  rpcCandidateSets.set(rpcCandidateSetId, { id: rpcCandidateSetId, names: rpcCandidates });
  return { id: row.id, routeTemplate: row.routeTemplate, portal: row.portal, status: row.status, rootModuleFiles, reachableModuleCount: files.length, rpcCandidateSetId, dynamicEndpointModuleCount: files.filter(file => inspect(file).dynamic.length).length, evidence: 'conservative_runtime_module_import_closure; neither symbol-use proof nor executed workflow' };
});
const moduleRows = [...modules.values()].sort((a, b) => a.file.localeCompare(b.file));
const endpoints = moduleRows.flatMap(module => module.endpoints.map(endpoint => ({ file: module.file, ...endpoint })));
const rpcNames = [...new Set(endpoints.filter(endpoint => endpoint.kind === 'rpc').map(endpoint => endpoint.name))].sort();
const report = { schemaVersion: 1, inventorySourceTreeHash: inventory.provenance.sourceTreeHash, sourceExts, auditKind: 'static conservative Android import and backend dependency candidates; no backend executions or mutations', limits: ['An imported module can contain unused exports and locked/prepared functionality. Candidate endpoints must be traced through an active action before being classified as defects.', 'Dynamic expressions and imported wrappers can contain additional endpoints; these are explicit gaps, not empty contracts.', 'Endpoint existence, grants and source checks do not prove record authorization, idempotency, readback, layout or actual Android acceptance.', 'Backend catalogue is optional, external, read-only evidence; it is never treated as a source of automatic migrations.'], counts: { routes: rows.length, modules: moduleRows.length, literalAndLocalWrapperRpcNames: rpcNames.length, modulesWithDynamicEndpoints: moduleRows.filter(module => module.dynamic.length).length, unresolvedLocalImports: moduleRows.reduce((sum, module) => sum + module.imports.filter(edge => edge.unresolved).length, 0) }, rows, rpcCandidateSets: [...rpcCandidateSets.values()].sort((a,b) => a.id.localeCompare(b.id)), modules: moduleRows };
// Keep fresh production metadata out of the checked-in source artifact.
if (production) {
  const comparison = { project: production.project, observedAt: production.observedAt, method: production.method, sourceInventoryHash: report.inventorySourceTreeHash, limits: report.limits, names: rpcNames.map(name => ({ name, present: live.has(name), callers: endpoints.filter(endpoint => endpoint.kind === 'rpc' && endpoint.name === name), overloads: live.get(name) ?? [] })) };
  const path = process.argv.find(arg => arg.startsWith('--comparison='))?.slice(13);
  if (!path) throw Error('--comparison is required with --catalog, to store private audit evidence outside the repository');
  writeFileSync(path, JSON.stringify(comparison, null, 2) + '\n');
}
const changed = moduleRows.filter(module => sha(readFileSync(module.file, 'utf8')) !== module.sha256);
if (changed.length) throw Error('Sources changed during inventory; rerun after coordination: ' + changed.map(row => row.file).join(', '));
const json = JSON.stringify(report, null, 2) + '\n';
if (process.argv.includes('--write')) writeFileSync(outputPath, json);
if (process.argv.includes('--check') && (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== json)) { console.error('Backend dependency inventory is stale.'); process.exitCode = 1; }
console.log(JSON.stringify({ ...report.counts, releaseAcceptance: 'not_established', outputPath, comparison: production ? 'written to requested external QA path' : 'not requested' }));
