import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const app = resolve(root, 'app');
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]);
}
const routes = [...new Set(files(app).filter(file => /\.[jt]sx?$/.test(file)).map(file => relative(app, file).replace(/\\/g, '/').replace(/(?:\.(?:web|native|android|ios))?\.[jt]sx?$/, '').split('/').filter(segment => !/^\(.+\)$/.test(segment))).filter(segments => !segments.some(segment => segment.startsWith('+') || segment === '_layout')).map(segments => '/' + segments.filter((segment, index) => !(segment === 'index' && index === segments.length - 1)).join('/')))].sort();
const output = resolve(root, 'src/lib/navigation/webRoutePatterns.json');
const expected = JSON.stringify(routes, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== expected) throw new Error('Web route parents do not match the current application routes. Run the generator before review.');
} else writeFileSync(output, expected);
console.log(`${routes.length} current route patterns verified for Web parent navigation.`);
