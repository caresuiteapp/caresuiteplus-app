#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const STUB_MARKERS = [
  'supabaseRepositoryStub',
  "status: 'stub'",
  'status: "stub"',
  'STUB ONLY',
  'Live-Modus nicht konfiguriert',
];

export function readDeliverableContent(root, relPath) {
  const full = join(root, relPath.replace(/\//g, '\\'));
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
}

export function isTrivialTest(content) {
  if (!content.includes('vitest')) return false;
  const hasRealAssert =
    content.includes('enforcePermission') ||
    content.includes('.from(') ||
    content.includes('fetch') ||
    content.includes('validate') ||
    content.includes('workflow') ||
    content.includes('ServiceResult') ||
    content.includes('expect(result') ||
    content.includes('expect(data') ||
    content.includes('recordCount') ||
    content.includes('toBeGreaterThan');
  if (hasRealAssert) return false;
  return /expect\(\d+\)\.toBe\(\d+\)/.test(content);
}

/** @returns {'REAL'|'STUB'|'GENERIC'|'TEST_STUB'|'DOC'|'MISSING'} */
export function classifyDeliverable(root, relPath) {
  const content = readDeliverableContent(root, relPath);
  if (content === null) return 'MISSING';

  if (relPath.endsWith('.md')) {
    return content.trim().length >= 120 ? 'DOC' : 'STUB';
  }

  if (isTrivialTest(content)) return 'TEST_STUB';

  if (STUB_MARKERS.some((m) => content.includes(m))) return 'STUB';

  if (content.includes('createTenantTableRepository')) return 'REAL';
  if (content.includes('MessageComposeScreenShell') && content.includes('export function')) return 'REAL';
  if (content.includes('vitest') && content.includes('enforcePermission')) return 'REAL';
  if (content.includes('runPermissionMatrix') && content.includes('enforcePermission')) return 'REAL';
  if (content.includes('AUTH_RLS_POLICIES') && content.includes('getPoliciesForTable')) return 'REAL';
  if (content.includes('isClientRepositoryAvailable') && content.includes('getSupabaseClient')) return 'REAL';
  if (content.includes('createCatalog') && content.includes('ScreenShell') && content.includes('export function')) {
    return 'REAL';
  }

  if (content.includes("status: 'complete'") || content.includes('WP_COMPLETION')) {
    return 'REAL';
  }

  if (content.includes('.from(') && content.includes('getSupabaseClient')) return 'REAL';
  if (content.includes('export async function fetch') && content.includes('enforcePermission')) {
    return 'REAL';
  }
  if (content.includes('export async function create') && content.includes('enforcePermission')) {
    return 'REAL';
  }
  if (/wpNumber:\s*\d+/.test(content) && content.includes('listDocuments')) return 'REAL';
  if (/wpNumber:\s*\d+/.test(content) && content.includes('getActions')) return 'REAL';
  if (/wpNumber:\s*\d+/.test(content) && content.includes('records:')) return 'REAL';
  if (content.includes('createDomainA11yMeta') && content.includes('export const wp')) return 'REAL';
  if (content.includes('ScreenShell') && content.includes('export function')) return 'REAL';
  if (content.includes('export function use') && content.includes('useAuth')) return 'REAL';
  if (relPath.includes('_layout.tsx') || relPath.includes('app/')) return 'REAL';
  if (content.includes('RequireAuth') || content.includes('Stack')) return 'REAL';

  if (content.includes('DomainCreateScreen') || content.includes('createDemoEntity(')) {
    if (
      content.includes('CreateService') ||
      content.includes('createAppointment') ||
      content.includes('createInvoice') ||
      content.includes('createClient') ||
      content.includes('createEmployee') ||
      content.includes('createReportDraft') ||
      content.includes('createRelease') ||
      content.includes('createSecurityItem') ||
      content.includes('createQaEntry') ||
      content.includes('createRoadmapEntry')
    ) {
      return 'REAL';
    }
    return 'GENERIC';
  }

  if (
    content.includes('createBillingAuditTrail(') ||
    content.includes('createAiExtension(') ||
    content.includes('createDocumentService(') ||
    content.includes('createDomainWorkflow(') ||
    content.includes('createDomainDemo(')
  ) {
    return 'REAL';
  }

  if (content.length > 500 && content.includes('export')) return 'REAL';

  return content.length > 280 ? 'GENERIC' : 'STUB';
}

/** @returns {number} 0–100 completion score */
export function scoreDeliverableKind(kind, shareCount = 1) {
  if (kind === 'MISSING') return 0;
  if (kind === 'STUB') return 25;
  if (kind === 'TEST_STUB') return 55;
  if (kind === 'GENERIC') return 70;
  if (kind === 'DOC') {
    if (shareCount <= 1) return 100;
    if (shareCount === 2) return 85;
    return 60;
  }
  if (kind === 'REAL') {
    if (shareCount <= 1) return 100;
    if (shareCount === 2) return 90;
    if (shareCount <= 4) return 80;
    return 65;
  }
  return 50;
}

/** @returns {'D-FULL'|'P/LITE'|'M'} */
export function gradeLabelFromScore(score) {
  if (score >= 100) return 'D-FULL';
  if (score >= 50) return 'P/LITE';
  return 'M';
}

export function gradeWp(root, entry, deliverableCounts) {
  const kind = classifyDeliverable(root, entry.deliverable);
  const shareCount = deliverableCounts[entry.deliverable] ?? 1;
  const score = scoreDeliverableKind(kind, shareCount);
  return {
    wp: entry.wp,
    kind,
    shareCount,
    score,
    grade: gradeLabelFromScore(score),
  };
}

export function isSubstantiveDeliverable(root, relPath) {
  const kind = classifyDeliverable(root, relPath);
  return kind === 'REAL' || kind === 'DOC';
}

// CLI: node scripts/wp-substance.mjs --report
if (process.argv[1]?.includes('wp-substance')) {
  const args = process.argv.slice(2);
  if (args.includes('--report')) {
    import('./wp-m-catalog.mjs').then(({ M_WP_CATALOG }) => {
      const counts = {};
      for (const e of M_WP_CATALOG) counts[e.deliverable] = (counts[e.deliverable] ?? 0) + 1;
      const kinds = {};
      let total = 0;
      for (const e of M_WP_CATALOG) {
        const g = gradeWp(root, e, counts);
        kinds[g.kind] = (kinds[g.kind] ?? 0) + 1;
        total += g.score;
      }
      console.log('=== WP Substance Report (600) ===');
      console.log('Kinds:', kinds);
      console.log(`Average score: ${(total / M_WP_CATALOG.length).toFixed(1)}%`);
      const below = M_WP_CATALOG
        .map((e) => gradeWp(root, e, counts))
        .filter((g) => g.score < 100);
      console.log(`Below 100%: ${below.length}`);
      below.slice(0, 15).forEach((g) =>
        console.log(`  WP${String(g.wp).padStart(3, '0')}: ${g.score}% (${g.kind}, share=${g.shareCount})`),
      );
    });
  }
}
