import type { AssistServiceAreaKey } from '@/types/assistServiceCatalog';
import { ASSIST_MEDICAL_CARE_KEYWORDS, ASSIST_SERVICE_AREA_LABELS } from '@/types/assistServiceCatalog';

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

function containsMedicalCareKeyword(text: string): string | null {
  const normalized = normalizeText(text);
  for (const keyword of ASSIST_MEDICAL_CARE_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}

/** Verhindert Fehldeklaration medizinischer/pflegerischer Leistungen als Alltagsbegleitung. */
export function validateAssistServiceCategory(
  category: AssistServiceAreaKey,
  title: string,
  description: string,
): { ok: true } | { ok: false; error: string } {
  const combined = `${title} ${description}`;
  const keyword = containsMedicalCareKeyword(combined);

  if (category === 'alltagsbegleitung' && keyword) {
    return {
      ok: false,
      error:
        `„${title}" darf nicht als Alltagsbegleitung geführt werden — Hinweis auf ${keyword}. ` +
        'Pflege-/Medizinleistungen gehören in den Pflege-Leistungskatalog.',
    };
  }

  if (
    keyword &&
    (category === 'besuchsdienst' || category === 'sonstige_unterstuetzung') &&
    /\b(pflege|medizin|behandlung|injektion|wund)\b/i.test(combined)
  ) {
    return {
      ok: false,
      error:
        `Leistung „${title}" enthält pflegerische/medizinische Begriffe (${keyword}) — ` +
        'bitte korrekten Leistungsbereich wählen, nicht Alltagsbegleitung vortäuschen.',
    };
  }

  if (!ASSIST_SERVICE_AREA_LABELS[category]) {
    return { ok: false, error: 'Ungültiger Leistungsbereich.' };
  }

  return { ok: true };
}

export function mapAssistCategoryToCareServiceArea(category: AssistServiceAreaKey): string | null {
  switch (category) {
    case 'alltagsbegleitung':
    case 'aktivierung':
    case 'organisation_alltag':
      return 'alltagsbegleitung';
    case 'betreuung':
    case 'besuchsdienst':
    case 'entlastung_angehoeriger':
      return 'betreuung';
    case 'hauswirtschaft':
      return 'hauswirtschaft';
    case 'begleitung_ausser_haus':
    case 'einkaufen':
      return 'entlastungsleistungen';
    case 'sonstige_unterstuetzung':
      return 'selbstzahlerleistungen';
    default:
      return null;
  }
}
