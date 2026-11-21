import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { verifyNeoVercelEntrypoints } from '../../../scripts/verify-neo-vercel-entrypoints.mjs';
const run=promisify(execFile);
describe('NEO actual Vercel CommonJS entrypoints',()=>{
  it('reproduces the old static MJS require failure with Vercel-compatible Node restrictions',async()=>{
    const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'neo old runtime '));
    try{
      await fs.mkdir(path.join(temporary,'api/neo'),{recursive:true});await fs.mkdir(path.join(temporary,'api/_lib'),{recursive:true});
      await fs.writeFile(path.join(temporary,'package.json'),'{"type":"commonjs"}');
      await fs.copyFile(path.resolve('api/_lib/neo-vercel-engine.mjs'),path.join(temporary,'api/_lib/neo-vercel-engine.mjs'));
      const old="import { createNeoVercelEngine } from '../_lib/neo-vercel-engine.mjs'; export default createNeoVercelEngine();";
      const emitted=ts.transpileModule(old,{fileName:path.join(temporary,'api/neo/status.ts'),compilerOptions:{module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,target:ts.ScriptTarget.ES2022}}).outputText;
      expect(emitted).toContain('require(');await fs.writeFile(path.join(temporary,'api/neo/status.js'),emitted);
      await expect(run(process.execPath,['--no-experimental-require-module','-e',"require('./api/neo/status.js')"],{cwd:temporary,env:{NODE_ENV:'test',...Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TMP','TEMP'].filter(name=>typeof process.env[name]==='string').map(name=>[name,process.env[name] as string]))},windowsHide:true})).rejects.toMatchObject({stderr:expect.stringContaining('ERR_REQUIRE_ESM')});
    }finally{await fs.rm(temporary,{recursive:true,force:true});}
  });
  it('loads both real emitted entrypoints, preserves native dynamic import and fails closed without model assets',async()=>{
    const result=await verifyNeoVercelEntrypoints();
    expect(result).toMatchObject({requireEsmDisabled:true,unauthenticated:{status:401,transcribe:401},authorizedStatus:200,transcriptionReady:false,transcriptionStatus:503,noLiveBackend:true});
    expect(result.isolatedBackendFetches).toBeGreaterThan(0);
  });
  it('rejects a ready-required verification when the emitted function has no prepared assets',async()=>{
    await expect(verifyNeoVercelEntrypoints({requireReady:true})).rejects.toThrow('NEO Vercel API verification failed');
  });
});
