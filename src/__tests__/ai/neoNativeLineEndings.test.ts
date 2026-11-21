import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nativeSource } from '../../../scripts/native-source-adaptations.mjs';

const file = 'src/components/assist/AssistLiveFilterSelect.web.tsx';
const original = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
describe('native source adaptation after a Windows checkout', () => {
  it('adapts the actual filter identically with LF, CRLF and mixed line endings', () => {
    const expected = nativeSource(file, original);
    expect(expected).toContain('native-select-v1');
    expect(expected).toContain('disabled?: boolean;');
    expect(nativeSource(file, original.replaceAll('\n', '\r\n'))).toBe(expected);
    const mixed = original.split('\n').map((line, i) => line + (i % 2 ? '\r\n' : '\n')).join('');
    expect(nativeSource(file, mixed.trimEnd() + '\n')).toBe(expected);
  });
  it('still rejects a changed source contract instead of disabling the stale-content guard', () => {
    expect(() => nativeSource(file, original.replace('  value: string;', '  value: number;'))).toThrow('Stale native adaptation');
  });
});
