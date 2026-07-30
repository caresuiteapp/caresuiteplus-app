import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('Office-Einsatzprofile → Assist-Kalender → freigegebener Einsatz', () => {
  it('stores reusable client profiles without date or start time', () => {
    const migration = read(
      'supabase/migrations/20260730090000_office_assignment_profiles_calendar_drop.sql',
    );
    const tableDefinition = migration.slice(
      migration.indexOf('CREATE TABLE IF NOT EXISTS public.client_assignment_profiles'),
      migration.indexOf('CREATE INDEX IF NOT EXISTS idx_client_assignment_profiles_client'),
    );

    expect(tableDefinition).toContain('profile_name');
    expect(tableDefinition).toContain('duration_minutes');
    expect(tableDefinition).toContain('task_titles');
    expect(tableDefinition).not.toContain('assignment_date');
    expect(tableDefinition).not.toContain('start_time');
  });

  it('creates exactly one confirmed assignment, its tasks and one calendar event atomically', () => {
    const migration = read(
      'supabase/migrations/20260730090000_office_assignment_profiles_calendar_drop.sql',
    );

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.schedule_client_assignment_profile');
    expect(migration).toContain("    'confirmed',");
    expect(migration.match(/INSERT INTO public\.assignments/g)).toHaveLength(1);
    expect(migration).toContain('INSERT INTO public.assignment_tasks');
    expect(migration.match(/INSERT INTO public\.calendar_events/g)).toHaveLength(1);
    expect(migration).toContain('ON CONFLICT (tenant_id, source_type, source_id)');
    expect(migration).toContain('bereits eingeplant');
    expect(migration).toContain('besteht zu dieser Zeit bereits ein Einsatz');
  });

  it('persists the complete Assist template configuration and creates the modern Assist visit', () => {
    const migration = read(
      'supabase/migrations/20260730193000_office_assignment_profiles_full_assist_templates.sql',
    );
    const clientPanel = read('src/components/office/ClientAssignmentProfilesPanel.tsx');

    expect(migration).toContain('task_drafts JSONB');
    expect(migration).toContain('subject_key TEXT');
    expect(migration).toContain('assignment_type_key TEXT');
    expect(migration).toContain('service_category_key TEXT');
    expect(migration).toContain('task_package_id UUID');
    expect(migration).toContain('billing_budget_source_key TEXT');
    expect(migration).toContain('risk_flag_keys JSONB');
    expect(migration).toContain('documentation_template_key TEXT');
    expect(migration).toContain('proof_template_key TEXT');
    expect(migration).toContain('INSERT INTO public.assist_visits');
    expect(migration).toContain("'confirmed'");
    expect(migration).toContain("'released'");
    expect(migration).toContain('INSERT INTO public.assist_visit_tasks');
    expect(clientPanel).toContain('useAssistAssignmentOptions');
    expect(clientPanel).toContain('loadTaskPackageItems');
    expect(clientPanel).toContain('fetchTenantServiceCatalog');
    expect(clientPanel).toContain('Einsatzvorlagen & Leistungskatalog');
  });

  it('uses drag and drop plus a time-only confirmation modal', () => {
    const planner = read(
      'src/components/calendar/OfficeAssignmentProfileCalendarPlanner.tsx',
    );
    const clientPanel = read('src/components/office/ClientAssignmentProfilesPanel.tsx');
    const calendarShell = read('src/components/calendar/CalendarPageShell.tsx');

    expect(planner).toContain('ASSIGNMENT_PROFILE_DRAG_MIME');
    expect(planner).toContain('onDragStart');
    expect(planner).toContain("window.addEventListener('dragover'");
    expect(planner).toContain("window.addEventListener('drop'");
    expect(planner).toContain('ASSIGNMENT_DROP_SELECTOR');
    expect(planner).toContain('autoScrollAssignmentProfileDrag');
    expect(planner).toContain('requestAnimationFrame(tick)');
    expect(planner).toContain('onProfileDrop');
    expect(planner).toContain('Uhrzeit festlegen');
    expect(planner).toContain('Einsatz direkt freigeben');
    expect(clientPanel).toContain('Kein Tag und keine Uhrzeit');
    expect(clientPanel).toContain('ClientAssignmentProfilesPanel');
    expect(clientPanel).toContain('Assist-Kalender');
    expect(calendarShell).toContain("config.moduleKey === 'assist'");
  });

  it('keeps the long profile form readable and scrollable on dark surfaces', () => {
    const clientPanel = read('src/components/office/ClientAssignmentProfilesPanel.tsx');
    const planner = read('src/components/calendar/OfficeAssignmentProfileCalendarPlanner.tsx');
    const modal = read('src/components/layout/platform/platformmodal.tsx');
    const actionButton = read('src/components/layout/platform/gradientmodalactionbutton.tsx');

    expect(clientPanel).not.toContain('onLightSurface');
    expect(clientPanel.match(/onDarkSurface/g)?.length).toBeGreaterThanOrEqual(8);
    expect(planner).toContain('onDarkSurface');
    expect(modal).toContain('<ScrollView');
    expect(modal).toContain('nestedScrollEnabled');
    expect(modal).toContain('showsVerticalScrollIndicator');
    expect(actionButton).toContain("'#FFFFFF'");
  });

  it('snapshots operational client context instead of treating it as decoration', () => {
    const migration = read(
      'supabase/migrations/20260730090000_office_assignment_profiles_calendar_drop.sql',
    );

    expect(migration).toContain('client_risks');
    expect(migration).toContain('upper(r.category)');
    expect(migration).toContain('Haustiere:');
    expect(migration).toContain('Schlüsselhinweis:');
    expect(migration).toContain('Interner Aktenhinweis:');
    expect(migration).toContain('operational_context');
    expect(migration).toContain("'employeeNotes'");
    expect(migration).toContain("'accessAndKeys'");
  });

  it('shows safety and access hints throughout employee execution, but not client-visible notes', () => {
    const service = read('src/lib/portal/employeePortalExecutionLiveService.ts');
    const flags = read('src/lib/portal/resolveEmployeePortalSignatureRequirement.ts');
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');

    expect(service).toContain('operational_context');
    expect(service).toContain('snapshotEmployeeNotes');
    expect(service).toContain('snapshotAccess');
    expect(service).not.toContain(
      "notesForEmployee: assignmentRow?.client_visible_notes",
    );
    expect(screen).toContain('VOR UND WÄHREND DES EINSATZES BEACHTEN');
    expect(screen).toContain('Sicherheit, Risiken und Besonderheiten');
    expect(screen).toContain('Schlüssel und Zugang');
    expect(screen.indexOf('Wichtige Einsatzhinweise')).toBeLessThan(
      screen.indexOf('{renderPhaseContent()}'),
    );
    expect(flags).toContain("requirements?.signature");
    expect(flags).toContain("requirements?.documentation");
  });
});
