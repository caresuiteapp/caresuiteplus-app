import { build } from 'esbuild';
await build({ entryPoints: ['neo-service/server.mjs'], outfile: '.neo-runtime/server.mjs', bundle: true, platform: 'node', target: 'node20', format: 'esm' });
console.log('Eigener NEO-Sprachdienst gebaut: .neo-runtime/server.mjs');
