import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { buildSync } from 'esbuild';
import ts from 'typescript';

// Inventory and pure linking checks only. App components, providers, services,
// credentials and backend requests are never executed by this script.
const root = process.cwd(), require = createRequire(import.meta.url);
const target = 'docs/audit/native-portal-route-matrix.json';
const summaryTarget = 'docs/audit/native-portal-route-inventory.md';
const sources = new Map(), modules = new Map();
const sha = text => createHash('sha256').update(text).digest('hex');
const slash = value => value.replaceAll('\\', '/');
function read(file) {
  const name = slash(relative(root, resolve(root, file)));
  if (!sources.has(name)) sources.set(name, readFileSync(resolve(root, name), 'utf8'));
  return sources.get(name);
}
function walk(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = slash(join(directory, entry.name));
    return entry.isDirectory() ? walk(file) : [file];
  });
}
read('scripts/audit-native-portal-route-matrix.mjs');
const appFiles = walk('app').filter(file => /\.[jt]sx?$/.test(file));
const sourceFiles = walk('src').filter(file => /\.[jt]sx?$/.test(file) && !file.includes('/__tests__/') && !/\.web\.[jt]sx?$/.test(file));
const testFiles = walk('src/__tests__').filter(file => /\.test\.[jt]sx?$/.test(file));
const unbox = node => node && (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) ? unbox(node.expression) : node;
const nodeText = node => node ? node.getText() : '';
function simple(node) {
  node = unbox(node);
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(simple);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(property => [nodeText(property.name).replace(/^['"]|['"]$/g, ''), simple(property.initializer)]));
  return undefined;
}
const tsconfig = ts.readConfigFile(resolve(root, 'tsconfig.json'), file => read(slash(relative(root, file)))).config;
read('metro.config.js');
const metroSourceExts = require(resolve(root, 'metro.config.js')).resolver.sourceExts;
const aliasRules = Object.entries(tsconfig.compilerOptions.paths).sort(([a], [b]) => b.replace('*', '').length - a.replace('*', '').length);
function sourcePath(specifier, importer) {
  let base;
  if (specifier.startsWith('.')) base = resolve(root, dirname(importer), specifier);
  else for (const [pattern, targets] of aliasRules) {
    const star = pattern.indexOf('*'), prefix = star < 0 ? pattern : pattern.slice(0, star), suffix = star < 0 ? '' : pattern.slice(star + 1);
    if (star < 0 ? specifier === pattern : specifier.startsWith(prefix) && specifier.endsWith(suffix)) {
      const match = star < 0 ? '' : specifier.slice(prefix.length, suffix ? -suffix.length : undefined);
      base = resolve(root, targets[0].replace('*', match)); break;
    }
  }
  if (!base) return null;
  // Metro checks the exact file first, then Android/native/generic for each
  // sourceExt in configured order. In this project .ts precedes .tsx.
  const variants = path => [path, ...metroSourceExts.flatMap(ext => [path + '.android.' + ext, path + '.native.' + ext, path + '.' + ext])];
  const path = [...variants(base), ...variants(join(base, 'index'))].find(candidate => existsSync(candidate) && /\.(?:[cm]?[jt]sx?)$/.test(candidate));
  return path ? slash(relative(root, path)) : null;
}
function inspect(file) {
  if (modules.has(file)) return modules.get(file);
  const text = read(file), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = new Map(), importsAll = [], rendered = [], redirects = [], links = [], permissions = [], guards = [], declarations = [], exportBindings = new Map(), exportStars = [], definitions = new Map(), exportNames = new Set(), calls = new Map(), conditionalBranches = [];
  let defaultNode = null, defaultName = null, reexport = null, unstableSettings;
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text, path = sourcePath(specifier, file), clause = statement.importClause;
      const typeOnly = !!clause?.isTypeOnly || !!(clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.length && clause.namedBindings.elements.every(element => element.isTypeOnly));
      importsAll.push({ specifier, path, typeOnly });
      if (clause?.name) imports.set(clause.name.text, { specifier, path, imported: 'default', typeOnly });
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const element of clause.namedBindings.elements) imports.set(element.name.text, { specifier, path, imported: element.propertyName?.text ?? element.name.text, typeOnly: typeOnly || element.isTypeOnly });
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      const item = statement.exportClause.elements.find(item => item.name.text === 'default');
      if (item) reexport = { specifier: statement.moduleSpecifier.text, path: sourcePath(statement.moduleSpecifier.text, file), imported: item.propertyName?.text ?? item.name.text };
    }
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const specifier = statement.moduleSpecifier?.text, path = specifier ? sourcePath(specifier, file) : file;
      if (specifier) importsAll.push({ specifier, path, typeOnly: !!(statement.exportClause && ts.isNamedExports(statement.exportClause) && statement.exportClause.elements.length && statement.exportClause.elements.every(element => element.isTypeOnly)), reexport: true });
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) if (!element.isTypeOnly) exportBindings.set(element.name.text, { path, imported: element.propertyName?.text ?? element.name.text });
      } else if (path && specifier) exportStars.push(path);
    }
    if (ts.isExportAssignment(statement)) { defaultNode = statement.expression; defaultName = nodeText(defaultNode); }
    if (ts.isFunctionDeclaration(statement) && statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)) { defaultNode = statement; defaultName = statement.name?.text ?? 'default'; }
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) { definitions.set(statement.name.text, statement); if (statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) exportNames.add(statement.name.text); }
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (nodeText(declaration.name) === 'unstable_settings') unstableSettings = simple(declaration.initializer);
      if (ts.isIdentifier(declaration.name)) { definitions.set(declaration.name.text, declaration.initializer); if (statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) exportNames.add(declaration.name.text); }
    }
  }
  const line = node => ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
  function visit(node, scope = 'module') {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) scope = node.name.text;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(unbox(node.initializer)) || ts.isFunctionExpression(unbox(node.initializer)) || ts.isCallExpression(unbox(node.initializer)) && unbox(node.initializer).arguments.some(argument => ts.isArrowFunction(unbox(argument)) || ts.isFunctionExpression(unbox(argument))))) scope = node.name.text;
    if (ts.isExportAssignment(node) && (ts.isArrowFunction(unbox(node.expression)) || ts.isFunctionExpression(unbox(node.expression)))) scope = 'default';
    if (ts.isVariableDeclaration(node)) declarations.push({ node, scope });
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = nodeText(node.tagName), props = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attribute => [nodeText(attribute.name), attribute.initializer && ts.isJsxExpression(attribute.initializer) ? nodeText(attribute.initializer.expression) : simple(attribute.initializer)]));
      if (/^[A-Z]/.test(name)) rendered.push({ name, scope, line: line(node), ...imports.get(name), props });
      if (/RequireAuth|RequireRole|Gate|LiquidModuleRouteLayout|LiquidPortalRouteLayout/.test(name)) guards.push({ name, scope, line: line(node), props });
      if (name === 'Redirect') {
        const href = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && nodeText(attribute.name) === 'href');
        redirects.push({ scope, line: line(node), expression: href?.initializer && ts.isJsxExpression(href.initializer) ? href.initializer.expression : href?.initializer });
      }
      for (const attribute of node.attributes.properties.filter(ts.isJsxAttribute)) if (nodeText(attribute.name) === 'href') {
        const expression = attribute.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : attribute.initializer;
        links.push({ kind: name === 'Redirect' ? 'redirect' : 'href', line: line(node), expression });
      }
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) { const targets = calls.get(scope) ?? new Set(); targets.add(node.expression.text); calls.set(scope, targets); }
      const method = nodeText(node.expression).split('.').at(-1);
      const navigationCall = /\b(?:router|navigation|history)\b/i.test(nodeText(node.expression)) || ts.isIdentifier(node.expression) && node.expression.text === 'navigate';
      if (navigationCall && ['push', 'replace', 'navigate', 'dismissTo'].includes(method) && node.arguments.length) links.push({ kind: method, line: line(node), expression: node.arguments[0] });
      if (['can', 'hasPermission', 'enforcePermission', 'PermissionGate', 'hasModuleGate', 'hasGate'].includes(method)) permissions.push({ scope, method, line: line(node), arguments: node.arguments.map(nodeText), literals: node.arguments.map(simple).filter(value => value !== undefined) });
    }
    if (ts.isIfStatement(node) && /return\s|return\(/.test(nodeText(node.thenStatement))) conditionalBranches.push({ scope, line: line(node), condition: nodeText(node.expression), then: nodeText(node.thenStatement).slice(0, 1000), truncated: nodeText(node.thenStatement).length > 1000 });
    if (ts.isPropertyAssignment(node) && ['href', 'route', 'overviewHref'].includes(nodeText(node.name).replace(/^['"]|['"]$/g, ''))) links.push({ kind: 'declared-nav', line: line(node), expression: node.initializer });
    ts.forEachChild(node, child => visit(child, scope));
  }
  visit(ast);
  const result = { file, text, ast, imports, importsAll, defaultNode, defaultName, reexport, unstableSettings, rendered, redirects, links, permissions, guards, declarations, exportBindings, exportStars, definitions, exportNames, calls, conditionalBranches };
  modules.set(file, result); return result;
}

const bundle = buildSync({ stdin: { contents: `
 export {APP_ROUTES,getRouteByPath} from './src/lib/navigation/routes';
 export {buildDesktopApps} from './src/liquid-command/navigation/desktopAppCatalogModel';
 export {WIDGETS} from './src/liquid-command/screens/administrationDesktopCatalog';
 export {DESKTOP_AREAS} from './src/liquid-command/navigation/desktopAreas';
 export {buildDesktopAreaNavigation} from './src/liquid-command/navigation/moduleDesktopModel';
 export {filterDesktopCatalogEntries} from './src/liquid-command/navigation/appsWidgetsCatalogModel.shared';
 export {nativeAdministrationRoute} from './src/liquid-command/navigation/nativeAdministrationModel';
 export {getUnreleasedModuleKeyFromPath} from './src/lib/modules/constants';
 export * as portalCatalog from './src/liquid-command/navigation/portalCatalog';
 export {officeNav} from './src/lib/navigation/moduleNav/officeNav';
 export {assistNav} from './src/lib/navigation/moduleNav/assistNav';
 export {pflegeNav} from './src/lib/navigation/moduleNav/pflegeNav';
 export {stationaerNav} from './src/lib/navigation/moduleNav/stationaerNav';
 export {beratungNav} from './src/lib/navigation/moduleNav/beratungNav';
 export {akademieNav} from './src/lib/navigation/moduleNav/akademieNav';
 export {zentraleNav} from './src/lib/navigation/moduleNav/zentraleNav';
 export {adminNav} from './src/lib/navigation/moduleNav/adminNav';
 export {PORTAL_NAVIGATION_REGISTRY} from './src/lib/portal/engine/portalNavigationRegistry';
 `, loader: 'ts', resolveDir: root }, bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react-native'], loader: { '.png': 'empty', '.jpg': 'empty' } }).outputFiles[0].text;
const bundled = { exports: {} };
new Function('require', 'module', 'exports', bundle)(id => { if (id === 'react-native') return { Platform: { OS: 'android' } }; throw Error('Unexpected pure catalogue dependency: ' + id); }, bundled, bundled.exports);
const model = bundled.exports;
const { getRoutes } = require('expo-router/build/getRoutes');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const parserPath = require.resolve('expo-router/build/fork/getStateFromPath'), parserRequire = createRequire(parserPath), parser = { exports: {} };
new Function('require', 'module', 'exports', readFileSync(parserPath, 'utf8'))(id => id === '../react-navigation/native' ? require('expo-router/build/react-navigation/core/validatePathConfig') : parserRequire(id), parser, parser.exports);
const { getStateFromPath } = parser.exports;
const context = Object.assign(key => ({ default: () => null, unstable_settings: inspect('app/' + key.slice(2)).unstableSettings }), {
  keys: () => appFiles.map(file => './' + file.slice(4)), resolve: key => key, id: 'native-portal-route-audit',
});
const tree = getRoutes(context, { platform: 'android', ignoreRequireErrors: true });
const config = getReactNavigationConfig(tree, true), selected = [], layouts = [];
function collect(node, ancestors = []) {
  if (node.type === 'layout') layouts.push({ contextKey: node.contextKey, route: node.route, initialRouteName: node.initialRouteName ?? null });
  else selected.push({ node, ancestors });
  for (const child of node.children) collect(child, [...ancestors, node]);
}
collect(tree);
function parseUncached(href) {
  let state;
  try { state = getStateFromPath(href, config); } catch (error) { return { error: error.message }; }
  if (!state) return { error: 'No linking state' };
  let node = tree, leaf; const chain = [];
  while (state?.routes?.length) {
    leaf = state.routes[state.index ?? state.routes.length - 1];
    chain.push(leaf.name); node = node.children.find(item => item.route === leaf.name);
    if (!node) return { error: 'No selected route node for ' + leaf.name, chain };
    state = leaf.state;
  }
  return { selectedFile: node.contextKey.startsWith('./') ? 'app/' + node.contextKey.slice(2) : node.contextKey, params: leaf.params ?? {}, generated: !!node.generated, chain };
}
const linkingCache = new Map();
function parsed(href) { if (!linkingCache.has(href)) linkingCache.set(href, parseUncached(href)); return linkingCache.get(href); }

function routeTemplate(contextKey) {
  return '/' + contextKey.replace(/^\.\//, '').replace(/(?:\.(?:android|native))?\.[jt]sx?$/, '').split('/').filter(segment => segment !== 'index' && !/^\(.+\)$/.test(segment)).join('/');
}
function sampleFor(template) { return template.replace(/\[\[?\.\.\.([^\]]+)\]\]?/g, 'audit-record/audit-child').replace(/\[([^\]]+)\]/g, (_, name) => 'audit-' + name); }
function paramsFor(href) {
  const url = new URL(href, 'https://audit.invalid'), result = parsed(url.pathname + url.search);
  if (!result.error) return { ...result.params };
  return Object.fromEntries([...new Set(url.searchParams.keys())].map(key => [key, url.searchParams.getAll(key).length > 1 ? url.searchParams.getAll(key) : url.searchParams.get(key)]));
}
function resolveExportBody(file, symbol, seen) {
  const key = file + '#' + symbol; if (seen.has(key)) return null; seen.add(key);
  const info = inspect(file), binding = info.exportBindings.get(symbol);
  if (binding?.path && (binding.path !== file || binding.imported !== symbol)) return exportedTarget(binding.path, binding.imported, seen) ?? binding;
  if (symbol === 'default' && info.reexport?.path) return exportedTarget(info.reexport.path, info.reexport.imported, seen) ?? info.reexport;
  if (symbol === 'default' && info.defaultNode) {
    const node = unbox(info.defaultNode), name = ts.isIdentifier(node) ? node.text : null, imported = name ? info.imports.get(name) : null;
    if (imported?.path && !imported.typeOnly) return exportedTarget(imported.path, imported.imported, seen) ?? imported;
    if (ts.isCallExpression(node)) for (const argument of node.arguments) if (ts.isIdentifier(unbox(argument))) {
      const name = unbox(argument).text, dependency = info.imports.get(name);
      if (dependency?.path && !dependency.typeOnly) return exportedTarget(dependency.path, dependency.imported, seen) ?? dependency;
      if (info.definitions.has(name)) return { path: file, imported: name };
    }
    return { path: file, imported: info.defaultName ?? 'default' };
  }
  if (info.exportNames.has(symbol) || info.definitions.has(symbol)) return { path: file, imported: symbol };
  for (const star of info.exportStars) { const found = exportedTarget(star, symbol, new Set(seen)); if (found) return found; }
  return null;
}
const exportCache = new Map();
function exportedTarget(file, symbol, seen = new Set()) {
  const key = file + '#' + symbol;
  if (exportCache.has(key)) return exportCache.get(key);
  if (seen.has(key)) return null;
  const result = resolveExportBody(file, symbol, new Set(seen)); exportCache.set(key, result); return result;
}
const scopeCache = new Map();

function componentScopes(info, symbol) {
  const key = info.file + '#' + symbol; if (scopeCache.has(key)) return scopeCache.get(key);
  const resolved = symbol === 'default' ? exportedTarget(info.file, symbol) : null;
  const initial = symbol === 'default' ? resolved?.path === info.file && info.definitions.has(resolved.imported) ? resolved.imported : info.defaultName ?? 'default' : symbol, scopes = new Set([initial]), queue = [initial];
  while (queue.length) for (const callee of info.calls.get(queue.shift()) ?? []) if (!scopes.has(callee) && (info.definitions.has(callee) || info.rendered.some(item => item.scope === callee))) { scopes.add(callee); queue.push(callee); }
  scopeCache.set(key, scopes); return scopes;
}
function renderedTrace(file, depth = 0, seen = new Set(), symbol = 'default') {
  const key = file + '#' + symbol;
  if (!file || seen.has(key)) return [];
  seen.add(key); const info = inspect(file), target = exportedTarget(file, symbol), scopes = componentScopes(info, symbol);
  const rendered = info.rendered.filter(item => scopes.has(item.scope) && !item.typeOnly);
  const row = { file, entrySymbol: symbol, resolvedExport: target, defaultExport: info.defaultName ?? info.reexport?.imported ?? null,
    rendered: rendered.filter(item => !/^(?:Native|View$|Text$|ScrollView$|Pressable$|Stack$|Slot$)/.test(item.name)).map(({ name, scope, path, imported, props, line }) => ({ name, scope, path, imported, props: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, typeof value === 'string' && value.length > 1000 ? value.slice(0, 1000) + ' [TRUNCATED; inspect source]' : value])), line })) };
  if (depth >= 8) return [{ ...row, traceLimit: true }];
  const targets = [];
  if (target?.path && (target.path !== file || target.imported !== symbol && !info.definitions.has(target.imported))) targets.push({ path: target.path, symbol: target.imported });
  for (const item of rendered) if (item.path && !/\/components\/(?:ui|layout|icons|brand|navigation)\/|\/shell\/|\/design\//.test(item.path)) targets.push({ path: item.path, symbol: item.imported });
  return [row, ...[...new Map(targets.map(item => [item.path + '#' + item.symbol, item])).values()].flatMap(item => renderedTrace(item.path, depth + 1, seen, item.symbol))];
}
const UNKNOWN = Symbol('unsupported runtime expression');
function evaluate(node, env) {
  node = unbox(node); if (!node) return undefined;
  const literal = simple(node); if (literal !== undefined && !ts.isObjectLiteralExpression(node) && !ts.isArrayLiteralExpression(node)) return literal;
  if (ts.isIdentifier(node)) return node.text in env ? env[node.text] : UNKNOWN;
  if (ts.isPropertyAccessExpression(node)) { const parent = evaluate(node.expression, env); return parent === UNKNOWN ? UNKNOWN : parent?.[node.name.text]; }
  if (ts.isElementAccessExpression(node)) { const parent = evaluate(node.expression, env), key = evaluate(node.argumentExpression, env); return parent === UNKNOWN || key === UNKNOWN ? UNKNOWN : parent?.[key]; }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(element => evaluate(element, env));
  if (ts.isObjectLiteralExpression(node)) { const value = {}; for (const item of node.properties) {
    if (ts.isSpreadAssignment(item)) { const spread = evaluate(item.expression, env); if (spread === UNKNOWN) return UNKNOWN; Object.assign(value, spread); }
    else if (ts.isShorthandPropertyAssignment(item)) value[item.name.text] = env[item.name.text];
    else if (ts.isPropertyAssignment(item)) value[nodeText(item.name).replace(/^['"]|['"]$/g, '')] = evaluate(item.initializer, env);
  } return value; }
  if (ts.isTemplateExpression(node)) { let value = node.head.text; for (const span of node.templateSpans) { const part = evaluate(span.expression, env); if (part === UNKNOWN) return UNKNOWN; value += String(part) + span.literal.text; } return value; }
  if (ts.isConditionalExpression(node)) { const condition = evaluate(node.condition, env); return condition === UNKNOWN ? UNKNOWN : evaluate(condition ? node.whenTrue : node.whenFalse, env); }
  if (ts.isBinaryExpression(node)) {
    const left = evaluate(node.left, env), right = () => evaluate(node.right, env);
    if (left === UNKNOWN) return UNKNOWN;
    switch (node.operatorToken.kind) {
      case ts.SyntaxKind.QuestionQuestionToken: return left ?? right();
      case ts.SyntaxKind.BarBarToken: return left || right();
      case ts.SyntaxKind.AmpersandAmpersandToken: return left && right();
      case ts.SyntaxKind.EqualsEqualsEqualsToken: return right() === UNKNOWN ? UNKNOWN : left === right();
      case ts.SyntaxKind.ExclamationEqualsEqualsToken: return right() === UNKNOWN ? UNKNOWN : left !== right();
      case ts.SyntaxKind.PlusToken: return right() === UNKNOWN ? UNKNOWN : left + right();
    }
  }
  if (ts.isCallExpression(node)) {
    const fn = nodeText(node.expression), args = node.arguments.map(argument => evaluate(argument, env));
    if (['useLocalSearchParams', 'useGlobalSearchParams'].includes(fn)) return env.params;
    if (fn === 'usePathname') return env.pathname;
    if (fn === 'Array.isArray') return args[0] === UNKNOWN ? UNKNOWN : Array.isArray(args[0]);
    if (fn === 'String') return args[0] === UNKNOWN ? UNKNOWN : String(args[0]);
    if (fn === 'encodeURIComponent' || fn === 'decodeURIComponent') return args[0] === UNKNOWN ? UNKNOWN : globalThis[fn](args[0]);
    if (fn === 'nativeAdministrationRoute' || fn === 'canonicalDesktopCatalogRoute') return typeof args[0] === 'string' ? model.nativeAdministrationRoute(args[0]) : UNKNOWN;
    if (fn === 'resolveBusinessDashboardRoute') return '/business';
  }
  return UNKNOWN;
}
function redirectValues(info, href) {
  const params = paramsFor(href), env = { params, pathname: new URL(href, 'https://audit.invalid').pathname, Platform: { OS: 'android' }, BUSINESS_HOME_ROUTE: '/business', WEB_DESKTOP_ROUTE: '/Desktop' };
  for (const [name, dependency] of info.imports) if (dependency.path && !dependency.typeOnly && dependency.imported !== 'default') {
    const literal = simple(inspect(dependency.path).definitions.get(dependency.imported));
    if (literal !== undefined) env[name] = literal;
  }
  for (const { node: declaration, scope } of info.declarations) {
    if (info.activeScopes && scope !== 'module' && !info.activeScopes.has(scope)) continue;
    const value = evaluate(declaration.initializer, env);
    if (ts.isIdentifier(declaration.name)) env[declaration.name.text] = value;
    else if (ts.isObjectBindingPattern(declaration.name) && value && value !== UNKNOWN) { const remaining = { ...value }; for (const item of declaration.name.elements) {
      if (item.dotDotDotToken) env[nodeText(item.name)] = remaining;
      else { const key = nodeText(item.propertyName ?? item.name); env[nodeText(item.name)] = value[key]; delete remaining[key]; }
    } }
  }
  return info.redirects.map(item => {
    let value = evaluate(item.expression, env);
    if ((value === UNKNOWN || !value) && nodeText(item.expression) === 'target' && info.text.includes('canonicalDesktopCatalogRoute(href)')) value = model.nativeAdministrationRoute(href);
    let target;
    if (typeof value === 'string') target = value;
    else if (value && typeof value.pathname === 'string' && !containsUnknown(value)) { const query = new URLSearchParams(); for (const [key, entry] of Object.entries(value.params ?? {})) {
      if (Array.isArray(entry)) for (const repeated of entry) query.append(key, String(repeated));
      else if (entry !== undefined && entry !== null && entry !== UNKNOWN) query.set(key, String(entry));
    } target = value.pathname + (query.size ? '?' + query : ''); }
    return { source: info.file, line: item.line, expression: nodeText(item.expression), resolvedTarget: target ?? null };
  });
}
function containsUnknown(value) { return value === UNKNOWN || Array.isArray(value) && value.some(containsUnknown) || value && typeof value === 'object' && Object.values(value).some(containsUnknown); }
function staticLayoutReturn(file, href) {
  const info = inspect(file), raw = unbox(info.defaultNode), fn = raw && ts.isIdentifier(raw) ? info.definitions.get(raw.text) : raw;
  if (!fn || !(ts.isFunctionDeclaration(fn) || ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return { kind: 'not_evaluated_reexport_or_nonlocal_function' };
  const env = { params: paramsFor(href), pathname: new URL(href, 'https://audit.invalid').pathname, Platform: { OS: 'android' }, BUSINESS_HOME_ROUTE: '/business', WEB_DESKTOP_ROUTE: '/Desktop' };
  function result(expression) {
    expression = unbox(expression);
    if (expression && ts.isConditionalExpression(expression)) { const condition = evaluate(expression.condition, env); return condition === UNKNOWN ? { kind: 'runtime_conditional', expression: nodeText(expression.condition) } : result(condition ? expression.whenTrue : expression.whenFalse); }
    if (expression && (ts.isJsxSelfClosingElement(expression) || ts.isJsxElement(expression))) {
      const opening = ts.isJsxElement(expression) ? expression.openingElement : expression;
      if (nodeText(opening.tagName) === 'Redirect') {
        const attribute = opening.attributes.properties.find(item => ts.isJsxAttribute(item) && nodeText(item.name) === 'href');
        const value = evaluate(attribute?.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : attribute?.initializer, env);
        return typeof value === 'string' ? { kind: 'native_static_redirect', target: value } : { kind: 'runtime_redirect', expression: nodeText(attribute?.initializer) };
      }
    }
    return { kind: 'local_return_not_redirect' };
  }
  function statements(list) {
    for (const statement of list) {
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) env[declaration.name.text] = evaluate(declaration.initializer, env);
      if (ts.isIfStatement(statement)) {
        const condition = evaluate(statement.expression, env);
        if (condition === UNKNOWN) return { kind: 'runtime_conditional', expression: nodeText(statement.expression) };
        const branch = condition ? statement.thenStatement : statement.elseStatement;
        if (branch) { const exited = statements(ts.isBlock(branch) ? branch.statements : [branch]); if (exited) return exited; }
      }
      if (ts.isReturnStatement(statement)) return result(statement.expression);
    }
    return null;
  }
  return fn.body && ts.isBlock(fn.body) ? statements(fn.body.statements) ?? { kind: 'no_static_return' } : result(fn.body);
}
function aliasInfos(trace) { return trace.map(item => {
  const info = inspect(item.file), scopes = componentScopes(info, item.entrySymbol);
  return { ...info, activeScopes: scopes, redirects: info.redirects.filter(item => scopes.has(item.scope)), rendered: info.rendered.filter(item => scopes.has(item.scope)) };
}).filter(info => info.redirects.length && !info.rendered.some(item => !['Redirect', 'NativeWorkflowPage'].includes(item.name) && item.name !== 'LiquidState')); }
function followAliases(href, depth = 0, visited = new Set()) {
  const match = parsed(href); if (match.error || match.generated) return [{ href, ...match }];
  const step = { href, selectedFile: match.selectedFile, params: match.params }, trace = renderedTrace(match.selectedFile), aliases = aliasInfos(trace);
  if (!aliases.length) return [step];
  const redirects = aliases.flatMap(info => redirectValues(info, href)); step.redirects = redirects;
  const targets = [...new Set(redirects.map(item => item.resolvedTarget).filter(Boolean))];
  if (targets.length !== 1) return [{ ...step, unresolved: targets.length ? 'Conditional/multiple redirects need runtime role/state' : 'Redirect expression could not be safely evaluated' }];
  const next = targets[0];
  if (visited.has(next) || next === href) return [{ ...step, cycle: next }];
  if (depth >= 10) return [{ ...step, unresolved: 'Redirect chain exceeds ten links' }];
  visited.add(href); return [step, ...followAliases(next, depth + 1, visited)];
}

const nav = [];
function collectNav(value, sourceExport, path = [], inherited = {}) {
  if (Array.isArray(value)) return value.forEach((item, index) => collectNav(item, sourceExport, [...path, index], inherited));
  if (!value || typeof value !== 'object') return;
  const meta = { ...inherited, ...(value.moduleKey ? { moduleKey: value.moduleKey } : {}) };
  for (const key of ['route', 'href', 'overviewHref']) if (typeof value[key] === 'string' && value[key].startsWith('/')) nav.push({ sourceExport, objectPath: path.join('.'), href: value[key], label: value.label ?? value.title ?? value.id ?? null, ...meta, allowedRoles: value.allowedRoles ?? null, permissionKey: value.permissionKey ?? value.permission ?? null, openInModal: !!value.openInModal, implemented: value.implemented ?? null, conditional: 'Source catalogue entry; effective tenant permissions/features are not simulated.' });
  for (const [key, child] of Object.entries(value)) if (typeof child === 'object' && child) collectNav(child, sourceExport, [...path, key], meta);
}
for (const name of ['portalCatalog', 'shellConfig', 'officeNav', 'assistNav', 'pflegeNav', 'stationaerNav', 'beratungNav', 'akademieNav', 'zentraleNav', 'adminNav', 'PORTAL_NAVIGATION_REGISTRY']) collectNav(model[name], name);
for (const role of model.getRouteByPath('/business').allowedRoles) {
  const apps = model.buildDesktopApps(model.WIDGETS, role).map(app => ({ ...app, route: model.nativeAdministrationRoute(app.route) }));
  for (const area of model.DESKTOP_AREAS.filter(area => ['office', 'assist', 'settings', 'premium', 'robotics'].includes(area.key))) {
    const active = model.filterDesktopCatalogEntries(apps, area.key, { roleKey: role, can: () => true, hasModuleGate: () => true });
    for (const app of active) nav.push({ sourceExport: 'nativeDesktop.Apps', role, area: area.key, href: app.route, label: app.label, conditional: 'Upper-bound catalogue with permission/module predicates true; no customer entitlement claim.' });
    for (const group of model.buildDesktopAreaNavigation(active, area.key)) for (const app of group.items) nav.push({ sourceExport: 'nativeDesktop.Navigation', role, area: area.key, href: app.route, label: app.label, conditional: 'Upper-bound catalogue with permission/module predicates true; no customer entitlement claim.' });
  }
}
const navUnique = [...new Map(nav.map(item => [JSON.stringify(item), item])).values()];
const navByFile = new Map(), navFailures = [];
for (const entry of navUnique) {
  if (/\[[^\]]+\]/.test(entry.href)) continue;
  const destination = parsed(entry.href);
  if (destination.error || destination.generated || destination.chain?.some(name => name.includes('+not-found'))) navFailures.push({ ...entry, resolution: destination });
  else { const entries = navByFile.get(destination.selectedFile) ?? []; entries.push(entry); navByFile.set(destination.selectedFile, entries); }
}

const allTraces = new Map();
for (const { node } of selected) if (!node.generated && node.contextKey.startsWith('./')) {
  const file = 'app/' + node.contextKey.slice(2); allTraces.set(file, renderedTrace(file));
}
// Include all selected receiver files and their native-capable imports. This
// source graph is broader than the menu: unlinked page entry points are roots.
const reachable = new Set([...allTraces.values()].flatMap(trace => trace.map(item => item.file)));
const queue = [...reachable];
while (queue.length) {
  const file = queue.shift(), info = inspect(file);
  for (const imported of info.importsAll) if (imported.path && !imported.typeOnly && !reachable.has(imported.path)) { reachable.add(imported.path); queue.push(imported.path); }
}
const incoming = new Map(), unresolvedLinks = [];
const navSourceFiles = sourceFiles.filter(file => /src\/(?:lib\/navigation|liquid-command\/navigation)\//.test(file));
for (const file of new Set([...reachable, ...navSourceFiles])) for (const link of inspect(file).links) {
  let href = simple(unbox(link.expression)), dynamic = false;
  if (link.expression && ts.isTemplateExpression(unbox(link.expression))) { const value = unbox(link.expression); href = value.head.text + value.templateSpans.map(span => 'audit-record' + span.literal.text).join(''); dynamic = true; }
  if (href && typeof href === 'object') href = href.pathname;
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
    if (link.expression && !['redirect'].includes(link.kind)) unresolvedLinks.push({ file, line: link.line, kind: link.kind, expression: nodeText(link.expression) });
    continue;
  }
  const result = parsed(href), entry = { file, runtimeImportGraph: reachable.has(file), line: link.line, kind: link.kind, hrefSample: href, expression: nodeText(link.expression), dynamic, resolution: result.error ? result.error : result.selectedFile };
  if (!result.error && result.selectedFile) { const rows = incoming.get(result.selectedFile) ?? []; rows.push(entry); incoming.set(result.selectedFile, rows); }
  else unresolvedLinks.push(entry);
}
const tests = testFiles.map(file => ({ file, text: read(file) }));
function testReferences(file, template, trace) {
  const needles = [file.replace(/\.[jt]sx?$/, ''), ...trace.map(item => item.file.replace(/\.[jt]sx?$/, ''))];
  return tests.filter(test => test.text.includes(template) || needles.some(needle => test.text.includes(needle) || test.text.includes(needle.replace(/^src\//, '@/')))).map(test => ({ file: test.file, kind: test.text.includes(template) ? 'route_literal_reference' : 'source_import_or_bundle_reference', executedByThisInventory: false }));
}
function portalFor(path) {
  if (path.startsWith('/liquid-command/')) return portalFor(path.slice('/liquid-command'.length));
  if (/^\/portal\/employee(?:\/|$)/.test(path)) return 'employee';
  if (/^\/portal\/(?:client|relative|family)(?:\/|$)/.test(path)) return 'client_and_family';
  if (/^\/platform(?:\/|$)/.test(path)) return 'platform_operator';
  if (/^\/(?:auth|access)(?:\/|$)/.test(path) || path === '/') return 'shared_access';
  if (/^\/portal(?:\/|$)/.test(path)) return 'other_portal_or_alias';
  if (/^\/(?:business|office|unternehmen|assist|pflege|stationaer|beratung|akademie|medical|insight|robotics|admin|zentrale)(?:\/|$)/.test(path)) return 'administration';
  return 'shared_or_system';
}
const rows = selected.filter(({ node }) => !node.generated && node.contextKey.startsWith('./')).map(({ node, ancestors }) => {
  const template = routeTemplate(node.contextKey) || '/', qualifiedTemplate = '/' + node.contextKey.replace(/^\.\//, '').replace(/(?:\.(?:android|native))?\.[jt]sx?$/, '').split('/').filter(segment => segment !== 'index').join('/'), file = 'app/' + node.contextKey.slice(2), trace = allTraces.get(file), sample = sampleFor(template);
  const url = new URL(sample, 'https://audit.invalid'); url.searchParams.set('auditKeep', 'record/a &?'); url.searchParams.append('auditRepeated', 'one'); url.searchParams.append('auditRepeated', 'two');
  const publicSampleHref = url.pathname + url.search, publicResolution = parsed(publicSampleHref), groupQualified = publicResolution.selectedFile !== file && qualifiedTemplate !== template;
  const sampleHref = groupQualified ? sampleFor(qualifiedTemplate) + url.search : publicSampleHref, result = groupQualified ? parsed(sampleHref) : publicResolution, rule = model.getRouteByPath(template), locks = model.getUnreleasedModuleKeyFromPath(template);
  const info = inspect(file), aliases = aliasInfos(trace), redirects = aliases.flatMap(item => redirectValues(item, sampleHref));
  const navigationEntries = navByFile.get(file) ?? [], incomingLinks = incoming.get(file) ?? [];
  const ownerReturns = ancestors.filter(item => item.contextKey.startsWith('./')).map(item => { const file = 'app/' + item.contextKey.slice(2); return { file, ...staticLayoutReturn(file, sampleHref) }; });
  const staticOwnerRedirect = ownerReturns.find(item => item.kind === 'native_static_redirect');
  const chain = staticOwnerRedirect ? [{ href: sampleHref, selectedFile: file, ownerRedirect: staticOwnerRedirect }, ...followAliases(staticOwnerRedirect.target)] : aliases.length ? followAliases(sampleHref) : [{ href: sampleHref, selectedFile: result.selectedFile, params: result.params }];
  const guards = [...ancestors.filter(item => item.contextKey.startsWith('./')).flatMap(item => { const layoutFile = 'app/' + item.contextKey.slice(2); return inspect(layoutFile).guards.map(guard => ({ file: layoutFile, ...guard })); }), ...trace.flatMap(item => inspect(item.file).guards.map(guard => ({ file: item.file, ...guard })))];
  const conditionalOwnerBranches = ancestors.filter(item => item.contextKey.startsWith('./')).flatMap(item => { const file = 'app/' + item.contextKey.slice(2); return inspect(file).conditionalBranches.map(branch => ({ file, ...branch })); });
  const permissionReferences = trace.flatMap(item => inspect(item.file).permissions.map(permission => ({ file: item.file, ...permission })));
  const preparationSignals = trace.flatMap(item => { const value = inspect(item.file); return /(?:Prep|Placeholder|Prepared)(?:Screen|Workspace)|nicht implementiert|in Vorbereitung|coming soon/i.test(value.file + '\n' + value.text) ? [item.file] : []; });
  const gaps = ['No Android device navigation/retention run performed by this inventory.', 'No page-specific visual, service, record authorization or mutation acceptance performed by this inventory.'];
  if (!rule) gaps.push('No matched APP_ROUTES registry rule.');
  else if (!rule.allowedRoles?.length) gaps.push('Matched registry rule has no explicit role allow-list; do not infer denial or business ownership.');
  if (!navigationEntries.length && !incomingLinks.length) gaps.push('No static navigation/incoming-link evidence; may be an orphan or a record/deep-link-only page.');
  if (trace.some(item => item.traceLimit)) gaps.push('Receiver graph reached the bounded eight-component trace; full module imports remain in inspectedSourceFiles.');
  if (chain.some(item => item.unresolved)) gaps.push('Redirect chain requires runtime role/state or unsupported expression evaluation.');
  if (preparationSignals.length) gaps.push('Preparation/placeholder source signals require manual functional classification.');
  if (groupQualified) gaps.push('Unqualified public URL selects a different page; this file requires an explicit route-group href and may be legacy/shadowed.');
  if (staticOwnerRedirect) gaps.push('Native ancestor layout redirects before this page can render; route presence is not native availability.');
  const resolutionErrors = [];
  if (result.error) resolutionErrors.push(result.error);
  if (result.selectedFile !== file && !template.includes('+')) resolutionErrors.push('Sample resolves to another selected file: ' + result.selectedFile);
  if (result.params?.auditKeep !== 'record/a &?' || JSON.stringify(result.params?.auditRepeated) !== JSON.stringify(['one', 'two'])) resolutionErrors.push('Linking parser did not retain synthetic query parameters.');
  if (chain.some(item => item.cycle)) resolutionErrors.push('Redirect cycle detected.');
  return { id: file, routeTemplate: template, qualifiedRouteTemplate: qualifiedTemplate, sampleHref, publicSampleHref, publicResolution, portal: portalFor(template), selectedFile: file, routeChain: result.chain ?? [],
    layoutChain: ancestors.map(item => ({ route: item.route, selectedFile: item.contextKey.startsWith('./') ? 'app/' + item.contextKey.slice(2) : item.contextKey, initialRouteName: item.initialRouteName ?? null })), receiverTrace: trace,
    roleContract: rule ? { matchedRule: rule.path, exact: rule.path === template, allowedRoles: rule.allowedRoles ?? null, requiresAuth: rule.requiresAuth, productKey: rule.productKey ?? null } : null,
    guards, conditionalOwnerBranches, ownerReturns, permissionReferences, redirects, redirectChain: chain, navigationEntries, incomingLinks,
    status: { moduleLocked: locks, nativeOwnerRedirect: staticOwnerRedirect ?? null, legacyPrefix: template.startsWith('/liquid-command/'), groupQualifiedOnly: groupQualified, alias: aliases.length > 0, preparationSignals, navLinked: navigationEntries.length > 0, staticIncoming: incomingLinks.length > 0, functionalRelease: locks ? 'locked_module_preserved' : staticOwnerRedirect ? 'native_owner_redirects_page' : groupQualified ? 'shadowed_group_variant_needs_review' : preparationSignals.length ? 'prepared_or_placeholder_signal_needs_review' : 'selected_native_page_unverified' },
    evidence: { linkingParser: 'actual installed Expo Router, Android-selected files; app imports inert', syntheticLinkingCheck: resolutionErrors.length === 0 ? 'passed' : 'failed', testReferences: testReferences(file, template, trace), runtimeVerified: false, visualVerified: false },
    resolution: { ...result, errors: resolutionErrors }, gaps,
  };
}).sort((a, b) => a.routeTemplate.localeCompare(b.routeTemplate) || a.selectedFile.localeCompare(b.selectedFile));

const countBy = fn => Object.fromEntries([...new Set(rows.map(fn))].sort().map(key => [key, rows.filter(row => fn(row) === key).length]));
const structuralFailures = rows.filter(row => row.resolution.errors.length).map(row => ({ id: row.id, routeTemplate: row.routeTemplate, errors: row.resolution.errors }));
const checkerControls = {
  unknownUrlSelectsNotFound: parsed('/native-audit-absent-route-604b949e').chain?.some(name => name.includes('+not-found')) === true,
  tsBeforeTsx: sourcePath('@/lib/auth/context', 'app/index.tsx') === 'src/lib/auth/context.ts',
  productWorkflowAlias: sourcePath('@/product-workflows/screens/office/EmployeesAdaptiveScreen', 'app/business/office/employees/index.tsx') !== null && sourcePath('@/product-workflows/screens/office/EmployeesAdaptiveScreen', 'app/business/office/employees/index.tsx') === sourcePath('@/screens/office/EmployeesAdaptiveScreen', 'app/business/office/employees/index.tsx'),
  localHocRecordReceiver: rows.find(row => row.id === 'app/business/office/clients/[id]/billing.native.tsx')?.receiverTrace.some(item => item.rendered.some(receiver => receiver.name === 'ClientRecordScreen' && typeof receiver.props.initialTabOverride === 'string')) === true,
  localHocCompanyReceiver: rows.find(row => row.id === 'app/unternehmen.native.tsx')?.receiverTrace.some(item => item.rendered.some(receiver => receiver.name === 'CompanyWorkspaceScreen')) === true,
};
const sourceHashes = [...sources].sort(([a], [b]) => a.localeCompare(b)).map(([file, text]) => ({ file, sha256: sha(text) }));
const matrix = {
  schemaVersion: 1, platform: 'android', auditKind: 'exhaustive selected-route static inventory plus synthetic installed-router linking checks; not end-to-end acceptance',
  provenance: { sourceTreeHash: sha(JSON.stringify(sourceHashes)), sourceFiles: sourceHashes.length, appVariantFiles: appFiles.length, installedExpoRouter: require('expo-router/package.json').version, metroSourceExts, aliasRules: Object.fromEntries(aliasRules), receiverTraceKind: 'Selected exported symbol, JSX receivers and statically called local JSX helpers; no component/provider execution.', tools: ['installed expo-router', 'installed TypeScript', 'installed esbuild', 'Node'] },
  portals: [
    { id: 'administration', entryLabel: 'Verwaltung', login: '/auth/business-login', root: '/business', source: 'src/liquid-command/screens/AccessHubScreen.tsx' },
    { id: 'employee', entryLabel: 'Mitarbeiter', login: '/auth/employee-login', root: '/portal/employee', source: 'src/liquid-command/screens/AccessHubScreen.tsx' },
    { id: 'client_and_family', entryLabel: 'Klient', login: '/auth/client-login', root: '/portal/client', variants: ['client_portal', 'family_portal', 'academy_family'], source: 'src/liquid-command/screens/AccessHubScreen.tsx' },
  ],
  counts: { selectedPages: rows.length, selectedLayouts: layouts.length, pagesByPortal: countBy(row => row.portal), uniqueTemplates: new Set(rows.map(row => row.routeTemplate)).size, groupQualifiedOnly: rows.filter(row => row.status.groupQualifiedOnly).length, nativeOwnerRedirects: rows.filter(row => row.status.nativeOwnerRedirect).length, aliases: rows.filter(row => row.status.alias).length, lockedPages: rows.filter(row => row.status.moduleLocked).length, withoutStaticIncoming: rows.filter(row => !row.status.navLinked && !row.status.staticIncoming).length, withoutRegistryRule: rows.filter(row => !row.roleContract).length, withoutExplicitRegistryRoles: rows.filter(row => !row.roleContract?.allowedRoles?.length).length, preparedSignals: rows.filter(row => row.status.preparationSignals.length).length, unresolvedRedirects: rows.filter(row => row.redirectChain.some(item => item.unresolved)).length, structuralFailures: structuralFailures.length, navigationEntries: navUnique.length, invalidCatalogueEntries: navFailures.length, sourceGraphFiles: reachable.size, unresolvedSourceNavigationExpressions: unresolvedLinks.length },
  acceptance: { structuralGate: structuralFailures.length || navFailures.length || Object.values(checkerControls).some(value => !value) ? 'failed' : 'passed', releaseAcceptance: 'not_established', unverified: ['Every selected native page needs per-page Android lifecycle, record/tenant/role, design/large-font/keyboard, load/empty/error/retry and meaningful action evidence. Test references are not test pass claims.', 'Runtime-dependent redirects and source navigation expressions are explicitly listed and have not been executed.', 'Nav visibility uses catalogue definitions and an upper-bound desktop permission fixture, not live customer permissions.', 'Locked products remain locked; selected files are not evidence of product release.'] },
  checkerControls, structuralFailures, invalidCatalogueEntries: navFailures, unresolvedSourceNavigation: unresolvedLinks,
  unverifiedLists: {
    allDeviceRuntimeAndVisual: rows.map(row => row.id),
    noRegistryRule: rows.filter(row => !row.roleContract).map(row => row.id),
    noExplicitRegistryRoles: rows.filter(row => !row.roleContract?.allowedRoles?.length).map(row => row.id),
    noStaticIncoming: rows.filter(row => !row.status.navLinked && !row.status.staticIncoming).map(row => row.id),
    unresolvedRedirects: rows.filter(row => row.redirectChain.some(item => item.unresolved)).map(row => row.id),
    groupQualifiedOnly: rows.filter(row => row.status.groupQualifiedOnly).map(row => row.id),
    nativeOwnerRedirected: rows.filter(row => row.status.nativeOwnerRedirect).map(row => row.id),
    preparedSignals: rows.filter(row => row.status.preparationSignals.length).map(row => row.id),
  },
  layouts, rows, inspectedSourceFiles: [...reachable].sort(), sourceHashes,
};
let markdown = `# Native Portal-Routeninventur\n\nDer Android-Dateibaum enthält **${rows.length} ausgewählte Seiten** und **${layouts.length} Layouts**. Die tatsächliche Expo-Android-Dateiauswahl und der installierte Linking-Parser wurden synthetisch geprüft. Das belegt weder eine benutzbare App noch die Ausführung der Seiten, Formulare oder Backendaktionen.\n\nDie drei sichtbaren Zugänge heißen **Verwaltung**, **Mitarbeiter** und **Klient** (AccessHubScreen.tsx). Zum Klientenzugang gehören Familien-/Angehörigenrollen und der Akademie-Familienzweig. Plattformkonsole und gemeinsame Zugänge werden zusätzlich erfasst.\n\n## Zählung\n\n| Bereich | Seiten |\n|---|---:|\n${Object.entries(matrix.counts.pagesByPortal).map(([key, value]) => `| ${key} | ${value} |`).join('\n')}\n\n- Aliasseiten: ${matrix.counts.aliases}\n- Nur gruppenqualifiziert auflösbare Schattenvarianten: ${matrix.counts.groupQualifiedOnly}\n- Native Weiterleitung im übergeordneten Layout: ${matrix.counts.nativeOwnerRedirects}\n- Weiterhin global gesperrte Modulseiten: ${matrix.counts.lockedPages}\n- Ohne statischen Navigations-/Eingangslinkbeleg: ${matrix.counts.withoutStaticIncoming}\n- Ohne passende Registryregel: ${matrix.counts.withoutRegistryRule}\n- Vorbereitungs-/Platzhaltersignale: ${matrix.counts.preparedSignals}\n- Nicht sicher auswertbare Redirectketten: ${matrix.counts.unresolvedRedirects}\n- Strukturelle Dateiauswahl-/Parameterfehler: ${structuralFailures.length}\n- Nicht aufgelöste Quell-Navigationausdrücke: ${unresolvedLinks.length}\n\n## Beleggrenze und offene Abnahme\n\n${matrix.acceptance.unverified.map(item => '- ' + item).join('\n')}\n\n**Für jede unten aufgeführte Seite bleiben Android-Gerätelauf, fachliche Daten-/Schreibverträge und visuelle Abnahme offen.** Die vollständige JSON-Matrix enthält Empfängergraph, Guard-/Berechtigungsreferenzen, Registryvertrag, Navigationsursprung, Redirectausdrücke mit Query-/Recordbezug und Testreferenzen. Fehlende Referenzen bedeuten nicht automatisch, dass eine Seite unbenutzbar oder obsolet ist. Vorbereitungsstrings sind Prüfsignale.\n\n## Ausführbare Prüfung\n\n\`node scripts/audit-native-portal-route-matrix.mjs --write\` erzeugt Matrix und diesen Bericht.\n\`node scripts/audit-native-portal-route-matrix.mjs --check\` prüft den aktuellen Quellstand und die strukturellen Linkingverträge. Eine grüne Strukturprüfung erteilt **keine** Funktions- oder Releasefreigabe.\n\n## Sämtliche ausgewählten Seiten\n\n| Route | Bereich | Status | Registry | Android-Datei |\n|---|---|---|---|---|\n${rows.map(row => `| \`${row.routeTemplate}\` | ${row.portal} | ${row.status.moduleLocked ? 'gesperrt: ' + row.status.moduleLocked : row.status.nativeOwnerRedirect ? 'Owner leitet nativ um' : row.status.groupQualifiedOnly ? 'Gruppen-/Schattenvariante' : row.status.alias ? 'Alias / Redirect' : row.status.preparationSignals.length ? 'Vorbereitungssignal' : 'Laufzeit ungeprüft'} | ${row.roleContract?.matchedRule ?? 'FEHLT'} | \`${row.selectedFile}\` |`).join('\n')}\n`;
const changedWhileReading = sourceHashes.filter(item => !existsSync(resolve(root, item.file)) || sha(readFileSync(resolve(root, item.file), 'utf8')) !== item.sha256).map(item => item.file);
if (changedWhileReading.length) {
  if (!process.argv.includes('--provisional')) { console.error(JSON.stringify({ sourceSnapshotChanged: changedWhileReading })); process.exit(2); }
  matrix.provenance.sourceSnapshotChangedDuringAudit = changedWhileReading;
  matrix.acceptance.structuralGate = 'source_snapshot_mutating_not_established';
  markdown = '> VORLÄUFIGER ARBEITSSTAND: Quellen änderten sich während der Inventur. Vor jedem Gate/Abgleich nach Source-Freeze ohne --provisional neu erzeugen. Betroffen: ' + changedWhileReading.join(', ') + '\n\n' + markdown;
}

const json = JSON.stringify(matrix, null, 2) + '\n';
if (process.argv.includes('--write')) { mkdirSync(resolve(root, dirname(target)), { recursive: true }); writeFileSync(resolve(root, target), json); writeFileSync(resolve(root, summaryTarget), markdown); }
if (process.argv.includes('--check')) {
  if (!existsSync(resolve(root, target)) || readFileSync(resolve(root, target), 'utf8') !== json || !existsSync(resolve(root, summaryTarget)) || readFileSync(resolve(root, summaryTarget), 'utf8') !== markdown) { console.error('Native portal audit outputs are stale; inspect source changes and regenerate with --write.'); process.exitCode = 1; }
  if (matrix.acceptance.structuralGate !== 'passed') { console.error(JSON.stringify({ structuralFailures, invalidCatalogueEntries: navFailures, checkerControls })); process.exitCode = 1; }
}
console.log(JSON.stringify({ ...matrix.counts, structuralGate: matrix.acceptance.structuralGate, releaseAcceptance: matrix.acceptance.releaseAcceptance, matrix: target, summary: summaryTarget }));
