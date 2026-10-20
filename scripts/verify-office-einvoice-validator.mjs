import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import {
  validateEInvoiceXml, XRECHNUNG_PROFILE, EN16931_PROFILE, MAX_EINVOICE_XML_BYTES,
} from '../api/_lib/einvoice-validator.mjs';

const fixtures = new URL('./fixtures/einvoice/', import.meta.url);
const rules = new URL('../api/_lib/einvoice-rules/2026-08-31/', import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => readFileSync(new URL(name, fixtures), 'utf8');
const base = read('care-suite-S.xml');
const oracle = JSON.parse(read('kosit-oracle-results.json'));
const oracleByHash = new Map(oracle.results.map(value => [value.documentSha256, value]));
const comparedOracleHashes = new Set();
let tests = 0;

async function check(name, source, expected, verify) {
  const xml = typeof source === 'string' ? Buffer.from(source) : source;
  const report = await validateEInvoiceXml({ xml });
  assert.equal(report.status, expected, `${name}: ${JSON.stringify(report.findings)}`);
  assert.equal(report.documentSha256, sha256(xml), `${name}: report must bind the actual input bytes`);
  assert.equal(report.source, 'server');
  assert.equal(report.scope, 'structured_xml');
  if (expected === 'valid') {
    assert.ok(report.checks.every(value => value.status === 'passed'), `${name}: incomplete validation`);
    assert.ok(!report.findings.some(value => value.severity === 'error'));
  }
  const reference = oracleByHash.get(report.documentSha256);
  if (reference) {
    assert.equal(expected === 'valid', reference.accepted, `${name}: official KoSIT acceptance differs`);
    assert.equal(report.checks[1].status === 'passed', reference.xsdValid, `${name}: official XSD outcome differs`);
    if (reference.xsdValid) {
      const normalize = findings => findings.map(({ code, severity }) => `${code}:${severity}`).sort();
      assert.deepEqual(normalize(report.findings), normalize(reference.findings), `${name}: official KoSIT findings differ`);
    }
    comparedOracleHashes.add(report.documentSha256);
  }
  verify?.(report);
  tests++;
  return report;
}

// Verify all archived source, schema and executable rule bytes, not merely names.
const manifestBytes = readFileSync(new URL('manifest.json', rules));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
assert.equal(sha256(manifestBytes), oracle.applicationRuleManifestSha256, 'The oracle baseline must be reviewed after updating validation rules.');
for (const [name, expected] of Object.entries(manifest.files)) {
  const bytes = gunzipSync(Buffer.from(readFileSync(new URL(`${name}.gz.b64`, rules), 'utf8').trim(), 'base64'));
  assert.equal(sha256(bytes), expected, `Pinned rule asset changed: ${name}`);
}

for (const category of ['S', 'Z', 'E', 'AE', 'O', 'annex']) {
  await check(`generated ${category}`, read(`care-suite-${category}.xml`), 'valid', report => {
    assert.deepEqual(report.businessRuleSets, ['en16931-1.3.16', 'xrechnung-2.6.0']);
    assert.equal(report.ruleSet.sha256, sha256(manifestBytes));
    assert.deepEqual(report.findings, []);
  });
}

for (const syntax of ['ubl', 'cii']) {
  await check(`KoSIT ${syntax}`, read(`kosit-01.01a-${syntax}.xml`), 'valid', report => {
    assert.equal(report.syntax, syntax === 'cii' ? 'cii' : 'ubl_invoice');
    assert.ok(report.findings.some(value => value.code === 'BR-DE-TMP-32' && value.severity === 'information'));
  });
  await check(`base EN16931 ${syntax}`, read(`kosit-01.01a-${syntax}.xml`).replace(XRECHNUNG_PROFILE, EN16931_PROFILE), 'valid', report => {
    assert.equal(report.standard, 'en16931');
    assert.deepEqual(report.businessRuleSets, ['en16931-1.3.16']);
    assert.ok(!report.findings.some(value => value.code.startsWith('BR-DE-')));
  });
}

const credit = base.replaceAll('Invoice-2', 'CreditNote-2')
  .replace('<Invoice ', '<CreditNote ').replace('</Invoice>', '</CreditNote>')
  .replaceAll('InvoiceTypeCode', 'CreditNoteTypeCode').replace('>380<', '>381<')
  .replace(/<cbc:DueDate>[^<]+<\/cbc:DueDate>/, '')
  .replaceAll('InvoiceLine', 'CreditNoteLine').replaceAll('InvoicedQuantity', 'CreditedQuantity');
await check('UBL credit note', credit, 'valid', report => assert.equal(report.syntax, 'ubl_credit_note'));

await check('wrong payable total', base.replace('<cbc:PayableAmount currencyID="EUR">238.00', '<cbc:PayableAmount currencyID="EUR">239.00'), 'invalid', report => {
  assert.equal(report.checks[1].status, 'passed');
  assert.equal(report.checks[2].status, 'failed');
  assert.ok(report.findings.some(value => value.code === 'BR-CO-16' && value.severity === 'error'));
});
await check('missing seller contact', base.replace(/<cac:Contact>[\s\S]*?<\/cac:Contact>/, ''), 'invalid', report => {
  assert.ok(report.findings.some(value => value.code === 'BR-DE-2' && value.severity === 'error'));
});
await check('invalid date rejected by XSD', base.replace('<cbc:IssueDate>2026-10-18', '<cbc:IssueDate>not-a-date'), 'invalid', report => {
  assert.equal(report.checks[1].status, 'failed');
  assert.equal(report.checks[2].status, 'not_run');
});

// BR-DE-19 is a warning in the pinned official scenario. Both outcomes were
// compared with KoSIT Validator 1.6.3, including its original unpatched XSLT.
await check('invalid IBAN checksum preserves official warning', base.replace('DE89370400440532013000', 'DE88370400440532013000'), 'valid', report => {
  assert.deepEqual(report.findings.map(value => [value.code, value.severity]), [['BR-DE-19', 'warning']]);
});
for (const [iban, shouldWarn] of [['DE89370400440532013000', false], ['DE88370400440532013000', true]]) {
  await check(`CII IBAN checksum ${iban}`, read('kosit-01.01a-cii.xml').replace('DE79000000001234567890', iban), 'valid', report => {
    assert.equal(report.findings.some(value => value.code === 'BR-DE-19' && value.severity === 'warning'), shouldWarn);
  });
}
await check('unknown unit preserves official severity override', base.replaceAll('unitCode="HUR"', 'unitCode="INVALID"'), 'valid', report => {
  assert.ok(report.findings.length > 0);
  assert.ok(report.findings.every(value => value.code === 'BR-CL-23' && value.severity === 'warning'));
});

for (const profile of [
  'urn:factur-x.eu:1p0:minimum',
  'urn:factur-x.eu:1p0:basicwl',
  `${XRECHNUNG_PROFILE}#conformant#urn:xeinkauf.de:kosit:extension:xrechnung_3.0`,
  'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_4.0',
]) {
  await check(`unsupported profile ${profile}`, base.replace(XRECHNUNG_PROFILE, profile), 'unsupported', report => {
    assert.equal(report.checks[2].status, 'not_run');
    assert.deepEqual(report.businessRuleSets, []);
  });
}
const mismatch = await validateEInvoiceXml({ xml: Buffer.from(base), expectedProfileId: EN16931_PROFILE });
assert.equal(mismatch.status, 'invalid');
assert.ok(mismatch.findings.some(value => value.code === 'PROFILE_MISMATCH'));
tests++;

await check('wrong document namespace', '<Invoice xmlns="urn:untrusted"/>', 'unsupported');
await check('malformed XML', '<Invoice>', 'invalid');
await check('empty file', Buffer.alloc(0), 'invalid');
await check('oversized file', Buffer.alloc(MAX_EINVOICE_XML_BYTES + 1, 32), 'invalid');
await check('entity expansion blocked', '<!DOCTYPE Invoice [<!ENTITY leak SYSTEM "file:///etc/passwd">]><Invoice>&leak;</Invoice>', 'invalid');
await check('external stylesheet blocked', '<?xml-stylesheet type="text/xsl" href="https://invalid.example/evil.xsl"?><Invoice/>', 'invalid');
await check('deep document blocked', '<a>'.repeat(83) + '</a>'.repeat(83), 'invalid');
await check('invalid byte encoding', Buffer.from([0xc3, 0x28]), 'invalid');
await check('contradictory encoding', base.replace('encoding="UTF-8"', 'encoding="UTF-16"'), 'invalid');
await check('schemaLocation cannot override pinned XSD', base.replace('<Invoice ', '<Invoice xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2 https://invalid.example/override.xsd" '), 'valid');
const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(base.replace('encoding="UTF-8"', 'encoding="UTF-16"'), 'utf16le')]);
const utf16Report = await check('UTF16 original byte hash', utf16, 'valid');
assert.notEqual(utf16Report.documentSha256, sha256(Buffer.from(base)));
await check('UTF16 DTD also blocked', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<!DOCTYPE a><a/>', 'utf16le')]), 'invalid');

assert.equal(comparedOracleHashes.size, oracleByHash.size, 'Every independent KoSIT oracle case must be exercised.');
console.log(`[office-einvoice-validator] ${tests} real XSD/Schematron, profile, integrity and security checks passed (${Object.keys(manifest.files).length} pinned assets, ${comparedOracleHashes.size} independent KoSIT oracle cases).`);
