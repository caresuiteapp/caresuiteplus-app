import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const liquidRoot = join(root, 'src', 'liquid-command');
const routeRoot = join(root, 'app', 'liquid-command');
const failures = [];

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collect(path) : [path];
  });
}

function requireFile(path) {
  if (!existsSync(join(root, path))) failures.push(`Fehlende Datei: ${path}`);
}

[
  'app/index.tsx',
  'app/liquid-command/index.tsx',
  'app/liquid-command/access/index.tsx',
  'app/liquid-command/access/business.tsx',
  'app/liquid-command/access/employee.tsx',
  'app/liquid-command/access/client.tsx',
  'app/liquid-command/access/family.tsx',
  'app/liquid-command/access/register.tsx',
  'app/liquid-command/access/recovery.tsx',
  'app/liquid-command/access/reset-password.tsx',
  'app/liquid-command/portal/employee.tsx',
  'app/liquid-command/portal/client.tsx',
  'app/liquid-command/portal/family.tsx',
].forEach(requireFile);

for (const module of [
  'office',
  'assist',
  'pflege',
  'stationaer',
  'beratung',
  'akademie',
  'robotics',
  'platform',
  'settings',
]) {
  requireFile(`app/liquid-command/${module}/index.tsx`);
}

const sources = collect(liquidRoot).filter((path) => ['.ts', '.tsx'].includes(extname(path)));
const sourceText = sources.map((path) => readFileSync(path, 'utf8')).join('\n');
const routeFiles = collect(routeRoot).filter((path) => extname(path) === '.tsx');

const forbiddenImports = /from\s+['"]@\/(components|screens|design|theme)(?:\/|['"])/g;
for (const path of sources) {
  const text = readFileSync(path, 'utf8');
  if (forbiddenImports.test(text)) {
    failures.push(`Legacy-UI-Import: ${relative(root, path)}`);
  }
  forbiddenImports.lastIndex = 0;
  if (/on(?:Press|ChangeText)=\{\(\)\s*=>\s*undefined\}/.test(text)) {
    failures.push(`Leere Interaktion: ${relative(root, path)}`);
  }
}

for (const [token, value] of Object.entries({
  navy950: '#06152B',
  navy800: '#0A2342',
  blue500: '#1478FF',
  blue200: '#8BC1FF',
  white: '#FFFFFF',
})) {
  if (!sourceText.includes(`${token}: '${value}'`)) {
    failures.push(`Binding Token fehlt: ${token} ${value}`);
  }
}

for (const pageType of [
  'command-center',
  'work-list',
  'record',
  'planning',
  'editor',
  'review',
  'analytics',
  'settings',
]) {
  if (!sourceText.includes(`pageType: '${pageType}'`)) {
    failures.push(`Universeller Seitentyp fehlt: ${pageType}`);
  }
}

if (!sourceText.includes('phone-landscape-blocked')) {
  failures.push('Smartphone-Querformat-Sperre fehlt.');
}
if (!sourceText.includes('fetchPortalAppointments')) {
  failures.push('Portal-Terminadapter fehlt.');
}
if (!sourceText.includes('downloadPortalDocument')) {
  failures.push('Portal-Dokumentdownload fehlt.');
}
if (!sourceText.includes('registerBusinessTenant')) {
  failures.push('Organisationsregistrierung fehlt.');
}

if (failures.length) {
  console.error(`Liquid Command Audit fehlgeschlagen (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Liquid Command Audit: OK · ${sources.length} isolierte UI-Dateien · ${routeFiles.length} Routen · 10 Module · 8 Seitentypen`,
);
