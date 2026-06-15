#!/usr/bin/env node
/**
 * Audits ERWEITERTER UMSETZUNGSBLOCK completion heuristics per route.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import blocks from '../src/lib/navigation/extension-blocks.json' with { type: 'json' };
import routeMap from '../src/lib/navigation/einzelseiten-route-map.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'app');

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (name.endsWith('.tsx')) files.push(full);
  }
  return files;
}

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

function resolveRoute(block) {
  if (block.routeHint) {
    const hint = block.routeHint.replace('[id]', 'test-id');
    const file = findRouteFile(hint);
    if (file) return { route: block.routeHint, file };
  }
  const byTitle = routeMap.find((r) =>
    block.title.toLowerCase().includes(r.prompt.split('/').pop()?.replace(/-/g, ' ') ?? ''),
  );
  if (byTitle) {
    const file = findRouteFile(byTitle.prompt) || findRouteFile(byTitle.target);
    return { route: byTitle.prompt, file };
  }
  return { route: block.routeHint, file: null };
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
  if (!filePath || !existsSync(filePath)) return { score: 0, reasons: ['route_missing'] };
  const src = readFileSync(filePath, 'utf8');
  const reasons = [];
  let score = 0;
  if (src.includes('EinzelseitenBridgeRoute') || src.includes('<Redirect')) {
    reasons.push('bridge_or_redirect');
    return { score: 0, reasons };
  }
  score += 20;
  reasons.push('dedicated_route');
  if (src.includes('titleOverride')) {
    reasons.push('title_override_alias');
    score -= 10;
  }
  const screenMatch = src.match(/from '@\/screens\/([^']+)'/);
  if (screenMatch) {
    const screenPath = join(root, 'src/screens', `${screenMatch[1].replace(/\//g, '/')}.tsx`);
    const altPath = join(root, 'src/screens', `${screenMatch[1]}.tsx`);
    const screenFile = [screenPath, altPath].find((p) => existsSync(p));
    if (screenFile) {
      const screenSrc = readFileSync(screenFile, 'utf8');
      const heuristicSrc = resolveScreenHeuristicSource(screenSrc);
      if (heuristicSrc !== screenSrc) reasons.push('delegated_screen_component');
      if (/LoadingState/.test(heuristicSrc)) score += 15;
      if (/EmptyState/.test(heuristicSrc)) score += 15;
      if (/ErrorState/.test(heuristicSrc)) score += 15;
      if (/Service|useAsyncQuery|fetch[A-Z]/.test(heuristicSrc)) score += 15;
      if (/PremiumInput|CatalogValueSelect|CareMultiCatalogSelect/.test(heuristicSrc)) score += 10;
      if (/Coming Soon|In Vorbereitung|preparedOnly:\s*true/.test(heuristicSrc)) {
        reasons.push('prepared_only_marker');
        score -= 20;
      }
    }
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

const byModule = {};
let complete = 0;
let partial = 0;
let missing = 0;

for (const block of blocks) {
  const mod = block.title.split(' ')[0] ?? 'Other';
  if (!byModule[mod]) byModule[mod] = { complete: 0, partial: 0, missing: 0, total: 0 };
  byModule[mod].total += 1;

  const { route, file } = resolveRoute(block);
  const { score, reasons } = scoreRouteFile(file);
  if (score >= 70) {
    complete += 1;
    byModule[mod].complete += 1;
  } else if (score >= 35) {
    partial += 1;
    byModule[mod].partial += 1;
  } else {
    missing += 1;
    byModule[mod].missing += 1;
  }
}

console.log(`CareSuite+ Extension Blocks Audit: ${blocks.length} blocks\n`);
console.log(`✓ Complete (≥70): ${complete}`);
console.log(`◐ Partial (35-69): ${partial}`);
console.log(`✗ Missing (<35): ${missing}\n`);
console.log('By module prefix:');
for (const [mod, stats] of Object.entries(byModule).sort((a, b) => b[1].total - a[1].total)) {
  console.log(`  ${mod}: ${stats.complete}/${stats.total} complete, ${stats.partial} partial, ${stats.missing} missing`);
}

const threshold = Number(process.env.EXTENSION_BLOCKS_MIN_COMPLETE ?? 0);
if (complete < threshold) {
  process.exit(1);
}
