import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const checks = [
  ['Vier Abrechnungsmodule sind definiert', read('src/lib/office/invoiceModules.ts'), /assist[\s\S]*pflege[\s\S]*stationaer[\s\S]*beratung/],
  ['Leistungsnachweise werden nach Modul gefiltert', read('src/lib/office/invoiceCreateService.ts'), /\.eq\('product_key', billingModule\)/],
  ['Modulfremde Katalogpositionen werden abgewiesen', read('src/lib/office/invoiceCreateService.ts'), /selected\.moduleKey !== billingModule/],
  ['PDF-Vorschau ist angebunden', read('src/screens/office/InvoiceDetailScreen.tsx'), /PDF-Vorschau/],
  ['PDF-Download ist angebunden', read('src/screens/office/InvoiceDetailScreen.tsx'), /PDF herunterladen/],
  ['PDF-Pflichtangaben werden validiert', read('src/lib/office/invoicePdfService.ts'), /Vollständige Empfängeranschrift fehlt/],
];

console.log('CareSuite+ office:invoice-v31:audit');
let failed = false;
for (const [label, source, pattern] of checks) {
  const ok = pattern.test(source);
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  failed ||= !ok;
}
if (failed) process.exit(1);
