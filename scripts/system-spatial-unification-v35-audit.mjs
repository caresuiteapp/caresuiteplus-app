import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const checks = [];

function check(label, condition) {
  checks.push({ label, condition });
  if (!condition) process.exitCode = 1;
}

const card = read('src/components/ui/PremiumCard.tsx');
const button = read('src/components/ui/PremiumButton.tsx');
const shell = read('src/components/layout/ScreenShell.tsx');
const header = read('src/components/layout/ScreenHeader.tsx');
const breadcrumb = read('src/components/layout/BreadcrumbTrail.tsx');
const glassDom = read('src/design/web/applyLlganGlassDom.tsx');
const assignment = read('src/components/assist/AssignmentCompactCard.tsx');
const themeBridge = read('src/design/tokens/themeBridge.ts');
const legacyCard = read('src/components/ui/CareLightCard.tsx');
const legacyButton = read('src/components/ui/CareLightButton.tsx');
const legacyShell = read('src/components/layout/CareLightPageShell.tsx');

check('PremiumCard besitzt nur noch die räumliche Systemkarte',
  card.includes('spatialCareGradients.nightGlass') &&
  !card.includes('CareLightCard') &&
  !card.includes('LightLlganPremiumCard'));
check('PremiumButton besitzt nur noch eine kompakte Button-Hierarchie',
  button.includes('Eine einzige kompakte Button-Hierarchie') &&
  !button.includes('CareLightButton'));
check('ScreenShell besitzt keinen parallelen Light-/Dark-Seitenpfad',
  shell.includes('Verbindliche Seitenschale') &&
  !shell.includes('CareLightPageShell') &&
  !shell.includes('isLight'));
check('ScreenHeader bleibt auf Desktop sichtbar und räumlich lesbar',
  header.includes('spatialCare.navigation') &&
  !header.includes('desktopA11yHeader'));
check('Breadcrumbs nutzen kontrastreiche Spatial-Farben',
  breadcrumb.includes('spatialCareColors.cyanLight') &&
  breadcrumb.includes('spatialCareColors.white'));
check('Web-Glasflächen besitzen Blur und dunkle transparente Tiefe',
  glassDom.includes("setProperty('backdrop-filter', `blur(") &&
  !glassDom.includes("backdropFilter: 'none'"));
check('Assist-Aktionen wachsen nicht mehr zu riesigen Vollbreiten-Kacheln',
  assignment.includes('flexGrow: 0') &&
  !assignment.includes('actionBtn: { flex: 1'));
check('Legacy-Komponenten werden in dieselbe dunkle Designwelt überführt',
  themeBridge.includes("const mode: ColorMode = 'dark'"));
check('Direkte CareLight-Altimporte verwenden dieselben Systemkomponenten',
  legacyCard.includes('<PremiumCard') &&
  legacyButton.includes('<PremiumButton') &&
  legacyShell.includes('<ScreenShell'));

console.log('CareSuite+ System Spatial Unification Audit V35');
for (const item of checks) {
  console.log(`${item.condition ? '✓' : '✗'} ${item.label}`);
}

if (process.exitCode) {
  console.error('\nAudit fehlgeschlagen: Mindestens ein paralleler Designpfad ist wieder aktiv.');
} else {
  console.log(`\n${checks.length} verbindliche Systemregeln erfüllt.`);
}
