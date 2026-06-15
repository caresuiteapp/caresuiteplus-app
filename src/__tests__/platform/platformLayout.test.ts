import { describe, expect, it } from 'vitest';
import {
  buildPlatformLayoutSnapshot,
  detectWebPlatformTarget,
  resolveShellVariant,
} from '@/lib/platform/layoutSnapshot';

describe('platform layout snapshot', () => {
  it('wählt mobile shell für Phone-Breite', () => {
    const layout = buildPlatformLayoutSnapshot(390, 844, 'ios');
    expect(layout.deviceClass).toBe('phone');
    expect(layout.shellVariant).toBe('mobile');
    expect(layout.useMasterDetail).toBe(false);
    expect(resolveShellVariant('phone')).toBe('mobile');
  });

  it('wählt tablet shell für Tablet-Breite', () => {
    const layout = buildPlatformLayoutSnapshot(1024, 768, 'ios');
    expect(layout.deviceClass).toBe('tablet');
    expect(layout.shellVariant).toBe('tablet');
    expect(layout.useMasterDetail).toBe(true);
    expect(resolveShellVariant('tablet')).toBe('tablet');
  });

  it('wählt desktop shell für Desktop-Breite', () => {
    const layout = buildPlatformLayoutSnapshot(1440, 900, 'web');
    expect(layout.deviceClass).toBe('desktop');
    expect(layout.shellVariant).toBe('desktop');
    expect(layout.useMasterDetail).toBe(true);
    expect(resolveShellVariant('desktop')).toBe('desktop');
  });

  it('erkennt Windows und macOS aus User-Agent', () => {
    expect(detectWebPlatformTarget('Mozilla/5.0 (Windows NT 10.0)')).toBe('windows');
    expect(detectWebPlatformTarget('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('macos');
    expect(detectWebPlatformTarget('Mozilla/5.0 (Linux)')).toBe('web');
  });
});
