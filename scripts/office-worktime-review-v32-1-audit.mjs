import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const checks = [];

function check(label, condition) {
  if (!condition) throw new Error(`✗ ${label}`);
  checks.push(label);
}

const review = read('src/lib/wfm/wfmTimeReviewService.ts');
const repository = read('src/lib/wfm/wfmWorkSessionRepository.ts');
const office = read('src/lib/wfm/wfmOfficeTimekeepingService.ts');
const migration = read('supabase/migrations/0261_wfm_time_review_atomic_repair.sql');

check('Geplante Einsätze behalten ihre autoritative Einsatz-ID', review.includes("entryId.startsWith('planned:')"));
check('Review verwendet die atomare Datenbankfunktion', review.includes("rpc('wfm_upsert_time_review'"));
check('Mitarbeitende werden über Einsätze aufgelöst', repository.includes("fromUnknownTable(supabase, 'assignments')"));
check('Mitarbeitende werden über Zeitsitzungen aufgelöst', repository.includes('reference?.entryKind === \'session\''));
check('Office reicht die Originalreferenz bis zur Prüfung durch', office.includes('rawReferenceId: reviewCtx.rawReferenceId'));
check('Review und Historie werden in einer Transaktion geschrieben',
  migration.includes('INSERT INTO public.workforce_time_entry_reviews') &&
    migration.includes('INSERT INTO public.workforce_time_review_actions'));
check('Historie verwendet den angemeldeten Benutzer', migration.includes('v_actor_id UUID := auth.uid()'));

console.log('CareSuite+ Office Arbeitszeit V32.1 Integritätsprüfung');
for (const label of checks) console.log(`✓ ${label}`);
