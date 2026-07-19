import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office messenger usability regression', () => {
  it('keeps message bodies selectable and provides a visible copy action', () => {
    const source = readSrc('src/components/communication/ChatBubble.tsx');

    expect(source).toContain('selectable');
    expect(source).toContain('Clipboard.setStringAsync');
    expect(source).toContain('Nachricht kopieren');
    expect(source).toContain('Kopieren');
  });

  it('keeps the history scrollable and opens at the latest message', () => {
    const source = readSrc('src/components/office/officemessagethread.tsx');

    expect(source).toContain('office-message-history');
    expect(source).toContain('scrollToEnd');
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
  });

  it('uses a compact composer with toolbar and input row', () => {
    const source = readSrc('src/components/communication/ChatComposer.tsx');

    expect(source).toContain('styles.toolbar');
    expect(source).toContain('styles.inputRow');
    expect(source).toContain('🎤 Sprache');
    expect(source).toContain('Als interne Notiz');
  });
});
