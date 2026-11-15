import type { WoundCatalogItem } from './woundRecordDomain';

// Product families from the manufacturers' German catalogues. A practice adds the exact variant, PZN and purchasing price.
const MATERIAL_FAMILIES = [
  ['HARTMANN', [
    'HydroClean', 'Sorbalgon Classic', 'Hydrosorb Gel', 'Zetuvit Plus', 'Zetuvit Plus Silicone Border',
    'HydroTac', 'HydroTac transparent', 'PermaFoam classic', 'Hydrocoll', 'Atrauman', 'Atrauman Silicone',
    'Grassolind', 'Zetuvit', 'Cosmopor steril', 'Cosmopor advance', 'Cosmopor silicone', 'Cosmopor waterproof',
    'Hydrofilm', 'Hydrofilm Plus', 'ES-Kompressen', 'Peha Schlitzkompressen', 'Medicomp', 'Medicomp drain', 'Pagasling',
  ]],
  ['Mölnlycke', [
    'Mepilex', 'Mepilex XT', 'Mepilex Lite', 'Mepilex Transfer', 'Mepilex Up', 'Mepilex Border Flex',
    'Mepilex Border Flex Lite', 'Mepilex Border Sacrum', 'Mepilex Border Heel', 'Mepilex Border Post-Op',
    'Mextra Superabsorbent', 'Mepitel', 'Mepitel One', 'Mepitel Film', 'Mepore', 'Mepore Film', 'Mepore Film & Pad',
    'Mepore Pro', 'Exufiber', 'Melgisorb Plus', 'Mepitac', 'Mefix', 'Tubifast',
  ]],
  ['Lohmann & Rauscher', [
    'Suprasorb A Pro', 'Suprasorb Liquacel', 'Suprasorb G Gel Kompresse', 'Suprasorb H', 'Suprasorb X',
    'Suprasorb P', 'Suprasorb P sensitive', 'Lomatuell H', 'Lomatuell Pro', 'Metalline', 'Vliwaktiv',
    'Vliwasorb', 'Vliwasorb Pro', 'Vliwasorb sensitive', 'Vliwazell Pro', 'Debrisoft',
  ]],
] as const;

export const WOUND_STARTER_ARTICLES: WoundCatalogItem[] = MATERIAL_FAMILIES.flatMap(([supplier, names], group) =>
  names.map((name, index) => ({
    id: 'family-' + group + '-' + index, kind: 'article' as const, name, supplier,
    code: '', unit: '', text: '', unit_cents: null, updated_at: '',
  })));
