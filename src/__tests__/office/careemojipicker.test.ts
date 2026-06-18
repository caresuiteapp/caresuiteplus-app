import { describe, expect, it } from 'vitest';
import {
  CARE_EMOJI_CATEGORIES,
  CARE_EMOJI_COUNT,
} from '@/data/office/careemojipicker';
import { insertTextAtSelection } from '@/lib/communication/composerutils';

describe('careEmojiPicker', () => {
  it('enthält etwa 200 kuratierte Emojis in drei Kategorien', () => {
    expect(CARE_EMOJI_CATEGORIES).toHaveLength(3);
    expect(CARE_EMOJI_CATEGORIES.map((item) => item.label)).toEqual([
      'Reaktionen',
      'Pflege',
      'Medizin',
    ]);
    expect(CARE_EMOJI_COUNT).toBeGreaterThanOrEqual(200);
  });
});

describe('composerUtils', () => {
  it('insertTextAtSelection fügt Emoji an der Cursor-Position ein', () => {
    const result = insertTextAtSelection('Hallo ', '😊', { start: 6, end: 6 });
    expect(result.text).toBe('Hallo 😊');
    expect(result.selection).toEqual({ start: 8, end: 8 });
  });
});
