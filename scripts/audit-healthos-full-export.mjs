import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, extname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Usage: node scripts/audit-healthos-full-export.mjs [export-dir]
//        [--verify-current-sources] [--easignore path/to/reviewed-ignore-file]
// Release pipelines must pass --verify-current-sources. The ignore override is
// explicit so archive-fixture checks do not change the project's real rules.
const argumentsToParse = process.argv.slice(2);
const exportRoot = resolve(argumentsToParse[0] && !argumentsToParse[0].startsWith('--') ? argumentsToParse.shift() : 'dist-healthos-full');
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const normalized = (path) => path.replaceAll('\\', '/');
const require = createRequire(import.meta.url);
// Use the installed Expo serializer's identity algorithm, not a separate copy.
const { stringToUUID } = require('@expo/metro-config/build/serializer/debugId.js');
const metroResolver = require(resolve(projectRoot, 'metro.config.js')).resolver;
const sourceExtensions = metroResolver.sourceExts;
const assetExtensions = new Set([...metroResolver.assetExts, 'json'].map((extension) => extension.toLowerCase()));
const ignore = require('ignore');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(file) {
  assert(existsSync(file), `missing artifact: ${normalized(relative(exportRoot, file))}`);
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`invalid JSON in ${basename(file)}: ${error.message}`); }
}

function artifactPath(path) {
  assert(typeof path === 'string' && path.length > 0 && !isAbsolute(path), 'invalid artifact path');
  const resolved = resolve(exportRoot, path);
  const local = relative(exportRoot, resolved);
  assert(local && local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local), `artifact escapes export: ${path}`);
  assert(existsSync(resolved) && statSync(resolved).isFile() && statSync(resolved).size > 0, `missing or empty artifact: ${path}`);
  return resolved;
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : entry.isFile() ? [absolute] : [];
  });
}

function sourceRecords(map) {
  assert(map && map.version === 3, 'Android bundle source map must use version 3');
  if (Array.isArray(map.sections)) {
    return map.sections.flatMap((section) => sourceRecords(section.map));
  }
  assert(Array.isArray(map.sources) && Array.isArray(map.sourcesContent), 'Android bundle map needs sources and sourcesContent');
  assert(map.sources.length === map.sourcesContent.length, 'Android map sourcesContent is incomplete');
  return map.sources.map((source, index) => {
    assert(typeof source === 'string', 'invalid Android source-map entry');
    const path = normalized(source);
    return { path, content: map.sourcesContent[index] };
  });
}

