import {beforeEach, describe, expect, it, vi} from 'vitest';
const state = vi.hoisted(() => ({load: vi.fn(), create: vi.fn(), write: vi.fn(), remove: vi.fn()}));
vi.mock('expo', () => ({requireNativeModule: state.load}));
vi.mock('expo-crypto', () => ({randomUUID: () => 'fixture'}));
vi.mock('expo-file-system', () => ({
  Paths: {cache: 'file:///fixture'},
  Directory: class {exists = true; create = state.create; delete = state.remove;},
  File: class {uri = 'file:///fixture/original.pdf'; create = state.create; write = state.write; async base64() {return 'cG5n';}},
}));
beforeEach(() => {vi.resetModules(); vi.clearAllMocks(); state.load.mockReset();});
describe('native PDF action boundary', () => {
  it('imports the inspection service without loading a native module', async () => {
    await import('@/lib/platform/nativePdfInspection.native');
    expect(state.load).not.toHaveBeenCalled();
    expect(state.create).not.toHaveBeenCalled();
  });
  it.each(['missing', 'incomplete'])('rejects a %s extension before creating temporary files', async kind => {
    state.load.mockImplementation(() => {if (kind === 'missing') throw Error('JSI missing'); return {};});
    const service = await import('@/lib/platform/nativePdfInspection.native');
    await expect(service.extractNativePdfAttachments(new Uint8Array([37, 80]))).rejects.toThrow('PDF-Funktion');
    await expect(service.renderNativePdfPages(new Uint8Array([37]), 'Original', 2)).rejects.toThrow('PDF-Funktion');
    expect(state.create).not.toHaveBeenCalled();
  });
  it('preserves decoded attachment bytes and cleans up the temporary directory', async () => {
    state.load.mockReturnValue({extractAttachments: vi.fn().mockResolvedValue([{name: 'data.xml', base64: 'AP+A'}]), renderPages: vi.fn()});
    const service = await import('@/lib/platform/nativePdfInspection.native');
    const result = await service.extractNativePdfAttachments(new Uint8Array([37, 80]));
    expect(result[0].name).toBe('data.xml');
    expect([...result[0].bytes]).toEqual([0, 255, 128]);
    expect(state.write).toHaveBeenCalledWith(new Uint8Array([37, 80]));
    expect(state.remove).toHaveBeenCalledOnce();
  });
  it('preserves rendering limits and metadata', async () => {
    const renderPages = vi.fn().mockResolvedValue([{uri: 'file:///fixture/page.png', sourcePage: 2, sourcePages: 4, width: 600, height: 800}]);
    state.load.mockReturnValue({extractAttachments: vi.fn(), renderPages});
    const service = await import('@/lib/platform/nativePdfInspection.native');
    expect(await service.renderNativePdfPages(new Uint8Array([37]), 'Original', 2)).toEqual([{title: 'Original', sourcePage: 2, sourcePages: 4, width: 600, height: 800, dataUrl: 'data:image/png;base64,cG5n'}]);
    expect(renderPages).toHaveBeenCalledWith('file:///fixture/original.pdf', 2);
    expect(state.remove).toHaveBeenCalledOnce();
  });
  it('cleans up and preserves errors from an available native implementation', async () => {
    state.load.mockReturnValue({extractAttachments: vi.fn().mockRejectedValue(Error('damaged original')), renderPages: vi.fn()});
    const service = await import('@/lib/platform/nativePdfInspection.native');
    await expect(service.extractNativePdfAttachments(new Uint8Array([37]))).rejects.toThrow('damaged original');
    expect(state.remove).toHaveBeenCalledOnce();
  });
});
