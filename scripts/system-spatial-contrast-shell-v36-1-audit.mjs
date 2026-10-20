import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const checks = [];

function check(label, condition) {
  if (!condition) throw new Error(`Audit fehlgeschlagen: ${label}`);
  checks.push(label);
}

const auroraGlass = read('src/design/tokens/auroraGlass.ts');
const healthOsPage = read('src/components/healthos/HealthOSPage.tsx');
const webSurface = read('src/design/web/lightLiquidGlassSurfaceCss.ts');
const appLayout = read('app/_layout.tsx');
const portalCards = [
  'src/components/portal/EmployeePortalAssignmentCard.tsx',
  'src/components/portal/ClientPortalAssignmentCard.tsx',
  'src/components/portal/EmployeePortalAssignmentPreviewSheet.tsx',
  'src/components/portal/ClientPortalAssignmentPreviewSheet.tsx',
].map(read).join('\n');
const platformControls = [
  'src/components/layout/platform/PlatformProfileMenu.tsx',
  'src/components/layout/platform/PlatformContextSearch.tsx',
].map(read).join('\n');

check('dunkle und helle Oberflächen besitzen getrennte Tokens', auroraGlass.includes('isLight ? lightLiquidGlass : auroraGlass'));
check('dunkle Flächen verwenden die zentrale lesbare Textfarbe', auroraGlass.includes('systemLiquidGlass.text.primary'));
check('HealthOS-Seiten erzeugen keinen verschachtelten Scrollbereich', !healthOsPage.includes('<ScrollView'));
check('Web-Glasflächen vererben Textfarben an Eingaben und Buttons', webSurface.includes('input, textarea, select, button') && webSurface.includes('color: inherit;'));
check('alte schwarze Inline-Texte erhalten eine lesbare Kompatibilitätsfarbe', webSurface.includes('[style*="color: rgb(0, 0, 0)"]'));
check('globale Text-Fallbacks werden beim App-Start installiert', appLayout.includes('installSystemTextDefaults()'));
check('Portal-Karten verwenden keine helle Text-Tokenwelt auf dunklen Flächen', !portalCards.includes('lightSurfaceText'));
check('Plattform-Bedienelemente erzwingen kein Schwarz', !platformControls.includes("color: '#000000'"));

console.log('CareSuite+ System Spatial Contrast Shell V36.1');
for (const label of checks) console.log(`✓ ${label}`);
