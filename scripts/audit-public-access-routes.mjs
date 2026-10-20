import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { getRoutes } = require('expo-router/build/getRoutesCore');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const { getStateFromPath } = require('expo-router/build/react-navigation/core/getStateFromPath');
const { getHtmlFiles } = require('@expo/cli/build/src/export/exportStaticAsync');
const publicPaths = ['/support', '/auth/forgot-password', '/auth/reset-password'];

export function collectRouteKeys(appDirectory, prefix = '.') {
  return readdirSync(appDirectory, { withFileTypes: true }).flatMap(entry => {
    const key = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return collectRouteKeys(resolve(appDirectory, entry.name), key);
    return /\.[jt]sx?$/.test(entry.name) ? [key] : [];
  });
}

// Use Expo's platform selection and export-path generation. Only these public
// branches enter the pure linking parser; app route groups retain Expo's own
// group-aware parser during the full export.
export function inspectPublicAccessRoutes(keys, platform = 'web') {
  const publicKeys = keys.filter(key => {
    const name = key.replace(/^\.\//, '').replace(/(?:\.(?:web|native|ios|android))?\.[jt]sx?$/, '');
    return name === '_layout' || name === 'index' || name === 'auth/_layout' ||
      /^support(?:\/|$)/.test(name) || /^auth\/(?:forgot-password|reset-password)(?:\/|$)/.test(name);
  });
  const context = () => ({ default: () => null });
  context.keys = () => publicKeys;
  const tree = getRoutes(context, { platform, ignoreEntryPoints: true, ignoreRequireErrors: true });
  const linking = getReactNavigationConfig(tree, true);
  const exports = getHtmlFiles({ manifest: getReactNavigationConfig(tree), includeGroupVariations: false });
  return publicPaths.map(url => {
    assert(getStateFromPath(url, linking), `Public route missing: ${url}`);
    const matches = exports.filter(route => `/${route.pathname}` === url);
    assert.equal(matches.length, 1, `Public route must have exactly one export: ${url}`);
    return { url, filePath: matches[0].filePath, contextKey: matches[0].route.contextKey };
  });
}

export function auditPublicAccessRoutes(root = resolve(fileURLToPath(new URL('..', import.meta.url)))) {
  return inspectPublicAccessRoutes(collectRouteKeys(resolve(root, 'app')));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(auditPublicAccessRoutes()));
}
