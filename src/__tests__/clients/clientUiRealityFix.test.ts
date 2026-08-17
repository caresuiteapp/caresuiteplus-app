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
  it('ClientsListTable uses the HealthOS workspace surface and readable contrast tokens', () => {
    const table = readSrc('components/office/ClientsListTable.tsx');
    expect(table).toContain('ClientWorkspacePanel');
    expect(table).toContain('careSuiteAuroraTheme.text.primary');
    expect(table).toContain('AuroraBadge');
    expect(table).toContain('Akte öffnen');
  });

  it('ClientsListHero exposes the interactive HealthOS cockpit', () => {
    const hero = readSrc('components/office/ClientsListHero.tsx');
    expect(hero).toContain('kpiRowCompact');
    expect(hero).toContain('AuroraPageHeader');
    expect(hero).toContain('ClientWorkspaceKpiCard');
    expect(hero).toContain('ClientWorkspaceLiveBadge');
    expect(hero).toContain('AuroraGradientButton');
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
    expect(modal).toContain('validateOnSubmit: false');
    expect(modal).toContain('resolveChangedSections');
    expect(modal).toContain("submitting ? 'Wird gespeichert…' : 'Speichern'");

    const sections = readSrc('lib/clients/clientMasterDataSections.ts');
    expect(sections).not.toContain("key: 'vertraege_einwilligungen'");
  });

  it('loads existing intake signatures instead of asking the client to sign again', () => {
    const edit = readSrc('lib/clients/clientIntakeEditService.ts');
    const documents = readSrc('features/intakeDocuments/intakeDocumentRepository.ts');
    const hook = readSrc('hooks/useClientIntakeWizard.ts');
    expect(edit).toContain('loadPersistedIntakeDocumentsForClient');
    expect(documents).toContain("from('client_document_signatures')");
    expect(documents).toContain('signature_data');
    expect(documents).toContain('signedAt: row.signed_at');
    expect(documents).toContain('hasClientSignature');
    expect(documents).toContain('clientSignedIds.has(row.id)');
    expect(hook).toContain("editSections?.includes('vertraege_einwilligungen')");
  });

  it('recovers signed intake documents after interrupted client assignment writes', () => {
    const documents = readSrc('features/intakeDocuments/intakeDocumentRepository.ts');
    const hook = readSrc('hooks/useClientIntakeWizard.ts');
    const record = readSrc('screens/business/office/ClientRecordScreen.tsx');
    const migration = readFileSync(
      path.join(
        srcRoot,
        '..',
        'supabase',
        'migrations',
        '20260731090000_signed_intake_document_recovery.sql',
      ),
      'utf8',
    );

    const signatureLookup = documents.slice(
      documents.indexOf("from('client_document_signatures')"),
      documents.indexOf('if (signatureError)'),
    );
    expect(signatureLookup).not.toContain(".eq('client_id', clientId)");
    expect(documents).toContain("update({ status: recoveredStatus })");
    expect(hook).toContain('containsSignedDocument');
    expect(hook).toContain('persistClientIntakeDocuments');
    expect(record).toContain('loadClientIntakeDraft');
    expect(record).toContain('draft.clientId !== id');
    expect(record).toContain('persistClientIntakeDocuments');
    expect(migration).toContain('sig.document_id = doc.id');
    expect(migration).toContain("sig.signer_role = 'client'");
    expect(migration).toContain('INSERT INTO public.client_documents');
    expect(migration).toContain("status = 'active'");
    expect(migration).toContain('no required intake document is left unsigned');
  });

  it('saves only production client columns and keeps derived sync non-blocking', () => {
    const repository = readSrc(
      'lib/clients/repositories/clientIntakeRepository.supabase.ts',
    );
    const service = readSrc('lib/clients/clientIntakeService.ts');
    const persistence = readSrc('lib/clients/clientIntakePersistence.ts');

    expect(repository).toContain(
      "Database['public']['Tables']['clients']['Update']",
    );
    expect(repository).toContain("shouldUpdate('stammdaten')");
    expect(repository).toContain('service_start: form.serviceStart');
    expect(repository).not.toContain('birth_place: form.birthPlace');
    expect(persistence).toContain('isMissingTableError(existingError)');
    expect(service).toContain(
      "console.warn('[clientIntakeService] client core sync:'",
    );
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
