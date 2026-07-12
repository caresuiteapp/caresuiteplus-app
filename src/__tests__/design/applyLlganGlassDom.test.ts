import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

describe('applyLlganGlassDom', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      documentElement: { style: { setProperty: vi.fn() } },
      getElementById: vi.fn(() => ({ id: 'caresuite-llgan-glass-surfaces' })),
      createElement: vi.fn(() => ({ id: '', textContent: '' })),
      head: { appendChild: vi.fn() },
    });
    vi.stubGlobal('MutationObserver', vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
    })));
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      cb();
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses production-safe glass without live blur or observer feedback loops', async () => {
    const { bindLlganGlassSurface } = await import('@/design/web/applyLlganGlassDom');

    const el = {
      style: { setProperty: vi.fn() },
      setAttribute: vi.fn(),
      classList: { add: vi.fn() },
    };

    bindLlganGlassSurface(el as never, 'card');

    expect(el.setAttribute).toHaveBeenCalledWith('data-cs-llgan-glass', 'card');
    expect(el.classList.add).toHaveBeenCalledWith('cs-llgan-glass', 'cs-llgan-glass-card');
    expect(el.style.setProperty).toHaveBeenCalledWith(
      'backdrop-filter',
      'none',
      'important',
    );
    expect(el.style.setProperty).toHaveBeenCalledWith(
      'background-color',
      expect.stringContaining('rgba(255, 255, 255'),
      'important',
    );
    expect(el.style.setProperty).toHaveBeenCalledWith(
      'background-image',
      expect.stringContaining('linear-gradient'),
      'important',
    );
    const source = await import('node:fs').then(({ readFileSync }) =>
      readFileSync('src/design/web/applyLlganGlassDom.tsx', 'utf8'),
    );
    expect(source).not.toContain('new MutationObserver');
    expect(source).not.toContain('requestAnimationFrame');
  });
});
