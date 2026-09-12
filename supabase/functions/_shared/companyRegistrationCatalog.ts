/** Shared by Web registration and the Edge Function. Keys are stable; never reuse them. */
export const COMPANY_REGISTRATION_CATALOG_VERSION = '2026-09-12';
export type CompanyCatalogKind = 'legal_form' | 'industry';
export type CompanyCatalogChoice = { key: string; label: string; optionLabel?: string; aliases: readonly string[] };
export const COMPANY_REGISTRATION_CATALOG: Record<CompanyCatalogKind, readonly CompanyCatalogChoice[]> = {
  "legal_form": [
    {
      "key": "einzelunternehmen",
      "label": "Einzelunternehmen",
      "aliases": [
        "Einzelunternehmer",
        "Einzelunternehmerin"
      ]
    },
    {
      "key": "ek",
      "label": "e. K.",
      "aliases": [
        "e.K.",
        "e.K",
        "eingetragener Kaufmann",
        "eingetragene Kauffrau"
      ]
    },
    {
      "key": "ug",
      "label": "UG (haftungsbeschränkt)",
      "aliases": [
        "UG",
        "Unternehmergesellschaft (haftungsbeschränkt)"
      ]
    },
    {
      "key": "gmbh",
      "label": "GmbH",
      "aliases": [
        "Gesellschaft mit beschränkter Haftung"
      ]
    },
    {
      "key": "gug",
      "label": "gUG (haftungsbeschränkt)",
      "aliases": [
        "gUG",
        "gemeinnützige UG (haftungsbeschränkt)"
      ]
    },
    {
      "key": "ggmbh",
      "label": "gGmbH",
      "aliases": [
        "gemeinnützige GmbH"
      ]
    },
    {
      "key": "gbr",
      "label": "GbR",
      "aliases": [
        "Gesellschaft bürgerlichen Rechts"
      ]
    },
    {
      "key": "egbr",
      "label": "eGbR",
      "aliases": [
        "eingetragene Gesellschaft bürgerlichen Rechts"
      ]
    },
    {
      "key": "ohg",
      "label": "OHG",
      "aliases": [
        "offene Handelsgesellschaft"
      ]
    },
    {
      "key": "kg",
      "label": "KG",
      "aliases": [
        "Kommanditgesellschaft"
      ]
    },
    {
      "key": "gmbh_co_kg",
      "label": "GmbH & Co. KG",
      "aliases": [
        "GmbH & Co KG"
      ]
    },
    {
      "key": "ag",
      "label": "AG",
      "aliases": [
        "Aktiengesellschaft"
      ]
    },
    {
      "key": "eg",
      "label": "eG",
      "aliases": [
        "eingetragene Genossenschaft"
      ]
    },
    {
      "key": "ev",
      "label": "e. V.",
      "aliases": [
        "e.V.",
        "e.V",
        "eingetragener Verein"
      ]
    },
    {
      "key": "stiftung",
      "label": "Stiftung",
      "aliases": []
    },
    {
      "key": "kdoer",
      "label": "Körperschaft des öffentlichen Rechts",
      "optionLabel": "Körperschaft (öff. Recht)",
      "aliases": [
        "KöR",
        "KdöR"
      ]
    },
    {
      "key": "adoer",
      "label": "Anstalt des öffentlichen Rechts",
      "optionLabel": "Anstalt (öff. Recht)",
      "aliases": [
        "AöR"
      ]
    },
    {
      "key": "sonstige",
      "label": "Sonstige Rechtsform",
      "aliases": []
    }
  ],
  "industry": [
    {
      "key": "alltagsbegleitung",
      "label": "Ambulante Alltagsbegleitung",
      "aliases": [
        "Alltagsbegleitung",
        "Alltagsbegleiter",
        "ambulante Alltagshilfe"
      ]
    },
    {
      "key": "betreuungsdienst",
      "label": "Ambulanter Betreuungsdienst",
      "aliases": [
        "Betreuungsdienst"
      ]
    },
    {
      "key": "pflegedienst",
      "label": "Ambulanter Pflegedienst",
      "aliases": [
        "Pflegedienst",
        "ambulante Pflege"
      ]
    },
    {
      "key": "haushaltsdienst",
      "label": "Haushaltsnahe Dienstleistungen",
      "optionLabel": "Haushaltsnahe Dienste",
      "aliases": [
        "Haushaltshilfe",
        "haushaltsnahe Unterstützung"
      ]
    },
    {
      "key": "persoenliche_assistenz",
      "label": "Persönliche Assistenz",
      "aliases": [
        "persoenliche Assistenz"
      ]
    },
    {
      "key": "betreutes_wohnen",
      "label": "Betreutes Wohnen / Servicewohnen",
      "optionLabel": "Betreutes Wohnen",
      "aliases": [
        "Betreutes Wohnen",
        "Servicewohnen"
      ]
    },
    {
      "key": "ambulante_wg",
      "label": "Ambulant betreute Wohngemeinschaft",
      "optionLabel": "Ambulant betreute WG",
      "aliases": [
        "ambulant betreute WG"
      ]
    },
    {
      "key": "tagespflege",
      "label": "Tagespflege",
      "aliases": []
    },
    {
      "key": "nachtpflege",
      "label": "Nachtpflege",
      "aliases": []
    },
    {
      "key": "kurzzeitpflege",
      "label": "Kurzzeitpflege",
      "aliases": []
    },
    {
      "key": "stationaere_pflege",
      "label": "Vollstationäre Pflegeeinrichtung",
      "optionLabel": "Stationäre Pflege",
      "aliases": [
        "Pflegeheim",
        "stationäre Pflege",
        "vollstationäre Pflege"
      ]
    },
    {
      "key": "eingliederungshilfe",
      "label": "Einrichtung der Eingliederungshilfe",
      "optionLabel": "Eingliederungshilfe",
      "aliases": [
        "Eingliederungshilfe"
      ]
    },
    {
      "key": "pflegeberatung",
      "label": "Pflegeberatung / Beratungsstelle",
      "optionLabel": "Pflegeberatung",
      "aliases": [
        "Pflegeberatung",
        "Pflegeberatungsstelle"
      ]
    },
    {
      "key": "bildung",
      "label": "Bildungs- und Schulungsanbieter",
      "optionLabel": "Bildung / Schulung",
      "aliases": [
        "Bildungsanbieter",
        "Schulungsanbieter",
        "Akademie"
      ]
    },
    {
      "key": "pflege_allgemein",
      "label": "Pflegeeinrichtung (allgemein)",
      "aliases": [
        "Pflege",
        "Pflegeeinrichtung"
      ]
    },
    {
      "key": "sonstige",
      "label": "Sonstiger Einrichtungstyp",
      "aliases": []
    }
  ]
};

