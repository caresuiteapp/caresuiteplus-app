import fs from 'node:fs';

const file = new URL('../package.json', import.meta.url);
const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
packageJson.scripts ??= {};
packageJson.scripts['payroll:audit'] = 'node scripts/payroll-month-audit.mjs';
fs.writeFileSync(file, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log('package.json wurde konfliktfrei um payroll:audit ergänzt.');
