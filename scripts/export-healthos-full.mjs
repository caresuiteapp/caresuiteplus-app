import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = process.cwd();
const expoCli = resolve(projectRoot, 'node_modules', 'expo', 'bin', 'cli');
const workers = process.env.CARESUITE_EXPORT_WORKERS ?? '2';
if (!['1', '2'].includes(workers)) throw new Error('CARESUITE_EXPORT_WORKERS muss 1 oder 2 sein.');
if (!existsSync(expoCli)) {
  console.error('HealthOS full export requires the installed project Expo CLI.');
  process.exit(1);
}

// A fresh Android graph avoids reusing a cached portal-only or desktop export.
const result = spawnSync(
  process.execPath,
  [
    expoCli,
    'export',
    '--platform', 'android',
    '--output-dir', 'dist-healthos-full',
    '--source-maps',
    '--max-workers', workers,
    '--clear',
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      APP_ENV: 'production',
      EXPO_PUBLIC_DEMO_MODE: 'false',
      EXPO_PUBLIC_APP_EDITION: 'full',
      EXPO_PUBLIC_FOLDER: 'public-portal',
    },
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error(`HealthOS full export could not start: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
