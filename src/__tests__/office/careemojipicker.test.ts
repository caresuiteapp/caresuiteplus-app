import { describe, expect, it } from 'vitest';
import {
  CARE_EMOJI_CATEGORIES,
  CARE_EMOJI_COUNT,
} from '@/data/office/careemojipicker';
import { insertTextAtSelection } from '@/lib/communication/composerutils';
import { validateMessageAttachment } from '@/lib/office/messageattachmentvalidation';

describe('careEmojiPicker', () => {
  it('enthält etwa 1000 kuratierte Emojis in acht Kategorien', () => {
    expect(CARE_EMOJI_CATEGORIES).toHaveLength(8);
    expect(CARE_EMOJI_CATEGORIES.map((item) => item.label)).toEqual([
      'Alltagsbegleitung',
      'Pflege',
      'Stationär',
      'Akademie',
      'Verwaltung',
      'Menschen',
      'Essen & Trinken',
      'Transport',
    ]);
    expect(CARE_EMOJI_COUNT).toBeGreaterThanOrEqual(900);
  });

  it('akzeptiert Sprachnachrichten als Anhang', () => {
    const result = validateMessageAttachment({
      fileName: 'sprachnachricht.webm',
      mimeType: 'audio/webm',
      fileSizeBytes: 4096,
    });
    expect(result.ok).toBe(true);

    const withCodec = validateMessageAttachment({
      fileName: 'sprachnachricht.webm',
      mimeType: 'audio/webm;codecs=opus',
      fileSizeBytes: 4096,
    });
    expect(withCodec.ok).toBe(true);
  });
});

describe('composerUtils', () => {
  it('insertTextAtSelection fügt Emoji an der Cursor-Position ein', () => {
    const result = insertTextAtSelection('Hallo ', '😊', { start: 6, end: 6 });
    expect(result.text).toBe('Hallo 😊');
    expect(result.selection).toEqual({ start: 8, end: 8 });
  });
});
