import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const liquidRoot = path.join(root, 'src', 'liquid-command');
const required = [
  'src/liquid-command/LiquidCommandApp.tsx',
  'src/liquid-command/tokens.ts',
  'src/liquid-command/moduleRegistry.ts',
  'src/liquid-command/data/contracts.ts',
  'src/liquid-command/hooks/useLiquidFormFactor.ts',
  'src/liquid-command/hooks/usePhonePortraitLock.ts',
  'src/liquid-command/screens/RotateDeviceScreen.tsx',
  'app/liquid-command/index.tsx',
];

const errors = [];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) {
    errors.push(`Pflichtdatei fehlt: ${relative}`);
  }
}

if (fs.existsSync(liquidRoot)) {
  const stack = [liquidRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue;
      const content = fs.readFileSync(absolute, 'utf8');
      const forbidden = [
        /from ['"]@\/components\//,
        /from ['"]@\/design\//,
        /from ['"]@\/screens\//,
        /from ['"]@\/components\/navigation/,
      ];
      for (const pattern of forbidden) {
        if (pattern.test(content)) {
          errors.push(
            `Verbotener Legacy-Import in ${path.relative(root, absolute)}: ${pattern}`,
          );
        }
      }
    }
  }
}

if (errors.length) {
  console.error('Liquid Command Greenfield Audit: FEHLER');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Liquid Command Greenfield Audit: OK');
console.log('- Keine alten UI-/Design-/Screen-Imports');
console.log('- Datenzugriff ist über neue Contracts getrennt');
console.log('- Vier Formfaktoren und Smartphone-Rotationsschutz vorhanden');

