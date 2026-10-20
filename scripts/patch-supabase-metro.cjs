/**
 * Metro (Expo web + static SSR) resolves @supabase/realtime-js via the ESM
 * dist/module build whose extensionless relative imports fail on Windows/web.
 * Force CJS entry points by patching package.json fields after install.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function patchJson(relativePkg, mutate) {
  const pkgPath = path.join(root, 'node_modules', relativePkg, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.warn(`[patch-supabase-metro] skip missing ${relativePkg}`);
    return false;
  }
  const raw = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  mutate(pkg);
  const next = `${JSON.stringify(pkg, null, 2)}\n`;
  if (next !== raw) {
    fs.writeFileSync(pkgPath, next, 'utf8');
    console.log(`[patch-supabase-metro] patched ${relativePkg}`);
    return true;
  }
  return false;
}

let changed = 0;

if (
  patchJson('@supabase/realtime-js', (pkg) => {
    pkg.main = 'dist/main/index.js';
    delete pkg.module;
    pkg.types = 'dist/main/index.d.ts';
  })
) {
  changed += 1;
}

if (
  patchJson('@supabase/supabase-js', (pkg) => {
    pkg.main = 'dist/index.cjs';
    delete pkg.module;
    pkg.types = 'dist/index.d.cts';
    const dot = pkg.exports?.['.'];
    if (dot && typeof dot === 'object') {
      if (dot.import?.default) {
        dot.import.default = './dist/index.cjs';
      }
      if (dot.require?.default) {
        dot.require.default = './dist/index.cjs';
      }
      if (dot['react-native']?.default) {
        dot['react-native'].default = './dist/index.cjs';
      }
    }
  })
) {
  changed += 1;
}

if (
  patchJson('@supabase/phoenix', (pkg) => {
    pkg.main = './priv/static/phoenix.cjs.js';
    delete pkg.module;
    if (pkg.exports && typeof pkg.exports === 'object') {
      if (pkg.exports.import?.default) {
        pkg.exports.import.default = './priv/static/phoenix.cjs.js';
      }
      pkg.exports['./package.json'] = './package.json';
    }
  })
) {
  changed += 1;
}

if (changed === 0) {
  console.log('[patch-supabase-metro] already patched');
}
