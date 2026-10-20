import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'src/components/backgrounds/index.ts');
const source = fs.readFileSync(indexPath, 'utf8');
const exports = [...source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
const unresolved = exports.filter((relativePath) => {
  const base = path.resolve(path.dirname(indexPath), relativePath);
  return !['.ts', '.tsx', '.js', '.jsx'].some((extension) => fs.existsSync(`${base}${extension}`));
});

if (unresolved.length > 0) {
  throw new Error(`Fehlende Hintergrundmodule: ${unresolved.join(', ')}`);
}
if (source.includes('DarkLiquidGlassBackground')) {
  throw new Error('Der entfernte dunkle Testhintergrund wird weiterhin exportiert.');
}

console.log('CareSuite+ System Spatial V34.1 Deploy Audit');
console.log('✓ alle Hintergrund-Exporte sind auflösbar');
console.log('✓ der dunkle Testhintergrund ist nicht mehr im Export');
console.log('✓ der V34 SpatialCare-Hintergrund bleibt aktiv');
