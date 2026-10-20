import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const npm = 'npm';
const npx = 'npx';
const windowsShell = process.platform === 'win32';
const bodyMapTests = readdirSync('src/__tests__/pflege')
  .filter((name) => /^bodyMap.*\.test\.ts$/.test(name))
  .sort()
  .map((name) => `src/__tests__/pflege/${name}`);

const gates = [
  {
    label: 'Liquid-Command-Gesamtabnahme',
    command: npm,
    args: ['run', 'liquid-command:r5:acceptance'],
  },
  {
    label: 'BodyMap-Modelle und Mesh-Vertrag',
    command: npm,
    args: ['run', 'bodymap3d:audit'],
  },
  {
    label: 'BodyMap-Geometrie',
    command: npm,
    args: ['run', 'bodymap3d:real-human:verify-geometry'],
  },
  {
    label: 'BodyMap-Raumintegrität',
    command: npm,
    args: ['run', 'bodymap3d:real-human:verify-spatial'],
  },
  {
    label: 'BodyMap-Funktionen, Persistenz und Stationär',
    command: npx,
    args: [
      '--no-install',
      'vitest',
      'run',
      ...bodyMapTests,
      'src/__tests__/stationaer/stationaerBodyMapIntegration.test.ts',
    ],
  },
  {
    label: 'BodyMap-R7-Quellcode-Lint',
    command: npx,
    args: [
      '--no-install',
      'eslint',
      'app/bodymap-mesh-workbench.tsx',
      'src/screens/pflege/BodyMapScreen.tsx',
      'src/components/pflege/bodyMap3d/BodyMap3DViewer.native.tsx',
      'src/components/pflege/bodyMap3d/BodyMap3DViewer.web.tsx',
      'src/components/pflege/bodyMap3d/BodyMap3DViewer.types.ts',
      'src/components/pflege/bodyMap3d/ClinicalBodyModel.web.tsx',
      'src/components/pflege/bodyMap3d/ParametricBodyModel.tsx',
      'scripts/bodymap3d-audit.mjs',
      'scripts/bodymap-r7-acceptance.mjs',
      'scripts/bodymap-r7-visual-qa.mjs',
    ],
  },
];

console.log('======================================================');
console.log('CARESUITE HEALTHOS · BODYMAP R7 · VERBINDLICHE ABNAHME');
console.log('======================================================');

for (const [index, gate] of gates.entries()) {
  console.log(`\n[${index + 1}/${gates.length}] ${gate.label}`);
  const result = spawnSync(gate.command, gate.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: windowsShell,
    windowsHide: true,
  });

  if (result.error) {
    console.error(`\nABBRUCH: ${gate.label}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\nABBRUCH: ${gate.label} (Exit ${result.status ?? 'unbekannt'})`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n======================================================');
console.log('BODYMAP R7 · GESAMTABNAHME ERFOLGREICH');
console.log('======================================================');
