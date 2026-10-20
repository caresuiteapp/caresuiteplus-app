const fs = require('fs');
const path = process.argv[2];
const raw = fs.readFileSync(path, 'utf8');
const data = JSON.parse(raw);
const lints = data.result?.lints || data.lints || data;
console.log('Total:', lints.length);
const sev = {};
const names = {};
for (const l of lints) {
  sev[l.level] = (sev[l.level] || 0) + 1;
  names[l.name] = (names[l.name] || 0) + 1;
}
console.log('Severity:', JSON.stringify(sev));
console.log('Names:');
Object.entries(names).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
fs.writeFileSync(path.replace('.txt', '-parsed.json'), JSON.stringify(lints, null, 2));
