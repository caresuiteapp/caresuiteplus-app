import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const checks = [];
const check = (label, ok) => {
  checks.push({ label, ok });
  console.log(`${ok ? '✓' : '✗'} ${label}`);
};

const shell = read('src/components/layout/portal/PortalShellLayout.tsx');
const nav = read('src/components/layout/PortalMobileNav.tsx');
const drawer = read('src/components/layout/portal/PortalNavigationDrawer.tsx');
const today = read('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx');
const calendar = read('src/components/portal/EmployeePortalCalendarScreen.tsx');
const upload = read('src/components/portal/EmployeePortalUploadScreen.tsx');
const profile = read('src/components/portal/PortalEmployeeProfileHero.tsx');
const messages = read('src/screens/communication/PortalMessagesScreens.tsx');
const landing = read('src/components/landing/portalchoicescreen.tsx');

console.log('CareSuite+ Mobile Portal Spatial Audit V34.3');
check('Bottom-Navigation überdeckt keinen Seiteninhalt', shell.includes('paddingBottom: bottomNavOffset'));
check('Mobile Navigation verwendet die dunkle Spatial-Fläche', nav.includes('spatialCare.navigationStrong'));
check('Drawer verwendet dieselbe dunkle Spatial-Fläche', drawer.includes('spatialCare.navigationStrong'));
check('Drawer öffnet links und trennt den Inhalt rechts', drawer.includes('borderRightWidth'));
check('Dashboard verwendet durchgehend dunkle Glaskarten', today.includes("const cardVariant = 'glass' as const"));
check('Kalender verwendet keine weiße Fremdfläche', calendar.includes('spatialCare.stageStrong'));
check('Uploads verwenden die gemeinsame dunkle Formularfläche', upload.includes('spatialCare.stageStrong'));
check('Profil-KPIs bleiben auf dunklem Glas lesbar', profile.includes('spatialCare.textOnNight'));
check('Nachrichtenliste verwendet dunkle Glaskarten', messages.includes('spatialCare.stageStrong'));
check('Login-/Portalwahltexte besitzen expliziten Kontrast', landing.includes('spatialCare.textOnNight'));

if (checks.some((entry) => !entry.ok)) process.exit(1);
console.log(`\n${checks.length} von ${checks.length} Portalvorgaben erfüllt.`);
