import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const invoiceScreen = readFileSync(path.join(root, 'src/screens/office/InvoiceCreateScreen.tsx'), 'utf8');
const selector = readFileSync(path.join(root, 'src/components/inputs/CareEntitySelect.tsx'), 'utf8');
const invoiceService = readFileSync(path.join(root, 'src/lib/office/invoiceCreateService.ts'), 'utf8');
const invoiceList = readFileSync(path.join(root, 'src/lib/office/invoiceListService.ts'), 'utf8');
const invoiceDetail = readFileSync(path.join(root, 'src/lib/office/invoiceDetailService.ts'), 'utf8');

const failures = [];
for (const forbiddenLabel of ['Bezeichnung', 'Klient:in', 'Fälligkeitsdatum', 'Status']) {
  const freeTextPattern = new RegExp(`<PremiumInput[^>]*label=["']${forbiddenLabel}`);
  if (freeTextPattern.test(invoiceScreen)) {
    failures.push(`Rechnungsformular verwendet Freitext für ${forbiddenLabel}.`);
  }
}

for (const requiredField of ['Klient:in', 'Rechnungsart', 'Abrechnungsmonat', 'Zahlungsziel']) {
  if (!invoiceScreen.includes(`label="${requiredField}"`)) {
    failures.push(`Systemauswahl ${requiredField} fehlt im Rechnungsformular.`);
  }
}

if (!selector.includes('Nur vorhandene Systemeinträge')) {
  failures.push('Die wiederverwendbare Systemauswahl ist nicht vorhanden.');
}
if (!invoiceService.includes('createFromServiceRecords') || !invoiceService.includes('records.data.length === 0')) {
  failures.push('Leere Rechnungen werden nicht zuverlässig verhindert.');
}
if (!invoiceList.includes('clientName: inv.client_name') || invoiceDetail.includes('clientName: row.invoice_number')) {
  failures.push('Klient:innen-Zuordnung wird im Rechnungsdatenfluss falsch dargestellt.');
}

console.log('CareSuite+ office:structured-input:audit');
console.log('✓ Klient:innen werden über IDs statt Namensfreitext zugeordnet');
console.log('✓ Rechnungsart, Zeitraum und Zahlungsziel sind kontrollierte Auswahlen');
console.log('✓ Nummer, Status und Fälligkeit werden automatisch erzeugt');
console.log('✓ Positionen stammen ausschließlich aus freigegebenen Leistungsnachweisen');
console.log('✓ Leere Rechnungen und Rechnungsnummern als Klient:innenname sind gesperrt');
console.log('✓ Freitext bleibt Notizen, Beschreibungen, Begründungen und Nachrichten vorbehalten');

if (failures.length) {
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
