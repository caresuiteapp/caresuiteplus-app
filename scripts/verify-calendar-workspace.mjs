import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = 'node_modules/vitest/vitest.mjs';
// Functional release checks use isolated test data and mocked service boundaries.
// The client-intake gate already runs the project type check. DOM interaction
// tests do not establish browser geometry or authenticated live-data behavior.
const groups = {
  'Web views, date restoration and profile planning interactions': [
    'calendar/assistCalendarScreenWeb.test.tsx',
    'calendar/calendarShellIdentityWeb.test.tsx',
    'calendar/calendarShellWebInteraction.test.tsx',
    'calendar/calendarViewsWebInteraction.test.tsx',
    'calendar/calendarWebViewModel.test.ts',
    'calendar/calendarWorkspaceStateWeb.test.ts',
    'calendar/assignmentProfilePlannerWebInteraction.test.tsx',
  ],
  'Calendar sources, permissions, recurring visits and status': [
    'calendar/calendarWorkspaceDataWeb.test.ts',
    'calendar/calendarSettingsWebPersistence.test.ts',
    'calendar/calendarHooksWebInteraction.test.tsx',
    'calendar/unifiedCalendar.test.ts',
    'calendar/calendarAssistRecurrenceIntegration.test.ts',
    'calendar/assistVisitCalendarRecurrence.test.ts',
    'calendar/assistOperationalCalendarEvents.test.ts',
    'calendar/assignmentCalendarStatusR13.test.ts',
    'calendar/calendarEventDisplay.test.ts',
    'office/officeCalendarEvents.test.ts',
    'office/officeCalendarRouting.test.ts',
  ],
  'Local dates, availability, multiple-day planning and plan import': [
    'calendar/calendarDayBoundaries.test.ts',
    'calendar/employeeMonthPlanning.test.ts',
    'calendar/assignmentProfileMultiDay.test.ts',
    'calendar/employeePlanAnalysis.test.ts',
    'calendar/localPlanParser.test.ts',
    'calendar/employeePlanImportWeb.test.ts',
  ],
  'Calendar writes, source receipts and form recovery': [
    'calendar/calendarWebDialogs.test.tsx',
    'calendar/calendarMeetingParticipants.test.ts',
    'calendar/calendarPlanningTemplatesWeb.test.ts',
    'calendar/calendarTemplatePickerWeb.test.tsx',
    'calendar/officeCalendarMutationTruth.test.ts',
    'calendar/officeCalendarFormRecovery.test.tsx',
    'office/officePlanningReadAndWriteReceipts.test.ts',
    'office/clientAssignmentProfilesCalendarWorkflow.test.ts',
  ],
};

const tests = Object.values(groups).flat().map(file => `src/__tests__/${file}`);
const missing = [vitest, ...tests].filter(file => !existsSync(resolve(root, file)));
if (missing.length) {
  console.error(`[calendar-release] Required project files are missing:\n${missing.map(file => `- ${file}`).join('\n')}`);
  process.exit(1);
}

for (const [label, files] of Object.entries(groups)) {
  console.log(`[calendar-release] ${label}: ${files.length} suites`);
}
const result = spawnSync(process.execPath, [vitest, 'run', '--maxWorkers=1', ...tests], {
  cwd: root,
  stdio: 'inherit',
  // The product uses German local dates. This also exercises real 23-/25-hour
  // day boundaries instead of accidentally testing every day in UTC.
  env: { ...process.env, TZ: 'Europe/Berlin' },
});
if (result.error || result.status !== 0) {
  console.error(`[calendar-release] Functional checks failed${result.error ? `: ${result.error.message}` : result.signal ? ` (${result.signal})` : ''}`);
  process.exit(result.status && result.status > 0 ? result.status : 1);
}
const databaseResult = spawnSync(process.execPath, ['--test', 'supabase/tests/calendar_meeting_participants.test.mjs'], {
  cwd: root, stdio: 'inherit',
});
if (databaseResult.error || databaseResult.status !== 0) {
  console.error('[calendar-release] Meeting participant database checks failed.');
  process.exit(databaseResult.status && databaseResult.status > 0 ? databaseResult.status : 1);
}
console.log('\n[calendar-release] Functional and isolated database checks passed. No remote data was changed. Browser layout and authenticated live workflows require separate verification.');
