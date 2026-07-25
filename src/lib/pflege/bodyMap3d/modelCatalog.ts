import type {
  BodyMapAgeGroup,
  BodyMapAnatomyPackId,
  BodyMapChestAnatomy,
  BodyMapGenitalAnatomy,
  BodyMapModelId,
  BodyMapModelSelection,
  BodyMapSex,
} from '@/types/modules/bodyMap';

export type BodyMapModelDefinition = {
  id: BodyMapModelId;
  sex: BodyMapSex;
  ageGroup: BodyMapAgeGroup;
  label: string;
  assetKey: string;
  nominalHeightMeters: number;
  cameraDistance: number;
  cameraTargetY: number;
  medicallyReviewed: boolean;
  version: number;
};

export type BodyMapAnatomyPackDefinition = {
  id: BodyMapAnatomyPackId;
  genitalAnatomy: BodyMapGenitalAnatomy;
  label: string;
  assetKey: string;
  medicallyReviewed: boolean;
  version: number;
};

export const BODY_MAP_AGE_LABELS: Record<BodyMapAgeGroup, string> = {
  baby: 'Baby',
  kleinkind: 'Kleinkind',
  kind: 'Kind',
  junger_erwachsener: 'Junger Erwachsener',
  erwachsener: 'Erwachsener',
};

export const BODY_MAP_SEX_LABELS: Record<BodyMapSex, string> = {
  maennlich: 'Männlich',
  weiblich: 'Weiblich',
  divers: 'Divers',
};

const AGE_RENDER_PROFILE: Record<
  BodyMapAgeGroup,
  Pick<BodyMapModelDefinition, 'nominalHeightMeters' | 'cameraDistance' | 'cameraTargetY'>
> = {
  baby: { nominalHeightMeters: 0.68, cameraDistance: 2.25, cameraTargetY: 0.34 },
  kleinkind: { nominalHeightMeters: 1.0, cameraDistance: 2.8, cameraTargetY: 0.5 },
  kind: { nominalHeightMeters: 1.42, cameraDistance: 3.6, cameraTargetY: 0.71 },
  junger_erwachsener: { nominalHeightMeters: 1.72, cameraDistance: 4.25, cameraTargetY: 0.86 },
  erwachsener: { nominalHeightMeters: 1.72, cameraDistance: 4.25, cameraTargetY: 0.86 },
};

const MODEL_ROWS: Array<[BodyMapAgeGroup, BodyMapSex]> = [
  ['baby', 'maennlich'],
  ['baby', 'weiblich'],
  ['baby', 'divers'],
  ['kleinkind', 'maennlich'],
  ['kleinkind', 'weiblich'],
  ['kleinkind', 'divers'],
  ['kind', 'maennlich'],
  ['kind', 'weiblich'],
  ['kind', 'divers'],
  ['junger_erwachsener', 'maennlich'],
  ['junger_erwachsener', 'weiblich'],
  ['junger_erwachsener', 'divers'],
  ['erwachsener', 'maennlich'],
  ['erwachsener', 'weiblich'],
  ['erwachsener', 'divers'],
];

export const BODY_MAP_MODELS: readonly BodyMapModelDefinition[] = MODEL_ROWS.map(
  ([ageGroup, sex]) => {
    const slugAge = ageGroup.replaceAll('_', '-');
    const id = `body-${slugAge}-${sex}` as BodyMapModelId;
    return {
      id,
      ageGroup,
      sex,
      label: `${BODY_MAP_AGE_LABELS[ageGroup]} · ${BODY_MAP_SEX_LABELS[sex]}`,
      assetKey: `bodymap3d/v1/${id}.glb`,
      ...AGE_RENDER_PROFILE[ageGroup],
      medicallyReviewed: false,
      version: 1,
    };
  },
);

export const BODY_MAP_ANATOMY_PACKS: readonly BodyMapAnatomyPackDefinition[] = [
  {
    id: 'anatomy-pack-penis',
    genitalAnatomy: 'penis',
    label: 'Penis und Skrotum',
    assetKey: 'bodymap3d/v1/anatomy-pack-penis.glb',
    medicallyReviewed: false,
    version: 1,
  },
  {
    id: 'anatomy-pack-vulva',
    genitalAnatomy: 'vulva',
    label: 'Vulva und Vaginalöffnung',
    assetKey: 'bodymap3d/v1/anatomy-pack-vulva.glb',
    medicallyReviewed: false,
    version: 1,
  },
  {
    id: 'anatomy-pack-unbekannt',
    genitalAnatomy: 'unbekannt',
    label: 'Genitalanatomie unbekannt',
    assetKey: 'bodymap3d/v1/anatomy-pack-unbekannt.glb',
    medicallyReviewed: false,
    version: 1,
  },
];

export const BODY_MAP_CHEST_OPTIONS: readonly {
  id: BodyMapChestAnatomy;
  label: string;
}[] = [
  { id: 'brueste', label: 'Brüste' },
  { id: 'keine_brueste', label: 'Keine Brüste' },
  { id: 'unbekannt', label: 'Unbekannt' },
];

export function getBodyMapModel(selection: BodyMapModelSelection): BodyMapModelDefinition {
  const model = BODY_MAP_MODELS.find(
    (entry) => entry.sex === selection.sex && entry.ageGroup === selection.ageGroup,
  );
  if (!model) {
    throw new Error(
      `Kein Bodymap-Modell für ${selection.sex}/${selection.ageGroup} registriert.`,
    );
  }
  return model;
}

export function getBodyMapAnatomyPack(
  selection: BodyMapModelSelection,
): BodyMapAnatomyPackDefinition | null {
  if (selection.sex !== 'divers') return null;
  if (!selection.genitalAnatomy) return null;
  return (
    BODY_MAP_ANATOMY_PACKS.find(
      (entry) => entry.genitalAnatomy === selection.genitalAnatomy,
    ) ?? null
  );
}

export function validateBodyMapSelection(selection: BodyMapModelSelection): string[] {
  const errors: string[] = [];
  if (selection.sex === 'divers') {
    if (!selection.genitalAnatomy) {
      errors.push('Bei Divers muss die Genitalanatomie ausgewählt werden.');
    }
    if (!selection.chestAnatomy) {
      errors.push('Bei Divers muss die Brustausprägung ausgewählt werden.');
    }
  }
  return errors;
}

export function ageGroupFromAge(ageYears: number): BodyMapAgeGroup {
  if (!Number.isFinite(ageYears) || ageYears < 0) return 'erwachsener';
  if (ageYears < 1) return 'baby';
  if (ageYears < 6) return 'kleinkind';
  if (ageYears < 18) return 'kind';
  if (ageYears < 30) return 'junger_erwachsener';
  return 'erwachsener';
}