function ownPath(path) {
  if (/(?:^|\/)node_modules\//.test(path)) return null;
  return /(?:^|\/)((?:app|app-portal|src)\/.+)$/.exec(path)?.[1] ?? null;
}

function runtimeImports(record, browserUi = []) {
  assert(typeof record.content === 'string', `source content missing: ${record.path}`);
  const source = ts.createSourceFile(record.path, record.content, ts.ScriptTarget.Latest, false);
  const modules = [];
  const onlyTypeBindings = (bindings) => bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly);
  const platformBindings = new Set();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== 'react-native') continue;
    const clause = statement.importClause;
    if (clause?.isTypeOnly || !clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
    for (const binding of clause.namedBindings.elements) {
      if (!binding.isTypeOnly && (binding.propertyName?.text ?? binding.name.text) === 'Platform') platformBindings.add(binding.name.text);
    }
  }
  // A similarly named parameter/local is not React Native's Platform. Treat
  // all conditions involving a shadowed binding as unknown, conservatively.
  const boundNames = (name) => ts.isIdentifier(name) ? [name.text] : name.elements.flatMap((element) => ts.isOmittedExpression(element) ? [] : boundNames(element.name));
  const bindings = new Map();
  const constantInitializers = new Map();
  const addBinding = (name) => bindings.set(name, (bindings.get(name) ?? 0) + 1);
  function checkShadowing(node, parent) {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
      for (const name of boundNames(node.name)) {
        platformBindings.delete(name);
        addBinding(name);
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isVariableDeclarationList(parent) && parent.flags & ts.NodeFlags.Const) {
        constantInitializers.set(node.name.text, node.initializer);
      }
    }
    if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isEnumDeclaration(node)) && node.name) {
      platformBindings.delete(node.name.text);
      addBinding(node.name.text);
    }
    if ((ts.isImportClause(node) && node.name) || ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportEqualsDeclaration(node)) addBinding(node.name.text);
    ts.forEachChild(node, (child) => checkShadowing(child, node));
  }
  checkShadowing(source);
  const unknown = Symbol('unknown');
  // These preserve known truthiness without inventing an exact JS value:
  // unknown && false can produce false, 0, null, or another falsy value.
  const unknownFalsy = Symbol('unknown falsy value');
  const unknownTruthy = Symbol('unknown truthy value');
  const truthiness = (result) => result === unknown ? unknown : result === unknownFalsy ? false : result === unknownTruthy ? true : Boolean(result);
  const evaluatingConstants = new Set();
  const value = (node) => {
    if (ts.isParenthesizedExpression(node)) return value(node.expression);
    if (ts.isIdentifier(node) && bindings.get(node.text) === 1 && constantInitializers.has(node.text) && !evaluatingConstants.has(node.text)) {
      evaluatingConstants.add(node.text);
      const result = value(constantInitializers.get(node.text));
      evaluatingConstants.delete(node.text);
      return result;
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && platformBindings.has(node.expression.text) && node.name.text === 'OS') return 'android';
    if (ts.isStringLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
      const result = truthiness(value(node.operand));
      return result === unknown ? unknown : !result;
    }
    if (ts.isBinaryExpression(node)) {
      const left = value(node.left), right = value(node.right);
      const operator = node.operatorToken.kind;
      if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
        const truth = truthiness(left);
        return truth === unknown ? truthiness(right) === false ? unknownFalsy : unknown : truth ? right : left;
      }
      if (operator === ts.SyntaxKind.BarBarToken) {
        const truth = truthiness(left);
        return truth === unknown ? truthiness(right) === true ? unknownTruthy : unknown : truth ? left : right;
      }
      if (![unknown, unknownFalsy, unknownTruthy].includes(left) && ![unknown, unknownFalsy, unknownTruthy].includes(right)) {
        if (operator === ts.SyntaxKind.EqualsEqualsEqualsToken) return left === right;
        if (operator === ts.SyntaxKind.ExclamationEqualsEqualsToken) return left !== right;
      }
    }
    return unknown;
  };
  const exits = (node) => {
    if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) return true;
    if (ts.isBlock(node)) return node.statements.some((statement) => exits(statement));
    if (ts.isIfStatement(node)) {
      const condition = truthiness(value(node.expression));
      if (condition !== unknown) return condition ? exits(node.thenStatement) : Boolean(node.elseStatement && exits(node.elseStatement));
      return Boolean(node.elseStatement && exits(node.thenStatement) && exits(node.elseStatement));
    }
    return false;
  };
  const addStaticImport = (node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (!clause?.isTypeOnly && !(clause && !clause.name && onlyTypeBindings(clause.namedBindings)) && ts.isStringLiteral(node.moduleSpecifier)) {
        modules.push(node.moduleSpecifier.text);
        if (node.moduleSpecifier.text === 'react-native-webview') browserUi.push('WebView import');
      }
    } else if (ts.isExportDeclaration(node)) {
      const onlyTypes = node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every((element) => element.isTypeOnly);
      if (!node.isTypeOnly && !onlyTypes && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        modules.push(node.moduleSpecifier.text);
        if (node.moduleSpecifier.text === 'react-native-webview') browserUi.push('WebView reexport');
      }
    }
  };
  // ESM imports/reexports are hoisted, including declarations after a throw.
  source.statements.forEach(addStaticImport);
  function visit(node) {
    // Metro keeps these literal imports in the bundle, but a proven web-only
    // branch cannot execute on Android. Unknown conditions stay conservative.
    if (ts.isIfStatement(node)) {
      visit(node.expression);
      const condition = truthiness(value(node.expression));
      if (condition === unknown || condition) visit(node.thenStatement);
      if (node.elseStatement && (condition === unknown || !condition)) visit(node.elseStatement);
      return;
    }
    if (ts.isConditionalExpression(node)) {
      visit(node.condition);
      const condition = truthiness(value(node.condition));
      if (condition === unknown || condition) visit(node.whenTrue);
      if (condition === unknown || !condition) visit(node.whenFalse);
      return;
    }
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind)) {
      visit(node.left);
      const left = truthiness(value(node.left));
      if (left === unknown || (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? left : !left)) visit(node.right);
      return;
    }
    if (ts.isBlock(node) || ts.isSourceFile(node)) {
      for (const statement of node.statements) {
        visit(statement);
        if (exits(statement)) break;
      }
      return;
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        modules.push(node.arguments[0].text);
        if (node.arguments[0].text === 'react-native-webview') browserUi.push('WebView load');
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (tag === 'iframe' || /(?:^|\.)WebView$/.test(tag)) browserUi.push(tag);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return modules;
}

