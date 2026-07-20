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

  it('keeps the history scrollable and opens at the start of the latest message', () => {
    const source = readSrc('src/components/office/officemessagethread.tsx');

    expect(source).toContain('office-message-history');
    expect(source).toContain('scrollToLatestMessage');
    expect(source).toContain('messagesContent: { paddingVertical: spacing.lg, flexGrow: 1 }');
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
  });

  it('uses a compact composer with toolbar and integrated input shell', () => {
    const source = readSrc('src/components/communication/ChatComposer.tsx');

    expect(source).toContain('styles.toolbar');
    expect(source).toContain('styles.inputShell');
    expect(source).toContain('styles.sendButton');
    expect(source).toContain('🎤 Sprache');
    expect(source).toContain('🔒 Interne Notiz');
  });

  it('renders day separators and a compact attachment action', () => {
    const thread = readSrc('src/components/office/officemessagethread.tsx');
    const attachments = readSrc('src/components/office/officemessageattachmentpicker.tsx');

    expect(thread).toContain('styles.dayDivider');
    expect(thread).toContain("weekday: 'long'");
    expect(attachments).toContain('accessibilityLabel="Anhang hinzufügen"');
  });

  it('responds to the real messenger workspace width instead of the browser width', () => {
    const screen = readSrc('src/screens/office/OfficeMessengerScreen.tsx');

    expect(screen).toContain('workspaceWidth');
    expect(screen).toContain('event.nativeEvent.layout.width');
    expect(screen).toContain('workspaceWidth < 1240');
  });

  it('moves opened chats automatically and exposes lifecycle actions visibly', () => {
    const thread = readSrc('src/components/office/officemessagethread.tsx');
    const actions = readSrc('src/components/office/officemessageactionsmenu.tsx');

    expect(thread).toContain('await markAsRead()');
    expect(thread).toContain("await updateStatus('in_progress')");
    expect(thread).toContain('✓ Abschließen');
    expect(thread).toContain('🗑 Chat löschen');
    expect(actions).toContain('••• Verwalten');
  });

  it('keeps automatic refresh as a fallback when realtime events are unavailable', () => {
    const realtime = readSrc('src/lib/office/officemessagerealtime.ts');

    expect(realtime).toContain('const POLL_INTERVAL_MS = 12_000');
    expect(realtime.match(/createVisibilityAwareInterval/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
