import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  enrichPortalTaskCategory,
  lookupAssistCatalogCategoryByTitle,
} from '@/lib/portal/enrichPortalTaskCategory';
import { applyDocumentationAiFallback } from '@/lib/portal/documentationAiFallback';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function task(
  id: string,
  title: string,
  overrides: Partial<EmployeePortalTaskItem> = {},
): EmployeePortalTaskItem {
  return {
    id,
    title,
    description: '',
    required: false,
    status: 'open',
    completionNote: null,
    requiresNote: false,
    ...overrides,
  };
}

describe('enrichPortalTaskCategory', () => {
  it('maps assist catalog titles to subcategory labels', () => {
    const catalog = lookupAssistCatalogCategoryByTitle('Anreise und Begrüßung');
    expect(catalog?.categoryKey).toBe('einsatzvorbereitung');
    expect(catalog?.categoryLabel).toBeTruthy();
  });

  it('enriches live tasks without explicit category from catalog', () => {
    const enriched = enrichPortalTaskCategory(task('1', 'Anreise und Begrüßung'));
    expect(enriched.categoryKey).toBe('einsatzvorbereitung');
    expect(enriched.categoryLabel).toBeTruthy();
  });

  it('falls back to title inference when catalog has no match', () => {
    const enriched = enrichPortalTaskCategory(task('2', 'Lebensmitteleinkauf erledigen'));
    expect(enriched.categoryKey).toBe('einkauf');
    expect(enriched.categoryLabel).toBeTruthy();
  });

  it('preserves explicit workflow categories', () => {
    const enriched = enrichPortalTaskCategory(
      task('3', 'Beliebiger Titel', {
        categoryKey: 'demenzbegleitung',
        categoryLabel: 'Demenzbegleitung',
      }),
    );
    expect(enriched.categoryKey).toBe('demenzbegleitung');
    expect(enriched.categoryLabel).toBe('Demenzbegleitung');
  });
});

describe('documentationAiFallback', () => {
  it('converts bullet lines into sentences', () => {
    const result = applyDocumentationAiFallback('from_bullets', '- Klient anwesend\n- Einkauf erledigt');
    expect(result).toContain('Klient anwesend');
    expect(result).toContain('Einkauf erledigt');
  });

  it('creates short version with max three sentences', () => {
    const source = 'Erster Satz. Zweiter Satz. Dritter Satz. Vierter Satz.';
    const result = applyDocumentationAiFallback('short', source);
    expect(result.split('.').filter((part) => part.trim()).length).toBeLessThanOrEqual(3);
  });
});

describe('visit execution completion hardening', () => {
  it('documents AI availability guard without tenant id', () => {
    const source = readSrc('src/lib/portal/documentationAiAvailability.ts');
    expect(source).toContain('resolveDocumentationAiAvailability');
    expect(source).toContain('canUseLocalFallback');
    expect(source).toContain('Mandantenverbindung');
  });

  it('voice note modal explains native audio fallback', () => {
    const source = readSrc('src/components/portal/EmployeePortalVisitVoiceNoteModal.tsx');
    expect(source).toContain('Audio-Anhang');
    expect(source).toContain('isSpeechDictationSupported');
  });
});
