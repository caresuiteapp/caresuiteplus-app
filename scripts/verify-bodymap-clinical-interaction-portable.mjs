import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

function includesAll(value, fragments, label) {
  for (const fragment of fragments) {
    assert.ok(value.includes(fragment), `${label}: "${fragment}" fehlt.`);
  }
}

const [
  packageJson,
  viewer,
  parametricModel,
  screen,
  catalog,
  repository,
  clinicalService,
  migration,
  stationaerHub,
  stationaerRoute,
  stationaerNavigation,
  residentDetail,
] = await Promise.all([
  source('package.json'),
  source('src/components/pflege/bodyMap3d/BodyMap3DViewer.web.tsx'),
  source('src/components/pflege/bodyMap3d/ParametricBodyModel.tsx'),
  source('src/screens/pflege/BodyMapScreen.tsx'),
  source('src/lib/pflege/bodyMap3d/clinicalInteractionCatalog.ts'),
  source('src/lib/pflege/bodyMapRepository.supabase.ts'),
  source('src/lib/pflege/bodyMapClinicalService.ts'),
  source('supabase/migrations/20260726094500_bodymap_clinical_interaction_phase9.sql'),
  source('src/screens/stationaer/StationaerBodyMapHubScreen.tsx'),
  source('app/stationaer/bewohner/[id]/bodymap.tsx'),
  source('src/lib/navigation/moduleNav/stationaerNav.ts'),
  source('src/screens/stationaer/ResidentDetailScreen.tsx'),
]);

const meshFiles = (await readdir(resolve(root, 'public/bodymap3d/v2')))
  .filter((file) => file.endsWith('-v2.glb'));
assert.equal(meshFiles.length, 30, 'Die Mesh-Matrix muss 30 technische GLB-Varianten enthalten.');

includesAll(viewer, [
  'allowTechnicalMeshPreview',
  'TECHNISCHE REFERENZ · NICHT MEDIZINISCH FREIGEGEBEN',
], 'Web-Viewer');
includesAll(parametricModel, [
  'function PulsingFindingMarker',
  '#ffd21f',
  'useFrame',
], '3D-Befundpunkt');
includesAll(screen, [
  "careContext = 'pflege'",
  "careContext?: 'pflege' | 'stationaer'",
  '<PulsingFindingDot',
  'resolveAnatomicalCandidates',
  'recommendedFindingDefinitions',
], 'Gemeinsamer Bodymap-Screen');
assert.ok(!screen.includes('Red X'), 'Der Bodymap-Screen enthält noch einen roten X-Marker.');

const findingCount = (catalog.match(/\bid:\s*'[^']+'/g) ?? [])
  .filter((entry) => !entry.includes('anatomical')).length;
assert.ok(findingCount >= 16, 'Der klinische Katalog enthält weniger als 16 Einträge.');
includesAll(catalog, [
  'buildClinicalLocationSnapshot',
  'markerMatchesModelSelection',
  'pressureRelevant',
  'sensitiveArea',
], 'Klinischer Interaktionskatalog');

includesAll(repository, [
  'resident_record_id',
  'subject_type',
  'subject_id',
  ".eq('subject_type', subjectType)",
  ".eq('subject_id', clientId)",
], 'Bodymap-Repository');
includesAll(clinicalService, [
  'record_body_map_finding_progress',
  "'subjects'",
  "'resident'",
  'BODY_MAP_CLINICAL_MEDIA_MAX_BYTES',
  'validateBodyMapClinicalMediaUpload',
], 'Klinischer Bodymap-Service');

includesAll(migration, [
  "subject_type IN ('client', 'resident')",
  'body_map_markers_subject_reference_check',
  'record_body_map_finding_progress',
  'SECURITY INVOKER',
  'append_pressure_injury_assessment_history_trigger',
  "(storage.foldername(name))[4] = 'resident'",
], 'Phase-9-Migration');
assert.ok(!/\b(?:DROP|TRUNCATE)\s+TABLE\b/i.test(migration), 'Migration enthält Tabellenlöschung.');

includesAll(stationaerHub, [
  'useResidentList',
  'Alle 30 technischen Körpervarianten',
  '/stationaer/bewohner/',
], 'Stationär-Hub');
includesAll(stationaerRoute, [
  '@/screens/pflege/BodyMapScreen',
  'careContext="stationaer"',
], 'Bewohner-Bodymap-Route');
assert.ok(
  stationaerNavigation.includes("href: '/stationaer/bodymap'"),
  'Stationär-Navigation enthält keinen Bodymap-Einstieg.',
);
assert.ok(residentDetail.includes('/bodymap'), 'Bewohnerakte enthält keinen Bodymap-Einstieg.');

const scripts = JSON.parse(packageJson).scripts;
assert.equal(
  scripts['bodymap3d:clinical:verify-portable'],
  'node scripts/verify-bodymap-clinical-interaction-portable.mjs',
);

console.log('Plattformneutrale Phase-9-Prüfung bestanden.');
console.log('30 GLB-Varianten · Pflege + Stationär · 16 klinische Befundarten');
console.log('Gelber Pulsmarker · Dekubitus · Fotos · atomarer Verlauf');
console.log('Client-/Resident-Trennung · additive Migration · keine Tabellenlöschung');
