import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_LOCALE, APP_TIME_ZONE, APP_CURRENCY } from '@/lib/i18n/locale';
import { formatDate, formatTime } from '@/lib/formatters/dateTimeFormatters';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { formatCareLevel, formatIntakeScheduleLabel } from '@/lib/formatters/unitFormatters';
import {
  getClientRecordTabsForClientContext,
  getRequiredFieldsForClientContext,
  getVisibleSectionsForClientContext,
} from '@/lib/clients/clientIntakeFieldRules';
import { getIntakeStepsForContexts, validateIntakeStep } from '@/lib/clients/clientIntakeService';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { ALL_CATALOG_KEYS, getSystemCatalog } from '@/lib/catalogs/systemCatalogs';
import { buildClientDocumentStoragePath } from '@/lib/clients/clientDocumentsService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { buildDemoConstellationClients } from '@/data/demo/clients/constellations';

describe('Client Intake & Record Rebuild', () => {
  it('locale Konstanten sind de-DE / Europe/Berlin / EUR', () => {
    expect(APP_LOCALE).toBe('de-DE');
    expect(APP_TIME_ZONE).toBe('Europe/Berlin');
    expect(APP_CURRENCY).toBe('EUR');
  });

  it('formatiert Datum als TT.MM.JJJJ', () => {
    expect(formatDate('2026-06-14')).toMatch(/14\.06\.2026/);
  });

  it('formatiert Uhrzeit als HH:MM Uhr', () => {
    expect(formatTime('2026-06-14T13:45:00')).toMatch(/13:45 Uhr/);
  });

  it('formatiert Währung als 1.234,56 €', () => {
    expect(formatCurrency(123456, true)).toMatch(/1\.234,56/);
    expect(formatCurrency(123456, true)).toContain('€');
  });

  it('formatiert Pflegegrad als PG 3', () => {
    expect(formatCareLevel('pg3')).toBe('PG3');
  });

  it('Einnahmeschema zeigt morgens/mittags/abends/nachts', () => {
    expect(formatIntakeScheduleLabel(true, true, false, true)).toBe('morgens / mittags / nachts');
  });

  it('Neuaufnahme startet mit Leistungsart-Schritt', () => {
    const steps = getIntakeStepsForContexts([]);
    expect(steps[0]).toBe('leistungsart');
  });

  it('Mehrfachauswahl Leistungsart wird validiert', () => {
    const errors = validateIntakeStep('leistungsart', { ...EMPTY_CLIENT_INTAKE_FORM, careContexts: [] });
    expect(errors.careContexts).toBeTruthy();
  });

  it('Alltagsbegleitung ohne Pflegepflichtfelder', () => {
    const required = getRequiredFieldsForClientContext(['daily_assistance']);
    expect(required).not.toContain('insuranceNumber');
    expect(required).not.toContain('familyDoctor');
  });

  it('Ambulante Pflege zeigt Wohnungszugang Pflicht', () => {
    const required = getRequiredFieldsForClientContext(['ambulatory_care']);
    expect(required).toContain('homeAccess');
    expect(required).toContain('insuranceNumber');
  });

  it('Stationäre Pflege zeigt Zimmer Pflicht', () => {
    const required = getRequiredFieldsForClientContext(['stationary_care']);
    expect(required).toContain('roomNumber');
    expect(required).toContain('facility');
  });

  it('Ambulant + Betreuung kombiniert Kontexte', () => {
    const tabs = getClientRecordTabsForClientContext(['ambulatory_care', 'support_care']);
    expect(tabs).toContain('medikation');
    expect(tabs).toContain('aufgaben');
  });

  it('Akte Tabs abhängig von Beratung', () => {
    const tabs = getClientRecordTabsForClientContext(['consulting']);
    expect(tabs).toContain('beratungsanlass');
    expect(tabs).toContain('protokolle');
  });

  it('Systemkataloge enthalten Leistungsart und Pflegegrad', () => {
    expect(ALL_CATALOG_KEYS).toContain('leistungsart');
    expect(getSystemCatalog('care_level').entries.length).toBeGreaterThan(5);
  });

  it('Dokumentupload Storage-Pfad tenant/client', () => {
    const path = buildClientDocumentStoragePath(DEMO_TENANT_ID, 'client-001', 'doc-1', 'test.pdf');
    expect(path).toBe(`tenant/${DEMO_TENANT_ID}/clients/client-001/documents/doc-1/doc-1.pdf`);
  });

  it('Dokumentupload Storage-Pfad sanitisiert Sonderzeichen', () => {
    const path = buildClientDocumentStoragePath(
      DEMO_TENANT_ID,
      'client-001',
      'doc-uuid',
      'Helferhasen-Mail - Versorgung §45a – Krankenfahrten.pdf',
    );
    expect(path).toBe(`tenant/${DEMO_TENANT_ID}/clients/client-001/documents/doc-uuid/doc-uuid.pdf`);
  });

  it('Demo-Konstellationen: mindestens 10 Akten', () => {
    const clients = buildDemoConstellationClients();
    expect(clients.length).toBeGreaterThanOrEqual(10);
  });

  it('Listeneinstieg verweist auf Neuaufnahme-Wizard', () => {
    const listView = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'office', 'ClientsListView.tsx'),
      'utf8',
    );
    expect(listView).toContain('CLIENT_INTAKE_NEW_ROUTE');
    expect(listView).toContain('clientRecordRoute');
    expect(listView).not.toContain("'/office/clients/create'");
  });

  it('Legacy-Create-Route leitet auf Wizard weiter', () => {
    const createRoute = readFileSync(
      path.join(__dirname, '..', '..', '..', 'app', 'office', 'clients', 'create.tsx'),
      'utf8',
    );
    expect(createRoute).toContain('Redirect');
    expect(createRoute).toContain('CLIENT_INTAKE_NEW_ROUTE');
    expect(createRoute).not.toContain('ClientCreateScreen');
  });

  it('Legacy-Detail-Route leitet auf ClientRecordScreen weiter', () => {
    const detailRoute = readFileSync(
      path.join(__dirname, '..', '..', '..', 'app', 'office', 'clients', '[id]', 'index.tsx'),
      'utf8',
    );
    expect(detailRoute).toContain('Redirect');
    expect(detailRoute).toContain('clientRecordRoute');
    expect(detailRoute).not.toContain('ClientDetailScreen');
  });

  it('Sichtbare Wizard-Schritte bei Support-Kontext', () => {
    const sections = getVisibleSectionsForClientContext(['daily_assistance']);
    expect(sections[0]).toBe('leistungsart');
    expect(sections).toContain('stammdaten');
    expect(sections).toContain('kostentraeger');
  });
});