function selectedAndroidGraph(ownRecords) {
  const byPath = new Map(ownRecords.map((record) => [ownPath(record.path), record]));
  const routes = new Map();
  for (const [path, record] of byPath) {
    if (!path.startsWith('app/') || !/\.[jt]sx?$/.test(path) || /(?:^|\/)\+(?:html|middleware|native-intent)(?:\.|$)|\+api\.[jt]sx?$/.test(path)) continue;
    const stem = path.replace(/\.[jt]sx?$/, '');
    const platform = /\.(android|native|ios|web)$/.exec(stem)?.[1];
    if (platform === 'web' || platform === 'ios') continue;
    const key = platform ? stem.slice(0, -platform.length - 1) : stem;
    const specificity = platform === 'android' ? 2 : platform === 'native' ? 1 : 0;
    if (!routes.has(key) || routes.get(key).specificity < specificity) routes.set(key, { record, specificity });
  }
  const paths = readJson(resolve(projectRoot, 'tsconfig.json')).compilerOptions?.paths ?? {};
  const aliases = Object.entries(paths).sort(([a], [b]) => b.length - a.length);
  const resolveImport = (from, moduleName) => {
    let base;
    if (moduleName.startsWith('.')) base = posix.normalize(posix.join(posix.dirname(from), moduleName));
    else {
      for (const [alias, targets] of aliases) {
        const [prefix, suffix = ''] = alias.split('*');
        const wildcard = alias.includes('*');
        if ((!wildcard && moduleName !== alias) || (wildcard && (!moduleName.startsWith(prefix) || !moduleName.endsWith(suffix)))) continue;
        const middle = wildcard ? moduleName.slice(prefix.length, suffix ? -suffix.length : undefined) : '';
        base = posix.normalize(normalized(targets[0]).replace('*', middle)).replace(/^\.\//, '');
        break;
      }
    }
    if (!base) return null;
    if (byPath.has(base)) return byPath.get(base);
    // Match Metro's platform resolution, using only modules actually present
    // in this map. Explicit .web imports remain explicit and will be rejected.
    for (const stem of [base, `${base}/index`]) {
      for (const extension of sourceExtensions) {
        for (const platform of ['.android', '.native', '']) {
          const candidate = `${stem}${platform}.${extension}`;
          if (byPath.has(candidate)) return byPath.get(candidate);
        }
      }
    }
    return null;
  };
  const pending = [...routes.values()].map(({ record }) => record);
  const visited = new Map();
  while (pending.length) {
    const record = pending.pop();
    const path = ownPath(record.path);
    if (visited.has(path)) continue;
    assert(!/\.(?:web|ios)\.[jt]sx?$/.test(path), `web or iOS implementation reachable from Android routes: ${path}`);
    visited.set(path, record);
    for (const moduleName of runtimeImports(record)) {
      const dependency = resolveImport(path, moduleName);
      if (dependency) pending.push(dependency);
    }
  }
  return { routes: [...routes.values()].map(({ record }) => record), records: [...visited.values()] };
}

function projectFile(path) {
  const file = resolve(projectRoot, path);
  const local = relative(projectRoot, file);
  assert(local && local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local), `source or asset escapes project: ${path}`);
  return file;
}

function verifySourceIdentity(records) {
  const normalizeText = (value) => value.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const verified = new Set();
  for (const record of records) {
    const path = ownPath(record.path);
    const file = projectFile(path);
    assert(existsSync(file) && statSync(file).isFile(), `bundled source no longer exists in project: ${path}`);
    assert(typeof record.content === 'string' && normalizeText(record.content) === normalizeText(readFileSync(file, 'utf8')), `bundled source differs from current project: ${path}`);
    verified.add(path);
  }
  return verified.size;
}

