import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Exercise emitted files in plain Node, without Vitest/Metro import resolution.
// The Vercel Node builder selects one compiler config from the entrypoint and
// preserves the relative paths of traced .mjs files and includeFiles assets.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(root, 'api/einvoice/validate.ts');
const configPath = ts.findConfigFile(entry, ts.sys.fileExists);
assert.equal(configPath, resolve(root, 'api/tsconfig.json'), 'The API must use its Node compiler configuration.');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(config.error, undefined);
const converted = ts.convertCompilerOptionsFromJson(config.config.compilerOptions, dirname(configPath));
assert.equal(converted.errors.length, 0);
assert.equal(converted.options.module, ts.ModuleKind.NodeNext);
assert.equal(converted.options.moduleResolution, ts.ModuleResolutionKind.NodeNext);
const output = mkdtempSync(join(tmpdir(), 'office-einvoice-node-runtime-'));
const seen = new Set();
try {
  function emit(source) {
    if (seen.has(source)) return;
    seen.add(source);
    const target = join(output, relative(root, source).replace(/\.ts$/, '.js'));
    mkdirSync(dirname(target), { recursive: true });
    const original = readFileSync(source, 'utf8');
    const code = source.endsWith('.ts') ? ts.transpileModule(original, { fileName: source, compilerOptions: converted.options }).outputText : original;
    writeFileSync(target, code);
    for (const match of code.matchAll(/(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue;
      const base = resolve(dirname(source), match[1]);
      const dependency = [base, `${base}.ts`, `${base}.mjs`, `${base}.js`].find(existsSync);
      assert(dependency, `Missing emitted runtime dependency: ${match[1]} from ${relative(root, source)}`);
      emit(dependency);
    }
  }
  emit(entry);
  emit(resolve(root, 'api/_lib/einvoice-pdf-worker.mjs'));
  cpSync(resolve(root, 'api/_lib/einvoice-rules'), join(output, 'api/_lib/einvoice-rules'), { recursive: true });
  // Symlinks reuse the installed lockfile dependencies; no install or network.
  for (const name of ['libxml2-wasm', 'saxon-js', 'pdfjs-dist']) {
    let directory = dirname(require.resolve(name));
    while (!existsSync(join(directory, 'package.json')) || JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).name !== name) {
      const parent = dirname(directory); assert.notEqual(parent, directory, `Package root missing: ${name}`); directory = parent;
    }
    const link = join(output, 'node_modules', name); mkdirSync(dirname(link), { recursive: true }); symlinkSync(directory, link, 'dir');
  }
  const emittedEntry = readFileSync(join(output, 'api/einvoice/validate.js'), 'utf8');
  assert.match(emittedEntry, /require\(["']\.\.\/_lib\/einvoice-validation-handler["']\)/);
  assert.match(emittedEntry, /import\(["']\.\.\/_lib\/einvoice-validator\.mjs["']\)/, 'Validator WASM initialization must remain a native asynchronous import.');
  const runner = `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const handler = require('./api/einvoice/validate.js').default;
    for (const [method, expected] of [['GET',405],['POST',401]]) {
      const state = {}; const response = { status(value){state.status=value;return this},setHeader(){},json(value){state.body=value;return this} };
      await handler({method,headers:{},body:{}},response);
      assert.equal(state.status,expected); assert.equal(state.body.ok,false);
    }
    const { validateEInvoiceXml } = await import('./api/_lib/einvoice-validator.mjs');
    const report = await validateEInvoiceXml({xml:readFileSync(${JSON.stringify(resolve(root, 'scripts/fixtures/einvoice/kosit-01.01a-ubl.xml'))})});
    assert.equal(report.status,'valid');
    console.log('Node runtime startup passed: GET 405, anonymous POST 401, native WASM validator and packaged rules.');
  `;
  writeFileSync(join(output, 'check.mjs'), runner);
  const result = spawnSync(process.execPath, [join(output, 'check.mjs')], { cwd: output, stdio: 'inherit', timeout: 60000, env: { ...process.env, NODE_OPTIONS: '' } });
  assert.equal(result.error, undefined); assert.equal(result.status, 0, 'The emitted API must start in plain Node.');
} finally { rmSync(output, { recursive: true, force: true }); }
