import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const navPath = path.join(root, 'src/lib/navigation/modulenav/officenav.ts');
const navSource = readFileSync(navPath, 'utf8');
const hrefs = [...navSource.matchAll(/href:\s*'([^']+)'/g)].map((match) => match[1]);
const keys = [...navSource.matchAll(/key:\s*'([^']+)'/g)].map((match) => match[1]);
const failures = [];

const forbiddenMainScreenMarkers = [
  'Wird wiederhergestellt',
  'nach der Dateiwiederherstellung erneut verfügbar',
  'Stub —',
];

function routeCandidates(href) {
  const route = href.split('?')[0].replace(/\/$/, '') || '/';
  const relative = route.replace(/^\//, '');
  const candidates = [
    `app/${relative}.tsx`,
    `app/${relative}/index.tsx`,
  ];
  const parts = relative.split('/');
  if (parts[0] === 'office' && parts.length === 2) {
    candidates.push(`app/office/(tabs)/${parts[1]}.tsx`);
  }
  return candidates;
}

for (const href of hrefs) {
  if (!routeCandidates(href).some((candidate) => existsSync(path.join(root, candidate)))) {
    failures.push(`Navigationsziel ohne Route: ${href}`);
  }
}

const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
if (duplicateKeys.length > 0) {
  failures.push(`Doppelte Navigation-Keys: ${[...new Set(duplicateKeys)].join(', ')}`);
}

for (const obsoleteKey of ['messages-clients', 'messages-employees', 'messages-internal']) {
  if (navSource.includes(`key: '${obsoleteKey}'`)) {
    failures.push(`Doppelte Messenger-Navigation vorhanden: ${obsoleteKey}`);
  }
}

const billingSource = readFileSync(path.join(root, 'src/screens/office/OfficeBillingScreen.tsx'), 'utf8');
if (!billingSource.includes("import { InvoiceDetailModal } from '@/components/office/invoicedetailmodal'")) {
  failures.push('Rechnungsdetail-Popup ist nicht an die produktive Modal-Komponente angebunden.');
}
if (/function\s+InvoiceDetailModal[\s\S]*?return null;/.test(billingSource)) {
  failures.push('Rechnungsdetail-Popup rendert weiterhin eine leere Seite.');
}

const criticalScreens = [
  'src/screens/office/ClientDetailScreen.tsx',
  'src/screens/office/InvoiceDetailScreen.tsx',
  'src/screens/office/BudgetDetailScreen.tsx',
];
for (const file of criticalScreens) {
  const source = readFileSync(path.join(root, file), 'utf8');
  if (/if\s*\(!\w+\)\s*return null;/.test(source)) {
    failures.push(`Kritischer Detail-Screen kann leer rendern: ${file}`);
  }
}

const remainingOfficeScreens = [
  'src/screens/office/officemessagetemplatesscreen.tsx',
  'app/office/calendar/templates/index.tsx',
  'src/screens/business/office/OfficeBusinessReportingScreen.tsx',
  'src/screens/business/office/OfficeModulesHubScreen.tsx',
  'src/screens/business/office/OfficeAuditLogScreen.tsx',
  'src/screens/qm/QmDashboardScreen.tsx',
  'src/screens/inventory/InventoryDashboardScreen.tsx',
  'src/screens/office/OfficeDocumentsListScreen.tsx',
];

for (const file of remainingOfficeScreens) {
  const source = readFileSync(path.join(root, file), 'utf8');
  for (const marker of forbiddenMainScreenMarkers) {
    if (source.includes(marker)) failures.push(`Office-Bereich enthält Platzhalter „${marker}": ${file}`);
  }
}

const messageTemplates = readFileSync(
  path.join(root, 'src/screens/office/officemessagetemplatesscreen.tsx'),
  'utf8',
);
if (!messageTemplates.includes('MessageTemplatesScreen')) {
  failures.push('Nachrichten-Vorlagen verwenden nicht die produktive Vorlagenverwaltung.');
}

const reporting = readFileSync(
  path.join(root, 'src/screens/business/office/OfficeBusinessReportingScreen.tsx'),
  'utf8',
);
if (reporting.includes('<ScrollView')) {
  failures.push('Office Reporting besitzt einen verschachtelten vertikalen Scrollbereich.');
}

const officeDocuments = readFileSync(
  path.join(root, 'src/screens/office/OfficeDocumentsListScreen.tsx'),
  'utf8',
);
if (officeDocuments.includes('fetchOfficeDocumentList')) {
  failures.push('Dokumentenablage lädt die Dokumentliste doppelt.');
}

console.log('CareSuite+ office:integrity:audit');
console.log(`Navigationsziele geprüft: ${hrefs.length}`);
console.log(`Kritische Detail-Screens geprüft: ${criticalScreens.length}`);
console.log(`Übrige Office-Bereiche geprüft: ${remainingOfficeScreens.length}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}

console.log('✓ Keine doppelten Messenger-Einträge');
console.log('✓ Alle Office-Navigationsziele besitzen eine Route');
console.log('✓ Kritische Detailseiten besitzen sichtbare Fehlerzustände');
console.log('✓ Rechnungsdetail-Popup ist funktionsfähig angebunden');
console.log('✓ Vorlagen, Reporting und Organisationsbereiche enthalten keine Wiederherstellungs-Stubs');
