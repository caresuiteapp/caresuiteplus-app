import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildClientListKpis } from '@/lib/office/clientListStats';
import { demoClients } from '@/data/demo/clients';

const srcRoot = path.join(__dirname, '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

describe('Client UI Reality Fix', () => {
  it('ClientsListTable uses adaptive dark text on glass tables', () => {
    const table = readSrc('components/office/ClientsListTable.tsx');
    expect(table).toContain('useAuroraAdaptiveText');
    expect(table).toContain("fontWeight: '700'");
  });

  it('ClientsListHero shows compact KPI row and smaller action buttons', () => {
    const hero = readSrc('components/office/ClientsListHero.tsx');
    expect(hero).toContain('kpiRowCompact');
    expect(hero).toContain('size="sm"');
    expect(hero).toContain('variant="light"');
  });

  it('buildClientListKpis includes Gesamt, Aktiv, Entwürfe', () => {
    const kpis = buildClientListKpis(demoClients);
    expect(kpis.some((k) => k.label === 'Gesamt')).toBe(true);
    expect(kpis.some((k) => k.label === 'Aktiv')).toBe(true);
    expect(kpis.some((k) => k.label === 'Entwürfe')).toBe(true);
  });

  it('ClientsListView uses readable German empty-state copy', () => {
    const view = readSrc('components/office/ClientsListView.tsx');
    expect(view).toContain('Noch keine Klient:innen');
    expect(view).toContain('Filter zurücksetzen');
    expect(view).not.toContain('f?r');
  });

  it('Client record tabs are normalized with readable labels', () => {
    const rules = readSrc('lib/clients/clientIntakeFieldRules.ts');
    expect(rules).toContain('normalizeClientRecordTabs');
    expect(rules).toContain("leistungsbereiche: 'Leistungen & Budget'");
    expect(rules).toContain("portal: 'Portal & Freigaben'");
    expect(rules).toContain("einsaetze: 'Einsätze & Termine'");
  });

  it('ClientRecordScreen moves delete to Gefahrenzone and uses master data modal', () => {
    const record = readSrc('screens/business/office/ClientRecordScreen.tsx');
    expect(record).toContain('Gefahrenzone');
    expect(record).toContain('ClientMasterDataEditModal');
    expect(record).not.toContain('headerDelete');
  });

  it('ClientMasterDataEditModal is scrollable with sticky footer actions', () => {
    const modal = readSrc('components/office/ClientMasterDataEditModal.tsx');
    expect(modal).toContain('ScrollView');
    expect(modal).toContain('footerActions');
    expect(modal).toContain('Ungespeicherte Änderungen');
    expect(modal).toContain('CLIENT_MASTER_DATA_SECTIONS');
  });

  it('buildClientDetailKpis avoids invoice KPI labels', () => {
    const stats = readSrc('lib/office/clientDetailStats.ts');
    expect(stats).not.toContain("label: 'Rechnungen'");
    expect(stats).toContain("label: 'Offene Punkte'");
  });

  it('ClientRecordOverview includes next appointment and open items', () => {
    const overview = readSrc('lib/clients/clientRecordOverview.ts');
    const panel = readSrc('components/office/ClientRecordOverviewPanel.tsx');
    expect(overview).toContain('nextAppointment');
    expect(overview).toContain('openItemsSummary');
    expect(panel).toContain('Stammdaten-Kurzüberblick');
    expect(panel).toContain('Nächster Termin');
    expect(panel).toContain('Offene Punkte');
  });

  it('FormStepper supports clickable steps and error/completed states', () => {
    const stepper = readSrc('components/ui/FormStepper.tsx');
    expect(stepper).toContain('onStepPress');
    expect(stepper).toContain('stepStatuses');
    expect(stepper).toContain('dotError');
  });

  it('Intake wizard supports draft save, sticky footer, and activation on last step', () => {
    const form = readSrc('components/office/clientintakewizardform.tsx');
    const hook = readSrc('hooks/useClientIntakeWizard.ts');
    const screen = readSrc('screens/business/office/ClientIntakeWizardScreen.tsx');
    expect(form).toContain('Als Entwurf speichern');
    expect(form).toContain('Klient:in aktivieren');
    expect(form).toContain('onStepPress={goToStep}');
    expect(form).toContain('styles.footer');
    expect(hook).toContain('goToStep');
    expect(hook).toContain('stepStatuses');
    expect(screen).toContain('Klient:in aufnehmen');
    expect(screen).not.toContain('Kontextbasierte Aufnahme');
  });

  it('PremiumDataTable header text uses primary color on light glass', () => {
    const glass = readSrc('design/tokens/auroraGlass.ts');
    expect(glass).toContain('color: text.primary');
    expect(glass).toContain('useAuroraGlassTableStyles');
  });
});
