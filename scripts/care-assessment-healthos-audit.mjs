#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['Pflege nutzt gemeinsamen Fachkern','app/pflege/sis/index.tsx',/CareAssessmentListScreen/],
  ['Stationär nutzt gemeinsamen Fachkern','app/stationaer/assessment/index.tsx',/CareAssessmentListScreen/],
  ['Nur aktive Pflegeklient:innen','src/screens/careAssessment/CareAssessmentWorkspaceScreen.tsx',/fetchEligibleCareClients/],
  ['Keine generische Assist-Liste','src/screens/careAssessment/CareAssessmentWorkspaceScreen.tsx',/^(?![\s\S]*useClientList)[\s\S]*$/],
  ['Live-Bewohner:innen','src/screens/careAssessment/CareAssessmentWorkspaceScreen.tsx',/useResidentList/],
  ['Sechs Themenfelder','src/types/modules/careAssessment.ts',/cognition_communication[\s\S]*living_environment/],
  ['Transaktionales Speichern','supabase/migrations/20260726140000_care_assessment_healthos.sql',/save_care_assessment[\s\S]*FOR UPDATE[\s\S]*DELETE FROM public\.care_assessment_topics/],
  ['Serverseitige Freigabe','supabase/migrations/20260726140000_care_assessment_healthos.sql',/transition_care_assessment[\s\S]*topic_count < 6/],
  ['Versionsschutz','supabase/migrations/20260726140000_care_assessment_healthos.sql',/protect_approved_care_assessment/],
  ['RLS Mandantenschutz','supabase/migrations/20260726140000_care_assessment_healthos.sql',/ENABLE ROW LEVEL SECURITY[\s\S]*current_tenant_id/],
  ['Altbestand bleibt erhalten','supabase/migrations/20260726140000_care_assessment_healthos.sql',/assessment_runs[\s\S]*legacy_payload/],
  ['Altbestand nur aus Pflege','supabase/migrations/20260726140000_care_assessment_healthos.sql',/client_module_assignments[\s\S]*module_key = 'pflege'/],
  ['Datenbankgrenze Pflege','supabase/migrations/20260808170000_premium_sis_pfleger_boundary.sql',/is_active_pfleger_client[\s\S]*module_key = 'pflege'/],
  ['Nur produktiv aktive Pflegefälle','supabase/migrations/20260808170000_premium_sis_pfleger_boundary.sql',/is_active_pfleger_client[\s\S]*c\.status = 'active'::public\.client_status[\s\S]*list_pfleger_clients[\s\S]*c\.status = 'active'::public\.client_status/],
  ['Assist-Übernahme gesperrt','supabase/migrations/20260808170000_premium_sis_pfleger_boundary.sql',/Assist-Klient:innen werden nicht übernommen/],
  ['Pflege-RPC statt Sammelliste','src/lib/careAssessment/careAssessmentRepository.supabase.ts',/rpc\('list_pfleger_clients'\)/],
  ['Evaluation und Versionierung','src/lib/careAssessment/careAssessmentRepository.supabase.ts',/care_assessment_evaluations[\s\S]*care_assessment_versions/],
  ['Ambulant: Haushaltsführung','src/screens/careAssessment/CareAssessmentWorkspaceScreen.tsx',/Haushaltsführung/],
  ['Keine Demo-Klient:innen im SIS-Formular','src/screens/pflege/SisFormScreen.tsx',/CareAssessmentWorkspaceScreen/],
];
let failed = 0;
for (const [label,file,pattern] of checks) {
  const ok = pattern.test(read(file));
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`\n✓ ${checks.length} Care-Assessment-Prüfungen bestanden.`);
