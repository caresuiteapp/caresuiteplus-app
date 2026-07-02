import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const FOUNDATION_FILES = [
  'src/components/healthos/HealthOSPage.tsx',
  'src/components/healthos/HealthOSSection.tsx',
  'src/components/healthos/HealthOSCard.tsx',
  'src/components/healthos/HealthOSMetricCard.tsx',
  'src/components/healthos/HealthOSStatusBadge.tsx',
  'src/components/healthos/HealthOSActionButton.tsx',
  'src/components/healthos/HealthOSAlert.tsx',
  'src/components/healthos/HealthOSEmptyState.tsx',
  'src/components/healthos/HealthOSLoadingState.tsx',
  'src/components/healthos/HealthOSErrorState.tsx',
  'src/components/healthos/tokens/healthosTokens.ts',
  'src/components/healthos/status/healthosStatusMapping.ts',
];

const FORBIDDEN_IMPORTS = [
  '@/features/assistWorkflow',
  'finalizeVisit',
  'clientBudgetTransactionService',
  'wfmClockService',
  'wfmAssistAdapter',
  'saveVisitDocumentation',
];

describe('HealthOS H1 foundation', () => {
  it('exports all foundation components from index', () => {
    const index = readSrc('src/components/healthos/index.ts');
    expect(index).toContain('HealthOSPage');
    expect(index).toContain('HealthOSStatusBadge');
    expect(index).toContain('HealthOSErrorState');
  });

  it.each(FOUNDATION_FILES)('%s exists', (file) => {
    expect(() => readSrc(file)).not.toThrow();
  });

  it('foundation layer does not import P0 workflow services', () => {
    for (const file of FOUNDATION_FILES) {
      const source = readSrc(file);
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(source, `${file} must not import ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('HealthOSActionButton supports danger variant mapping', () => {
    const source = readSrc('src/components/healthos/HealthOSActionButton.tsx');
    expect(source).toContain("'danger'");
    expect(source).toContain('HealthOSActionVariant');
  });

  it('state wrappers use existing StateViews without data logic', () => {
    expect(readSrc('src/components/healthos/HealthOSEmptyState.tsx')).toContain('EmptyState');
    expect(readSrc('src/components/healthos/HealthOSLoadingState.tsx')).toContain('LoadingState');
    expect(readSrc('src/components/healthos/HealthOSErrorState.tsx')).toContain('ErrorState');
  });

  it('HealthOSAlert wraps InfoBanner with German-friendly defaults', () => {
    const source = readSrc('src/components/healthos/HealthOSAlert.tsx');
    expect(source).toContain('InfoBanner');
    expect(source).toContain("'warning'");
  });

  it('tokens bridge existing design system', () => {
    const source = readSrc('src/components/healthos/tokens/healthosTokens.ts');
    expect(source).toContain('careSpacing');
    expect(source).toContain('careRadius');
    expect(source).toContain('breakpoints');
  });
});
