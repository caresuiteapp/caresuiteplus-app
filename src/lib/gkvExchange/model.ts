import { calculatePrice, type PricingRule } from './pricing';
/** §105 SGB XI. Field order and limits: TA1 6.4.0, TA3 6.4.0 (01.05.2026). */
export const GKV_SPEC = {
  version: '6.4.0', validFrom: '2026-05-01', validUntil: '2027-01-31',
  nextVersion: '6.5.1', nextValidFrom: '2027-02-01',
  source: 'https://www.gkv-datenaustausch.de/leistungserbringer/pflege/pflege.jsp',
} as const;
export const SERVICE_TYPES = {
  '01': 'Ambulante Pflege', '02': 'Tagespflege', '03': 'Nachtpflege',
  '04': 'Kurzzeitpflege', '05': 'Vollstationäre Pflege', '06': 'Pflegehilfsmittel',
  '07': 'Verhinderungspflege', '08': 'Zuschuss nach § 43 Abs. 3',
  '09': 'Beratungseinsatz § 37 Abs. 3', '10': 'Entlastungsleistungen § 45b',
  '11': 'Beratungsgutschein § 7b', '12': 'Wohngruppenzuschlag § 38a',
  '13': 'Pflegekurse / häusliche Schulung § 45', '14': 'Zusätzliche Betreuung § 43b',
  '15': 'Unterstützung digitaler Pflegeanwendungen',
} as const;
export type ServiceType = keyof typeof SERVICE_TYPES;
export type Channel = 'classic' | 'kim';
export type FileMode = 'test' | 'trial' | 'production';
export type FundType = 'AO' | 'BK' | 'BN' | 'EK' | 'IK' | 'LK' | 'SE';
export type Issue = { path: string; message: string; severity: 'error' | 'warning' };
export type ExchangeProfile = {
  providerIk: string; senderIk: string; name: string; name2?: string;
  billingCode: string; tariffCode: string; fundType: FundType; stateCode: string;
  ambulatoryProvider: boolean; employeeNumberRequired: boolean;
  taxExemptionCode: string; taxNumber?: string;
};
export type ServiceLine = {
  sourceId?: string; day: string; startTime?: string; remuneration: string;
  sourceItemId?: string; sourceItemUpdatedAt?: string; sourceRecordUpdatedAt?: string; sourceDescription?: string;
  pricingRule?: PricingRule; contractReference?: string; distanceKm?: string;
  qualification: string; code: string; unitPriceCents: number; quantityHundredths: number;
  duration: string; pointValue?: string; points?: string; employeeNumber?: string;
  secondEmployeeNumber?: string; totalCents: number;
};
export type BillingCase = {
  sourceInvoiceId?: string; sourceUpdatedAt?: string; clientId?: string; proofIds?: string[];
  sourceProofs?: { recordId: string; updatedAt: string; pdfSha256: string }[];
  invoiceNumber: string; invoiceDate: string; documentNumber: string;
  insuranceNumber: string; lastName: string; firstName: string; birthDate: string;
  street?: string; houseNumber?: string; postalCode?: string; city?: string;
  careGrade: string; month: string; proofConfirmed: boolean;
  coPaymentCents: number; aidCents: number; grossCents: number;
  lines: ServiceLine[];
};
export type ExchangeDraft = {
  profile: ExchangeProfile; channel: Channel; mode: FileMode; serviceType: ServiceType;
  payerIk: string; insuranceIk: string; receiverIk: string; physicalReceiverIk: string;
  month: string; sequence: number; transferNumber: number; interchangeReference: number;
  correction: number; createdAt: string; cases: BillingCase[];
};
export type BatchStatus = 'draft' | 'checked' | 'exported_test' | 'blocked' | 'queued' | 'sending' | 'delivery_unknown' | 'sent' | 'delivered' | 'rejected' | 'accepted' | 'cancelled';
export const STATUS_LABELS: Record<BatchStatus, string> = {
  draft: 'Entwurf', checked: 'Fachlich geprüft', exported_test: 'Prüfdatei erstellt', blocked: 'Klärung erforderlich',
  queued: 'Zum Versand freigegeben', sending: 'Übermittlung läuft', delivery_unknown: 'Versandstatus ungeklärt',
  sent: 'Übermittelt', delivered: 'Technisch zugestellt', rejected: 'Zurückgewiesen', accepted: 'Fachlich angenommen', cancelled: 'Verworfen',
};
export function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function isMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
export function billingDay(value: Date | string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(key => parts.find(part => part.type === key)?.value).join('-');
}
export const isIk = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{8}$/.test(value);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const textKeys = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string');
const numbers = (value: Record<string, unknown>, keys: string[]) => keys.every(key => Number.isSafeInteger(value[key]) && Number(value[key]) >= 0 && Number(value[key]) <= 999999999999);
const optionalText = (value: Record<string, unknown>, keys: string[]) => keys.every(key => value[key] === undefined || typeof value[key] === 'string');
export function hasProfileShape(value: unknown): value is ExchangeProfile {
  return record(value) && textKeys(value, ['providerIk','senderIk','name','billingCode','tariffCode','fundType','stateCode','taxExemptionCode'])
    && typeof value.ambulatoryProvider === 'boolean' && typeof value.employeeNumberRequired === 'boolean';
}
/** Incomplete text fields may be saved; malformed structures and non-finite numbers may not. */
export function hasDraftShape(value: unknown): value is ExchangeDraft {
  return record(value) && hasProfileShape(value.profile) && textKeys(value, ['channel','mode','serviceType','payerIk','insuranceIk','receiverIk','physicalReceiverIk','month','createdAt'])
    && numbers(value, ['sequence','transferNumber','interchangeReference','correction']) && Array.isArray(value.cases) && value.cases.length <= 500
    && value.cases.every(c => record(c) && textKeys(c, ['invoiceNumber','invoiceDate','documentNumber','insuranceNumber','lastName','firstName','birthDate','careGrade','month'])
      && optionalText(c,['sourceInvoiceId','sourceUpdatedAt','clientId'])
      && (c.proofIds === undefined || Array.isArray(c.proofIds) && c.proofIds.length <= 30 && c.proofIds.every(id => typeof id === 'string'))
      && (c.sourceProofs === undefined || Array.isArray(c.sourceProofs) && c.sourceProofs.length <= 30 && c.sourceProofs.every(p => record(p) && textKeys(p,['recordId','updatedAt','pdfSha256'])))
      && typeof c.proofConfirmed === 'boolean' && numbers(c, ['coPaymentCents','aidCents','grossCents']) && Array.isArray(c.lines) && c.lines.length <= 1000
      && c.lines.every(l => record(l) && textKeys(l, ['day','remuneration','qualification','code','duration'])
        && optionalText(l,['sourceId','sourceItemId','sourceItemUpdatedAt','sourceRecordUpdatedAt','sourceDescription','pricingRule','contractReference','distanceKm','pointValue','points','startTime','employeeNumber','secondEmployeeNumber'])
        && numbers(l, ['unitPriceCents','quantityHundredths','totalCents'])));
}
export function cents(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 999999999999) throw new Error('Ungültiger Geldbetrag.');
  return `${Math.floor(value / 100)},${String(value % 100).padStart(2, '0')}`;
}
export function blankDraft(now = new Date()): ExchangeDraft {
  const day = billingDay(now);
  return { profile: { providerIk: '', senderIk: '', name: '', billingCode: '', tariffCode: '', fundType: 'EK',
    stateCode: '05', ambulatoryProvider: false, employeeNumberRequired: true, taxExemptionCode: '' },
    channel: 'classic', mode: 'test', serviceType: '09', payerIk: '', insuranceIk: '', receiverIk: '', physicalReceiverIk: '',
    month: day.slice(0, 7), sequence: 1, transferNumber: 1, interchangeReference: 1, correction: 0,
    createdAt: now.toISOString(), cases: [] };
}
export function blankCase(month: string, date = billingDay(new Date())): BillingCase {
  return { invoiceNumber: '', invoiceDate: date, documentNumber: '', insuranceNumber: '', lastName: '', firstName: '',
    birthDate: '', careGrade: '', month, proofConfirmed: false, coPaymentCents: 0, aidCents: 0, grossCents: 0, lines: [] };
}
/** No rate, tax exemption, IK, employee substitute or consent is inferred. */
export function validateDraft(input: unknown): Issue[] {
  const d = input as ExchangeDraft;
  const out: Issue[] = [];
  const add = (path: string, message: string, severity: Issue['severity'] = 'error') => out.push({ path, message, severity });
  if (!d || typeof d !== 'object' || !d.profile || typeof d.profile !== 'object' || !Array.isArray(d.cases)) return [{ path: '', message: 'Abrechnung ist unvollständig.', severity: 'error' }];
  if (d.cases.length > 500) return [{ path: 'cases', message: 'Höchstens 500 Abrechnungsfälle pro Paket.', severity: 'error' }];
  const strings = (value: object, keys: string[], path: string) => {
    for (const key of keys) if (typeof (value as Record<string, unknown>)[key] !== 'string') add(`${path}${key}`, 'Textangabe fehlt oder hat ein ungültiges Format.');
  };
  strings(d, ['channel','mode','serviceType','payerIk','insuranceIk','receiverIk','physicalReceiverIk','month','createdAt'], '');
  strings(d.profile, ['providerIk','senderIk','name','billingCode','tariffCode','fundType','stateCode','taxExemptionCode'], 'profile.');
  if (typeof d.profile.ambulatoryProvider !== 'boolean' || typeof d.profile.employeeNumberRequired !== 'boolean') add('profile', 'Die Anbieterart muss ausdrücklich angegeben werden.');
  for (const key of ['providerIk', 'senderIk'] as const) if (!isIk(d.profile[key])) add(`profile.${key}`, 'Ein gültiges neunstellliges IK ist erforderlich.');
  for (const key of ['payerIk', 'insuranceIk', 'receiverIk', 'physicalReceiverIk'] as const) if (!isIk(d[key])) add(key, 'Ein gültiges neunstellliges IK ist erforderlich.');
  if (!/^18\d{7}$/.test(d.insuranceIk)) add('insuranceIk', 'Das IK der Pflegekasse beginnt mit 18.');
  if (!['classic', 'kim'].includes(d.channel) || !['test', 'trial', 'production'].includes(d.mode)) add('channel', 'Übermittlungsart oder Dateimodus ist ungültig.');
  if (!['AO','BK','BN','EK','IK','LK','SE'].includes(d.profile.fundType)) add('profile.fundType', 'Kassenart fehlt.');
  if (!Object.hasOwn(SERVICE_TYPES, d.serviceType)) add('serviceType', 'Unbekannte Leistungsart.');
  if (!isMonth(d.month)) add('month', 'Ein gültiger Abrechnungsmonat ist erforderlich.');
  const day = typeof d.createdAt === 'string' ? billingDay(d.createdAt) : '';
  if (!isDate(day) || !Number.isFinite(Date.parse(d.createdAt))) add('createdAt', 'Erstellzeitpunkt ist ungültig.');
  else if (day < GKV_SPEC.validFrom || day > GKV_SPEC.validUntil) add('createdAt', 'Der Erstellzeitpunkt liegt außerhalb der unterstützten Version 6.4.0. Ab 01.02.2027 ist die Umstellung erforderlich.');
  for (const [key, min, max] of [['sequence',1,99],['transferNumber',0,999],['interchangeReference',1,99999],['correction',0,9]] as const) {
    if (!Number.isInteger(d[key]) || d[key] < min || d[key] > max) add(key, `Erlaubter Nummernbereich: ${min} bis ${max}.`);
  }
  const field = (value: unknown, path: string, max: number, required = true) => {
    if (typeof value !== 'string' || (required && !value.trim()) || (typeof value === 'string' && (value.length > max || /[^\x20-\x7e\xa0-\xff]/.test(value)))) {
      add(path, `Bitte ${required ? 'einen Wert mit ' : ''}höchstens ${max} Zeichen im Zeichensatz ISO 8859-1 verwenden.`);
    }
  };
  field(d.profile.name, 'profile.name', 30);
  if (d.profile.name2) field(d.profile.name2, 'profile.name2', 30);
  if (!/^(11|15|16|17|18|19|35|36|37|39|81|82|83|84|86|87|88|89|91|92|93|94|96|97|98|99)$/.test(d.profile.billingCode)) add('profile.billingCode', 'Abrechnungscode gemäß Vertrag auswählen.');
  if (!/^[A-Za-z0-9]{5}$/.test(d.profile.tariffCode)) add('profile.tariffCode', 'Das vertragliche Tarifkennzeichen muss fünfstellig sein.');
  if (!/^(0[1-9]|1[0-6])$/.test(d.profile.stateCode)) add('profile.stateCode', 'Bundesland für das Empfängerrouting fehlt.');
  if (!d.profile.taxExemptionCode) add('profile.taxExemptionCode', 'Die umsatzsteuerliche Einordnung muss vor dem Export bestätigt werden.');
  else if (d.profile.taxExemptionCode !== '01') add('profile.taxExemptionCode', 'Dieses Exportprofil unterstützt ausschließlich den bestätigten Befreiungsschlüssel 01 aus TA3.');
  if (d.profile.taxNumber) field(d.profile.taxNumber, 'profile.taxNumber', 20);
  if (d.profile.senderIk !== d.profile.providerIk) add('profile.senderIk', 'Dieser Export unterstützt Selbstabrechnung. Die Sammelabrechnung über ein Abrechnungszentrum benötigt einen eigenen geprüften Adapter.');
  if (['02','03','04','05','06','08','11','12','14','15'].includes(d.serviceType)) add('serviceType', 'Dieses Fachprofil ist noch nicht zur Dateierzeugung freigegeben.');
  if (d.channel === 'kim') {
    if (!['01','07','10'].includes(d.serviceType)) add('channel', 'Version 6.4.0 erlaubt diese Leistungsart nicht im vollelektronischen KIM-Verfahren.');
    if (d.serviceType === '10' && !d.profile.ambulatoryProvider) add('channel', 'Entlastungsleistungen sind über KIM nur für Leistungserbringer der ambulanten Pflege zugelassen.');
  }
  if (!d.cases.length || d.cases.length > 500) add('cases', 'Ein Paket benötigt 1 bis 500 Abrechnungsfälle.');
  const invoices = new Set<string>(); const documents = new Set<string>(); const sources = new Set<string>();
  for (const [i, c] of d.cases.entries()) {
    const path = `cases.${i}`;
    if (!c || typeof c !== 'object' || !Array.isArray(c.lines)) { add(path, 'Abrechnungsfall ist unvollständig.'); continue; }
    strings(c, ['invoiceNumber','invoiceDate','documentNumber','insuranceNumber','lastName','firstName','birthDate','careGrade','month'], `${path}.`);
    if (typeof c.invoiceNumber !== 'string' || !/^[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*$/.test(c.invoiceNumber) || c.invoiceNumber.length > 14) add(`${path}.invoiceNumber`, 'Rechnungsnummer: höchstens 14 Zeichen, Buchstaben/Ziffern mit einzelnen - oder /.');
    if (invoices.has(c.invoiceNumber)) add(`${path}.invoiceNumber`, 'Rechnungsnummer im Paket doppelt.'); invoices.add(c.invoiceNumber);
    if (!/^[A-Za-z0-9/-]{1,10}$/.test(c.documentNumber) || documents.has(c.documentNumber)) add(`${path}.documentNumber`, 'Eine eindeutige Belegnummer mit höchstens 10 Zeichen ist erforderlich.'); documents.add(c.documentNumber);
    if (!isDate(c.invoiceDate) || c.invoiceDate > day) add(`${path}.invoiceDate`, 'Rechnungsdatum fehlt oder liegt nach der Dateierstellung.');
    if (!isDate(c.birthDate) || c.birthDate > day) add(`${path}.birthDate`, 'Geburtsdatum fehlt oder liegt in der Zukunft.');
    if (c.month !== d.month) add(`${path}.month`, 'Abrechnungsfälle verschiedener Monate müssen getrennt werden.');
    if (!/^[1-5]$/.test(c.careGrade)) add(`${path}.careGrade`, 'Pflegegrad 1 bis 5 erforderlich. Wechsel im Monat als getrennten Fall erfassen.');
    field(c.lastName, `${path}.lastName`, 45); field(c.firstName, `${path}.firstName`, 45);
    if (c.insuranceNumber && !/^[A-Za-z0-9]{1,12}$/.test(c.insuranceNumber)) add(`${path}.insuranceNumber`, 'Versichertennummer unverändert gemäß Bewilligung, höchstens 12 Zeichen.');
    for (const [key, max] of [['street',46],['houseNumber',9],['postalCode',10],['city',40]] as const) {
      if (c[key] || !c.insuranceNumber) field(c[key], `${path}.${key}`, max, !c.insuranceNumber && key !== 'houseNumber');
    }
    if (c.proofConfirmed !== true) add(`${path}.proofConfirmed`, 'Leistungsnachweis und erforderliche Unterschriften sind noch nicht bestätigt.');
    if (!c.lines.length || c.lines.length > 1000) { add(`${path}.lines`, 'Es werden 1 bis 1.000 Leistungspositionen benötigt.'); continue; }
    let calculated = 0;
    for (const [j, l] of c.lines.entries()) {
      const lp = `${path}.lines.${j}`;
      if (!l || typeof l !== 'object') { add(lp, 'Leistungsposition fehlt.'); continue; }
      strings(l, ['day','remuneration','qualification','code','duration'], `${lp}.`);
      if (!/^\d{2}$/.test(l.day) || !isDate(`${d.month}-${l.day}`)) add(`${lp}.day`, 'Leistungstag liegt nicht im Abrechnungsmonat.');
      else if (`${d.month}-${l.day}` > day || (isDate(c.invoiceDate) && `${d.month}-${l.day}` > c.invoiceDate)) add(`${lp}.day`, 'Eine Leistung darf nicht nach Rechnungsdatum oder Dateierstellung liegen.');
      if (['01','02','03','06'].includes(l.remuneration) && !/^([01]\d|2[0-3])[0-5]\d$/.test(l.startTime || '')) add(`${lp}.startTime`, 'Tatsächliche Beginnzeit im Format HHMM erforderlich.');
      if (!['01','02','06','07','08','99'].includes(l.remuneration)) add(`${lp}.remuneration`, 'Dieses Vergütungsprofil ist für den Export noch nicht freigegeben.');
      if (!/^[0-48]$/.test(l.qualification)) add(`${lp}.qualification`, 'Qualifikationsschlüssel 0–4 oder 8 erforderlich.');
      if (!/^[A-Za-z0-9]{1,10}$/.test(l.code)) add(`${lp}.code`, 'Vertraglicher Leistungsschlüssel fehlt.');
      if (l.remuneration === '08' && (d.serviceType !== '09' || !['1','2'].includes(l.code))) add(`${lp}.code`, 'Beratungspauschale: 1 für vor Ort, 2 für Video.');
      if (l.remuneration === '07' && (d.serviceType !== '10' || !['10','20','30','31','40'].includes(l.code))) add(`${lp}.code`, 'Entlastungsleistung passend zum Anbieter auswählen.');
      if (l.remuneration === '01' && !/^[A-Za-z0-9]{3}$/.test(l.code)) add(`${lp}.code`, 'Leistungskomplex hat drei Stellen.');
      if (l.remuneration === '99' && l.code !== '99') add(`${lp}.code`, 'Ohne Vertragspreisregelung gilt Schlüssel 99.');
      if (l.remuneration === '06' && !['01','02','03','04'].includes(l.code)) add(`${lp}.code`, 'Wegegebühr: Schlüssel 01 bis 04.');
      if (!/^\d{1,4}$/.test(l.duration) || (l.remuneration === '02' && Number(l.duration) < 1)) add(`${lp}.duration`, 'Dauer oder Kilometerangabe ist ungültig.');
      if (!['02','06'].includes(l.remuneration) && l.duration !== '00') add(`${lp}.duration`, 'Für diese Vergütungsart ist 00 zu melden.');
      if (l.remuneration === '06' && l.code !== '04' && l.duration !== '00') add(`${lp}.duration`, 'Bei Wegepauschalen ist 00 zu melden.');
      for (const key of ['unitPriceCents','totalCents','quantityHundredths'] as const) if (!Number.isSafeInteger(l[key]) || l[key] < (key === 'quantityHundredths' ? 1 : 0) || l[key] > (key === 'quantityHundredths' ? 999999 : 999999999999)) add(`${lp}.${key}`, 'Betrag oder Menge ist ungültig.');
      if (l.remuneration === '02') {
        if (!/^[1-6][0-9A-D]$/.test(l.code)) add(`${lp}.code`, 'Zeitvergütung benötigt den zweistelligen Schlüssel aus TA3.');
        if (/[AB]$/.test(l.code) && d.serviceType !== '09') add(`${lp}.code`, 'Zeitart A/B ist für den Beratungsbesuch vorgesehen.');
        if (typeof l.code === 'string' && l.code.endsWith('0') && d.serviceType !== '15') add(`${lp}.code`, 'Zeitart 0 ist für ergänzende Unterstützungsleistungen für DiPA vorgesehen.');
      }
      try {
        const expected = calculatePrice(l);
        if (l.totalCents !== expected.totalCents) add(`${lp}.totalCents`, 'Positionssumme stimmt nicht mit der gewählten Berechnungsregel überein.');
        if (l.unitPriceCents !== expected.unitPriceCents) add(`${lp}.unitPriceCents`, 'Einzelpreis stimmt nicht mit Punktwert × Punktzahl überein.');
        if (Number(l.duration) !== Number(expected.duration)) add(`${lp}.duration`, 'Gemeldete Kilometer stimmen nicht mit der kaufmännisch gerundeten Strecke überein.');
      } catch (error) { add(`${lp}.totalCents`, error instanceof Error ? error.message : 'Berechnungsgrundlage ist unvollständig.'); }
      if (Object.hasOwn(l, 'adjustments') || Object.hasOwn(l, 'surcharges')) add(lp, 'Zuschläge dürfen erst mit dem gesonderten ZUS-Berechnungsweg exportiert werden.');
      if ((d.profile.ambulatoryProvider || d.profile.employeeNumberRequired) && !/^\d{9}$/.test(l.employeeNumber || '')) add(`${lp}.employeeNumber`, 'Beschäftigtennummer oder belegter Ersatzwert erforderlich.');
      if (l.secondEmployeeNumber && !/^\d{9}$/.test(l.secondEmployeeNumber)) add(`${lp}.secondEmployeeNumber`, 'Zweite Beschäftigtennummer ist ungültig.');
      if (l.sourceId) { if (sources.has(l.sourceId)) add(`${lp}.sourceId`, 'Diese Leistung wurde im Paket mehrfach ausgewählt.'); sources.add(l.sourceId); }
      calculated += l.totalCents;
    }
    for (const key of ['grossCents','coPaymentCents','aidCents'] as const) if (!Number.isSafeInteger(c[key]) || c[key] < 0 || c[key] > 999999999999) add(`${path}.${key}`, 'Ungültiger Fallbetrag.');
    if (calculated !== c.grossCents) add(`${path}.grossCents`, 'Fallsumme stimmt nicht mit den Leistungspositionen überein.');
    if (c.coPaymentCents + c.aidCents > c.grossCents) add(`${path}.aidCents`, 'Eigenanteil und Beihilfe übersteigen den Bruttobetrag.');
  }
  return out;
}
