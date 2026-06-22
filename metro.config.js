const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const supabaseRoot = (name) => {
  const direct = path.join(__dirname, 'node_modules', name);
  if (fs.existsSync(path.join(direct, 'package.json'))) return direct;
  return path.dirname(require.resolve(`${name}/package.json`));
};

const supabaseCjs = {
  '@supabase/realtime-js': path.join(
    supabaseRoot('@supabase/realtime-js'),
    'dist/main/index.js',
  ),
  '@supabase/supabase-js': path.join(
    supabaseRoot('@supabase/supabase-js'),
    'dist/index.cjs',
  ),
  '@supabase/phoenix': path.join(
    supabaseRoot('@supabase/phoenix'),
    'priv/static/phoenix.cjs.js',
  ),
};

config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
  resolverMainFields: ['react-native', 'browser', 'main'],
};

const upstreamResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const direct = supabaseCjs[moduleName];
  if (direct) {
    return { filePath: direct, type: 'sourceFile' };
  }

  if (
    moduleName.includes('@supabase/realtime-js/dist/module') ||
    moduleName.endsWith('realtime-js/dist/module/index.js')
  ) {
    return { filePath: supabaseCjs['@supabase/realtime-js'], type: 'sourceFile' };
  }

  if (
    moduleName.includes('@supabase/supabase-js/dist/index.mjs') ||
    moduleName.endsWith('supabase-js/dist/index.mjs')
  ) {
    return { filePath: supabaseCjs['@supabase/supabase-js'], type: 'sourceFile' };
  }

  if (upstreamResolve) {
    return upstreamResolve(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
