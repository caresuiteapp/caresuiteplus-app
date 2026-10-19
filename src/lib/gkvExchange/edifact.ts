import { cents, validateDraft, type ExchangeDraft } from './model';

export type Segment = string[][];
type Decimal = { decimal: string };
type Field = string | number | Decimal | (string | number)[];
const decimal = (value: number): Decimal => ({ decimal: cents(value) });
export const escapeEdifact = (value: string): string => value.replace(/[?:+,']/g, character => `?${character}`);
export function segment(tag: string, fields: Field[]): string {
  const encode = (field: Field): string => Array.isArray(field) ? field.map(v => escapeEdifact(String(v))).join(':')
    : typeof field === 'object' ? field.decimal : escapeEdifact(String(field));
  const values = fields.map(encode);
  while (values.at(-1) === '') values.pop();
  return `${tag}+${values.join('+')}'`;
}
/** A single pass is essential: splitting and unescaping in separate passes corrupts ?+ and ?:. */
export function parseEdifact(input: string, maxBytes = 8 * 1024 * 1024): Segment[] {
  if (typeof input !== 'string' || input.length > maxBytes || /[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/.test(input)) throw new Error('Ungültiger Zeichensatz oder zu große Datei.');
  let source = input.replace(/^\uFEFF/, '');
  if (source.startsWith('UNA')) {
    if (!source.startsWith("UNA:+,? '")) throw new Error('Abweichende EDIFACT-Trennzeichen werden nicht unterstützt.');
    source = source.slice(9);
  }
  const output: Segment[] = []; let fields: Segment = []; let components: string[] = []; let value = ''; let released = false;
  const pushComponent = () => { components.push(value); value = ''; };
  const pushField = () => { pushComponent(); fields.push(components); components = []; };
  for (const character of source) {
    if (released) { if (!"?:+,'".includes(character)) throw new Error('Ungültiges Aufhebungszeichen.'); value += character; released = false; continue; }
    if (character === '?') { released = true; continue; }
    if (character === '\r' || character === '\n') { if (fields.length || components.length || value) throw new Error('Zeilenumbruch innerhalb eines Segments.'); continue; }
    if (character === ':') pushComponent();
    else if (character === '+') pushField();
    else if (character === "'") { pushField(); if (!/^[A-Z]{3}$/.test(fields[0]?.[0] || '')) throw new Error('Ungültige Segmentkennung.'); output.push(fields); fields = []; }
    else value += character;
  }
  if (released || value.trim() || fields.length || components.length) throw new Error('Die Datei endet mit einem unvollständigen Segment.');
  return output;
}
export function validateEnvelope(segments: Segment[], types: string[] = ['PLGA','PLAA']): void {
  const first = segments[0], last = segments.at(-1);
  if (first?.[0]?.[0] !== 'UNB' || last?.[0]?.[0] !== 'UNZ' || first[1]?.join(':') !== 'UNOC:3') throw new Error('Dateikopf oder Dateiende fehlt.');
  if (last[2]?.[0] !== first[5]?.[0]) throw new Error('Dateireferenz stimmt nicht überein.');
  let start = -1, reference = '', count = 0; const references = new Set<string>();
  for (let index = 1; index < segments.length - 1; index++) {
    const s = segments[index], tag = s[0][0];
    if (tag === 'UNH') {
      if (start !== -1 || !types.includes(s[2]?.[0])) throw new Error('Ungültige Nachrichtenfolge.');
      start = index; reference = s[1]?.[0];
      if (!/^\d{1,5}$/.test(reference) || references.has(reference)) throw new Error('Nachrichtenreferenz fehlt oder ist doppelt.');
      references.add(reference); count++;
    } else if (tag === 'UNT') {
      if (start < 0 || s[2]?.[0] !== reference || !/^\d+$/.test(s[1]?.[0]) || Number(s[1][0]) !== index - start + 1) throw new Error('Nachrichtenzähler oder Referenz stimmt nicht überein.');
      start = -1;
    } else if (start < 0 || ['UNB','UNZ'].includes(tag)) throw new Error('Segment außerhalb einer Nachricht.');
  }
  if (start >= 0 || !count || !/^\d+$/.test(last[1]?.[0]) || Number(last[1][0]) !== count) throw new Error('Nachrichtenanzahl stimmt nicht überein.');
}
export function latin1Bytes(text: string): Uint8Array {
  if (/[^\x00-\xff]/.test(text)) throw new Error('Der Text kann nicht verlustfrei als ISO 8859-1 gespeichert werden.');
  return Uint8Array.from(text, character => character.charCodeAt(0));
}
export function decodeLatin1(bytes: Uint8Array): string {
  let value = ''; for (const byte of bytes) value += String.fromCharCode(byte); return value;
}
export function logicalFileName(d: ExchangeDraft): string {
  return `PL${d.month.slice(5,7)}${d.month.slice(3,4)}${d.correction}${String(d.sequence).padStart(2,'0')}S${d.profile.fundType}`;
}
export function physicalFileName(d: ExchangeDraft): string {
  return `${d.mode === 'production' ? 'E' : 'T'}PFL0${String(d.transferNumber).padStart(3,'0')}`;
}
function berlinStamp(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(new Date(iso));
  return ['year','month','day','hour','minute','second'].map(type => parts.find(p => p.type === type)!.value).join('');
}
/** Self-billing, one provider, payer, service type and month. Does not send or attest certification. */
export function buildTestInterchange(d: ExchangeDraft): { name: string; text: string; bytes: Uint8Array; order: Uint8Array } {
  const errors = validateDraft(d).filter(issue => issue.severity === 'error');
  if (errors.length) throw new Error(errors[0].message);
  if (d.mode === 'production') throw new Error('Echtdateien benötigen einen serverseitig freigegebenen Versandadapter.');
  if (d.channel !== 'classic') throw new Error('KIM benötigt einzeln signierte Nachweise und eine gegen die amtlichen Schemata geprüfte XML-Nutzdatendatei.');
  const stamp = berlinStamp(d.createdAt), p = d.profile;
  const output = [segment('UNB', [['UNOC',3],p.senderIk,d.receiverIk,[stamp.slice(0,8),stamp.slice(8,12)],d.interchangeReference,logicalFileName(d),d.mode === 'test' ? 0 : 1])];
  let reference = 0;
  const message = (type: string, body: string[]) => { const ref = ++reference; output.push(segment('UNH',[ref,[type,6]]),...body,segment('UNT',[body.length + 2,ref])); };
  for (const c of d.cases) {
    const net = c.grossCents - c.coPaymentCents - c.aidCents;
    const rec = segment('REC',[[c.invoiceNumber,'0'],c.invoiceDate.replaceAll('-',''),'1','EUR']);
    message('PLGA',[
      segment('FKT',['01','',p.providerIk,d.payerIk,d.insuranceIk,p.senderIk]), rec,
      segment('SRD',[[p.billingCode,p.tariffCode],d.serviceType]),
      segment('UST',[p.taxNumber || '', 'J',p.taxExemptionCode]),
      segment('GES',[decimal(c.grossCents),decimal(c.coPaymentCents),decimal(c.aidCents),decimal(net)]),
      segment('NAM',[p.name,p.name2 || '']),
    ]);
    const body = [segment('FKT',['01',p.providerIk,d.payerIk,d.insuranceIk,p.providerIk]),rec,
      segment('INV',[c.insuranceNumber,c.documentNumber]),
      segment('NAD',[c.lastName,c.firstName,c.birthDate.replaceAll('-',''),c.street || '',c.houseNumber || '',c.postalCode || '',c.city || '']),
      segment('MAN',[c.month.replace('-',''),'','',c.careGrade])];
    for (const l of [...c.lines].sort((a,b) => `${a.day}${a.startTime || ''}`.localeCompare(`${b.day}${b.startTime || ''}`))) {
      body.push(segment('ESK',[l.day,l.startTime || '']), segment('ELS',[[d.serviceType,l.remuneration,l.qualification,l.code],
        decimal(l.unitPriceCents),'','',l.duration,decimal(l.quantityHundredths),l.employeeNumber || '',l.secondEmployeeNumber || '']));
    }
    body.push(segment('IAF',[decimal(c.grossCents),decimal(c.coPaymentCents),decimal(c.aidCents),decimal(net)]));
    message('PLAA',body);
  }
  output.push(segment('UNZ',[reference,d.interchangeReference]));
  const text = output.join(''); const bytes = latin1Bytes(text);
  validateEnvelope(parseEdifact(text));
  return { name: physicalFileName(d), text, bytes, order: buildTestOrder(d, bytes.length, stamp) };
}
/** Unencrypted TEST order only. Encryption fields must describe actual ciphertext in production. */
export function buildTestOrder(d: ExchangeDraft, byteLength: number, stamp = berlinStamp(d.createdAt)): Uint8Array {
  if (d.mode === 'production' || !Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > 999999999999) throw new Error('Ungültiger Prüfauftrag.');
  const output = Array(348).fill(' ');
  const put = (start: number, length: number, value: string | number, numeric = false) => {
    const text = String(value); if (text.length > length || (numeric && !/^\d+$/.test(text))) throw new Error('Auftragsfeld überschreitet seine Feldlänge.');
    output.splice(start - 1,length,...(numeric ? text.padStart(length,'0') : text.padEnd(length,' ')));
  };
  put(1,6,'500000'); put(7,2,'01'); put(9,8,348,true); put(17,3,0,true); put(20,5,'TPFL0'); put(25,3,d.transferNumber,true);
  put(33,15,d.profile.senderIk); put(48,15,d.profile.senderIk); put(63,15,d.receiverIk); put(78,15,d.physicalReceiverIk);
  put(93,6,0,true); put(99,6,0,true); put(105,11,logicalFileName(d)); put(116,14,stamp,true);
  for (const start of [130,144,158]) put(start,14,0,true);
  put(172,6,0,true); put(178,1,0,true); put(179,12,byteLength,true); put(191,12,byteLength,true);
  put(203,2,'I1'); put(205,2,0,true); put(207,2,0,true); put(209,2,0,true);
  put(214,5,0,true); put(219,8,0,true); put(228,2,0,true); put(230,1,5,true); put(231,10,0,true);
  put(319,2,d.serviceType);
  return latin1Bytes(output.join(''));
}
