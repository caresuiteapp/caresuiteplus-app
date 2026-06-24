import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildQmHandbookKpis } from '@/data/demo/qmHandbookStats';
import { QM_CHAPTERS, QM_HANDBOOK } from '@/lib/qm/qm.demoData';
import { fetchQmChapters } from '@/lib/qm';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('QM Handbuch entry polish', () => {
  it('enforcePermission schützt QM-Handbuch', () => {
    expect(enforcePermission(null, 'qm.view')).not.toBeNull();
  });

  it('buildQmHandbookKpis berechnet Kennzahlen aus Kapiteln', () => {
    const kpis = buildQmHandbookKpis(QM_CHAPTERS, QM_HANDBOOK);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'qm-hb-kpi-chapters')).toBe(true);
    expect(kpis[0]?.value).toBeGreaterThanOrEqual(20);
  });

  it('fetchQmChapters liefert Demo-Kapitel', async () => {
    const result = await fetchQmChapters(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('QmHandbookHero nutzt PremiumListHeroFrame', () => {
    const source = readSrc('src/components/qm/QmHandbookHero.tsx');
    expect(source).toContain('PremiumListHeroFrame');
    expect(source).toContain('PremiumKpiCard');
  });

  it('QmHandbookScreen zeigt Hero und Kapitelbaum', () => {
    const source = readSrc('src/screens/qm/QmHandbookScreen.tsx');
    expect(source).toContain('QmHandbookHero');
    expect(source).toContain('QmChapterTree');
    expect(source).not.toContain('Coming Soon');
  });
});
