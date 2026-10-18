import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import SaxonJS from 'saxon-js';
import {
  XmlDocument, XsdValidator, XmlBufferInputProvider, xmlRegisterInputProvider,
  ParseOption,
} from 'libxml2-wasm';

export const MAX_EINVOICE_XML_BYTES = 5 * 1024 * 1024;
export const XRECHNUNG_PROFILE = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
export const EN16931_PROFILE = 'urn:cen.eu:en16931:2017';
const RULE_DIRECTORY = new URL('./einvoice-rules/2026-08-31/', import.meta.url);
const MANIFEST_SHA256 = 'f3e6fce0fb96b25a6aa3a646dc67ab9b21615dffeb177cffe1f260f36c09e147';
const SCHEMA_ORIGIN = 'https://schemas.caresuite.invalid/';
const PARSE_OPTIONS = ParseOption.XML_PARSE_NO_XXE | ParseOption.XML_PARSE_NONET | ParseOption.XML_PARSE_NO_SYS_CATALOG;
const NS = {
  invoice: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  credit: 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  rsm: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
  ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
  svrl: 'http://purl.oclc.org/dsdl/svrl',
  scenario: 'http://www.xoev.de/de/validator/framework/1/scenarios',
};
const SYNTAX = {
  ubl_invoice: { root: 'Invoice', ns: NS.invoice, schema: 'resources/ubl/2.1/xsd/maindoc/UBL-Invoice-2.1.xsd', family: 'ubl', scenario: 'UBL Invoice' },
  ubl_credit_note: { root: 'CreditNote', ns: NS.credit, schema: 'resources/ubl/2.1/xsd/maindoc/UBL-CreditNote-2.1.xsd', family: 'ubl', scenario: 'UBL CreditNote' },
  cii: { root: 'CrossIndustryInvoice', ns: NS.rsm, schema: 'resources/cii/16b/xsd/CrossIndustryInvoice_100pD16B.xsd', family: 'cii', scenario: 'CII' },
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let manifest;
let providersRegistered = false;
const schemaCache = new Map();
const stylesheetCache = new Map();
const severityCache = new Map();

function getManifest() {
  if (!manifest) {
    const bytes = readFileSync(new URL('manifest.json', RULE_DIRECTORY));
    if (sha256(bytes) !== MANIFEST_SHA256) throw new Error('VALIDATOR_MANIFEST_INTEGRITY');
    manifest = JSON.parse(bytes.toString('utf8'));
  }
  return manifest;
}

function readRule(path) {
  const expected = getManifest().files[path];
  if (typeof expected !== 'string' || path.includes('..') || path.startsWith('/')) throw new Error('VALIDATOR_UNKNOWN_RESOURCE');
  const encoded = readFileSync(new URL(`${path}.gz.b64`, RULE_DIRECTORY), 'utf8');
  const bytes = gunzipSync(Buffer.from(encoded.trim(), 'base64'), { maxOutputLength: 16 * 1024 * 1024 });
  if (sha256(bytes) !== expected) throw new Error('VALIDATOR_RESOURCE_INTEGRITY');
  return bytes;
}

function registerSchemas() {
  if (providersRegistered) return;
  // Only the pinned, local schema closure is available to libxml2. No file or
  // HTTP input provider is registered. Incoming schemaLocation is never used.
  const files = {};
  for (const path of Object.keys(getManifest().files)) {
    if (path.endsWith('.xsd')) files[SCHEMA_ORIGIN + path] = readRule(path);
  }
  if (!xmlRegisterInputProvider(new XmlBufferInputProvider(files))) throw new Error('VALIDATOR_SCHEMA_PROVIDER');
  providersRegistered = true;
}

function getSchema(path) {
  registerSchemas();
  if (!schemaCache.has(path)) {
    const doc = XmlDocument.fromBuffer(readRule(path), { url: SCHEMA_ORIGIN + path, option: PARSE_OPTIONS });
    try { schemaCache.set(path, XsdValidator.fromDoc(doc)); } finally { doc.dispose(); }
  }
  return schemaCache.get(path);
}

function getStylesheet(name) {
  if (!stylesheetCache.has(name)) stylesheetCache.set(name, JSON.parse(readRule(`sef/${name}.sef.json`).toString('utf8')));
  return stylesheetCache.get(name);
}

function getSeverityOverrides(syntax, standard) {
  const key = `${syntax}:${standard}`;
  if (!severityCache.has(key)) {
    const doc = XmlDocument.fromBuffer(readRule('scenarios.xml'), { option: PARSE_OPTIONS });
    try {
      const scenarioName = `${standard === 'xrechnung_3.0' ? 'EN16931 XRechnung' : 'EN16931'} (${SYNTAX[syntax].scenario})`;
      const candidates = doc.find('/scenario:scenarios/scenario:scenario', NS);
      const scenario = candidates.find(value => value.get('scenario:name', NS)?.content === scenarioName);
      if (!scenario) throw new Error('VALIDATOR_SCENARIO_NOT_FOUND');
      const overrides = new Map();
      for (const item of scenario.find('scenario:createReport/scenario:customLevel', NS)) {
        const level = item.eval('string(@level)');
        if (!['error', 'warning', 'information'].includes(level)) throw new Error('VALIDATOR_SEVERITY');
        overrides.set(item.content, level);
      }
      severityCache.set(key, overrides);
    } finally { doc.dispose(); }
  }
  return severityCache.get(key);
}

function decodeXml(bytes) {
  let encoding = 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
  const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  const declared = text.match(/^\s*<\?xml\s[^?]*encoding\s*=\s*['"]([^'"]+)['"]/i)?.[1]?.toLowerCase();
  if (declared && !(encoding === 'utf-8' ? ['utf-8', 'utf8'].includes(declared) : ['utf-16', encoding].includes(declared))) {
    throw new Error('Die Zeichenkodierung der XML-Datei ist widersprüchlich oder wird nicht unterstützt. Bitte UTF-8 oder UTF-16 mit BOM verwenden.');
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text)) throw new Error('DTD- und Entity-Deklarationen sind aus Sicherheitsgründen nicht erlaubt.');
  if (/<\?xml-stylesheet\b/i.test(text)) throw new Error('Die XML-Datei darf keine externe Darstellungsvorschrift laden.');
  return text;
}

