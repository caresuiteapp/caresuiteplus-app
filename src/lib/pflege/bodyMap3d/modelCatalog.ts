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
  jugendlicher: 'Jugendliche',
  junger_erwachsener: 'Junger Erwachsener',
  erwachsener: 'Erwachsener',
  senior: 'Senior',
  hochbetagt: 'Hochbetagter Mensch',
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
  jugendlicher: { nominalHeightMeters: 1.66, cameraDistance: 4.1, cameraTargetY: 0.83 },
  junger_erwachsener: { nominalHeightMeters: 1.72, cameraDistance: 4.25, cameraTargetY: 0.86 },
  erwachsener: { nominalHeightMeters: 1.72, cameraDistance: 4.25, cameraTargetY: 0.86 },
  senior: { nominalHeightMeters: 1.65, cameraDistance: 4.1, cameraTargetY: 0.82 },
  hochbetagt: { nominalHeightMeters: 1.59, cameraDistance: 4, cameraTargetY: 0.79 },
};

const MODEL_ROWS: Array<[BodyMapAgeGroup, BodyMapSex]> = (
  Object.keys(BODY_MAP_AGE_LABELS) as BodyMapAgeGroup[]
).flatMap((ageGroup) =>
  (Object.keys(BODY_MAP_SEX_LABELS) as BodyMapSex[]).map((sex) => [ageGroup, sex]),
);

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
  if (ageYears < 13) return 'kind';
  if (ageYears < 18) return 'jugendlicher';
  if (ageYears < 30) return 'junger_erwachsener';
  if (ageYears < 65) return 'erwachsener';
  if (ageYears < 85) return 'senior';
  return 'hochbetagt';
}

export function completedAgeFromBirthDate(
  birthDate: string,
  referenceDate = new Date(),
): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) return null;
  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);
  const validation = new Date(Date.UTC(birthYear, birthMonth - 1, birthDay));
  if (
    validation.getUTCFullYear() !== birthYear ||
    validation.getUTCMonth() !== birthMonth - 1 ||
    validation.getUTCDate() !== birthDay
  ) {
    return null;
  }
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const referenceDay = referenceDate.getDate();
  let age = referenceYear - birthYear;
  if (
    referenceMonth < birthMonth ||
    (referenceMonth === birthMonth && referenceDay < birthDay)
  ) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function ageGroupFromBirthDate(
  birthDate: string | null | undefined,
  referenceDate = new Date(),
): BodyMapAgeGroup | null {
  if (!birthDate) return null;
  const completedAge = completedAgeFromBirthDate(birthDate, referenceDate);
  return completedAge === null ? null : ageGroupFromAge(completedAge);
}
