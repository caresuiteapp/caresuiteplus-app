import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const manifest = JSON.parse(
  await readFile('assets/bodymap3d/v3/real-human-manifest.json', 'utf8'),
);

for (const variant of manifest.variants) {
  const result = spawnSync(
    process.execPath,
    ['scripts/render-bodymap-real-human-qa.mjs'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        BODYMAP3D_REFERENCE_VARIANT: variant.id,
      },
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Vierseitenvergleich vollständig: ${manifest.variants.length} Varianten.`);
