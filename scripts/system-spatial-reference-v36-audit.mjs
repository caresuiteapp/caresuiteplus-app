import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['räumliches CareSuite-Motiv ist zentral vorhanden', 'src/components/ui/SpatialScene.tsx', ['spatial-scene', 'platform', 'building', 'lightLine']],
  ['Seitenkopf zeigt das räumliche Motiv', 'src/components/layout/ScreenHeader.tsx', ['SpatialScene', 'CareSuite+ HealthOS']],
  ['Seitenschale besitzt eine helle Pearl-Arbeitsfläche', 'src/components/layout/ScreenShell.tsx', ['LinearGradient', "rgba(225,220,237,0.97)"]],
  ['Karten unterstützen Pearl und Night', 'src/design/components/GlassCard.tsx', ["'pearl' | 'night'", 'variant === \'night\'']],
  ['Portal- und Login-Auswahl nutzt die Night-Bühne', 'src/components/landing/portalchoicescreen.tsx', ['variant="night"', 'SpatialScene']],
  ['Portale nutzen dieselbe Pearl-Arbeitsfläche', 'src/components/layout/portal/PortalShellLayout.tsx', ['spatialCare.radius.stage', 'rgba(238,234,245,0.98)']],
  ['Module behalten eigene Akzente', 'src/design/tokens/spatialCareSuite.ts', ['office:', 'assist:', 'pflege:', 'beratung:']],
  ['DOM-Oberflächen werden zentral auf Pearl abgebildet', 'src/design/web/applyLlganGlassDom.tsx', ["kind === 'card'", "kind === 'modal'", "rgba(252,250,253,.96)"]],
];

let failed = false;
console.log('CareSuite+ Spatial Reference Audit V36');
for (const [label, file, needles] of checks) {
  const source = read(file);
  const missing = needles.filter((needle) => !source.includes(needle));
  if (missing.length) {
    failed = true;
    console.error(`✗ ${label}: ${file} vermisst ${missing.join(', ')}`);
  } else {
    console.log(`✓ ${label}`);
  }
}

if (failed) process.exit(1);
console.log('✓ Eine gemeinsame Bühne, räumliche Szene und Pearl-Arbeitsfläche sind verbindlich.');