function verifyEasArchiveAssets(records, ignoreFile) {
  assert(existsSync(ignoreFile) && statSync(ignoreFile).isFile(), `reviewed EAS ignore file is missing: ${ignoreFile}`);
  const matcher = ignore().add(readFileSync(ignoreFile, 'utf8'));
  const required = new Set([
    '.easignore', 'app.json', 'app.config.ts', 'eas.json', 'package.json', 'package-lock.json',
    'metro.config.js', 'tsconfig.json', 'android-proguard-rules.pro', 'google-services.json',
    'assets/icon.png', 'assets/splash-icon.png',
    'assets/android-icon-foreground.png', 'assets/android-icon-background.png', 'assets/android-icon-monochrome.png',
    'public/fonts/CenturyGothic.ttf', 'assets/brand/intro/manifest.json',
  ]);
  for (const optional of ['babel.config.js', 'babel.config.cjs']) {
    if (existsSync(projectFile(optional))) required.add(optional);
  }
  const manifest = readJson(resolve(projectRoot, 'assets/brand/intro/manifest.json'));
  for (const format of manifest.formats ?? []) required.add(`assets/brand/intro/${format.file}`);
  const aliases = Object.entries(readJson(resolve(projectRoot, 'tsconfig.json')).compilerOptions?.paths ?? {}).sort(([a], [b]) => b.length - a.length);
  const addAsset = (from, moduleName) => {
    if (!assetExtensions.has(extname(moduleName).slice(1).toLowerCase())) return;
    let path;
    if (moduleName.startsWith('.')) path = posix.normalize(posix.join(posix.dirname(from), moduleName));
    else {
      for (const [alias, targets] of aliases) {
        const [prefix, suffix = ''] = alias.split('*');
        const wildcard = alias.includes('*');
        if ((!wildcard && moduleName !== alias) || (wildcard && (!moduleName.startsWith(prefix) || !moduleName.endsWith(suffix)))) continue;
        const middle = wildcard ? moduleName.slice(prefix.length, suffix ? -suffix.length : undefined) : '';
        path = posix.normalize(normalized(targets[0]).replace('*', middle)).replace(/^\.\//, '');
        break;
      }
    }
    if (path) required.add(path);
  };
  // Metro resolves literal assets from inactive Router candidates too. Scan
  // the whole own source map here, without pruning browser-only branches.
  for (const record of records) {
    const path = ownPath(record.path);
    // Source identity is a separate explicit check. Include physical source
    // inputs in archive coverage; synthetic artifact fixtures may model extra
    // modules and correctly report currentSourceIdentity:false.
    if (existsSync(projectFile(path))) required.add(path);
    assert(typeof record.content === 'string', `source content missing for archive audit: ${path}`);
    const source = ts.createSourceFile(path, record.content, ts.ScriptTarget.Latest, false);
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) addAsset(path, node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) addAsset(path, node.arguments[0].text);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  for (const path of required) {
    const file = projectFile(path);
    assert(existsSync(file) && statSync(file).isFile() && statSync(file).size > 0, `EAS archive input missing or empty: ${path}`);
    assert(!matcher.ignores(normalized(relative(projectRoot, file))), `required source or asset excluded from EAS archive: ${path}`);
  }
  return { ignoreFile: normalized(relative(projectRoot, ignoreFile)), checkedFiles: required.size, includedCheckedSourcesAndAssets: true };
}

function runAudit() {
  let verifyCurrentSources = false;
  let ignoreFile = resolve(projectRoot, '.easignore');
  for (let index = 0; index < argumentsToParse.length; index++) {
    const option = argumentsToParse[index];
    if (option === '--verify-current-sources') verifyCurrentSources = true;
    else if (option === '--easignore') {
      const path = argumentsToParse[++index];
      assert(path && !path.startsWith('--'), '--easignore requires a file path');
      ignoreFile = resolve(path);
    } else throw new Error(`unknown audit option: ${option}`);
  }
  assert(existsSync(exportRoot) && statSync(exportRoot).isDirectory(), `export directory does not exist: ${exportRoot}`);
  const metadata = readJson(resolve(exportRoot, 'metadata.json'));
  assert(metadata.version === 0 && metadata.bundler === 'metro', 'expected Expo Metro export metadata');
  const android = metadata.fileMetadata?.android;
  assert(android && Array.isArray(android.assets), 'Android export metadata is missing');
  assert(Object.keys(metadata.fileMetadata).every((platform) => platform === 'android'), 'expected an Android-only export');
  assert(/^_expo\/static\/js\/android\/[^/]+\.(?:hbc|js)$/.test(normalized(android.bundle ?? '')), 'metadata does not point to an Android runtime bundle');
  const bundle = artifactPath(android.bundle);
  // Only the map belonging to the selected runtime counts. A loose full-app
  // map beside a portal-only bundle cannot satisfy this audit.
  const mapFile = artifactPath(`${android.bundle}.map`);
  const sourceMap = readJson(mapFile);
  const expectedDebugId = stringToUUID(basename(bundle, extname(bundle)));
  assert(sourceMap.debugId === expectedDebugId, 'Android source map identity does not match the selected bundle');
  const records = sourceRecords(sourceMap);
  const sources = [...new Set(records.map((record) => record.path))];
  const ownRecords = records.filter(({ path }) => ownPath(path));
  const forbidden = ownRecords.filter(({ path }) => /(?:^|\/)app-portal\//.test(path));
  assert(forbidden.length === 0, `portal-only implementation in Android graph:\n${forbidden.map(({ path }) => path).join('\n')}`);
  const verifiedCurrentSources = verifyCurrentSources ? verifySourceIdentity(ownRecords) : 0;
  const easArchiveAssets = verifyEasArchiveAssets(ownRecords, ignoreFile);
  // Expo Router's require.context includes platform candidates in the bundle;
  // getRoutesCore selects Android/native/default files before loading a route.
  // Audit imports from those selected routes, rather than rejecting unused
  // browser candidates simply because they appear in a source map.
  const selected = selectedAndroidGraph(ownRecords);
  const webViewScreens = selected.records.filter((record) => {
    const browserUi = [];
    runtimeImports(record, browserUi);
    return browserUi.length > 0;
  });
  assert(webViewScreens.length === 0, `WebView/iframe reachable in native Android UI:\n${webViewScreens.map(({ path }) => path).join('\n')}`);
  const inactiveWebSources = ownRecords.filter(({ path }) => /\.web\.[jt]sx?$/.test(path)).map(({ path }) => ownPath(path));

  const getSource = (suffix) => selected.records.find(({ path }) => path === suffix || path.endsWith(`/${suffix}`));
  const requireSource = (suffix) => {
    const source = getSource(suffix);
    assert(source && typeof source.content === 'string' && source.content.trim(), `required Android source missing: ${suffix}`);
    return source.content;
  };
  const requireNativeSource = (base, extension = 'tsx') => {
    for (const platform of ['.android', '.native', '']) {
      const suffix = `${base}${platform}.${extension}`;
      if (getSource(suffix)) return { path: suffix, content: requireSource(suffix) };
    }
    throw new Error(`required native implementation missing: ${base}`);
  };

  const requiredRoutes = [
    'app/_layout.tsx', 'app/index.tsx', 'app/auth/_layout.tsx', 'app/auth/index.tsx',
    'app/auth/business-login.tsx', 'app/auth/register.tsx', 'app/auth/register-business.tsx',
    'app/auth/employee-login.tsx', 'app/auth/employee-first-login.tsx', 'app/auth/client-login.tsx',
    'app/business/_layout.tsx', 'app/business/(tabs)/index.tsx',
    'app/office/_layout.tsx', 'app/office/index.tsx',
    'app/office/(tabs)/employees.tsx', 'app/office/(tabs)/clients.tsx',
    'app/portal/employee/_layout.tsx', 'app/portal/employee/(tabs)/index.tsx',
    'app/portal/employee/assignments/[id]/execute.tsx',
    'app/portal/client/_layout.tsx', 'app/portal/client/(tabs)/index.tsx',
    'app/portal/client/(tabs)/documents.tsx',
    'app/settings/tenant/notifications.tsx',
  ];
  requiredRoutes.forEach(path => requireNativeSource(path.replace(/\.tsx$/, '')));
  const nativeImplementations = [
    requireNativeSource('src/liquid-command/screens/LiquidCommandEntryScreen'),
    requireNativeSource('src/liquid-command/screens/AccessHubBaseScreen'),
    requireNativeSource('src/liquid-command/screens/AccessScreens'),
    requireNativeSource('src/lib/auth/businessAuthService', 'ts'),
    requireNativeSource('src/liquid-command/screens/ModuleWorkspaceScreen'),
    requireNativeSource('src/liquid-command/components/CompanyRegistrationSelect'),
    requireNativeSource('src/liquid-command/screens/CommandCenterScreen'),
    requireNativeSource('src/screens/support/PublicSupportScreen'),
    requireNativeSource('src/screens/connect/GoogleWorkspaceScreen'),
    requireNativeSource('src/ai/robot/RobotNavigationAssistant'),
    requireNativeSource('src/screens/auth/BusinessPasswordRecovery'),
    requireNativeSource('src/components/images/CareSuiteImage'),
    requireNativeSource('src/screens/settings/TenantNotificationSettingsScreen'),
  ];
  for (const path of ['src/liquid-command/screens/CommandCenterScreen.native.tsx', 'src/screens/support/PublicSupportScreen.native.tsx', 'src/screens/connect/GoogleWorkspaceScreen.native.tsx', 'src/ai/robot/RobotNavigationAssistant.native.tsx', 'src/screens/auth/BusinessPasswordRecovery.native.tsx', 'src/components/images/CareSuiteImage.native.tsx']) requireSource(path);
  const hub = requireSource('src/liquid-command/screens/AccessHubScreen.tsx');
  for (const role of ['employee', 'client', 'administration']) {
    assert(new RegExp(`id:\\s*['"]${role}['"]`).test(hub), `access hub misses ${role}`);
  }
  assert(/showRegistration/.test(hub), 'access hub has no registration entry');
  const access = nativeImplementations.find(({ path }) => /\/AccessScreens(?:\.\w+)?\.tsx$/.test(path)).content;
  for (const screen of ['BusinessAccessScreen', 'EmployeeAccessScreen', 'PortalAccessScreen', 'RegisterOrganizationScreen']) {
    assert(access.includes(screen), `native access implementation misses ${screen}`);
  }

  const root = requireSource('app/_layout.tsx');
  const moduleLayout = requireSource('src/liquid-command/shell/LiquidModuleRouteLayout.tsx');
  const portalLayout = requireNativeSource('src/liquid-command/shell/LiquidPortalRouteLayout').content;
  for (const gate of ['PortalBiometricGate', 'PortalPushRegistrationGate']) {
    const directory = gate === 'PortalBiometricGate' ? 'auth' : 'portal';
    requireNativeSource(`src/components/${directory}/${gate}`);
    assert(new RegExp(`<${gate}\\b`).test(root), `full root does not render ${gate}`);
  }
  for (const guard of ['RequireAuth', 'RequireRole', 'RequireEmployeePasswordSetup']) {
    requireNativeSource(`src/lib/auth/${guard}`);
  }
  for (const guard of ['RequireAuth', 'RequireRole', 'LiquidProductAccessGuard']) {
    assert(new RegExp(`<${guard}\\b`).test(moduleLayout), `business/Office boundary misses ${guard}`);
  }
  for (const guard of ['RequireAuth', 'RequireRole', 'RequireEmployeePasswordSetup']) {
    assert(new RegExp(`<${guard}\\b`).test(portalLayout), `portal boundary misses ${guard}`);
  }
  const rolePolicy = requireSource('src/lib/navigation/routes.ts');
  for (const role of ['business_admin', 'employee_portal', 'client_portal']) {
    assert(rolePolicy.includes(role), `bundled route policy misses ${role}`);
  }
  requireSource('src/lib/navigation/redirects.ts');
  requireSource('src/lib/auth/sessionTarget.ts');
  requireSource('src/lib/auth/AuthProvider.tsx');
  requireSource('src/lib/portal/portalPushNotifications.ts');
  requireSource('src/lib/portal/portalPushNavigation.ts');
  requireSource('src/lib/portal/resolvePortalPushDestination.ts');
  requireSource('src/lib/tenant/tenantNotificationSettingsService.ts');

  const packagedAssets = android.assets.map((asset) => {
    assert(asset && typeof asset.ext === 'string', 'invalid Android asset metadata');
    const file = artifactPath(asset.path);
    return { file, ext: asset.ext, bytes: statSync(file).size };
  });
  const digestCache = new Map();
  const digest = (file) => {
    if (!digestCache.has(file)) digestCache.set(file, sha256(file));
    return digestCache.get(file);
  };
  const findPackaged = (expectedBytes, expectedDigest, ext) => packagedAssets.find((asset) => asset.ext === ext && asset.bytes === expectedBytes && digest(asset.file) === expectedDigest);
  const manifest = readJson(resolve(projectRoot, 'assets/brand/intro/manifest.json'));
  assert(manifest.version === '1.3' && manifest.durationSeconds === 8 && manifest.formats?.length === 6, 'expected approved eight-second v1.3 intro with six formats');
  requireSource('src/components/brand/AppStartIntro.native.tsx');
  requireSource('src/components/brand/appStartIntroAssets.ts');
  const introAssets = manifest.formats.map((format) => {
    assert(typeof format.file === 'string' && basename(format.file) === format.file && /\.mp4$/.test(format.file), 'invalid approved intro filename');
    const source = resolve(projectRoot, 'assets/brand/intro', format.file);
    assert(existsSync(source) && statSync(source).size === format.bytes && digest(source) === format.sha256, `intro source differs from approved media: ${format.id}`);
    const packaged = findPackaged(format.bytes, format.sha256, 'mp4');
    assert(packaged, `approved offline intro is missing or changed in Android assets: ${format.id}`);
    return { format: format.id, bytes: format.bytes, sha256: format.sha256, packaged: normalized(relative(exportRoot, packaged.file)) };
  });

  const fontProvider = requireSource('src/design/CareSuiteFontProvider.native.tsx');
  assert(fontProvider.includes('CenturyGothic.ttf'), 'native Century Gothic font loading is missing');
  requireSource('src/design/tokens/appFontFamily.ts');
  requireSource('src/design/tokens/fontFamily.ts');
  const fontFile = resolve(projectRoot, 'public/fonts/CenturyGothic.ttf');
  const fontDigest = '64654e2515da88ca0c470c69b45341a0dda7f066a5f0c72cd6f2a929cdedd461';
  assert(existsSync(fontFile) && digest(fontFile) === fontDigest, 'native font differs from supplied Century Gothic');
  const font = findPackaged(statSync(fontFile).size, fontDigest, 'ttf');
  assert(font, 'offline Century Gothic font is missing or changed in Android assets');

  const files = listFiles(exportRoot);
  const runtimeFiles = files.filter((file) => !file.endsWith('.map'));
  const runtimeBytes = runtimeFiles.reduce((sum, file) => sum + statSync(file).size, 0);
  const largestAssets = [...packagedAssets].sort((a, b) => b.bytes - a.bytes).slice(0, 12).map(({ file, ext, bytes }) => ({ path: normalized(relative(exportRoot, file)), type: ext, bytes }));
  return {
    status: 'ok', export: basename(exportRoot), platform: 'android', routerRoot: 'app',
    bundle: normalized(relative(exportRoot, bundle)), sourceMap: normalized(relative(exportRoot, mapFile)),
    bundleBytes: statSync(bundle).size, runtimeBytes,
    runtimeSizeMb: Number((runtimeBytes / 1024 / 1024).toFixed(1)), runtimeFiles: runtimeFiles.length,
    bundledSources: sources.length, requiredRoutes: requiredRoutes.length, nativeUiWithoutWebViews: true,
    selectedAndroidRoutes: selected.routes.length, selectedAndroidSources: selected.records.length,
    importAnalysis: 'Selected Android/native/default routes; static imports and literal dynamic imports; known Platform.OS branches evaluated for Android.',
    routes: Object.fromEntries(['business', 'office', 'portal/employee', 'portal/client'].map((branch) => [branch, ownRecords.filter(({ path }) => path.includes(`/app/${branch}/`) || path.startsWith(`app/${branch}/`)).length])),
    selectedNativeRouteImplementations: nativeImplementations.map(({ path }) => path),
    portalSecurityGates: true, authenticationAndRolePolicy: true, reachableWebImplementations: [],
    inactiveWebCandidates: inactiveWebSources,
    currentSourceIdentity: verifyCurrentSources, verifiedCurrentSources,
    currentSourceIdentityScope: 'Mapped app/src text only; BOM/CRLF normalized. Other input content identity is not asserted by this field.',
    easArchiveAssets,
    introAssets, nativeFont: { bytes: font.bytes, sha256: fontDigest, packaged: normalized(relative(exportRoot, font.file)) },
    packagedAssets: packagedAssets.length, packagedAssetBytes: packagedAssets.reduce((sum, asset) => sum + asset.bytes, 0), largestAssets,
  };
}

try { console.log(JSON.stringify(runAudit(), null, 2)); }
catch (error) {
  console.error(`HealthOS full export audit failed: ${error.message}`);
  process.exit(1);
}
