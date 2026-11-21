import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkNeoLocalRecognition, installNeoLocalRecognition, neoLocalRecognitionError, type NeoLocalRecognitionAvailability } from '@/ai/neo/neoLocalRecognition.web';

function browser(availability: NeoLocalRecognitionAvailability = 'available') {
  class Local { processLocally = false; static available = vi.fn().mockResolvedValue(availability); static install = vi.fn().mockResolvedValue(true); }
  return Local;
}
afterEach(() => vi.useRealTimers());
describe('NEO local speech readiness', () => {
  it('checks German on-device availability without requesting a microphone or installing anything', async () => {
    const Constructor = browser(); const existing = new Constructor();
    expect(await checkNeoLocalRecognition(Constructor, undefined, existing)).toMatchObject({ state: 'ready', canStart: true, canInstall: false, locale: 'de-DE' });
    expect(Constructor.available).toHaveBeenCalledExactlyOnceWith({ langs: ['de-DE'], processLocally: true }); expect(Constructor.install).not.toHaveBeenCalled();
  });
  it('never permits remote-only recognizers and accepts guarded local starts when static checking is absent', async () => {
    class Remote {} class OlderLocal { processLocally = false; }
    expect(await checkNeoLocalRecognition(Remote)).toMatchObject({ state: 'unsupported', canStart: false });
    expect(await checkNeoLocalRecognition(undefined)).toMatchObject({ state: 'unsupported', canStart: false });
    expect(await checkNeoLocalRecognition(OlderLocal)).toMatchObject({ state: 'unverified', canStart: true });
  });
  it.each(['downloadable', 'downloading', 'unavailable'] as const)('does not start an unavailable German package: %s', async value => {
    const Constructor = browser(value), result = await checkNeoLocalRecognition(Constructor);
    expect(result.canStart).toBe(false); expect(result.canInstall).toBe(value === 'downloadable'); expect(Constructor.install).not.toHaveBeenCalled();
  });
  it('offers no unusable download action when the install API is absent', async () => {
    const Constructor = browser('downloadable'); Object.defineProperty(Constructor, 'install', { value: undefined });
    expect(await checkNeoLocalRecognition(Constructor)).toMatchObject({ state: 'unsupported', canInstall: false });
  });
  it('installs only on an explicit request and requires a confirmed ready state afterwards', async () => {
    const Constructor = browser('downloadable'); Constructor.available.mockResolvedValueOnce('downloadable').mockResolvedValueOnce('available');
    expect(await installNeoLocalRecognition(Constructor)).toMatchObject({ state: 'ready', canStart: true });
    expect(Constructor.install).toHaveBeenCalledExactlyOnceWith({ langs: ['de-DE'], processLocally: true }); expect(Constructor.available).toHaveBeenCalledTimes(2);
  });
  it('does not confuse a successful install return with actual package availability', async () => {
    const Constructor = browser('downloadable'); Constructor.available.mockResolvedValueOnce('downloadable').mockResolvedValueOnce('downloading');
    expect(await installNeoLocalRecognition(Constructor)).toMatchObject({ state: 'downloading', canStart: false });
  });
  it('does not repeatedly install a package that is already ready or unavailable', async () => {
    for (const value of ['available', 'downloading', 'unavailable'] as const) {
      const Constructor = browser(value); await installNeoLocalRecognition(Constructor); expect(Constructor.install).not.toHaveBeenCalled();
    }
  });
  it('reports failed installation without starting a recognizer', async () => {
    const Constructor = browser('downloadable'); Constructor.install.mockResolvedValue(false);
    expect(await installNeoLocalRecognition(Constructor)).toMatchObject({ state: 'error', canStart: false, canInstall: true, code: 'local-install-incomplete' });
  });
  it('distinguishes policy rejection from a missing microphone or an unsupported language', async () => {
    const Constructor = browser(); Constructor.available.mockRejectedValue(new DOMException('private browser detail', 'NotAllowedError'));
    const result = await checkNeoLocalRecognition(Constructor); expect(result.code).toBe('local-policy-blocked'); expect(result.message).not.toContain('private browser detail');
  });
  it('reports a browser-internal abort rather than pretending the user canceled', async () => {
    const Constructor = browser(); Constructor.available.mockRejectedValue(new DOMException('browser aborted', 'AbortError'));
    expect(await checkNeoLocalRecognition(Constructor)).toMatchObject({ state: 'error', canStart: false, code: 'local-check-failed' });
  });
  it('drops a delayed readiness result after cancellation', async () => {
    const Constructor = browser(); let complete!: (state: string) => void;
    Constructor.available.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const abort = new AbortController(), result = checkNeoLocalRecognition(Constructor, abort.signal); const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    abort.abort(); await rejection; complete('available'); expect(Constructor.install).not.toHaveBeenCalled();
  });
  it('bounds an unresponsive browser availability API', async () => {
    vi.useFakeTimers(); const Constructor = browser(); Constructor.available.mockImplementation(() => new Promise(() => {}));
    const result = checkNeoLocalRecognition(Constructor); await vi.advanceTimersByTimeAsync(8000);
    expect(await result).toMatchObject({ state: 'error', canStart: false });
  });
  it('keeps unsupported browser status values from being interpreted as permission to start', async () => {
    const Constructor = browser(); Constructor.available.mockResolvedValue('future-unknown-value');
    expect(await checkNeoLocalRecognition(Constructor)).toMatchObject({ state: 'error', canStart: false, code: 'local-status-invalid' });
  });
});
describe('NEO browser error recovery', () => {
  it.each([
    ['language-not-supported', 'install'], ['not-allowed', 'permission'], ['service-not-allowed', 'unsupported'],
    ['audio-capture', 'device'], ['network', 'retry'], ['aborted', 'retry'], ['no-speech', 'retry'], ['phrases-not-supported', 'unsupported'],
  ])('retains the exact safe code and chooses recovery for %s', (code, recovery) => {
    expect(neoLocalRecognitionError(code)).toMatchObject({ code, recovery });
  });
  it('does not disclose raw exception values as error codes', () => {
    const result = neoLocalRecognitionError('patient name: Secret Person'); expect(result.code).toBe('unknown'); expect(result.message).not.toContain('Secret Person');
  });
});
