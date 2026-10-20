import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Assist Leistungsnachweis navigation', () => {
  it('opens the live review workspace directly instead of an empty intermediate list', () => {
    const catalog = readSrc('src/liquid-command/navigation/moduleCatalog.ts');
    const route = readSrc('app/assist/(tabs)/nachweise.tsx');

    expect(catalog).toMatch(
      /id: 'proofs',[\s\S]*?label: 'Nachweise',[\s\S]*?route: '\/assist\/nachweise'/,
    );
    expect(catalog).not.toMatch(
      /id: 'proofs',[\s\S]*?route: '\/assist\/live-status'/,
    );
    expect(route).toContain('VisitProofReviewScreen');
    expect(route).not.toContain('LeistungsnachweiseListScreen');
    expect(route).not.toContain('AssistLiveStatusScreen');
  });

  it('keeps the review route as a compatible direct entry without requiring it for the tab', () => {
    const tabRoute = readSrc('app/assist/(tabs)/nachweise.tsx');
    const reviewRoute = readSrc('app/assist/nachweise/review.tsx');

    expect(tabRoute).toContain('VisitProofReviewScreen');
    expect(reviewRoute).toContain('VisitProofReviewScreen');
  });
});
