import { medicationPlanOriginalFields, type MedicationPlanPosition } from './medicationPlanImportDomain';

type DailySchedule = { morning: number; noon: number; evening: number; night: number };
type SourceField = { label: string; value: string };
type PrefillBase = {
  fields: { name: string; activeIngredient: string; strength: string; form: string; indication: string; notes: string };
  originalFields: SourceField[];
  scheduleMessage: string;
};

export type MedicationPlanOrderPrefill = PrefillBase & (
  | { scheduleStatus: 'manual'; expectedSchedule: DailySchedule; expectedDose: string }
  | { scheduleStatus: 'unsupported' }
);

// Subset of the KBV S_BMP_DOSIEREINHEIT V1.00 key table supported in this handoff.
// These are exact identities, not conversions. In particular E and IE are not interchangeable.
const unitByCode = new Map([['1', 'Stück'], ['5', 'Hub'], ['6', 'Tropfen'], ['p', 'IE'], ['s', 'ml'], ['t', 'g'], ['v', 'mg']]);
const literalUnits = new Set([...unitByCode.values(), 'µg', 'Tablette', 'Kapsel']);
const scheduleKeys = ['morning', 'noon', 'evening', 'night'] as const;

/** Read-only source evidence for a deliberately entered order; never prefills administration fields. */
export function prepareMedicationPlanOrderPrefill(row: MedicationPlanPosition): MedicationPlanOrderPrefill | null {
  if (row.kind !== 'medication') return null;

  const activeIngredient = row.ingredients.map(part => part.name).join(' + ');
  const base: Omit<PrefillBase, 'scheduleMessage'> = {
    fields: {
      // An ingredient-only BMP entry can retain its identity as supplied. A PZN-only
      // entry must be resolved by the operator, not stored as an invented trade name.
      name: row.name?.trim() ? row.name : row.pzn === null ? activeIngredient : '',
      activeIngredient,
      strength: row.ingredients.length === 1 ? row.ingredients[0].strength ?? '' : '',
      form: row.form ?? '', indication: row.indication ?? '', notes: row.instructions ?? '',
    },
    originalFields: [
      { label: 'Seite im Original', value: String(row.page) },
      ...(row.section.label !== null ? [{ label: 'Abschnitt', value: row.section.label }] : []),
      ...(row.section.code !== null ? [{ label: 'Abschnitt (BMP-Code)', value: row.section.code }] : []),
      ...medicationPlanOriginalFields(row),
    ],
  };
  const unsupported = (scheduleMessage: string): MedicationPlanOrderPrefill => ({ ...base, scheduleStatus: 'unsupported', scheduleMessage });
  if (row.weekdayCode !== null || row.section.code === '425') {
    return unsupported('Die wöchentliche Gabe bleibt im Originalplan. Das Tagesformular kann den Wochentag nicht übernehmen.');
  }
  if (row.section.code === '411') {
    return unsupported('Diese Bedarfsmedikation bleibt im Originalplan. Ihre Bedingungen und Grenzen werden nicht automatisch übertragen.');
  }
  if (row.section.code === '423' || row.section.code === '424') {
    return unsupported('Der Originalplan nennt besondere Gabezeiten oder eine Befristung. Das Tagesformular kann diese Angaben nicht vollständig übernehmen.');
  }
  if (row.section.label !== null || (row.section.code !== null && row.section.code !== '412')
    || row.doseText !== null || row.instructions?.trim() || row.additionalText?.trim()) {
    return unsupported('Diese Position enthält weitere Angaben zur Anwendung oder Dosierung. Sie bleibt zur Prüfung im Originalplan.');
  }

  const originalSlots = scheduleKeys.map(key => row[key]);
  if (originalSlots.some(value => value !== null && !/^(0|[1-9][0-9]{0,3})$/.test(value))) {
    return unsupported('Die Originaldosierung passt nicht in das Tagesformular mit ganzen Einheiten.');
  }
  // The BMP specifies that omitted slots are zero in the four-part schema.
  const [morning, noon, evening, night] = originalSlots.map(value => value === null ? 0 : Number(value));
  const taken = [morning, noon, evening, night].filter(value => value > 0);
  if (!taken.length || taken.some(value => value !== taken[0])) {
    return unsupported('Eine eindeutige, gleichbleibende Einzeldosis pro Gabe ist aus den angegebenen Tageszeiten nicht übertragbar.');
  }
  const unit = row.unitCode !== null && row.unit === null ? unitByCode.get(row.unitCode)
    : row.unitCode === null && row.unit !== null && literalUnits.has(row.unit) ? row.unit : undefined;
  if (!unit) return unsupported('Die Dosiereinheit fehlt oder ist für diese Übernahme nicht eindeutig hinterlegt.');

  return {
    ...base, scheduleStatus: 'manual', expectedSchedule: { morning, noon, evening, night }, expectedDose: `${taken[0]} ${unit}`,
    scheduleMessage: 'Dosierung, Gabezeiten und Applikationsweg anhand des Originals prüfen und bewusst eintragen.',
  };
}
