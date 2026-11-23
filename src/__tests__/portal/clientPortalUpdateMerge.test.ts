import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {mergePortalFile} from '../../../scripts/apply-client-portal-night.mjs';
let temporary:string;
beforeEach(()=>{temporary=fs.mkdtempSync(path.join(os.tmpdir(),'client-update-test-'));});
afterEach(()=>{fs.rmSync(temporary,{recursive:true,force:true});});
const merge=(current:string|null,base:string|null,next:string,name='src/portal.tsx')=>mergePortalFile(current,base,next,name,temporary);
describe('safe client portal update merge',()=>{
 it('creates absent files and recognizes an already applied update',()=>{
  expect(merge(null,null,'new')).toEqual({status:'updated',content:'new'});
  expect(merge('new','old','new')).toEqual({status:'already',content:'new'});
 });
 it('preserves independent local source edits',()=>{
  const base='one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\n';
  const result=merge(base.replace('one','local one'),base,base.replace('eight','release eight'));
  expect(result.status).toBe('merged');expect(result.content).toContain('local one');expect(result.content).toContain('release eight');
 });
 it('stops on overlapping edits and on an existing different new file',()=>{
  expect(merge('local\n','base\n','release\n').status).toBe('conflict');
  expect(merge('local',null,'release').status).toBe('conflict');
  expect(merge(null,'base','release').status).toBe('conflict');
 });
 it('appends approved client design guidance while retaining newer local guidance',()=>{
  const result=merge('base\nlocal guidance\n','base\n','base\nclient guidance\n','docs/design.md');
  expect(result.content).toBe('base\nlocal guidance\nclient guidance\n');
 });
});
