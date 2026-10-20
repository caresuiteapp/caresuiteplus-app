#!/usr/bin/env node
/**
 * Migrates Hero components and Stats builders from static @/theme to themeBridge.
 * - Hero *.tsx: useLegacyTheme() + useMemo StyleSheet
 * - Stats *Stats*.ts: legacyColorsFromPalette(mode) + ColorMode param
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(root, 'src');

const THEME_RUNTIME = new Set(['colors', 'typography', 'gradients']);
const THEME_BRIDGE_IMPORT = "import { useLegacyTheme } from '@/design/tokens/themeBridge';";
const STATS_BRIDGE_IMPORT =
  "import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';";

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function isHeroFile(rel) {
  return rel.endsWith('Hero.tsx') || rel.endsWith('PremiumListHeroFrame.tsx');
}

function isStatsFile(rel) {
  return /Stats\.ts$/.test(rel) && rel.includes('/lib/');
}

function ensureReactUseMemo(source) {
  if (source.includes('useMemo')) return source;
  if (/import\s+\{([^}]+)\}\s+from\s+['"]react['"]/.test(source)) {
    return source.replace(/import\s+\{([^}]+)\}\s+from\s+['"]react['"]/, (m, imports) => {
      const parts = imports.split(',').map((s) => s.trim()).filter(Boolean);
      if (!parts.includes('useMemo')) parts.push('useMemo');
      return `import { ${parts.join(', ')} } from 'react'`;
    });
  }
  return `import { useMemo } from 'react';\n${source}`;
}

function stripThemeImports(source) {
  let next = source;

  next = next.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]@\/theme\/colors['"];?\n?/g,
    '',
  );

  next = next.replace(/import\s+\{([^}]+)\}\s+from\s+['"]@\/theme['"];?\n?/g, (match, imports) => {
    const names = imports
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\s+as\s+.*/, '').trim());

    const runtime = names.filter((n) => THEME_RUNTIME.has(n));
    const kept = names.filter((n) => !THEME_RUNTIME.has(n));

    if (runtime.length === 0) return match;
    if (kept.length === 0) return '';
    return `import { ${kept.join(', ')} } from '@/theme';\n`;
  });

  return next;
}

function injectHeroHook(source) {
  if (source.includes('useLegacyTheme()')) return source;

  let next = stripThemeImports(source);
  next = ensureReactUseMemo(next);

  if (!next.includes(THEME_BRIDGE_IMPORT)) {
    const reactImport = next.match(/^import .+ from 'react';?\n/m);
    if (reactImport) {
      next = next.replace(reactImport[0], `${reactImport[0]}${THEME_BRIDGE_IMPORT}\n`);
    } else {
      next = `${THEME_BRIDGE_IMPORT}\n${next}`;
    }
  }

  const fnMatch = next.match(
    /export function (\w+)\([^)]*\)\s*\{/,
  );
  if (!fnMatch) return null;

  const fnStart = fnMatch.index + fnMatch[0].length;
  const hookBlock =
    '\n  const { colors, typography, gradients, mode } = useLegacyTheme();\n';

  if (!next.slice(fnStart, fnStart + 120).includes('useLegacyTheme()')) {
    next = next.slice(0, fnStart) + hookBlock + next.slice(fnStart);
  }

  next = next.replace(
    /const kpis = (build[A-Za-z]+)\(([^;]+)\);/g,
    'const kpis = $1($2, mode);',
  );

  next = next.replace(
    /const kpis = (build[A-Za-z]+)\(([^;]+),\s*mode,\s*mode\);/g,
    'const kpis = $1($2, mode);',
  );

  const stylesMatch = next.match(/\nconst styles = StyleSheet\.create\(\{[\s\S]*?\n\}\);\n/);
  if (stylesMatch) {
    const stylesBlock = stylesMatch[0].trim();
    const inner = stylesBlock
      .replace(/^const styles = StyleSheet\.create\(/, '')
      .replace(/\);$/, '');

    const memoBlock = `const styles = useMemo(
    () =>
      StyleSheet.create(${inner}),
    [colors, typography, gradients],
  );`;

    next = next.replace(stylesMatch[0], '\n');
    next = next.replace(hookBlock.trim(), `${hookBlock.trim()}\n  ${memoBlock}\n`);
  }

  return next;
}

function migrateStatsFile(source) {
  if (!source.includes("@/theme")) return null;
  if (source.includes('legacyColorsFromPalette')) return null;

  let next = source.replace(
    /import\s+\{[^}]*colors[^}]*\}\s+from\s+['"]@\/theme['"];?\n?/g,
    `${STATS_BRIDGE_IMPORT}\n`,
  );

  next = next.replace(
    /export function (build[A-Za-z0-9]+)\(([^)]*)\)(\s*:\s*[^{]+)?\s*\{/g,
    (match, name, params, ret) => {
      if (params.includes('mode:') || params.includes('mode =')) return match;
      const trimmed = params.trim();
      const modeParam = trimmed.endsWith(',')
        ? `${trimmed} mode: ColorMode = 'dark'`
        : trimmed
          ? `${trimmed}, mode: ColorMode = 'dark'`
          : "mode: ColorMode = 'dark'";
      return `export function ${name}(${modeParam})${ret ?? ''} {\n  const colors = legacyColorsFromPalette(mode);`;
    },
  );

  next = next.replace(
    /export function (build[A-Za-z0-9]+)\(([^)]*)\)(\s*:\s*[^{]+)?\s*\{\n  const colors = legacyColorsFromPalette\(mode\);\n  const colors = legacyColorsFromPalette\(mode\);/g,
    'export function $1($2)$3 {\n  const colors = legacyColorsFromPalette(mode);',
  );

  return next;
}

function migrateHeroFile(source) {
  if (!source.includes("@/theme") && !source.includes("@/theme/colors")) return null;
  return injectHeroHook(source);
}

const allFiles = walk(srcRoot);
let heroChanged = 0;
let statsChanged = 0;

for (const file of allFiles) {
  const rel = relative(root, file).replace(/\\/g, '/');
  const source = readFileSync(file, 'utf8');

  if (isHeroFile(rel)) {
    const migrated = migrateHeroFile(source);
    if (migrated && migrated !== source) {
      writeFileSync(file, migrated, 'utf8');
      heroChanged += 1;
    }
  } else if (isStatsFile(rel)) {
    const migrated = migrateStatsFile(source);
    if (migrated && migrated !== source) {
      writeFileSync(file, migrated, 'utf8');
      statsChanged += 1;
    }
  }
}

console.log(`migrate-hero-stats-theme-bridge: ${heroChanged} hero files, ${statsChanged} stats files updated`);