function short(value, max = 2000) { return String(value ?? '').slice(0, max); }
function xmlErrorFindings(error, code) {
  const details = Array.isArray(error?.details) ? error.details.slice(0, 100) : [];
  if (!details.length) return [{ code, severity: 'error', message: short(error?.message || 'Die XML-Datei konnte nicht geprüft werden.') }];
  return details.map(detail => ({ code, severity: 'error', message: short(detail.message), location: `Zeile ${Number(detail.line) || 0}, Spalte ${Number(detail.col) || 0}` }));
}

function schematronFindings(text, name, overrides) {
  // No stylesheet or stylesheet parameter is accepted from a caller. The
  // initial-document-uri parameter stays unset, so the official SchXslt
  // document() entry point is never used. Only the in-memory source is read.
  const transformed = SaxonJS.transform({
    stylesheetInternal: getStylesheet(name), sourceText: text,
    destination: 'serialized', stylesheetParams: {},
  }, 'sync');
  if (typeof transformed?.principalResult !== 'string') throw new Error('VALIDATOR_MISSING_SVRL');
  const doc = XmlDocument.fromString(transformed.principalResult, { option: PARSE_OPTIONS });
  try {
    if (doc.root.name !== 'schematron-output' || doc.root.namespaceUri !== NS.svrl ||
      !doc.find('//svrl:active-pattern', NS).length || !doc.find('//svrl:fired-rule', NS).length) {
      throw new Error('VALIDATOR_INCOMPLETE_SVRL');
    }
    const failures = doc.find('//svrl:failed-assert | //svrl:successful-report', NS);
    const findings = failures.slice(0, 200).map(node => {
      const code = node.eval('string(@id)');
      const original = node.eval('string(@flag)') || node.eval('string(@role)') || 'error';
      const severity = overrides.get(code) || (original === 'warning' ? 'warning' : original === 'information' || original === 'info' ? 'information' : 'error');
      return { code: short(code || 'SCHEMATRON_FINDING', 100), severity,
        message: short(node.get('svrl:text', NS)?.content.trim() || 'Eine Geschäftsregel wurde nicht erfüllt.'),
        location: short(node.eval('string(@location)'), 1200) };
    });
    // A truncated report must never hide an error behind the first warnings.
    if (failures.length > 200) findings.push({ code: 'VALIDATION_FINDINGS_LIMIT', severity: 'error', message: 'Die Datei enthält mehr als 200 Prüfhinweise. Bitte zuerst die angezeigten Probleme beheben.' });
    return findings;
  } finally { doc.dispose(); }
}

