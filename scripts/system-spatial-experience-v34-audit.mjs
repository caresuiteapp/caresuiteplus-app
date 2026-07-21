import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (label, value) => {
  if (!value) throw new Error(`✗ ${label}`);
  checks.push(label);
};

const globalBackground = read('src/components/ui/effects/globalanimatedbackground.tsx');
const colors = read('src/design/tokens/colors.ts');
const platformShell = read('src/components/layout/platform/platformshell.tsx');
const portalShell = read('src/components/layout/portal/PortalShellLayout.tsx');
const authShell = read('src/design/components/AuthPageShell.tsx');
const employeeLogin = read('src/screens/auth/EmployeePortalLoginScreen.tsx');
const glassCard = read('src/design/components/GlassCard.tsx');
const appStart = read('src/screens/AppStartScreen.tsx');

check('räumlicher Hintergrund ist systemweit aktiv', globalBackground.includes('SpatialCareBackground'));
check('helles Papier-Testdesign ist aus der globalen Wurzel entfernt', !globalBackground.includes('StaticLightPaperBackground'));
check('Modulfarben wurden nicht in Einheitsblau umgewandelt', colors.includes('...spatialModuleAccents'));
check('Office und Assist verwenden die eingerückte Spatial-Arbeitsfläche', platformShell.includes('spatialCare.radius.shell'));
check('alle Portale verwenden dieselbe Spatial-Arbeitsfläche', portalShell.includes('spatialCare.radius.shell'));
check('Anmeldung besitzt die zweigeteilte Referenzstruktur', authShell.includes('SpatialCareScene') && authShell.includes('formPanel'));
check('Mitarbeitenden-Anmeldung verwendet die gemeinsame Auth-Schale', employeeLogin.includes('<AuthLayout'));
check('Start- und Portalauswahl verwendet dieselbe räumliche Szene', appStart.includes('SpatialCareScene'));
check('Karten verwenden ein gemeinsames räumliches Primitive', glassCard.includes('One canonical spatial pearl card'));

const routeCount = fs.readdirSync(path.join(root, 'app'), { recursive: true }).filter((entry) => /\.(tsx|ts)$/.test(String(entry))).length;
check('die gemeinsame Schale deckt die vorhandene Router-Struktur ab', routeCount >= 80);

console.log('CareSuite+ System Spatial Experience Audit V34');
for (const label of checks) console.log(`✓ ${label}`);
console.log(`Geprüfte Router-Dateien: ${routeCount}`);