export function normalizeCompanyCatalogText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}
export function companyCatalogOtherDetail(value: string): string | null {
  const match = /^sonstige:\s*([\s\S]*)$/i.exec(value.trim());
  return match ? match[1].trim() : null;
}
/** Unknown legacy values stay unresolved; never guess a category from part of a name. */
export function resolveCompanyCatalogChoice(kind: CompanyCatalogKind, value: unknown): CompanyCatalogChoice | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (companyCatalogOtherDetail(value) !== null) return COMPANY_REGISTRATION_CATALOG[kind].find(row => row.key === 'sonstige')!;
  const text = normalizeCompanyCatalogText(value);
  return COMPANY_REGISTRATION_CATALOG[kind].find(row => [row.key, row.label, ...row.aliases].some(alias => normalizeCompanyCatalogText(alias) === text)) ?? null;
}
export function canonicalCompanyCatalogValue(kind: CompanyCatalogKind, value: string): string | null {
  const choice = resolveCompanyCatalogChoice(kind, value);
  if (!choice) return null;
  if (choice.key !== 'sonstige') return choice.label;
  const detail = companyCatalogOtherDetail(value);
  return detail && detail.length >= 2 && detail.length <= 180 ? `Sonstige: ${detail}` : null;
}
/** null means a manual comparison is required, especially for unclassified or "other" values. */
export function compareCompanyCatalogValues(kind: CompanyCatalogKind, left: string, right: string): boolean | null {
  const a = resolveCompanyCatalogChoice(kind, left);
  const b = resolveCompanyCatalogChoice(kind, right);
  return !a || !b || a.key === 'sonstige' || b.key === 'sonstige' ? null : a.key === b.key;
}
export function validateCompanyRegistrationSelection(input: { legalForm?: unknown; industry?: unknown }): string | null {
  for (const [kind, field, label] of [['legal_form','legalForm','Rechtsform'], ['industry','industry','Einrichtungstyp / Branche']] as const) {
    const value = input[field];
    const choice = resolveCompanyCatalogChoice(kind, value);
    if (!choice) return `Bitte ${label} aus den Vorgaben auswählen.`;
    if (typeof value !== 'string' || value.length > 200) return `Bitte die Angabe für ${label} auf höchstens 200 Zeichen begrenzen.`;
    if (!canonicalCompanyCatalogValue(kind, value)) return `Bitte „Sonstige“ bei ${label} mit 2 bis 180 Zeichen genauer beschreiben.`;
  }
  return null;
}
export function normalizeCompanyRegistrationSelection<T extends { legalForm: string; industry: string }>(input: T) {
  const error = validateCompanyRegistrationSelection(input);
  if (error) throw new Error(error);
  return {
    ...input,
    legalForm: canonicalCompanyCatalogValue('legal_form', input.legalForm)!,
    industry: canonicalCompanyCatalogValue('industry', input.industry)!,
    legalFormKey: resolveCompanyCatalogChoice('legal_form', input.legalForm)!.key,
    industryKey: resolveCompanyCatalogChoice('industry', input.industry)!.key,
    registrationCatalogVersion: COMPANY_REGISTRATION_CATALOG_VERSION,
  };
}
