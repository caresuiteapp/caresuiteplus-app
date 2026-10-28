import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ key: null as string | null, cipher: true, failCopy: false, failDelete: false, calls: [] as string[], legacy: new Map<string,string>(), data: new Map<string,string>(), versions: new Set<number>() }));
vi.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7, getItem: () => h.key, setItem: (_name:string,value:string) => { h.key=value; } }));
vi.mock('expo-crypto', () => ({ getRandomBytes: (count:number) => new Uint8Array(count).fill(37) }));
vi.mock('expo-sqlite', () => ({
  openDatabaseSync: (name:string) => {
    h.calls.push(`open:${name}`); const legacy=name.endsWith('-v1.db');
    return {
      execSync(sql:string) { h.calls.push(sql.startsWith('PRAGMA key')?'set-key':'schema'); },
      getFirstSync(sql:string,...params:unknown[]) {
        if(sql.includes('cipher_version'))return h.cipher?{cipher_version:'4.fixture'}:null;
        if(sql.includes('sqlite_master'))return {name:'storage'};
        if(sql.includes('FROM migration')){const version=sql.includes('= 2')?2:1;return h.versions.has(version)?{version}:null;}
        if(sql.includes('COUNT'))return {count:h.data.size};
        if(sql.includes('SELECT value')){h.calls.push('readback');return h.data.has(String(params[0]))?{value:h.data.get(String(params[0]))}:null;}
        return null;
      },
      getAllSync() { return [...(legacy?h.legacy:h.data)].map(([key,value])=>({key,value})); },
      runSync(sql:string,...params:unknown[]) {
        if(sql.includes('INSERT INTO migration')){h.versions.add(sql.includes('(2)')?2:1);return;}
        if(sql.includes('INSERT INTO storage')){if(h.failCopy)throw Error('disk full');h.data.set(String(params[0]),String(params[1]));}
        if(sql.startsWith('DELETE FROM storage WHERE'))h.data.delete(String(params[0]));
        else if(sql.startsWith('DELETE FROM storage;'))h.data.clear();
      },
      withTransactionSync(action:()=>void) { const rows=new Map(h.data),versions=new Set(h.versions);try{action();}catch(error){h.data=rows;h.versions=versions;throw error;} },
      closeSync() { h.calls.push(legacy?'close-legacy':'close-encrypted'); },
    };
  },
  deleteDatabaseSync(name:string) {h.calls.push(`delete:${name}`);if(h.failDelete){h.failDelete=false;throw Error('file busy');}h.legacy.clear();},
}));
import { encryptedNativeWorkflowStore } from '@/lib/platform/encryptedWorkflowStorage.native';
beforeEach(()=>{h.key=null;h.cipher=true;h.failCopy=false;h.failDelete=false;h.calls=[];h.legacy.clear();h.data.clear();h.versions.clear();});
describe('encrypted native workflow storage',()=>{
  it('keeps database and key access lazy during cold application startup',()=>{encryptedNativeWorkflowStore('test-v1.db');expect(h.calls).toEqual([]);expect(h.key).toBeNull();});
  it('commits and reads every legacy value back before deleting the plaintext source',()=>{
    h.legacy.set('tenant:person:visit','draft');const store=encryptedNativeWorkflowStore('test-v1.db');expect(store.getItem('tenant:person:visit')).toBe('draft');
    expect(h.key).toMatch(/^[a-f0-9]{64}$/);expect(h.legacy.size).toBe(0);expect(h.versions).toEqual(new Set([1,2]));
    expect(h.calls.indexOf('set-key')).toBeLessThan(h.calls.indexOf('schema'));expect(h.calls.indexOf('readback')).toBeLessThan(h.calls.indexOf('delete:test-v1.db'));
  });
  it('refuses an unencrypted package without deleting or claiming to persist the draft',()=>{
    h.cipher=false;h.legacy.set('own','draft');expect(()=>encryptedNativeWorkflowStore('test-v1.db').setItem('new','value')).toThrow('Verschlüsselte');
    expect(h.legacy.get('own')).toBe('draft');expect(h.calls.some(x=>x.startsWith('delete:'))).toBe(false);expect(h.data.size).toBe(0);
  });
  it('rolls an incomplete migration back and retains the original for retry',()=>{
    h.failCopy=true;h.legacy.set('own','draft');expect(()=>encryptedNativeWorkflowStore('test-v1.db').getItem('own')).toThrow('disk full');
    expect(h.legacy.get('own')).toBe('draft');expect(h.versions.size).toBe(0);expect(h.data.size).toBe(0);
  });
  it('retries source cleanup after an interruption without copying over a newer value',()=>{
    h.failDelete=true;h.legacy.set('own','draft');const store=encryptedNativeWorkflowStore('test-v1.db');expect(()=>store.getItem('own')).toThrow('file busy');
    expect(h.versions).toEqual(new Set([1]));expect(store.getItem('own')).toBe('draft');expect(h.legacy.size).toBe(0);expect(h.versions.has(2)).toBe(true);
  });
  it('rejects a malformed key and unsafe database names before opening a data file',()=>{
    h.key='wrong';expect(()=>encryptedNativeWorkflowStore('test-v1.db').getItem('x')).toThrow('Datenschlüssel');expect(h.calls).toEqual([]);
    expect(()=>encryptedNativeWorkflowStore('not-versioned.db')).toThrow('Datenbereich');
  });
  it('propagates a synchronous write failure so no subsequent server dispatch can run',()=>{
    const store=encryptedNativeWorkflowStore('test-v1.db');store.getItem('x');h.failCopy=true;let dispatched=false;
    expect(()=>{store.setItem('tenant:person','request');dispatched=true;}).toThrow('disk full');expect(dispatched).toBe(false);
  });
});
