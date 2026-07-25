import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const expoCli = path.join(
  process.cwd(),
  'node_modules',
  'expo',
  'bin',
  'cli',
);

if (!fs.existsSync(expoCli)) {
  console.error(`Expo CLI nicht gefunden: ${expoCli}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [expoCli, 'export', '--platform', 'web'],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EXPO_PUBLIC_DEMO_MODE: 'false',
    },
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
