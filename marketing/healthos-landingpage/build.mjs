import {build} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const output=path.resolve(root,'../../public/landingpage');
const serverOutput=path.join(root,'.build');
const shared={root,configFile:false,publicDir:false,base:'/landingpage/',plugins:[react()],resolve:{alias:{'@':root}},css:{postcss:{plugins:[tailwindcss({base:root})]}}};
// Media are originals kept next to the generated bundle, so only replace build assets.
await rm(path.join(output,'assets'),{recursive:true,force:true});
await build({...shared,build:{outDir:output,emptyOutDir:false}});
await build({...shared,build:{ssr:path.join(root,'entry-server.tsx'),outDir:serverOutput,emptyOutDir:true,rollupOptions:{output:{entryFileNames:'entry-server.mjs'}}}});
const {render}=await import(new URL('./.build/entry-server.mjs',import.meta.url));
const html=await readFile(path.join(output,'index.html'),'utf8');
await writeFile(path.join(output,'index.html'),html.replace('<div id="root"></div>',`<div id="root">${render()}</div>`));
await rm(serverOutput,{recursive:true,force:true});
console.log('Prerendered CareSuite HealthOS at /landingpage');
