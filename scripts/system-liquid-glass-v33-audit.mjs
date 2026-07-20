import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const checks = [];

function check(label, condition) {
  checks.push(label);
  if (!condition) failures.push(label);
}

const tokens = read('src/design/tokens/systemLiquidGlass.ts');
const theme = read('src/design/ThemeModeProvider.tsx');
const background = read('src/components/ui/effects/globalanimatedbackground.tsx');
const moduleAccents = read('src/design/tokens/colors.ts');
const popup = read('src/design/tokens/popupShellTokens.ts');
const shell = read('src/components/layout/CareWebShell.tsx');
const concept = read('docs/design/SYSTEM-LIQUID-GLASS-UI-CONCEPT-V33.md');

check('Drei verbindliche Markenfarben sind definiert',
  tokens.includes("navy: '#061126'") &&
  tokens.includes("electricBlue: '#1478FF'") &&
  tokens.includes("white: '#F8FBFF'"));
check('Theme ist systemweit auf dark gesperrt',
  theme.includes("return 'dark'") && theme.includes("setModeState('dark')"));
check('Kein Theme-Schalter wird in der Web-Shell ausgeliefert',
  !shell.includes('ThemeModeToggle'));
check('Globaler Hintergrund nutzt System Liquid Glass',
  background.includes('DarkLiquidGlassBackground'));
check('Alle Modulakzente verwenden Electric Blue',
  ['office', 'assist', 'pflege', 'beratung', 'stationaer', 'akademie', 'qm', 'insight']
    .every((key) => moduleAccents.includes(`${key}: SYSTEM_LIQUID_COLORS.electricBlue`)));
check('Popup-Shell besitzt keine zweite helle Designwelt',
  popup.includes('light: canonicalPopupColors') &&
  popup.includes('dark: canonicalPopupColors') &&
  popup.includes('return canonicalPopupColors'));
check('Verbindliches Konzept deckt Produkte und Portale ab',
  ['Office', 'Assist', 'Pflege', 'Stationär', 'Beratung', 'Akademie',
   'Klient:innen-', 'Mitarbeitenden-', 'Angehörigenportal']
    .every((name) => concept.includes(name)));

const forbidden = ['#FF7A1A', '#FF9500', '#8B5CF6', '#EC4899', '#D946EF', '#06B6D4', '#7C3AED', '#A855F7'];
const centralFiles = [
  'src/design/tokens/colors.ts',
  'src/design/tokens/galaxy.ts',
  'src/design/tokens/auroraGlass.ts',
  'src/design/tokens/themeBridge.ts',
  'src/design/tokens/popupShellTokens.ts',
  'src/design/tokens/motion.ts',
  'src/lib/navigation/mainModuleAccent.ts',
];
check('Zentrale Designquellen enthalten keine alte Modul- oder Aurora-Farbe',
  centralFiles.every((file) => forbidden.every((color) => !read(file).toUpperCase().includes(color))));

function collectRuntimeFiles(directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return [];
      return collectRuntimeFiles(relative);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}

const runtimeUiFiles = [
  ...collectRuntimeFiles('app'),
  ...collectRuntimeFiles('src/components'),
  ...collectRuntimeFiles('src/screens'),
  ...collectRuntimeFiles('src/design'),
];
check('Laufzeit-UI enthält keine alte Modul-, Orange-, Pink- oder Violett-Markenfarbe',
  runtimeUiFiles.every((file) => {
    const source = read(file).toUpperCase();
    return forbidden.every((color) => !source.includes(color));
  }));

console.log('CareSuite HealthOS system-liquid-glass-v33:audit');
for (const label of checks) {
  console.log(`${failures.includes(label) ? '✗' : '✓'} ${label}`);
}

if (failures.length) {
  console.error(`\n${failures.length} Designregel(n) verletzt.`);
  process.exit(1);
}

console.log('\nEine Designwelt ist technisch verbindlich abgesichert.');
