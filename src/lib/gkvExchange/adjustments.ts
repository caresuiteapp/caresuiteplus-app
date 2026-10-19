import type { Issue, ServiceLine, ServiceType } from './model';
import { fixedDecimal } from './pricing';

/** TA3 6.4.0 §2.14.1. These codes differ from the routing-state codes. */
export const ADJUSTMENT_TARIFFS = {
  '00': 'Bundeseinheitlich', '01': 'Baden-Württemberg', '02': 'Bayern', '04': 'Bremen',
  '05': 'Hamburg', '06': 'Hessen', '07': 'Niedersachsen', '08': 'Nordrhein-Westfalen',
  '09': 'Rheinland-Pfalz', '10': 'Saarland', '11': 'Schleswig-Holstein', '12': 'Brandenburg',
  '13': 'Sachsen', '14': 'Sachsen-Anhalt', '15': 'Mecklenburg-Vorpommern', '16': 'Thüringen', '23': 'Berlin',
} as const;
export const ADJUSTMENT_CODES = {
  '00': 'Andere vertragliche Regelung (Beschreibung erforderlich)',
  '02': 'Anteilige Wegegebühr SGB V / SGB XI', '03': 'Anteilige Wegegebühr betreutes Wohnen',
  '04': 'Zweite Pflegekraft', '05': 'Zu- oder Abwahl einzelner Leistungen',
  '06': 'Mehrere pflegebedürftige Personen', '07': 'Demenz', '08': 'Apallisches Syndrom',
  '09': 'Härtefall', '10': 'Taxi', '18': 'Ausbildungsumlage', '19': 'MRE',
  '21': 'Ungünstige Zeiten', '22': 'Ungünstige Tage',
  '23': 'Ausbildungskosten Pflegeassistenz', '24': 'Sonstige Ausbildungskosten',
} as const;
export const ADJUSTMENT_CALCULATIONS = { '11': 'Prozent vom unveränderten Basisbetrag', '12': 'Fester Betrag (€)' } as const;
export const ADJUSTMENT_RULE = 'independent_single_unit' as const;
export type Adjustment = {
  tariff: string; kind: string; code: string; text: string; allocation: string;
  calculation: string; direction: string; value: string; contractReference: string;
};
export type AdjustmentAmount = { resultCents: number; signedCents: number; end: '0' | '1' };

export function hasAdjustmentsShape(value: unknown): value is Adjustment[] {
  return Array.isArray(value) && value.length <= 20 && value.every(a => a && typeof a === 'object' && !Array.isArray(a)
    && ['tariff','kind','code','text','allocation','calculation','direction','value','contractReference']
      .every(key => typeof a[key] === 'string'));
}

