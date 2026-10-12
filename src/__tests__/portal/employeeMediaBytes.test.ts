import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ platform: { OS: 'android' }, read: vi.fn(), fetch: vi.fn() }));
vi.mock('react-native', () => ({ Platform: f.platform }));
vi.mock('expo-file-system', () => ({ File: class { constructor(public uri: string) {} arrayBuffer() { return f.read(this.uri); } } }));
import { readEmployeePortalMediaBytes } from '@/lib/portal/employeePortalMediaBytes';
beforeEach(() => { vi.clearAllMocks(); f.platform.OS = 'android'; vi.stubGlobal('fetch', f.fetch); f.read.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer); });
it('reads native cached and Android content URIs with the installed filesystem', async () => {
  for (const uri of ['file:///cache/photo.jpg', 'content://provider/scan']) expect([...await readEmployeePortalMediaBytes(uri)]).toEqual([1, 2, 3]);
  expect(f.fetch).not.toHaveBeenCalled(); expect(f.read).toHaveBeenCalledWith('content://provider/scan');
});
it('keeps a web blob selection available for retry and rejects empty files', async () => {
  f.platform.OS = 'web'; f.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([5]).buffer });
  expect([...await readEmployeePortalMediaBytes('blob:selection')]).toEqual([5]);
  expect(f.read).not.toHaveBeenCalled();
  f.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  await expect(readEmployeePortalMediaBytes('blob:empty')).rejects.toThrow('leer');
});
