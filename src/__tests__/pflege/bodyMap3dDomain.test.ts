import { describe, expect, it } from 'vitest';
import {
  BODY_MAP_ANATOMY_PACKS,
  BODY_MAP_MODELS,
  ageGroupFromAge,
  getBodyMapAnatomyPack,
  getBodyMapModel,
  validateBodyMapSelection,
} from '@/lib/pflege/bodyMap3d/modelCatalog';
import {
  ANATOMICAL_ZONES,
  PRESSURE_RISK_ZONES,
  getAnatomicalPath,
} from '@/lib/pflege/bodyMap3d/anatomicalZones';
import { PRESSURE_INJURY_CLASSIFICATIONS } from '@/lib/pflege/bodyMap3d/pressureInjuryCatalog';

describe('medizinische 3D-Bodymap-Domäne', () => {
  it('registriert exakt 15 alters- und geschlechtsspezifische Grundmodelle', () => {
    expect(BODY_MAP_MODELS).toHaveLength(15);
    expect(new Set(BODY_MAP_MODELS.map((entry) => entry.id)).size).toBe(15);
    expect(BODY_MAP_MODELS.filter((entry) => entry.sex === 'divers')).toHaveLength(5);
  });

  it('registriert drei modulare Divers-Anatomiepakete', () => {
    expect(BODY_MAP_ANATOMY_PACKS).toHaveLength(3);
    expect(BODY_MAP_ANATOMY_PACKS.map((entry) => entry.genitalAnatomy)).toEqual([
      'penis',
      'vulva',
      'unbekannt',
    ]);
  });

  it('erzwingt bei Divers Genital- und Brustangabe', () => {
    const errors = validateBodyMapSelection({
      sex: 'divers',
      ageGroup: 'erwachsener',
      genitalAnatomy: null,
      chestAnatomy: null,
      skinTone: 'mittel',
    });
    expect(errors).toHaveLength(2);
  });

  it('löst Grundmodell und Anatomiepaket stabil auf', () => {
    const selection = {
      sex: 'divers' as const,
      ageGroup: 'kind' as const,
      genitalAnatomy: 'vulva' as const,
      chestAnatomy: 'keine_brueste' as const,
      skinTone: 'dunkel' as const,
    };
    expect(getBodyMapModel(selection).id).toBe('body-kind-divers');
    expect(getBodyMapAnatomyPack(selection)?.id).toBe('anatomy-pack-vulva');
  });

  it('ordnet Altersgruppen deterministisch zu', () => {
    expect(ageGroupFromAge(0.2)).toBe('baby');
    expect(ageGroupFromAge(2)).toBe('kleinkind');
    expect(ageGroupFromAge(12)).toBe('kind');
    expect(ageGroupFromAge(22)).toBe('junger_erwachsener');
    expect(ageGroupFromAge(50)).toBe('erwachsener');
  });

  it('enthält sensible Anatomie und Dekubitus-Prädilektionsstellen', () => {
    const ids = new Set(ANATOMICAL_ZONES.map((entry) => entry.id));
    expect(ids.has('auge-links')).toBe(true);
    expect(ids.has('ohr-rechts')).toBe(true);
    expect(ids.has('mundhoehle')).toBe(true);
    expect(ids.has('penis')).toBe(true);
    expect(ids.has('vulva')).toBe(true);
    expect(ids.has('vaginaloeffnung')).toBe(true);
    expect(ids.has('anus')).toBe(true);
    expect(ids.has('ferse-links')).toBe(true);
    expect(PRESSURE_RISK_ZONES.length).toBeGreaterThan(25);
  });

  it('liefert den vollständigen anatomischen Pfad', () => {
    expect(getAnatomicalPath('vaginaloeffnung').map((entry) => entry.id)).toEqual([
      'koerper',
      'becken',
      'anogenitalregion',
      'vulva',
      'vaginaloeffnung',
    ]);
  });

  it('deckt internationale Dekubitus-Sonderklassifikationen ab', () => {
    const ids = PRESSURE_INJURY_CLASSIFICATIONS.map((entry) => entry.id);
    expect(ids).toContain('kategorie_1');
    expect(ids).toContain('kategorie_4');
    expect(ids).toContain('nicht_klassifizierbar');
    expect(ids).toContain('tiefe_gewebeschaedigung');
    expect(ids).toContain('schleimhaut');
    expect(ids).toContain('medizinproduktbezogen');
  });
});
