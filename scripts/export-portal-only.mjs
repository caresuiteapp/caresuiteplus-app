import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const expoCli = resolve(process.cwd(), 'node_modules', 'expo', 'bin', 'cli');
const result = spawnSync(
  process.execPath,
  [
    expoCli,
    'export',
    '--platform',
    'android',
    '--output-dir',
    'dist-portal-only',
    '--source-maps',
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EXPO_PUBLIC_APP_EDITION: 'portal-only',
      EXPO_PUBLIC_FOLDER: 'public-portal',
    },
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error(`Portal-only Export konnte nicht gestartet werden: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
