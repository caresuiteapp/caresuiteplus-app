import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vercel serves index.html for direct application URLs. The actual exported
// React root must therefore hydrate identically for the home and deep links.
// This exercises Expo's platform-file resolution, beyond component unit tests.
const output = resolve(process.argv[2] ?? 'dist');
const routes = ['index.html', 'auth/business-login.html', 'business/office/access/module-permissions/index.html'];
const roots = routes.map((route) => {
  const html = readFileSync(resolve(output, route), 'utf8');
  const root = html.match(/<div id="root">([\s\S]*?)<script\b/)?.[1];
  assert(root, `React root missing from ${route}`);
  assert(root.includes('data-caresuite-start-intro'), `Startup intro missing from ${route}`);
  return root;
});
for (let index = 1; index < roots.length; index += 1) {
  assert(roots[index] === roots[0], `${routes[index]} prerenders a different initial route than index.html`);
}
console.log(`Web navigation export audit passed: ${routes.length} identical initial React roots.`);
