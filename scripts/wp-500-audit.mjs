#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { M_WP_CATALOG } from './wp-m-catalog.mjs';
import { isSubstantiveDeliverable, gradeWp } from './wp-substance.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const transcriptPath =
  'C:/Users/Kevin Reinhardt/.cursor/projects/c-Users-Kevin-Reinhardt-Documents-CareSuite/agent-transcripts/a716b39e-0b34-48d2-b973-4b78f73f0883/a716b39e-0b34-48d2-b973-4b78f73f0883.jsonl';

const transcript = JSON.parse(readFileSync(transcriptPath, 'utf8').split('\n')[0]).message.content[0]
  .text;
const re = /(\d{3})\.\s*(\d{2})\s+([^\n]+)/g;
const wps = [];
let m;
while ((m = re.exec(transcript)) !== null) {
  const full = m[3].trim();
  const dash = full.indexOf(' — ');
  wps.push({
    num: parseInt(m[1], 10),
    sec: parseInt(m[2], 10),
    topic: dash >= 0 ? full.slice(dash + 3).trim() : full,
  });
}

const topicOrder = wps.filter((w) => w.num <= 20).map((w) => w.topic);
const pos = (topic) => topicOrder.indexOf(topic) + 1;

function exists(rel) {
  return existsSync(join(root, rel.replace(/\//g, '\\')));
}

const catalogByWp = new Map(M_WP_CATALOG.map((e) => [e.wp, e]));
const deliverableCounts = {};
for (const e of M_WP_CATALOG) {
  deliverableCounts[e.deliverable] = (deliverableCounts[e.deliverable] ?? 0) + 1;
}

const DOC_MAP = {
  1: '001-fundament.md',
  2: '002-navigation.md',
  3: '003-dashboard.md',
  4: '004-list-view.md',
  5: '005-detail-view.md',
  6: '006-create-wizard.md',
  7: '007-service-layer.md',
  8: '008-hooks-state.md',
  9: '009-roles-permissions.md',
  10: '010-supabase-rls.md',
  11: '011-demo-data.md',
  12: '012-portal-view.md',
  13: '013-communication.md',
  14: '014-documents.md',
  15: '015-workflow.md',
  16: '016-billing.md',
  17: '017-ai-providers.md',
  18: '018-accessibility.md',
  19: '019-testing.md',
  20: '020-fundament-abschluss.md',
};

function catalogGrade(n) {
  const entry = catalogByWp.get(n);
  if (!entry || !exists(entry.deliverable)) return null;
  const g = gradeWp(root, entry, deliverableCounts);
  if (g.score >= 100) return 'D';
  if (g.score >= 50) return 'P';
  return 'M';
}

function audit(wp) {
  const t = pos(wp.topic);
  const sec = wp.sec;
  const n = wp.num;

  const fromCatalog = catalogGrade(n);
  if (fromCatalog === 'D') return 'D';

  if (sec === 1) {
    if (t === 19) return exists('src/__tests__/wp/wp019-fundament.test.ts') ? 'D' : 'P';
    if (t === 4) {
      return exists('docs/architecture/004-list-view.md') && exists('src/hooks/core/useListState.ts')
        ? 'D'
        : 'P';
    }
    return exists(`docs/architecture/${DOC_MAP[t]}`) ? 'D' : 'P';
  }
  if (sec === 2) {
    return exists('src/theme/colors.ts') && exists('docs/architecture/021-040-premium-designsystem.md')
      ? 'D'
      : 'P';
  }
  if (sec === 3) return exists('src/components/ui/PremiumCard.tsx') ? 'D' : 'P';
  if (sec === 4) return exists('docs/architecture/061-navigation-architecture.md') ? 'D' : 'P';

  if (sec === 5) {
    if (t === 19) return exists('src/__tests__/wp/wp099-auth.test.ts') ? 'D' : 'P';
    if (t === 10) {
      const rls = exists('src/lib/services/repositories/authRlsPolicy.ts');
      return rls && isSubstantiveDeliverable(root, 'src/lib/services/repositories/authRlsPolicy.ts')
        ? 'D'
        : rls
          ? 'P'
          : 'M';
    }
    return exists('src/lib/auth/AuthProvider.tsx') ? 'P' : 'M';
  }

  if (sec === 6) {
    if (t === 6) return exists('src/lib/onboarding/onboardingService.ts') ? 'P' : 'M';
    return exists('app/onboarding/index.tsx') ? 'P' : 'M';
  }

  if (fromCatalog === 'P') return 'P';

  if (n === 186 && exists('app/office/employees/create.tsx')) return 'P';
  if (n === 243 && exists('src/screens/assist/AssistCalendarScreen.tsx')) return 'P';
  if (n >= 161 && n <= 180 && t === 6 && exists('app/office/clients/create.tsx')) return 'P';

  const shells = {
    7: 'business',
    8: 'office',
    9: 'office/clients',
    10: 'office/employees',
    11: 'office',
    12: 'office/billing',
    13: 'assist',
    14: 'assist',
    15: 'assist',
    16: 'assist',
    17: 'portal/employee',
    18: 'portal/client',
    19: 'pflege',
    20: 'stationaer',
    21: 'beratung',
    22: 'akademie',
    23: 'office/catalogs',
    24: 'business/platform',
    25: 'business/integrations',
  };
  const shell = shells[sec];

  if (t === 1) return exists('docs/architecture') ? 'P' : 'M';
  if (t === 2) return exists(`app/${shell.split('/')[0]}`) ? 'P' : 'M';
  if (t === 3 || t === 4) return exists('src/screens') ? 'P' : 'M';
  if (t === 5) return 'P';
  if (t === 6) {
    if (sec === 9 && exists('app/office/clients/create.tsx')) return 'P';
    if (sec === 10 && exists('app/office/employees/create.tsx')) return 'P';
    return 'M';
  }
  if (t >= 7 && t <= 9) return 'P';
  if (t === 10) return 'M';
  if (t >= 11 && t <= 17) return 'M';
  if (t === 18 || t === 19) return 'M';
  if (t === 20) return 'P';
  return 'P';
}

const all = wps.filter((w) => w.num <= 500).map((w) => ({ ...w, s: audit(w) }));
const c = { D: 0, P: 0, M: 0 };
all.forEach((x) => c[x.s]++);

console.log('=== CareSuite+ Audit WP 001–500 ===\n');
console.log(`D (vollständig): ${c.D}`);
console.log(`P (teilweise):   ${c.P}`);
console.log(`M (fehlt):       ${c.M}`);
console.log(`Gesamt:          ${all.length}`);
console.log(`Katalog-Einträge: ${M_WP_CATALOG.length}\n`);

for (let sec = 1; sec <= 25; sec++) {
  const rs = all.filter((w) => w.sec === sec);
  const cc = { D: 0, P: 0, M: 0 };
  rs.forEach((r) => cc[r.s]++);
  const start = (sec - 1) * 20 + 1;
  console.log(
    `WP${String(start).padStart(3, '0')}-${String(start + 19).padStart(3, '0')}: ${rs.map((r) => r.s[0]).join('')} | D=${cc.D} P=${cc.P} M=${cc.M}`,
  );
}

const remaining = all.filter((x) => x.s === 'M');
console.log(`\nVerbleibende M (${remaining.length}):`);
remaining.forEach((x) => console.log(`  ${String(x.num).padStart(3, '0')} [pos${pos(x.topic)}] ${x.topic}`));

const full = all.filter((x) => x.s === 'D');
console.log(`\nVollständig (D) — ${full.length} Nummern:`);
console.log(full.map((x) => String(x.num).padStart(3, '0')).join(', '));
