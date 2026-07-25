import type { BodyMapModelSelection } from '@/types/modules/bodyMap';
import {
  BODY_MAP_AGE_LABELS,
  BODY_MAP_MODELS,
  BODY_MAP_SEX_LABELS,
} from './modelCatalog';

export type BodyMapVisualQaCase = {
  id: string;
  label: string;
  subtitle: string;
  selection: BodyMapModelSelection;
  group: 'grundmodell' | 'divers-variante';
};

const baseCases: BodyMapVisualQaCase[] = BODY_MAP_MODELS.map((model) => ({
  id: model.id,
  label: model.label,
  subtitle:
    model.sex === 'divers'
      ? 'Grundmodell · Genital- und Brustanatomie unbekannt'
      : `Grundmodell · ${BODY_MAP_SEX_LABELS[model.sex]}`,
  selection: {
    sex: model.sex,
    ageGroup: model.ageGroup,
    genitalAnatomy: model.sex === 'divers' ? 'unbekannt' : null,
    chestAnatomy: model.sex === 'divers' ? 'unbekannt' : null,
    skinTone: 'mittel',
  },
  group: 'grundmodell',
}));

const adultDiversLabel = `${BODY_MAP_AGE_LABELS.erwachsener} · ${BODY_MAP_SEX_LABELS.divers}`;

const diversityCases: BodyMapVisualQaCase[] = [
  {
    id: 'body-erwachsener-divers-penis-brueste',
    label: adultDiversLabel,
    subtitle: 'Divers-Variante · Penis/Skrotum · Brüste',
    selection: {
      sex: 'divers',
      ageGroup: 'erwachsener',
      genitalAnatomy: 'penis',
      chestAnatomy: 'brueste',
      skinTone: 'mittel',
    },
    group: 'divers-variante',
  },
  {
    id: 'body-erwachsener-divers-vulva-keine-brueste',
    label: adultDiversLabel,
    subtitle: 'Divers-Variante · Vulva · Keine Brüste',
    selection: {
      sex: 'divers',
      ageGroup: 'erwachsener',
      genitalAnatomy: 'vulva',
      chestAnatomy: 'keine_brueste',
      skinTone: 'mittel',
    },
    group: 'divers-variante',
  },
  {
    id: 'body-erwachsener-divers-unbekannt-brueste',
    label: adultDiversLabel,
    subtitle: 'Divers-Variante · Genitalanatomie unbekannt · Brüste',
    selection: {
      sex: 'divers',
      ageGroup: 'erwachsener',
      genitalAnatomy: 'unbekannt',
      chestAnatomy: 'brueste',
      skinTone: 'mittel',
    },
    group: 'divers-variante',
  },
];

export const BODY_MAP_VISUAL_QA_CASES: readonly BodyMapVisualQaCase[] = [
  ...baseCases,
  ...diversityCases,
];

export function getBodyMapVisualQaCase(id: string | undefined): BodyMapVisualQaCase {
  return (
    BODY_MAP_VISUAL_QA_CASES.find((entry) => entry.id === id) ??
    BODY_MAP_VISUAL_QA_CASES[0]!
  );
}
