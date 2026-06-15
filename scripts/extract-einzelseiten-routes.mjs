#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const promptDir =
  process.env.EINZELSEITEN_PROMPTS ??
  join(
    process.env.USERPROFILE ?? '',
    'Downloads/CareSuitePlus_MultiMillionen_Einzelseiten_MegaPrompt/CareSuitePlus_MultiMillionen_Einzelseiten_MegaPrompt/einzelseiten_prompts',
  );

const files = readdirSync(promptDir)
  .filter((f) => f.endsWith('.md'))
  .sort();

const routes = files.map((file) => {
  const content = readFileSync(join(promptDir, file), 'utf8');
  const routeMatch = content.match(/## Route[\s\S]*?```text\n([\s\S]*?)```/);
  const id = file.match(/^(\d+)/)?.[1] ?? file;
  return { id, file, route: routeMatch?.[1]?.trim() ?? null };
});

writeFileSync(
  join(process.cwd(), 'tmp-einzelseiten-routes.json'),
  JSON.stringify(routes, null, 2),
);
console.log(`Extracted ${routes.length} routes`);
