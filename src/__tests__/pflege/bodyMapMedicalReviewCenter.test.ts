import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BODYMAP_MEDICAL_REVIEW_CRITERIA,
  bodyMapVariantLabel,
  createPendingMedicalReviewItems,
  evaluateBodyMapMedicalApproval,
  getBodyMapMedicalCriteria,
  selectionFromBodyMapVariantId,
} from '@/lib/pflege/bodyMap3d/medicalReviewCatalog';
import { REAL_HUMAN_VISUAL_VARIANTS } from '@/lib/pflege/bodyMap3d/medicalMeshCatalog';
import { platformRoleHasCapability } from '@/lib/platformConsole';

describe('Bodymap medical review center', () => {
  it('bindet alle 30 Varianten an einen kryptografischen Asset-Hash', () => {
    expect(REAL_HUMAN_VISUAL_VARIANTS).toHaveLength(30);
    const hashes = new Set(
      REAL_HUMAN_VISUAL_VARIANTS.map((variant) => variant.assetSha256),
    );
    expect(hashes.size).toBe(30);
    for (const variant of REAL_HUMAN_VISUAL_VARIANTS) {
      expect(variant.assetSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('bildet alle Basis- und Divers-Varianten auf eine gültige Auswahl ab', () => {
    for (const variant of REAL_HUMAN_VISUAL_VARIANTS) {
      const selection = selectionFromBodyMapVariantId(variant.id);
      expect(selection.ageGroup).toBeTruthy();
      expect(selection.sex).toMatch(/^(maennlich|weiblich|divers)$/);
      expect(bodyMapVariantLabel(variant.id)).not.toContain('undefined');
    }
    expect(
      selectionFromBodyMapVariantId(
        'body-erwachsener-divers-vulva-keine-brueste',
      ),
    ).toMatchObject({
      sex: 'divers',
      ageGroup: 'erwachsener',
      genitalAnatomy: 'vulva',
      chestAnatomy: 'keine_brueste',
    });
  });

  it('enthält medizinische Pflichtprüfungen einschließlich Dekubitus und Kontinuität', () => {
    expect(BODYMAP_MEDICAL_REVIEW_CRITERIA.length).toBeGreaterThanOrEqual(40);
    const categories = new Set(
      BODYMAP_MEDICAL_REVIEW_CRITERIA.map((criterion) => criterion.category),
    );
    expect(categories).toContain('pressure_injury');
    expect(categories).toContain('intimate');
    expect(categories).toContain('continuity');
    expect(
      BODYMAP_MEDICAL_REVIEW_CRITERIA.some(
        (criterion) => criterion.id === 'continuity-age-change',
      ),
    ).toBe(true);
    expect(
      BODYMAP_MEDICAL_REVIEW_CRITERIA.some(
        (criterion) => criterion.id === 'continuity-dual-module',
      ),
    ).toBe(true);
  });

  it('verweigert die Freigabe bei offenen Pflichtkriterien und wesentlichen Problemen', () => {
    const variantId = 'body-erwachsener-maennlich';
    const items = createPendingMedicalReviewItems(variantId);
    expect(evaluateBodyMapMedicalApproval(variantId, items, []).allowed).toBe(false);
    const passed = items.map((item) => ({ ...item, result: 'pass' as const }));
    expect(evaluateBodyMapMedicalApproval(variantId, passed, []).allowed).toBe(true);
    expect(
      evaluateBodyMapMedicalApproval(variantId, passed, [
        {
          id: 'issue-1',
          anatomicalZoneId: 'sakral',
          viewId: 'back',
          severity: 'major',
          status: 'open',
          title: 'Sakralregion unpräzise',
          description: '',
          surfacePoint: null,
          evidence: [],
          resolution: null,
          createdAt: new Date(0).toISOString(),
        },
      ]).allowed,
    ).toBe(false);
  });

  it('wendet Variantenkriterien differenziert an', () => {
    const penis = getBodyMapMedicalCriteria(
      'body-erwachsener-divers-penis-keine-brueste',
    ).map((item) => item.id);
    const vulvaBreasts = getBodyMapMedicalCriteria(
      'body-erwachsener-divers-vulva-brueste',
    ).map((item) => item.id);
    expect(penis).toContain('intimate-penis');
    expect(penis).not.toContain('intimate-vulva');
    expect(penis).toContain('chest-no-breasts');
    expect(vulvaBreasts).toContain('intimate-vulva');
    expect(vulvaBreasts).toContain('chest-breasts');
  });

  it('reserviert die finale Freigabe ausschließlich für den Platform Owner', () => {
    expect(
      platformRoleHasCapability('platform_owner', 'bodymap.review.approve'),
    ).toBe(true);
    expect(
      platformRoleHasCapability('platform_admin', 'bodymap.review.write'),
    ).toBe(true);
    expect(
      platformRoleHasCapability('platform_admin', 'bodymap.review.approve'),
    ).toBe(false);
    expect(
      platformRoleHasCapability('platform_readonly', 'bodymap.review.read'),
    ).toBe(true);
  });

  it('liefert eine Migration mit RLS, Audit und hashgebundener Runtime-Freigabe', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260726183000_bodymap_medical_review_center_phase12.sql',
      ),
      'utf8',
    );
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('platform_bodymap_approve_review');
    expect(migration).toContain('bodymap_get_active_medical_approval');
    expect(migration).toContain("platform_current_role() <> 'platform_owner'");
    expect(migration).toContain('asset_changed_review_invalid');
    expect(migration).toContain('platform_write_audit_log');
  });
});
