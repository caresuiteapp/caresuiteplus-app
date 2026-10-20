import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { AGE_REFERENCE_VARIANTS } from './lib/bodymap-age-reference-glb.mjs';

const root = process.cwd();
for (const configuration of AGE_REFERENCE_VARIANTS) {
  execFileSync(
    process.execPath,
    [resolve(root, 'scripts/render-bodymap-adult-male-reference-qa.mjs')],
    {
      cwd: root,
      env: {
        ...process.env,
        BODYMAP3D_REFERENCE_VARIANT: configuration.id,
      },
      stdio: 'inherit',
    },
  );
}

console.log('Phase-7-Altersvergleich vollständig gerendert.');
console.log(`Modelle: ${AGE_REFERENCE_VARIANTS.length}/8`);
console.log(`Ansichten: ${AGE_REFERENCE_VARIANTS.length * 4}/32`);
console.log('Medizinische Freigabe: NEIN');
