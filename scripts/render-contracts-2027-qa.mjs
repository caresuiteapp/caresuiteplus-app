// Local synthetic fixtures only; uses the same PDF renderer as the Web catalogue.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve(process.argv[2] || 'tmp/contracts-2027-qa');
await mkdir(output, { recursive: true });
const bundle = resolve(output, 'render.cjs');
await build({ stdin: { contents: `export { CENTRAL_DOCUMENT_CATALOG } from './src/data/seeds/documentCatalog/centralCatalog';
export { createCentralSnapshot } from './src/lib/documents/centralCatalogModel';
export { renderCentralDocumentPdf } from './src/lib/documents/centralCatalogPdf';
export { INTAKE_DOCUMENT_TEMPLATES_2027 } from './src/features/intakeDocuments/intakeDocumentTemplates2027';
export { renderIntakeDocumentHtml } from './src/features/intakeDocuments/renderIntakeDocumentPreview';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', outfile: bundle });
const { CENTRAL_DOCUMENT_CATALOG, createCentralSnapshot, renderCentralDocumentPdf, INTAKE_DOCUMENT_TEMPLATES_2027, renderIntakeDocumentHtml } = (await import(pathToFileURL(bundle).href)).default;
const context = { tenantId: '11111111-1111-4111-8111-111111111111', entityId: '22222222-2222-4222-8222-222222222222', target: 'client',
  company: { name: 'Pflege am Musterpark GmbH', address: 'Musterallee 12\n10115 Berlin', phone: '030 000000', email: 'kontakt@example.invalid' },
  subject: { name: 'Erika Musterperson', address: 'Beispielweg 24\n10117 Berlin', birthDate: '1950-01-01', insuranceNumber: 'TEST123456', careLevel: '2' },
  representative: {}, employee: {}, payor: { name: 'Beispiel Pflegekasse' }, sourceFetchedAt: '2026-10-21T12:00:00Z' };
const results = [];
for (const definition of CENTRAL_DOCUMENT_CATALOG.filter(d => d.edition === '2027')) {
  const snapshot = createCentralSnapshot(definition, context, 'Anna Beispiel', '33333333-3333-4333-8333-333333333333');
  for (const f of definition.fields) if (!snapshot.values[f.key]) snapshot.values[f.key] = `Synthetische Prüfangabe: ${f.label}. Einzelheiten wurden im persönlichen Gespräch am 21.10.2026 besprochen und festgehalten.`;
  snapshot.values.date = '2027-01-04';
  if (definition.layout === 'letter') Object.assign(snapshot.values, { subjectName: context.subject.name, subjectAddress: context.subject.address, reference: 'TEST-2027-01', enclosures: 'Vertragsunterlagen vom 04.01.2027' });
  const result = renderCentralDocumentPdf(snapshot);
  await writeFile(resolve(output, `${definition.key}.pdf`), result.bytes);
  results.push({ key: definition.key, title: definition.title, pages: result.pageCount, sha256: result.hash });
}
for (const template of INTAKE_DOCUMENT_TEMPLATES_2027) {
  const values = { 'tenant.name': context.company.name, 'tenant.street': 'Musterallee 12', 'tenant.zip': '10115', 'tenant.city': 'Berlin',
    'client.full_name': context.subject.name, 'client.date_of_birth': '01.01.1950', 'client.street': 'Beispielweg 24', 'client.zip': '10117', 'client.city': 'Berlin',
    'document.date': '04.01.2027', 'document.location': 'Berlin', 'cost_carrier.primary_name': 'Beispiel Pflegekasse', 'client.insurance_number': 'TEST123456',
    'legal.service_labels': 'Alltagsbegleitung, Betreuung und Begleitung', 'legal.signer.name': 'Erika Musterperson', 'legal.employee.name': 'Anna Beispiel',
    'legal.signer.capacity': 'Die betreute Person selbst', 'legal.signer.authority_text': 'Die betreute Person erklärt selbst.', 'contract.service_start': '04.01.2027' };
  for (const [key, field] of Object.entries(template.placeholderSchema)) if (!values[key]) values[key] = `Konkrete Prüfangabe: ${field.label}. Vereinbart am 04.01.2027.`;
  const html = renderIntakeDocumentHtml(template, values, {});
  await writeFile(resolve(output, `${template.templateKey}.html`), html.html);
}
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ synthetic: true, catalogue: results, intakeHtmlCount: INTAKE_DOCUMENT_TEMPLATES_2027.length }, null, 2));
console.log(JSON.stringify({ output, pdfs: results.length, pages: results.reduce((sum, row) => sum + row.pages, 0), intakeHtml: INTAKE_DOCUMENT_TEMPLATES_2027.length }));
