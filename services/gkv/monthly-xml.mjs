import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readMonthlyXmlDocument, MonthlyXmlError, monthlyXmlFail, MONTHLY_XML_PROFILE } from '../../src/lib/gkvExchange/monthlyXml.ts';
import { inspectMonthlySignature } from './monthly-signature-png.mjs';

export const MONTHLY_XML_SCHEMA_SHA256 = '908ad0933309fc314ad854ede4805d0db3374007924b768b01cb77974536f114';
export const MONTHLY_XML_NAMESPACE = 'http://www.gkv-datenaustausch.de/XMLSchema/PFL_LNW/2.2';
export const MONTHLY_XML_LIMIT = 8 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = v => JSON.stringify(v, function(_key, value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value;
});
const escape = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const element = (name, value) => `<${name}>${escape(value)}</${name}>`;
function signatureFile(document) {
  const s = document.signature, bytes = Buffer.from(s.base64, 'base64');
  if (!bytes.length || bytes.length > 2097152 || bytes.toString('base64') !== s.base64) monthlyXmlFail('BINARY');
  if (s.type === '1') {
    try { inspectMonthlySignature(bytes); } catch { monthlyXmlFail('PNG'); }
  } else if (!/^%PDF-1\.[0-7][\r\n]/.test(bytes.subarray(0,12).toString('ascii'))
    || !/%%EOF[\t\r\n ]*$/.test(bytes.subarray(-1024).toString('ascii'))) monthlyXmlFail('PDF');
  // A PDF header/EOF check is only format discrimination. Review, page matching,
  // active-content checks and authority belong to the existing paper verifier.
  return hash(bytes);
}
function worker(bytes, { python = 'python3', signal } = {}) {
  if (signal?.aborted) return Promise.reject(new MonthlyXmlError('MONTHLY_XML_ABORTED'));
  return new Promise((resolve, reject) => {
    let child, done = false, size = 0; const chunks = [];
    const finish = (code, value) => {
      if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', aborted);
      if (code) child?.kill('SIGKILL');
      if (code) reject(new MonthlyXmlError(code)); else resolve(value);
    };
    const aborted = () => finish('MONTHLY_XML_ABORTED');
    const timer = setTimeout(() => finish('MONTHLY_XML_TIMEOUT'), 10000);
    signal?.addEventListener('abort', aborted, { once: true });
    try {
      child = spawn(python, ['-I', '-B', fileURLToPath(new URL('./monthly-xml-worker.py', import.meta.url))], {
        shell: false, stdio: ['pipe','pipe','pipe'], env: { PATH: process.env.PATH, LANG: 'C.UTF-8' },
      });
      child.on('error', () => finish('MONTHLY_XML_UNAVAILABLE'));
      child.stdin.on('error', () => {}); child.stderr.resume();
      child.stdout.on('data', c => { size += c.length; if (size > MONTHLY_XML_LIMIT) return finish('MONTHLY_XML_LIMIT'); chunks.push(c); });
      child.on('close', code => {
        if (done) return;
        if (code !== 0) return finish('MONTHLY_XML_REJECTED');
        try {
          const result = JSON.parse(Buffer.concat(chunks));
          if (result.error) return finish(/^MONTHLY_XML_[A-Z_]{1,40}$/.test(result.error) ? result.error : 'MONTHLY_XML_REJECTED');
          finish(undefined, result);
        } catch { finish('MONTHLY_XML_REJECTED'); }
      });
      child.stdin.end(bytes);
    } catch { finish('MONTHLY_XML_UNAVAILABLE'); }
  });
}

/** Independent parsing of the ACTUAL XML, official pinned XSD, TA field rules
 * and exact comparison to expected content. expected must ultimately come from
 * the immutable capture; this module does not authenticate a caller's model.
 * No CMS signature, PROD/MOD approval, persistence or send authorization here.
 */
export async function verifyMonthlyXml(input, { expected, checkedAt, python, signal } = {}) {
  if (!(input instanceof Uint8Array) || !input.length || input.length > MONTHLY_XML_LIMIT) monthlyXmlFail('LIMIT');
  const bytes = Buffer.from(input), document = readMonthlyXmlDocument(expected, checkedAt);
  const binarySha256 = signatureFile(document), digest = hash(bytes);
  const result = await worker(bytes, { python, signal });
  if (result.sha256 !== digest || result.schemaSha256 !== MONTHLY_XML_SCHEMA_SHA256) monthlyXmlFail('WORKER_BINDING');
  const parsed = readMonthlyXmlDocument(result.document, checkedAt);
  if (canonical(parsed) !== canonical(document)) monthlyXmlFail('CONTENT_BINDING');
  return Object.freeze({ schema: 'gkv-lnw-xml-check-v1', logicalVersion: MONTHLY_XML_PROFILE.logicalVersion, xsd: 'PFL_LNW_2.2.0.xsd',
    schemaSha256: MONTHLY_XML_SCHEMA_SHA256, sha256: digest, embeddedFileSha256: binarySha256,
    checkedAt, schemaValid: true, fieldRulesValid: true, expectedContentMatches: true,
    sourceBindingVerified: false, componentSignatureVerified: false, dispatchReady: false });
}

/** A complete unsigned LNW XML file, for the explicitly supported signature
 * profiles 1/PNG and 3/PDF. Never graft this onto an old patient confirmation.
 * The result cannot satisfy KimPackageVerifier or enable live transmission.
 */
export async function generateMonthlyXml(input, options = {}) {
  const document = readMonthlyXmlDocument(input, options.checkedAt), d = document;
  signatureFile(d);
  const days = d.days.map(day => `<Tag>${element('Datum', day.date.replaceAll('-',''))}${day.visits.map(v =>
    `<Einsatz>${element('Lfd_Nummer', v.sequence)}${element('Uhrzeit_Beginn', v.startTime)}${v.lines.map(line =>
      `<Einzelleistung>${element('Leistungsziffer', line.code)}${element('Bezeichnung_der_Leistung', line.description)}${line.quantity !== undefined
        ? element('Anzahl', line.quantity) : element('Tatsaechliche_Dauer', line.minutes)}${line.employeeNumbers.map(n => element('Beschaeftigtennummer', n)).join('')}</Einzelleistung>`
    ).join('')}</Einsatz>`).join('')}</Tag>`).join('');
  const s = d.signature;
  const bytes = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Leistungsnachweis xmlns="${MONTHLY_XML_NAMESPACE}">`
    + element('Leistungsnachweis_ID', d.proofId) + '<Erbrachte_Leistungen>' + element('IK_Pflegedienst', d.providerIk)
    + element('Abrechnungsmonat', d.month.replace('-','')) + element('Versichertennummer', d.insuranceNumber)
    + element('Name', d.lastName) + element('Vorname', d.firstName) + `<Leistungen>${days}</Leistungen>`
    + element('Beschaeftigtennumer_verantwortliche_Fachkraft', d.responsibleEmployeeNumber) + '</Erbrachte_Leistungen>'
    + '<Unterschrift_Versicherter>' + element('Art_der_Unterschrift', s.type)
    + (s.signedLocalTime === undefined ? '' : element('Datum_Uhrzeit_der_Unterschrift', s.signedLocalTime))
    + '<Unterschrift>' + element('Datei', s.base64) + element('Dateityp', s.fileType)
    + '</Unterschrift></Unterschrift_Versicherter></Leistungsnachweis>');
  const verification = await verifyMonthlyXml(bytes, { ...options, expected: document });
  return { bytes, verification };
}
