const fs = require('fs');
const lints = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const byName = {};
for (const l of lints) {
  if (!byName[l.name]) byName[l.name] = [];
  byName[l.name].push(l);
}

for (const [name, items] of Object.entries(byName)) {
  console.log(`\n=== ${name} (${items.length}) ===`);
  const objs = new Set();
  for (const l of items) {
    const obj = l.metadata?.name || l.detail?.match(/`([^`]+)`/)?.[1] || l.detail?.slice(0, 80);
    objs.add(`${l.metadata?.schema || 'public'}.${obj}`);
  }
  [...objs].sort().forEach(o => console.log(' ', o));
}
