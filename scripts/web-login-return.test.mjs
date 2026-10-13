import test from 'node:test';
import assert from 'node:assert/strict';
import { safeWebReturnPath, rememberWebLoginReturn, resolveWebLoginReturn, clearReachedWebLoginReturn } from '../src/lib/navigation/webLoginReturn.ts';
const records=new Map();
function setup(path='/assist/assignments/123',search='?month=2026-10',hash='#notes') {
 records.clear();globalThis.window={location:{pathname:path,search,hash},sessionStorage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)}};
}
test('same-tab return preserves complete internal path, query and hash',()=>{setup();rememberWebLoginReturn();assert.equal(resolveWebLoginReturn('/'),'/assist/assignments/123?month=2026-10#notes');});
test('external, protocol-relative, auth and malformed paths are rejected',()=>{for(const path of ['https://evil.test','//evil.test','/\\evil','/auth/business-login','/device/confirm','/office\nfoo','/office/%2f%2fevil','/office/%5cfoo'])assert.equal(safeWebReturnPath(path),null);});
test('portal return cannot cross login audience',()=>{setup('/portal/client/documents/123','','');rememberWebLoginReturn();assert.equal(resolveWebLoginReturn('/portal/client'),'/portal/client/documents/123');assert.equal(resolveWebLoginReturn('/portal/employee'),'/portal/employee');assert.equal(resolveWebLoginReturn('/'),'/');});
test('anonymous session restore does not consume the target early',()=>{setup();rememberWebLoginReturn();assert.equal(resolveWebLoginReturn('/'),resolveWebLoginReturn('/'));assert.equal(records.size,1);clearReachedWebLoginReturn();assert.equal(records.size,0);});
test('expired and corrupt entries cannot redirect',()=>{setup();rememberWebLoginReturn();const key=[...records.keys()][0];records.set(key,JSON.stringify({path:'/office',expiresAt:0}));assert.equal(resolveWebLoginReturn('/'),'/');assert.equal(records.size,0);records.set(key,'broken');assert.equal(resolveWebLoginReturn('/'),'/');});
test('unavailable storage leaves normal login working',()=>{setup();window.sessionStorage.getItem=()=>{throw Error('blocked')};assert.equal(resolveWebLoginReturn('/'),'/');});