/** Validates actual immutable XML bytes against pinned XSD and all profile rules. */
export async function validateEInvoiceXml({ xml, expectedProfileId } = {}) {
  const started = performance.now();
  const bytes = xml instanceof Uint8Array ? new Uint8Array(xml) : new Uint8Array();
  const result = {
    schemaVersion: 1, status: 'error', documentSha256: sha256(bytes), syntax: null,
    profileId: '', standard: null, source: 'server', scope: 'structured_xml',
    engine: { name: 'libxml2-wasm+saxon-js', version: '0.7.2+2.7.0' },
    ruleSet: { name: 'KoSIT XRechnung', version: '2026-08-31', sha256: MANIFEST_SHA256 },
    checks: [{ kind: 'syntax', status: 'not_run' }, { kind: 'xsd', status: 'not_run' }, { kind: 'business_rules', status: 'not_run' }],
    businessRuleSets: [], findings: [], checkedAt: new Date().toISOString(), durationMs: 0,
  };
  const finish = status => { result.status = status; result.durationMs = Math.round(performance.now() - started); return result; };
  if (!bytes.length || bytes.length > MAX_EINVOICE_XML_BYTES) {
    result.findings.push({ code: 'XML_SIZE', severity: 'error', message: 'Die XML-Datei muss zwischen 1 Byte und 5 MB groß sein.' });
    return finish('invalid');
  }
  let text;
  let doc;
  try {
    try {
      text = decodeXml(bytes);
      doc = XmlDocument.fromBuffer(bytes, { option: PARSE_OPTIONS });
      if (Number(doc.eval('count(//*)')) > 50000 || Number(doc.eval('count(//*[count(ancestor::*) > 80])')) > 0) {
        throw new Error('Die XML-Datei überschreitet die zulässige Anzahl oder Verschachtelung der Elemente.');
      }
      result.checks[0].status = 'passed';
    } catch (error) {
      result.checks[0].status = 'failed'; result.findings.push(...xmlErrorFindings(error, 'XML_SYNTAX'));
      return finish('invalid');
    }
    result.syntax = Object.keys(SYNTAX).find(key => doc.root.name === SYNTAX[key].root && doc.root.namespaceUri === SYNTAX[key].ns) || null;
    if (!result.syntax) {
      result.findings.push({ code: 'UNSUPPORTED_SYNTAX', severity: 'information', message: 'Unterstützt werden UBL-2.1-Rechnungen, UBL-Gutschriften und CII-D16B-Rechnungen.' });
      return finish('unsupported');
    }
    const profilePath = result.syntax === 'cii'
      ? '/rsm:CrossIndustryInvoice/rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID'
      : '/*/cbc:CustomizationID';
    const profiles = doc.find(profilePath, NS);
    result.profileId = profiles.length === 1 ? profiles[0].content.trim() : '';
    if (typeof expectedProfileId === 'string' && result.profileId !== expectedProfileId) {
      result.findings.push({ code: 'PROFILE_MISMATCH', severity: 'error', message: 'Das tatsächliche XML-Profil stimmt nicht mit dem angeforderten Profil überein.' });
      return finish('invalid');
    }
    result.standard = result.profileId === XRECHNUNG_PROFILE ? 'xrechnung_3.0' : result.profileId === EN16931_PROFILE ? 'en16931' : null;
    if (!result.standard) {
      result.findings.push({ code: 'UNSUPPORTED_PROFILE', severity: 'information', message: 'Für dieses Profil ist kein passendes vollständiges Prüfverfahren eingebunden. Es wird nicht gegen ein fremdes Profil freigegeben.' });
      return finish('unsupported');
    }
    const definition = SYNTAX[result.syntax];
    const schema = getSchema(definition.schema);
    try { schema.validate(doc); result.checks[1].status = 'passed'; }
    catch (error) {
      result.checks[1].status = 'failed'; result.findings.push(...xmlErrorFindings(error, 'XSD_VALIDATION'));
      return finish('invalid');
    }
    const overrides = getSeverityOverrides(result.syntax, result.standard);
    result.findings.push(...schematronFindings(text, `en16931-${definition.family}`, overrides));
    result.businessRuleSets.push('en16931-1.3.16');
    if (result.standard === 'xrechnung_3.0') {
      result.findings.push(...schematronFindings(text, `xrechnung-${definition.family}`, overrides));
      result.businessRuleSets.push('xrechnung-2.6.0');
    }
    const hasErrors = result.findings.some(finding => finding.severity === 'error');
    result.checks[2].status = hasErrors ? 'failed' : 'passed';
    return finish(hasErrors ? 'invalid' : 'valid');
  } catch {
    result.findings.push({ code: 'VALIDATOR_EXECUTION', severity: 'error', message: 'Das vollständige Prüfverfahren konnte nicht abgeschlossen werden. Die Datei ist nicht freigegeben.' });
    return finish('error');
  } finally { doc?.dispose(); }
}
