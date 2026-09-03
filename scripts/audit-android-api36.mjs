#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const expoCli = require.resolve('expo/bin/cli');
const stdout = execFileSync(
  process.execPath,
  [expoCli, 'config', '--type', 'introspect', '--json'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      EXPO_PUBLIC_APP_EDITION: 'portal-only',
      EXPO_PUBLIC_FOLDER: 'public-portal',
    },
  },
);

const config = JSON.parse(stdout);
const androidMods = config._internal?.modResults?.android;
const properties = new Map(
  (androidMods?.gradleProperties ?? [])
    .filter((entry) => entry.type === 'property')
    .map((entry) => [entry.key, String(entry.value).trim()]),
);
const manifest = JSON.stringify(androidMods?.manifest ?? {});

const checks = {
  portalRouterRoot: config.extra?.router?.root === 'app-portal',
  androidPackage: config.android?.package === 'app.caresuitehealthos',
  appVersion: config.version === '0.3.2',
  versionCodeBaseline: Number(config.android?.versionCode) >= 25,
  minSdk24: properties.get('android.minSdkVersion') === '24',
  compileSdk36: properties.get('android.compileSdkVersion') === '36',
  targetSdk36: properties.get('android.targetSdkVersion') === '36',
  edgeToEdge: properties.get('edgeToEdgeEnabled') === 'true',
  backgroundLocation: manifest.includes('android.permission.ACCESS_BACKGROUND_LOCATION'),
  locationForegroundService: manifest.includes('android.permission.FOREGROUND_SERVICE_LOCATION'),
  notifications: manifest.includes('android.permission.POST_NOTIFICATIONS'),
  camera: manifest.includes('android.permission.CAMERA'),
  microphone: manifest.includes('android.permission.RECORD_AUDIO'),
  predictiveBackDisabled: manifest.includes('android:enableOnBackInvokedCallback'),
};

const failed = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

console.log(JSON.stringify({ status: failed.length === 0 ? 'ok' : 'failed', checks }, null, 2));

if (failed.length > 0) {
  throw new Error(`Android-API-36-Audit fehlgeschlagen: ${failed.join(', ')}`);
}
