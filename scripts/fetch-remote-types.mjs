#!/usr/bin/env node
/** Schreibt Remote-Types nach src/lib/supabase/types.ts und database.types.ts (via Supabase CLI). */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const typesPath = path.join(root, 'src/lib/supabase/types.ts');
const databaseTypesPath = path.join(root, 'src/lib/supabase/database.types.ts');
const ref = process.env.SUPABASE_PROJECT_REF ?? 'euagyyztvmemuaiumvxm';

execSync(`npx supabase link --project-ref ${ref}`, { cwd: root, stdio: 'inherit' });
const raw = execSync('npx supabase gen types typescript --linked', { cwd: root, encoding: 'utf8' });
const banner = '/** Auto-generated — do not edit. Run: npm run fetch-remote-types */\n';
const content = banner + raw;
fs.writeFileSync(typesPath, content);
fs.writeFileSync(databaseTypesPath, content);
console.log(`Wrote ${typesPath}`);
console.log(`Wrote ${databaseTypesPath}`);
