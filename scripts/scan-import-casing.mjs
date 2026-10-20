import fs from 'fs';
import path from 'path';

const srcRoot = path.join(process.cwd(), 'src');

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx)$/.test(ent.name)) files.push(p);
  }
  return files;
}

const allFiles = walk(srcRoot);
const fileMap = new Map();
for (const f of allFiles) {
  const rel = path.relative(srcRoot, f).replace(/\\/g, '/');
  const noExt = rel.replace(/\.(ts|tsx)$/, '');
  fileMap.set(noExt.toLowerCase(), { rel, noExt, full: f });
}

const issues = [];

function fixSpec(spec, fromDir) {
  let target;
  if (spec.startsWith('@/')) {
    target = spec.slice(2).replace(/\.(ts|tsx|js|jsx)$/, '');
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    const abs = path.normalize(path.join(fromDir, spec));
    target = path.relative(srcRoot, abs).replace(/\\/g, '/').replace(/\.(ts|tsx|js|jsx)$/, '');
  } else return null;
  return target;
}

function expectedSpec(spec, fromDir, actualNoExt) {
  if (spec.startsWith('@/')) {
    return '@/'.slice(0, -1) + actualNoExt; // '@/foo'
  }
  const absActual = path.join(srcRoot, actualNoExt);
  let rel = path.relative(fromDir, absActual).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);
  const relFile = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const lines = content.split('\n');

  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^'"\n]*?\s+from\s+|(?:\*|\{)[^'"]*?\}\s+from\s+)['"](\.\.?\/[^'"]+|@\/[^'"]+)['"]/g,
    /import\s*\(\s*['"](\.\.?\/[^'"]+|@\/[^'"]+)['"]\s*\)/g,
  ];

  lines.forEach((line, i) => {
    for (const re of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        const spec = m[1];
        const target = fixSpec(spec, dir);
        if (!target) continue;
        const actual = fileMap.get(target.toLowerCase());
        if (!actual) continue;
        if (actual.noExt !== target) {
          issues.push({
            file: relFile,
            line: i + 1,
            importPath: spec,
            expected: expectedSpec(spec, dir, actual.noExt),
            actualFile: 'src/' + actual.rel,
          });
        }
      }
    }
  });
}

for (const f of allFiles) scanFile(f);

const corruption = [];
for (const f of allFiles) {
  const c = fs.readFileSync(f, 'utf8');
  if (/\bexport\s+export\b/.test(c) || /\bimport\s+import\b/.test(c)) {
    corruption.push(path.relative(process.cwd(), f).replace(/\\/g, '/'));
  }
}

console.log(JSON.stringify({ issues, corruption }, null, 2));
console.error('Casing issues:', issues.length);
console.error('Corruption files:', corruption.length);
