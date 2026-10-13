// Static Expo route existence check; authorization, dynamic values and layout require separate verification.
const fs = require("fs"), path = require("path"), ts = require(process.cwd() + "/node_modules/typescript"), { buildSync } = require(process.cwd() + "/node_modules/esbuild");
const root = process.cwd();
const clientScope = process.argv.includes('--client');
const employeeScope = process.argv.includes('--employee');
const portalScope = clientScope || employeeScope;
const portalKind = employeeScope ? 'employee' : 'client';
const catalogPath = portalScope ? 'src/liquid-command/navigation/portalCatalog.ts' : 'src/liquid-command/navigation/desktopAppCatalogModel.ts';
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
}
const routeFiles = walk("app").filter((p) => /\.tsx$/.test(p) && !/(\.web\.|_layout|\+html|\+not-found)/.test(p));
const routes = routeFiles.map((p) => ({ file: p, route: ("/" + p.slice(4)).replace(/\/\([^/]+\)/g, "").replace(/\.tsx$/, "").replace(/\/index$/, "") || "/" }));
function match(url) {
  const bare = url.split(/[?#]/)[0].replace(/\/\([^/]+\)/g, "");
  return routes.filter((r) => new RegExp("^" + r.route.split("/").map((s) => /^\[\.\.\./.test(s) ? ".*" : /^\[/.test(s) ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/") + "/?$").test(bare));
}
const bundle = buildSync({ entryPoints: [catalogPath], bundle: true, write: false, platform: "node", format: "cjs", external: ["react-native"] }).outputFiles[0].text;
const m = { exports: {} };
new Function("require", "module", "exports", bundle)((id) => id === "react-native" ? { Platform: { OS: "android" } } : require(id), m, m.exports);
const apps = portalScope ? m.exports.liquidPortalNavigation[portalKind] : m.exports.buildDesktopApps([], "business_admin");
const inspected = /* @__PURE__ */ new Set(), links = [], missing = [], dynamic = [], unresolved = [];
const queue = apps.flatMap((a) => match(a.route).map((r) => r.file));
if (portalScope) queue.push(...walk(`app/portal/${portalKind}`).filter((p) => /\.tsx$/.test(p) && !/\.web\./.test(p)), `src/lib/navigation/${portalKind}PortalNavigation.ts`);
const text = (n) => ts.isAsExpression(n) || ts.isTypeAssertionExpression(n) || ts.isParenthesizedExpression(n) ? text(n.expression) : ts.isObjectLiteralExpression(n) ? n.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText() === "pathname") ? text(n.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === "pathname").initializer) : null : ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : ts.isTemplateExpression(n) ? n.head.text + n.templateSpans.map((s) => "example-id" + s.literal.text).join("") : null;
function check(url, file, line) {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return;
  if (portalScope && !new RegExp(`^/portal/${portalKind}(?:[/?#]|$)`).test(url)) return;
  let hits = match(url);
  if (!hits.length && url.includes("example-id")) {
    const pattern = new RegExp("^" + url.split(/[?#]/)[0].split("/").map((part) => part === "example-id" ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/") + "/?$");
    hits = routes.filter((r) => pattern.test(r.route.replace(/\[[^/]+\]/g, "example-id")));
    if (hits.length) dynamic.push({ file, line, url, targets: hits.map((x) => x.file) });
  }
  links.push({ file, line, url, targets: hits.map((x) => x.file) });
  if (!hits.length) missing.push({ file, line, url });
  else for (const hit of hits) queue.push(hit.file);
}
for (const app of apps) check(app.route, catalogPath, 0);
while (queue.length) {
  let visit2 = function(n) {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) {
      const mod = n.moduleSpecifier;
      if (mod && ts.isStringLiteral(mod)) {
        const found = ts.resolveModuleName(mod.text, path.resolve(file), options, ts.sys).resolvedModule;
        if (found) {
          let p = path.relative(root, found.resolvedFileName);
          const native = p.replace(/\.(tsx|ts)$/, ".native.$1");
          if (fs.existsSync(native)) p = native;
          queue.push(p);
        }
      }
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ["push", "replace", "navigate"].includes(n.expression.name.text) && /router/.test(n.expression.expression.getText(src))) {
      const arg = n.arguments[0];
      if (arg) {
        const value = text(arg), line = src.getLineAndCharacterOfPosition(n.pos).line + 1;
        if (value === null) unresolved.push({ file, line, expression: arg.getText(src) });
        else check(value, file, line);
      }
    }
    if (ts.isPropertyAssignment(n) && ["route", "href", "pathname"].includes(n.name.getText(src).replace(/['"]/g, ""))) check(text(n.initializer), file, src.getLineAndCharacterOfPosition(n.pos).line + 1);
    if (ts.isJsxAttribute(n) && n.name.getText(src) === "href" && n.initializer) {
      const v = ts.isJsxExpression(n.initializer) ? n.initializer.expression : n.initializer;
      if (v) check(text(v), file, src.getLineAndCharacterOfPosition(n.pos).line + 1);
    }
    ts.forEachChild(n, visit2);
  };
  var visit = visit2;
  const file = queue.shift();
  if (inspected.has(file) || !fs.existsSync(file) || !/^src\/|^app\//.test(file) || /\.web\./.test(file)) continue;
  inspected.add(file);
  const src = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  visit2(src);
}
const result = { generatedAt: (/* @__PURE__ */ new Date()).toISOString(), scope: portalScope ? `${portalKind}-portal` : 'administration', catalogEntries: apps.length, reachableSourceFiles: inspected.size, linksChecked: links.length, missing, dynamic, unresolved, catalog: apps.map((a) => ({ label: a.label, route: a.route, targets: match(a.route).map((r) => r.file) })), links };
const output = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, links: void 0, catalog: void 0 }, null, 2));
if (missing.length) process.exitCode = 1;
