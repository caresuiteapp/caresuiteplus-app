import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd());

describe('adaptive components foundation', () => {
  it('AdaptiveListDetail delegiert an MasterDetailLayout', () => {
    const src = readFileSync(
      join(root, 'src/components/adaptive/AdaptiveListDetail.tsx'),
      'utf8',
    );
    expect(src).toContain('MasterDetailLayout');
  });

  it('AdaptiveCardGrid nutzt useResponsiveValue', () => {
    const src = readFileSync(join(root, 'src/components/adaptive/AdaptiveCardGrid.tsx'), 'utf8');
    expect(src).toContain('useResponsiveValue');
  });

  it('AdaptiveKpiGrid verhindert vertikale KPI-Textumbrüche', () => {
    const src = readFileSync(join(root, 'src/components/adaptive/AdaptiveKpiGrid.tsx'), 'utf8');
    expect(src).toContain('kpiNoBreakTextProps');
    expect(src).toContain('numberOfLines: 1');
    expect(src).toContain('overflow:');
  });

  it('adaptive index exportiert alle Foundation-Komponenten', () => {
    const src = readFileSync(join(root, 'src/components/adaptive/index.ts'), 'utf8');
    for (const name of [
      'AdaptiveCardGrid',
      'AdaptiveKpiGrid',
      'AdaptiveListDetail',
      'AdaptiveForm',
      'AdaptiveActionBar',
      'AdaptiveModuleDashboard',
    ]) {
      expect(src).toContain(name);
    }
  });

  it('brand index exportiert alle Foundation-Komponenten', () => {
    const src = readFileSync(join(root, 'src/components/brand/index.ts'), 'utf8');
    for (const name of [
      'CareSuiteLogo',
      'CareSuiteWordmark',
      'CareSuiteHeader',
      'CareSuiteModuleHeader',
      'CareSuiteBackground',
      'CareSuiteIcon',
      'CareBotCard',
      'VoiceFlowPanel',
      'PlanPilotPanel',
    ]) {
      expect(src).toContain(name);
      expect(existsSync(join(root, `src/components/brand/${name}.tsx`))).toBe(true);
    }
  });
});
