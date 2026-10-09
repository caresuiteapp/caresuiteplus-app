#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import './verify-portal-production-env.mjs';

const require = createRequire(import.meta.url);
const expoCli = join(dirname(require.resolve('expo/package.json')), 'bin', 'cli');
const env = {
  ...process.env,
  APP_ENV: 'production',
  EXPO_PUBLIC_DEMO_MODE: 'false',
  EXPO_PUBLIC_APP_EDITION: 'full',
  EXPO_PUBLIC_FOLDER: 'public-portal',
};
const config = JSON.parse(execFileSync(process.execPath,
  [expoCli, 'config', '--type', 'public', '--json'],
  { encoding: 'utf8', env, maxBuffer: 8 * 1024 * 1024 }));
if (config.android?.package !== 'app.caresuitehealthos') throw new Error('Falsche Android-Paketkennung.');
if (config.version !== '0.4.0') throw new Error('Falsche aufgelöste App-Version.');
if (config.name !== 'CareSuite HealthOS') throw new Error('Falscher App-Name.');
if (config.extra?.router?.root !== 'app') throw new Error('Der vollständige App-Router fehlt.');
if (config.extra?.runtime?.appEdition !== 'full') throw new Error('Die vollständige HealthOS-Ausgabe fehlt.');
if (!config.extra?.runtime?.liveConfigured) throw new Error('Produktive Live-Konfiguration fehlt.');
if (config.extra?.eas?.projectId !== '567bda34-8356-4de8-9349-a0de3143567e') throw new Error('Falsches EAS-Projekt.');
const router = config.plugins?.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-router');
if (router?.[1]?.root !== 'app') throw new Error('Das Expo-Router-Plugin verwendet nicht den vollständigen App-Router.');
console.log('Produktionskonfiguration geprüft: CareSuite HealthOS 0.4.0, full, app.caresuitehealthos, Router app.');
