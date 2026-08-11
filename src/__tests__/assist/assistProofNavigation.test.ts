import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Assist Leistungsnachweis navigation', () => {
  it('opens the Leistungsnachweis list instead of Live-Status', () => {
    const catalog = readSrc('src/liquid-command/navigation/moduleCatalog.ts');
    const route = readSrc('app/assist/(tabs)/nachweise.tsx');

    expect(catalog).toMatch(
      /id: 'proofs',[\s\S]*?label: 'Nachweise',[\s\S]*?route: '\/assist\/nachweise'/,
    );
    expect(catalog).not.toMatch(
      /id: 'proofs',[\s\S]*?route: '\/assist\/live-status'/,
    );
    expect(route).toContain('LeistungsnachweiseListScreen');
    expect(route).not.toContain('AssistLiveStatusScreen');
  });

  it('keeps the review popup behind an explicit action inside the list', () => {
    const listScreen = readSrc('src/screens/assist/LeistungsnachweiseListScreen.tsx');
    const reviewRoute = readSrc('app/assist/nachweise/review.tsx');

    expect(listScreen).toContain("router.push('/assist/nachweise/review'");
    expect(reviewRoute).toContain('VisitProofReviewScreen');
  });
});
