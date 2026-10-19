import type { BillingCase, Issue, ServiceLine } from './model';

export const CARE_PRICING_RULES = {
  care_attendance: 'Vereinbarter Pflegesatz je tatsächlichem Pflegetag',
  care_daily: 'Vereinbarter Tagessatz × Kalendertage einschließlich Von-/Bis-Tag',
  care_monthly: 'Feste Pauschale für einen vollständigen Kalendermonat',
} as const;
export const CARE_RATE_CODES = { '00': 'Ganztags', '01': 'Halbtags (Tages-/Nachtpflege)', '02': 'Abwesenheit' } as const;
export function daysInMonth(month: string): number {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate() : 0;
}
const clock = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3])[0-5]\d$/.test(value);
export function carePeriod(line: unknown): { first: number; last: number } | null {
  if (!line || typeof line !== 'object' || !('remuneration' in line) || line.remuneration !== '04'
    || !('duration' in line) || typeof line.duration !== 'string' || !/^\d{4}$/.test(line.duration)) return null;
  const first = Number(line.duration.slice(0, 2)), last = Number(line.duration.slice(2));
  return first >= 1 && last >= first && last <= 31 ? { first, last } : null;
}
/** TA1 ESK/ELS supplies the dates; the explicitly selected contract supplies the price basis. */
export function careLineIssues(line: ServiceLine, serviceType: string, month: string, invoiceDate: string, createdDay: string): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message, severity: 'error' });
  if (!['03', '04'].includes(line.remuneration)) {
    if (line.day === '99') add('day', 'Monatskennzeichen 99 ist hier nur mit der bestätigten stationären Monatspauschale verfügbar.');
    if (line.careEndsNextDay) add('careEndsNextDay', 'Ein Folgetag ist nur beim Nachtpflege-Pflegesatz verfügbar.');
    return issues;
  }
  if (!Object.hasOwn(CARE_RATE_CODES, line.code) || line.remuneration === '04' && line.code === '01') add('code', 'Pflegesatz 00 oder 02; 01 nur für Tages-/Nachtpflege.');
  const maxDay = daysInMonth(month);
  if (line.remuneration === '03') {
    if (line.code === '02') add('code', 'Abwesenheit in Tages-/Nachtpflege benötigt eine gesonderte Regel für die Zeitangaben und wird hier noch nicht exportiert.');
    if (!['02', '03'].includes(serviceType)) add('remuneration', 'Teilstationärer Pflegesatz ist für Tages- oder Nachtpflege vorgesehen.');
    if (line.pricingRule !== 'care_attendance' || line.quantityHundredths !== 100) add('quantityHundredths', 'Je Pflegetag einen vereinbarten Pflegesatz mit Menge 1 erfassen. Der Halbtag benötigt seinen eigenen vertraglichen Preis.');
    if (!clock(line.duration)) add('duration', 'Tatsächliches Ende im Format HHMM erforderlich.');
    if (line.day === '99') add('day', 'Tages-/Nachtpflege benötigt den tatsächlichen Leistungstag.');
    if (line.careEndsNextDay && serviceType !== '03') add('careEndsNextDay', 'Nur bei Nachtpflege darf das Ende am Folgetag liegen.');
    if (clock(line.startTime) && clock(line.duration)) {
      if (!line.careEndsNextDay && line.duration <= line.startTime) add('duration', 'Das Ende muss nach dem Beginn liegen. Bei Nachtpflege den Folgetag ausdrücklich angeben.');
      if (line.careEndsNextDay && line.duration >= line.startTime) add('duration', 'Dieser Nachtpflegezeitraum wäre mindestens 24 Stunden lang. Bitte den Zeitraum prüfen.');
    }
    const endDay = Number(line.day) + (line.careEndsNextDay ? 1 : 0);
    if (endDay > maxDay) add('day', 'Monatsübergreifende Nachtpflege benötigt eine gesonderte vertragliche Zuordnung und wird hier noch nicht exportiert.');
    const date = `${month}-${String(endDay).padStart(2, '0')}`;
    if (date > invoiceDate || date > createdDay) add('duration', 'Der Aufenthalt endet nach Rechnungsdatum oder Dateierstellung.');
  } else {
    if (!['04', '05'].includes(serviceType)) add('remuneration', 'Vollstationärer Pflegesatz ist für Kurzzeitpflege oder vollstationäre Pflege vorgesehen.');
    if (line.careEndsNextDay) add('careEndsNextDay', 'Bei stationären Zeiträumen werden Von- und Bis-Tag verwendet.');
    const period = carePeriod(line);
    if (!period || period.last > maxDay) { add('duration', 'Von- und Bis-Tag als TTTT innerhalb desselben Monats angeben, etwa 0107.'); return issues; }
    const date = `${month}-${String(period.last).padStart(2, '0')}`;
    if (date > invoiceDate || date > createdDay) add('duration', 'Der Abrechnungszeitraum endet nach Rechnungsdatum oder Dateierstellung.');
    if (line.pricingRule === 'care_daily') {
      if (line.day !== String(period.first).padStart(2, '0')) add('day', 'Der Leistungstag muss dem ersten Tag des stationären Zeitraums entsprechen.');
      if (line.quantityHundredths !== (period.last - period.first + 1) * 100) add('quantityHundredths', 'Die Anzahl muss den Kalendertagen einschließlich Von- und Bis-Tag entsprechen. Abweichende Vertragszählungen benötigen einen eigenen Abrechnungslauf.');
    } else if (line.pricingRule === 'care_monthly') {
      if (line.day !== '99' || period.first !== 1 || period.last !== maxDay || line.quantityHundredths !== 100) add('day', 'Feste Monatspauschale: Kennzeichen 99, vollständiger Monat und Menge 1 erforderlich.');
    } else add('pricingRule', 'Die vertragliche Tages- oder Monatspauschale auswählen.');
  }
  return issues;
}
export function careCaseIssues(item: BillingCase): Issue[] {
  const covered = new Set<number>(); const issues: Issue[] = [];
  for (const [index, line] of item.lines.entries()) {
    const period = carePeriod(line); if (!period) continue;
    for (let day = period.first; day <= period.last; day++) {
      if (covered.has(day)) { issues.push({ path: `lines.${index}.duration`, severity: 'error', message: 'Stationäre Pflegesatzzeiträume überschneiden sich. Anwesenheit und Abwesenheit müssen getrennte Tage enthalten.' }); break; }
    }
    for (let day = period.first; day <= period.last; day++) covered.add(day);
  }
  return issues;
}
