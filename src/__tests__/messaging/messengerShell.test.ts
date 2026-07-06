import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('MessengerShell layout', () => {
  it('MessengerShell supports split and mobile thread chrome', () => {
    const source = readSrc('src/components/messaging/MessengerShell.tsx');
    expect(source).toContain('useMasterDetail');
    expect(source).toContain('showMobileThread');
    expect(source).toContain('onCloseThread');
    expect(source).toContain('← Liste');
  });

  it('OfficeMessengerScreen uses MessengerShell for chat view', () => {
    const source = readSrc('src/screens/office/OfficeMessengerScreen.tsx');
    expect(source).toContain('MessengerShell');
    expect(source).toContain('OfficeMessageThread');
    expect(source).not.toContain('OfficeMessageThreadModal');
  });
});