export function adjustmentIssues(line: ServiceLine, service?: ServiceType): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message, severity: 'error' });
  if (line.adjustments === undefined) {
    if (line.adjustmentRule) add('adjustmentRule', 'Zuschlagsregel ohne Zuschläge entfernen.');
    return issues;
  }
  if (!hasAdjustmentsShape(line.adjustments)) { add('adjustments', 'Höchstens 20 vollständig aufgebaute Zu- oder Abschläge je Leistung sind zulässig.'); return issues; }
  if (!line.adjustments.length) {
    if (line.adjustmentRule) add('adjustmentRule', 'Zuschlagsregel ohne Zuschläge entfernen.');
    return issues;
  }
  if (line.adjustmentRule !== ADJUSTMENT_RULE) add('adjustmentRule', 'Unabhängige Berechnung auf dem unveränderten Basisbetrag und einzelne Cent-Rundung vertraglich bestätigen.');
  // Restrict to unambiguous single-unit ELS. Time/km, pooled quantities, replacement
  // chains and monthly/day amounts need their own independently verified profile.
  if (line.quantityHundredths !== 100 || !['01','06','07','08'].includes(line.remuneration)
    || line.remuneration === '06' && line.code === '04') add('adjustments', 'Zuschläge sind hier nur für einzeln ausgewiesene Pauschalen oder Leistungskomplexe mit Menge 1 verfügbar. Zeit- und Kilometerzuschläge benötigen ein eigenes Berechnungsprofil.');
  if (service && (!['01','07','09','10','13'].includes(service)
    || line.remuneration === '07' && !['30','31','40'].includes(line.code))) add('adjustments', 'Dieses Zuschlagsprofil unterstützt ausschließlich ambulante Leistungen.');
  for (const [index, a] of line.adjustments.entries()) {
    const path = `adjustments.${index}`;
    if (!Object.hasOwn(ADJUSTMENT_TARIFFS, a.tariff)) add(`${path}.tariff`, 'Tarifbereich des Zuschlags aus der Vergütungsvereinbarung auswählen.');
    if (a.kind !== '1') add(`${path}.kind`, 'Für dieses Zuschlagsprofil ist die ambulante Zuschlagsart 1 erforderlich.');
    if (!Object.hasOwn(ADJUSTMENT_CODES, a.code)) add(`${path}.code`, 'Ein belegter ambulanter Zuschlagsschlüssel ist erforderlich.');
    if (a.text.length > 50 || /[^\x20-\x7e\xa0-\xff]/.test(a.text) || a.code === '00' && !a.text.trim()) add(`${path}.text`, 'Beschreibung des Zuschlags: höchstens 50 ISO-8859-1-Zeichen; bei Schlüssel 00 erforderlich.');
    if (a.allocation !== (line.remuneration === '06' ? '2' : '1')) add(`${path}.allocation`, 'Zuschlag muss zur vorhergehenden Leistung beziehungsweise Wegegebühr gehören.');
    if (!Object.hasOwn(ADJUSTMENT_CALCULATIONS, a.calculation)) add(`${path}.calculation`, 'Hier sind die Zuschlagsberechnungen 11 und 12 verfügbar; verkettete Ersatzwerte sind noch nicht freigegeben.');
    if (!['0','1'].includes(a.direction)) add(`${path}.direction`, 'Zuschlag oder Abzug auswählen.');
    const value = fixedDecimal(a.value, 4, 5);
    if (value === null || value <= 0n) add(`${path}.value`, 'Positiven Zuschlagswert mit höchstens vier Vor- und fünf Nachkommastellen eingeben.');
    if (!a.contractReference.trim() || a.contractReference.length > 200) add(`${path}.contractReference`, 'Gültige Vertragsgrundlage für diesen Zu- oder Abschlag angeben.');
    if (['02','03'].includes(a.code) && a.allocation !== '2') add(`${path}.code`, 'Dieser Schlüssel gehört zu den Wegegebühren.');
    if (a.code === '02' && (a.calculation !== '11' || a.direction !== '0')) add(`${path}.calculation`, 'Anteilige Wegegebühren SGB V / SGB XI sind als prozentualer Abzug abzubilden.');
    if (a.code === '04' && !/^\d{9}$/.test(line.secondEmployeeNumber || '')) add(`${path}.code`, 'Für die zweite Pflegekraft ist deren Beschäftigtennummer erforderlich.');
  }
  return issues;
}

/** TA1 ZUS Ergebnis is the delta for 11/12, never the final ELS amount.
 * Each adjustment refers to the original single-unit amount. No compounding.
 */
export function calculateAdjustments(line: ServiceLine, baseCents: number): AdjustmentAmount[] {
  const issue = adjustmentIssues(line)[0]; if (issue) throw new Error(issue.message);
  if (!Number.isSafeInteger(baseCents) || baseCents < 0) throw new Error('Ungültiger Basisbetrag.');
  const entries = (line.adjustments || []).map((a, i, list): AdjustmentAmount => {
    const value = fixedDecimal(a.value, 4, 5)!;
    const numerator = a.calculation === '11' ? BigInt(baseCents) * value : value;
    const denominator = a.calculation === '11' ? 10000000n : 1000n;
    const rounded = (numerator * 2n + denominator) / (denominator * 2n);
    if (rounded > 9999999n) throw new Error('Zuschlagsergebnis überschreitet 99.999,99 Euro.');
    const resultCents = Number(rounded);
    return { resultCents, signedCents: a.direction === '0' ? -resultCents : resultCents, end: i === list.length - 1 ? '1' : '0' };
  });
  const total = BigInt(baseCents) + entries.reduce((sum, entry) => sum + BigInt(entry.signedCents), 0n);
  if (total < 0n || total > 999999999999n) throw new Error('Zu- und Abschläge ergeben einen unzulässigen Positionsbetrag.');
  return entries;
}
