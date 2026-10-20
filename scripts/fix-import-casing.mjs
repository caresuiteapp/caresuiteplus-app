#!/usr/bin/env node
/**
 * Scan and fix import path casing mismatches for Metro (case-sensitive).
 * Run: node scripts/fix-import-casing.mjs [--fix]
 */
import fs from 'fs';
import path from 'path';

const FIX = process.argv.includes('--fix');
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
  fileMap.set(noExt.toLowerCase(), { rel, noExt, full: f, base: path.basename(f, path.extname(f)) });
}

const issues = [];
let fixCount = 0;

function expectedSpec(spec, fromDir, actualNoExt) {
  if (spec.startsWith('@/')) {
    return '@/' + actualNoExt;
  }
  const absActual = path.join(srcRoot, actualNoExt);
  let rel = path.relative(fromDir, absActual).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);
  const relFile = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  let changed = false;

  const replaceInSpec = (spec) => {
    let target;
    if (spec.startsWith('@/')) {
      target = spec.slice(2).replace(/\.(ts|tsx|js|jsx)$/, '');
    } else if (spec.startsWith('./') || spec.startsWith('../')) {
      const abs = path.normalize(path.join(dir, spec));
      target = path.relative(srcRoot, abs).replace(/\\/g, '/').replace(/\.(ts|tsx|js|jsx)$/, '');
    } else return spec;
    const actual = fileMap.get(target.toLowerCase());
    if (!actual || actual.noExt === target) return spec;
    const fixed = expectedSpec(spec, dir, actual.noExt);
    issues.push({ file: relFile, from: spec, to: fixed, actualFile: 'src/' + actual.rel });
    return fixed;
  };

  const newContent = content.replace(
    /((?:import|export)\s+(?:type\s+)?(?:[^'"\n]*?\s+from\s+|(?:\*|\{)[^'"]*?\}\s+from\s+)['"])(\.\.?\/[^'"]+|@\/[^'"]+)(['"])/g,
    (match, pre, spec, post) => {
      const fixed = replaceInSpec(spec);
      if (fixed !== spec) { changed = true; fixCount++; return pre + fixed + post; }
      return match;
    }
  ).replace(
    /(import\s*\(\s*['"])(\.\.?\/[^'"]+|@\/[^'"]+)(['"]\s*\))/g,
    (match, pre, spec, post) => {
      const fixed = replaceInSpec(spec);
      if (fixed !== spec) { changed = true; fixCount++; return pre + fixed + post; }
      return match;
    }
  );

  // Fix corruption
  let finalContent = newContent;
  if (/\bexport\s+export\b/.test(finalContent)) {
    finalContent = finalContent.replace(/\bexport\s+export\b/g, 'export');
    changed = true;
    fixCount++;
    issues.push({ file: relFile, from: 'export export', to: 'export', type: 'corruption' });
  }
  if (/\bimport\s+import\b/.test(finalContent)) {
    finalContent = finalContent.replace(/\bimport\s+import\b/g, 'import');
    changed = true;
    fixCount++;
    issues.push({ file: relFile, from: 'import import', to: 'import', type: 'corruption' });
  }

  if (FIX && changed) {
    fs.writeFileSync(filePath, finalContent, 'utf8');
  }
}

for (const f of allFiles) processFile(f);

const report = {
  fixMode: FIX,
  totalFixes: fixCount,
  uniqueFiles: [...new Set(issues.map(i => i.file))].length,
  issues,
};
fs.writeFileSync('scan-casing-report.json', JSON.stringify(report, null, 2));
console.log(`Mode: ${FIX ? 'FIX' : 'DRY-RUN'}`);
console.log(`Issues: ${issues.length}, Unique files: ${report.uniqueFiles}, Fix count: ${fixCount}`);
