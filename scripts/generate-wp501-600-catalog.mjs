#!/usr/bin/env node
/**
 * Generiert M_WP_CATALOG Einträge 501–600 aus Domain-Konfiguration.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOPICS = [
  'Modul-Architektur',
  'Routen & Navigation',
  'Hauptscreen / Dashboard',
  'Listenansicht',
  'Detailansicht',
  'Create/Edit Wizard',
  'Service-Schicht',
  'Hooks & State',
  'Rollen & Berechtigungen',
  'Supabase & RLS',
  'Demo-Daten',
  'Portal-Sicht',
  'Kommunikation',
  'Dokumente & PDF',
  'Workflow & Status',
  'Abrechnung & Audit',
  'AI/OCR/API',
  'UX & Barrierefreiheit',
  'Tests & Qualitätssicherung',
  'Dokumentation & Abschluss',
];

const DOMAINS = [
  {
    start: 501,
    key: 'reporting',
    docs: '501-520-reporting',
    paths: {
      1: 'docs/architecture/501-520-reporting.md',
      2: 'app/business/reporting/index.tsx',
      3: 'src/screens/reporting/PdlCockpitScreen.tsx',
      4: 'src/screens/reporting/ReportListScreen.tsx',
      5: 'src/screens/reporting/ReportDetailScreen.tsx',
      6: 'src/screens/reporting/ReportCreateScreen.tsx',
      7: 'src/lib/reporting/reportingService.ts',
      8: 'src/hooks/usePdlCockpit.ts',
      9: 'docs/architecture/wp-509-reporting-permissions.md',
      10: 'src/lib/services/repositories/reportingRepository.supabase.ts',
      11: 'src/data/demo/reportingDemo.ts',
      12: 'app/business/reporting/portal-preview.tsx',
      13: 'src/screens/reporting/ReportingComposeMessageScreen.tsx',
      14: 'src/lib/documents/reportingDocumentService.ts',
      15: 'src/lib/reporting/reportingWorkflow.ts',
      16: 'src/lib/reporting/reportingBillingAudit.ts',
      17: 'src/lib/reporting/reportingAiExtension.ts',
      18: 'src/lib/a11y/wp501-reporting.ts',
      19: 'src/__tests__/wp/wp519-reporting.test.ts',
      20: 'docs/architecture/501-520-reporting.md',
    },
  },
  {
    start: 521,
    key: 'release',
    docs: '521-540-release',
    paths: {
      1: 'docs/architecture/wp-521-release.md',
      2: 'app/business/release/index.tsx',
      3: 'src/screens/release/ReleaseHubScreen.tsx',
      4: 'src/screens/release/ReleaseListScreen.tsx',
      5: 'src/screens/release/ReleaseDetailScreen.tsx',
      6: 'src/screens/release/ReleaseCreateScreen.tsx',
      7: 'src/lib/release/releaseService.ts',
      8: 'src/hooks/useReleaseHub.ts',
      9: 'docs/architecture/wp-529-release-permissions.md',
      10: 'src/lib/services/repositories/releaseRepository.supabase.ts',
      11: 'src/data/demo/domains/releaseDemo.ts',
      12: 'app/business/release/portal-preview.tsx',
      13: 'src/screens/release/ReleaseComposeMessageScreen.tsx',
      14: 'src/lib/documents/releaseDocumentService.ts',
      15: 'src/lib/release/releaseWorkflow.ts',
      16: 'src/lib/release/releaseBillingAudit.ts',
      17: 'src/lib/release/releaseAiExtension.ts',
      18: 'src/lib/a11y/wp538-release.ts',
      19: 'src/__tests__/wp/wp539-release.test.ts',
      20: 'docs/architecture/wp-540-release-abschluss.md',
    },
  },
  {
    start: 541,
    key: 'security',
    docs: '541-560-security',
    paths: {
      1: 'docs/architecture/wp-541-security.md',
      2: 'app/business/security/index.tsx',
      3: 'src/screens/security/SecurityHubScreen.tsx',
      4: 'src/screens/security/SecurityListScreen.tsx',
      5: 'src/screens/security/SecurityDetailScreen.tsx',
      6: 'src/screens/security/SecurityCreateScreen.tsx',
      7: 'src/lib/security/securityService.ts',
      8: 'src/hooks/useSecurityHub.ts',
      9: 'docs/architecture/wp-549-security-permissions.md',
      10: 'src/lib/services/repositories/securityRepository.supabase.ts',
      11: 'src/data/demo/domains/securityDemo.ts',
      12: 'app/business/security/portal-preview.tsx',
      13: 'src/screens/security/SecurityComposeMessageScreen.tsx',
      14: 'src/lib/documents/securityDocumentService.ts',
      15: 'src/lib/security/securityWorkflow.ts',
      16: 'src/lib/security/securityBillingAudit.ts',
      17: 'src/lib/security/securityAiExtension.ts',
      18: 'src/lib/a11y/wp558-security.ts',
      19: 'src/__tests__/wp/wp559-security.test.ts',
      20: 'docs/architecture/wp-560-security-abschluss.md',
    },
  },
  {
    start: 561,
    key: 'qa',
    docs: '561-580-qa',
    paths: {
      1: 'docs/architecture/wp-561-qa.md',
      2: 'app/business/qa/index.tsx',
      3: 'src/screens/qa/QaHubScreen.tsx',
      4: 'src/screens/qa/QaListScreen.tsx',
      5: 'src/screens/qa/QaDetailScreen.tsx',
      6: 'src/screens/qa/QaCreateScreen.tsx',
      7: 'src/lib/qa/qaService.ts',
      8: 'src/hooks/useQaHub.ts',
      9: 'docs/architecture/wp-569-qa-permissions.md',
      10: 'src/lib/services/repositories/qaRepository.supabase.ts',
      11: 'src/data/demo/domains/qaDemo.ts',
      12: 'app/business/qa/portal-preview.tsx',
      13: 'src/screens/qa/QaComposeMessageScreen.tsx',
      14: 'src/lib/documents/qaDocumentService.ts',
      15: 'src/lib/qa/qaWorkflow.ts',
      16: 'src/lib/qa/qaBillingAudit.ts',
      17: 'src/lib/qa/qaAiExtension.ts',
      18: 'src/lib/a11y/wp578-qa.ts',
      19: 'src/__tests__/wp/wp579-qa.test.ts',
      20: 'docs/architecture/wp-580-qa-abschluss.md',
    },
  },
  {
    start: 581,
    key: 'roadmap',
    docs: '581-600-roadmap',
    paths: {
      1: 'docs/architecture/wp-581-roadmap.md',
      2: 'app/business/roadmap/index.tsx',
      3: 'src/screens/roadmap/RoadmapHubScreen.tsx',
      4: 'src/screens/roadmap/RoadmapListScreen.tsx',
      5: 'src/screens/roadmap/RoadmapDetailScreen.tsx',
      6: 'src/screens/roadmap/RoadmapCreateScreen.tsx',
      7: 'src/lib/roadmap/roadmapService.ts',
      8: 'src/hooks/useRoadmapHub.ts',
      9: 'docs/architecture/wp-589-roadmap-permissions.md',
      10: 'src/lib/services/repositories/roadmapRepository.supabase.ts',
      11: 'src/data/demo/domains/roadmapDemo.ts',
      12: 'app/business/roadmap/portal-preview.tsx',
      13: 'src/screens/roadmap/RoadmapComposeMessageScreen.tsx',
      14: 'src/lib/documents/roadmapDocumentService.ts',
      15: 'src/lib/roadmap/roadmapWorkflow.ts',
      16: 'src/lib/roadmap/roadmapBillingAudit.ts',
      17: 'src/lib/roadmap/roadmapAiExtension.ts',
      18: 'src/lib/a11y/wp598-roadmap.ts',
      19: 'src/__tests__/wp/wp599-roadmap.test.ts',
      20: 'docs/architecture/wp-600-roadmap-abschluss.md',
    },
  },
];

const entries = [];
for (const domain of DOMAINS) {
  for (let i = 0; i < 20; i++) {
    const wp = domain.start + i;
    const pos = i + 1;
    entries.push({
      wp,
      topic: TOPICS[i],
      deliverable: domain.paths[pos],
    });
  }
}

const lines = entries.map(
  (e) =>
    `  { wp: ${e.wp}, topic: '${e.topic}', deliverable: '${e.deliverable}' },`,
);

const out = join(dirname(fileURLToPath(import.meta.url)), 'wp501-600-catalog.generated.mjs');
writeFileSync(
  out,
  `/** Auto-generated — run node scripts/generate-wp501-600-catalog.mjs */\nexport const WP501_600_CATALOG = [\n${lines.join('\n')}\n];\n`,
);
console.log(`Generated ${entries.length} entries → ${out}`);
