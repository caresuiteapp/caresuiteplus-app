import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { birthdayAgeInYear } from '@/lib/calendar/assistCalendarOperationalEvents';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('Kalender Workspace R6', () => {
  it('berechnet das Alter für Geburtstage im jeweiligen Kalenderjahr', () => {
    expect(birthdayAgeInYear('1955-08-18', 2026)).toBe(71);
    expect(birthdayAgeInYear('2000-12-31', 2030)).toBe(30);
    expect(birthdayAgeInYear('', 2026)).toBe(0);
  });

  it('hält Zeitraum und Monatsüberschrift mit festem Kontrast lesbar', () => {
    const toolbar = read('src/components/calendar/CalendarToolbar.tsx');
    const month = read('src/components/office/calendar/OfficeCalendarMonthView.tsx');
    expect(toolbar).toContain("periodTitle: {");
    expect(toolbar).toContain("color: '#FFFFFF'");
    expect(toolbar).toContain('fontSize: 28');
    expect(month).toContain("color: '#0B1F3A'");
  });

  it('gruppiert Einsatzprofile nach Mitarbeitenden und klappt sie gezielt auf', () => {
    const planner = read('src/components/calendar/OfficeAssignmentProfileCalendarPlanner.tsx');
    expect(planner).toContain('employeeGroups');
    expect(planner).toContain('expandedEmployees');
    expect(planner).toContain('toggleEmployee');
    expect(planner).toContain('Mitarbeitende, Klient:in oder Profil suchen');
  });

  it('ersetzt den elfteiligen Eintragsflow durch einen kompakten, funktionalen Ablauf', () => {
    const modal = read('src/components/calendar/CalendarEventCreateModal.tsx');
    const form = read('src/components/calendar/CalendarEventForm.tsx');
    expect(modal).toContain("['template', 'basics', 'datetime', 'visibility', 'preview']");
    expect(modal).toContain('onChooseCalendarEntry={goNext}');
    expect(form).toContain('Was möchten Sie planen?');
    expect(form).toContain('Kalendereintrag anlegen →');
    expect(form).toContain('Einsatz-Wizard öffnen →');
  });

  it('liefert eine große strukturierte Einstellungsoberfläche und einen Live-Marker', () => {
    const settings = read('src/components/office/calendar/OfficeCalendarSettingsModal.tsx');
    const shell = read('src/components/calendar/CalendarPageShell.tsx');
    expect(settings).toContain('maxWidth={980}');
    expect(settings).toContain('ChoiceCard');
    expect(settings).toContain('NumberStepper');
    expect(shell).toContain("healthosCalendarRevision: 'r6'");
  });
});
