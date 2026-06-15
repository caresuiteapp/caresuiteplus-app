import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import blocks from '../src/lib/navigation/extension-blocks.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'app');

function findRouteFile(routePath) {
  const segments = routePath.replace(/^\//, '').split('/').filter(Boolean);
  function walkDir(dir, index) {
    if (!existsSync(dir)) return null;
    if (index >= segments.length) {
      if (existsSync(join(dir, 'index.tsx'))) return join(dir, 'index.tsx');
      if (existsSync(`${dir}.tsx`)) return `${dir}.tsx`;
      return null;
    }
    const seg = segments[index];
    const entries = readdirSync(dir, { withFileTypes: true });
    const exactDir = entries.find((e) => e.isDirectory() && e.name === seg);
    if (exactDir) {
      const via = walkDir(join(dir, exactDir.name), index + 1);
      if (via) return via;
    }
    const exactFile = entries.find((e) => e.isFile() && e.name === `${seg}.tsx`);
    if (exactFile) return join(dir, exactFile.name);
    const dynamic = entries.find((e) => e.isDirectory() && e.name.startsWith('['));
    if (dynamic) return walkDir(join(dir, dynamic.name), index + 1);
    const group = entries.find((e) => e.isDirectory() && e.name.startsWith('('));
    if (group) {
      const via = walkDir(join(dir, group.name), index);
      if (via) return via;
    }
    return null;
  }
  return walkDir(appRoot, 0);
}

const DELEGATED_SCREEN_COMPONENTS = [
  { pattern: /<DedicatedListScreen\b/, relPath: 'src/components/einzelseiten/DedicatedListScreen.tsx' },
  { pattern: /<DomainCreateScreen\b/, relPath: 'src/screens/shared/DomainCreateScreen.tsx' },
];

function resolveScreenHeuristicSource(screenSrc) {
  let combined = screenSrc;
  for (const { pattern, relPath } of DELEGATED_SCREEN_COMPONENTS) {
    if (!pattern.test(screenSrc)) continue;
    const delegatePath = join(root, relPath);
    if (existsSync(delegatePath)) {
      combined += `\n${readFileSync(delegatePath, 'utf8')}`;
      break;
    }
  }
  return combined;
}

function scoreRouteFile(filePath) {
  if (!filePath || !existsSync(filePath)) return { score: 0, screen: null, gaps: ['route_missing'] };
  const src = readFileSync(filePath, 'utf8');
  if (src.includes('EinzelseitenBridgeRoute') || src.includes('<Redirect')) {
    return { score: 0, screen: null, gaps: ['bridge'] };
  }
  let score = 20;
  const gaps = [];
  if (src.includes('titleOverride')) score -= 10;
  const screenMatch = src.match(/from '@\/screens\/([^']+)'/);
  let screen = null;
  if (screenMatch) {
    const screenPath = join(root, 'src/screens', `${screenMatch[1]}.tsx`);
    const altPath = join(root, 'src/screens', `${screenMatch[1].replace(/\//g, '/')}.tsx`);
    const screenFile = [screenPath, altPath].find((p) => existsSync(p));
    screen = screenFile?.replace(root, '') ?? null;
    if (screenFile) {
      const s = readFileSync(screenFile, 'utf8');
      const heuristicSrc = resolveScreenHeuristicSource(s);
      if (!/LoadingState/.test(heuristicSrc)) gaps.push('LoadingState');
      else score += 15;
      if (!/EmptyState/.test(heuristicSrc)) gaps.push('EmptyState');
      else score += 15;
      if (!/ErrorState/.test(heuristicSrc)) gaps.push('ErrorState');
      else score += 15;
      if (!/Service|useAsyncQuery|fetch[A-Z]/.test(heuristicSrc)) gaps.push('Service');
      else score += 15;
      if (!/PremiumInput|CatalogValueSelect|CareMultiCatalogSelect/.test(heuristicSrc)) gaps.push('PremiumInput');
      else score += 10;
      if (/Coming Soon|In Vorbereitung|preparedOnly:\s*true/.test(heuristicSrc)) score -= 20;
    } else gaps.push('screen_missing');
  } else gaps.push('no_screen_import');
  return { score: Math.max(0, Math.min(100, score)), screen, gaps };
}

const byModule = {};
const partialGroups = {};

for (const b of blocks) {
  const mod = b.title.split(' ')[0] ?? 'Other';
  if (!byModule[mod]) byModule[mod] = { complete: 0, partial: 0, missing: 0, total: 0 };
  byModule[mod].total += 1;

  const hint = b.routeHint || 'none';
  const file = findRouteFile(hint.replace('[id]', 'test-id'));
  const { score, screen, gaps } = scoreRouteFile(file);

  if (score >= 70) byModule[mod].complete += 1;
  else if (score >= 35) {
    byModule[mod].partial += 1;
    const key = `${mod}|${hint}|${screen ?? 'n/a'}`;
    if (!partialGroups[key]) {
      partialGroups[key] = { mod, hint, screen, score, gaps, count: 0 };
    }
    partialGroups[key].count += 1;
  } else byModule[mod].missing += 1;
}

console.log('Partial by module:\n');
for (const [mod, s] of Object.entries(byModule).filter(([, v]) => v.partial > 0).sort((a, b) => b[1].partial - a[1].partial)) {
  console.log(`${mod}: ${s.partial} partial (${s.complete}/${s.total} complete)`);
}

console.log('\nPartial groups by count:\n');
for (const g of Object.values(partialGroups).sort((a, b) => b.count - a.count || a.mod.localeCompare(b.mod))) {
  console.log(`${g.count}x [${g.mod}] score=${g.score} ${g.hint}`);
  console.log(`  screen: ${g.screen}`);
  console.log(`  gaps: ${g.gaps.join(', ')}`);
}
