import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BODY_MAP_FINDING_DEFINITIONS,
  buildClinicalLocationSnapshot,
  markerMatchesModelSelection,
  recommendedFindingDefinitions,
  resolveAnatomicalCandidates,
} from '@/lib/pflege/bodyMap3d/clinicalInteractionCatalog';
import type { BodyMapModelSelection } from '@/types/modules/bodyMap';

const diversVulva: BodyMapModelSelection = {
  sex: 'divers',
  ageGroup: 'erwachsener',
  genitalAnatomy: 'vulva',
  chestAnatomy: 'keine_brueste',
  skinTone: 'mittel',
};

describe('klinische Bodymap-Interaktion Phase 9', () => {
  it('führt alle 16 Befundarten als strukturierte Auswahl', () => {
    expect(BODY_MAP_FINDING_DEFINITIONS).toHaveLength(16);
    expect(new Set(BODY_MAP_FINDING_DEFINITIONS.map((entry) => entry.id)).size).toBe(16);
    expect(BODY_MAP_FINDING_DEFINITIONS.every((entry) => entry.description.length > 20)).toBe(
      true,
    );
  });

  it('priorisiert Dekubitus an einer Druckrisikostelle', () => {
    const findings = recommendedFindingDefinitions('ferse-links');
    expect(findings[0]?.id).toBe('dekubitus');
    expect(findings.slice(0, 3).every((entry) => entry.pressureRelevant)).toBe(true);
  });

  it('liefert beim Handtreffer exakte und benachbarte Strukturen', () => {
    const candidates = resolveAnatomicalCandidates('handflaeche-links', diversVulva);
    expect(candidates[0]?.id).toBe('handflaeche-links');
    expect(candidates.some((entry) => entry.id === 'handruecken-links')).toBe(true);
    expect(candidates.every((entry) => entry.id.endsWith('-links') || entry.id === 'obere-extremitaeten')).toBe(
      true,
    );
  });

  it('blendet anatomisch unpassende Genitaloptionen aus', () => {
    const candidates = resolveAnatomicalCandidates('vulva', diversVulva);
    expect(candidates.some((entry) => entry.id === 'vaginaloeffnung')).toBe(true);
    expect(candidates.some((entry) => entry.id === 'penis')).toBe(false);
  });

  it('trennt Marker verschiedener modularer Divers-Konfigurationen', () => {
    const marker = {
      modelId: 'body-erwachsener-divers',
      ageGroup: 'erwachsener',
      sex: 'divers',
      genitalAnatomy: 'penis',
      chestAnatomy: 'brueste',
    };
    expect(
      markerMatchesModelSelection(marker, diversVulva, 'body-erwachsener-divers'),
    ).toBe(false);
    expect(
      markerMatchesModelSelection(
        marker,
        { ...diversVulva, genitalAnatomy: 'penis', chestAnatomy: 'brueste' },
        'body-erwachsener-divers',
      ),
    ).toBe(true);
  });

  it('speichert einen vollständigen anatomischen Ortssnapshot', () => {
    expect(buildClinicalLocationSnapshot('vaginaloeffnung')).toMatchObject({
      anatomicalZoneId: 'vaginaloeffnung',
      laterality: 'nicht_anwendbar',
      sensitiveArea: true,
      anatomicalPath: ['koerper', 'becken', 'anogenitalregion', 'vulva', 'vaginaloeffnung'],
    });
  });

  it('speichert Statuswechsel atomar und verhindert doppelte Triggerverläufe', () => {
    const migration = readFileSync(
      'supabase/migrations/20260726094500_bodymap_clinical_interaction_phase9.sql',
      'utf8',
    );
    expect(migration).toContain('record_body_map_finding_progress');
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain("to_jsonb(NEW) - ARRAY['finding_status', 'closed_at', 'updated_at']");
    expect(migration).toContain('append_pressure_injury_assessment_history_trigger');
  });
});
