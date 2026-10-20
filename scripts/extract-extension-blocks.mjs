#!/usr/bin/env node
/**
 * Extracts ERWEITERTER UMSETZUNGSBLOCK entries from Mega-Prompt into JSON manifest.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const defaultMega = join(
  process.env.HOME || process.env.USERPROFILE || '',
  'Downloads/CareSuitePlus_MultiMillionen_Einzelseiten_MegaPrompt/CareSuitePlus_MultiMillionen_Einzelseiten_MegaPrompt/00_CareSuitePlus_ALLE_EINZELSEITEN_MEGA_PROMPT_KOMPLETT.md',
);
const megaPath = process.argv[2] || defaultMega;
const outPath = join(root, 'src/lib/navigation/extension-blocks.json');

if (!existsSync(megaPath)) {
  console.error(`Mega-Prompt not found: ${megaPath}`);
  process.exit(1);
}

const src = readFileSync(megaPath, 'utf8');
const blockRe = /^# ERWEITERTER UMSETZUNGSBLOCK (\d{4}) — (.+?) — Runde (\d+)\s/mg;
const routeRe = /Suche nach Route `([^`]+)`/;

const blocks = [];
let match;
while ((match = blockRe.exec(src)) !== null) {
  const id = match[1];
  const title = match[2].trim();
  const round = Number(match[3]);
  const sliceStart = match.index;
  const nextBlock = src.indexOf('\n# ERWEITERTER UMSETZUNGSBLOCK', sliceStart + 1);
  const section = src.slice(sliceStart, nextBlock === -1 ? undefined : nextBlock);
  const routeMatch = section.match(routeRe);
  blocks.push({
    id,
    title,
    round,
    routeHint: routeMatch?.[1] ?? null,
  });
}

writeFileSync(outPath, `${JSON.stringify(blocks, null, 2)}\n`, 'utf8');
console.log(`Extracted ${blocks.length} extension blocks → ${outPath}`);
