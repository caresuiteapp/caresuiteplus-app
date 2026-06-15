import type { WoundDocumentation } from '@/types/modules/pflege';
import { getDemoWoundDocumentations, getDemoWoundPhotoCount } from '@/data/demo/woundDocumentations';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type WoundDocumentationDetail = WoundDocumentation & {
  clientName: string;
  woundType: string;
  woundSize: string;
  treatmentPlan: string;
  photoCount: number;
  bodyMapPrepared: boolean;
  nextReviewAt: string | null;
  caregiverNotes: string;
};

export type WoundDocumentationDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

const DETAIL_EXTRAS: Record<string, Omit<WoundDocumentationDetail, keyof WoundDocumentation>> = {
  'wound-001': {
    clientName: 'Hans Weber',
    woundType: 'Ulcus cruris',
    woundSize: '3,2 × 2,1 cm',
    treatmentPlan: 'Feuchte Wundbehandlung, Kompressionstherapie',
    photoCount: 0,
    bodyMapPrepared: true,
    nextReviewAt: new Date(Date.now() + 4 * 86_400_000).toISOString(),
    caregiverNotes: 'BodyMap-Markierung vorbereitet — Foto-Upload folgt.',
  },
  'wound-002': {
    clientName: 'Gertrud Fischer',
    woundType: 'Dekubitus Grad II',
    woundSize: '2,0 × 1,5 cm',
    treatmentPlan: 'Druckentlastung, lokale Wundversorgung',
    photoCount: 0,
    bodyMapPrepared: true,
    nextReviewAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    caregiverNotes: 'Lagerungsplan im Pflegeplan hinterlegt.',
  },
  'wound-003': {
    clientName: 'Maria Hoffmann',
    woundType: 'Diabetisches Fußsyndrom',
    woundSize: 'Abgeheilt',
    treatmentPlan: 'Kontrolle alle 3 Wochen',
    photoCount: 0,
    bodyMapPrepared: true,
    nextReviewAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    caregiverNotes: 'Abheilung dokumentiert — Kontrolltermin geplant.',
  },
};

export function buildWoundDocumentationDetail(item: WoundDocumentation, mode: ColorMode = 'dark'): WoundDocumentationDetail  {
  const colors = legacyColorsFromPalette(mode);
  const extras = DETAIL_EXTRAS[item.id] ?? {
    clientName: '—',
    woundType: 'Unbekannt',
    woundSize: '—',
    treatmentPlan: 'Noch nicht definiert',
    photoCount: 0,
    bodyMapPrepared: true,
    nextReviewAt: null,
    caregiverNotes: 'Demo-Wundfall — BodyMap extern.',
  };
  const photoCount = getDemoWoundPhotoCount(item.id) || extras.photoCount;
  return { ...item, ...extras, photoCount };
}

export function getDemoWoundDocumentationDetail(id: string): WoundDocumentationDetail | null {
  const item = getDemoWoundDocumentations().find((entry) => entry.id === id);
  return item ? buildWoundDocumentationDetail(item) : null;
}

export function buildWoundDocumentationDetailKpis(detail: WoundDocumentationDetail, mode: ColorMode = 'dark'): WoundDocumentationDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const nextReview = detail.nextReviewAt
    ? new Date(detail.nextReviewAt).toLocaleDateString('de-DE')
    : '—';

  return [
    {
      id: 'type',
      label: 'Wundtyp',
      value: detail.woundType,
      subValue: detail.woundSize,
      icon: '🩹',
      accentColor: colors.danger,
    },
    {
      id: 'location',
      label: 'Lokalisation',
      value: detail.bodyLocation,
      subValue: detail.bodyMapPrepared ? 'BodyMap vorbereitet' : 'BodyMap ausstehend',
      icon: '📍',
      accentColor: colors.cyan,
    },
    {
      id: 'review',
      label: 'Nächste Kontrolle',
      value: nextReview,
      subValue: `${detail.photoCount} Fotos`,
      icon: '📅',
      accentColor: colors.amber,
    },
  ];
}
