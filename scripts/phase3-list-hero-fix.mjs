#!/usr/bin/env node
/** Fix duplicate CareLight imports from phase3-list-hero-migrate.mjs */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components');

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (name.endsWith('ListHero.tsx')) files.push(p);
  }
  return files;
}

const MODULE_ACCENT = {
  office: 'office',
  pflege: 'pflege',
  assist: 'assist',
  beratung: 'beratung',
  stationaer: 'stationaer',
  akademie: 'akademie',
  qm: 'qm',
  ti: 'ti',
  templates: 'office',
};

function detectModule(rel) {
  if (rel.includes('/office/')) return 'office';
  if (rel.includes('/pflege/')) return 'pflege';
  if (rel.includes('/assist/')) return 'assist';
  if (rel.includes('/beratung/')) return 'beratung';
  if (rel.includes('/stationaer/')) return 'stationaer';
  if (rel.includes('/akademie/')) return 'akademie';
  if (rel.includes('/qm/')) return 'qm';
  if (rel.includes('/ti/')) return 'ti';
  if (rel.includes('/templates/')) return 'templates';
  return 'office';
}

function fixFile(filePath) {
  let src = readFileSync(filePath, 'utf8');
  if (!src.includes('CareLightListHeroFrame')) return false;

  // Normalize broken import blocks
  src = src.replace(
    /import \{[\s\S]*?\} from '@\/components\/ui';/,
    (block) => {
      const names = new Set();
      const re = /\b(CareLightButton|CareLightKpiCard|CareLightListHeroFrame|PremiumBadge|DesktopListViewToggle|type DesktopListViewMode)\b/g;
      let m;
      while ((m = re.exec(block))) names.add(m[1]);
      const lines = [];
      if (names.has('DesktopListViewToggle') || names.has('type DesktopListViewMode')) {
        lines.push('  DesktopListViewToggle,');
      }
      if (names.has('CareLightButton')) lines.push('  CareLightButton,');
      lines.push('  CareLightKpiCard,');
      lines.push('  CareLightListHeroFrame,');
      lines.push('  PremiumBadge,');
      if (names.has('type DesktopListViewMode')) lines.push('  type DesktopListViewMode,');
      return `import {\n${lines.join('\n')}\n} from '@/components/ui';`;
    },
  );

  const mod = MODULE_ACCENT[detectModule(filePath.replace(/\\/g, '/'))] ?? 'office';
  src = src.replace(/moduleColor\('office'\)/g, `moduleColor('${mod}')`);

  // Remove unused spacing import from theme when careSpacing is used
  src = src.replace(/import \{ designTokens, spacing \} from '@\/theme';/g, "import { designTokens } from '@/theme';");

  writeFileSync(filePath, src);
  return true;
}

let count = 0;
for (const f of walk(root)) {
  if (fixFile(f)) {
    console.log('✓', f.replace(root, ''));
    count++;
  }
}
console.log(`Fixed ${count} list hero files`);
