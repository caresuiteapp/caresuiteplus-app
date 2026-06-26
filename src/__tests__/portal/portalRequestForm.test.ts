import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildAppointmentOptions,
  buildLeistungsartOptions,
  buildPortalRequestDescription,
  createDefaultFormState,
  serializePortalRequestPayload,
  validatePortalRequestPayload,
  WEEKDAY_OPTIONS,
} from '@/lib/portal/assist/portalRequestFormOptions';

function readSrc(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('portal request form payloads', () => {
  it('serializes zusatztermin payload with structured fields', () => {
    const formState = createDefaultFormState('zusatztermin', {
      leistungsartOptions: buildLeistungsartOptions(['daily_assistance']),
      appointmentOptions: buildAppointmentOptions([]),
    });

    expect(validatePortalRequestPayload('zusatztermin', formState)).toBeNull();

    const payload = serializePortalRequestPayload('zusatztermin', {
      ...formState,
      leistungsart: 'alltagsbegleitung',
      wochentag: 'di',
      tageszeit: 'nachmittag',
      dringlichkeit: 'dringend',
      nachricht: 'Bitte zeitnah',
    });

    expect(payload).toMatchObject({
      formVersion: 1,
      requestType: 'zusatztermin',
      leistungsart: 'alltagsbegleitung',
      wochentag: 'di',
      tageszeit: 'nachmittag',
      dringlichkeit: 'dringend',
      nachricht: 'Bitte zeitnah',
    });
  });

  it('serializes termin_aendern payload for change types and cancel', () => {
    const base = createDefaultFormState('termin_aendern', {
      leistungsartOptions: [],
      appointmentOptions: buildAppointmentOptions([
        {
          id: 'appt-1',
          title: 'Hausbesuch',
          startsAt: '2026-06-20T09:00:00Z',
          endsAt: null,
          location: null,
          status: 'geplant',
        },
      ]),
    });

    const timeChangePayload = serializePortalRequestPayload('termin_aendern', {
      ...(base as ReturnType<typeof createDefaultFormState>),
      appointmentId: 'appt-1',
      appointmentLabel: 'Hausbesuch',
      aenderungsart: 'uhrzeit_aendern',
      tageszeit: 'vormittag',
    });

    expect(timeChangePayload).toMatchObject({
      requestType: 'termin_aendern',
      appointmentId: 'appt-1',
      aenderungsart: 'uhrzeit_aendern',
      tageszeit: 'vormittag',
      wochentag: null,
      absagegrund: null,
    });

    const dayAndTimePayload = serializePortalRequestPayload('termin_aendern', {
      ...(base as ReturnType<typeof createDefaultFormState>),
      appointmentId: 'appt-1',
      appointmentLabel: 'Hausbesuch',
      aenderungsart: 'tag_und_uhrzeit_aendern',
      wochentag: 'fr',
      tageszeit: 'nachmittag',
    });

    expect(dayAndTimePayload).toMatchObject({
      aenderungsart: 'tag_und_uhrzeit_aendern',
      wochentag: 'fr',
      tageszeit: 'nachmittag',
    });

    const cancelPayload = serializePortalRequestPayload('termin_aendern', {
      ...(base as ReturnType<typeof createDefaultFormState>),
      appointmentId: 'appt-1',
      appointmentLabel: 'Hausbesuch',
      aenderungsart: 'absagen',
      absagegrund: 'krankheit',
    });

    expect(cancelPayload).toMatchObject({
      aenderungsart: 'absagen',
      wochentag: null,
      tageszeit: null,
      absagegrund: 'krankheit',
    });
  });

  it('validates termin_aendern requires assignment or general request', () => {
    const emptyState = createDefaultFormState('termin_aendern', {
      leistungsartOptions: [],
      appointmentOptions: buildAppointmentOptions([]),
    });

    expect(validatePortalRequestPayload('termin_aendern', emptyState)).toContain('geplanten Einsatz');

    expect(
      validatePortalRequestPayload('termin_aendern', {
        ...(emptyState as ReturnType<typeof createDefaultFormState>),
        appointmentLabel: 'Allgemeine Anfrage',
      }),
    ).toBeNull();
  });

  it('serializes rueckruf payload with phone and topic', () => {
    const formState = createDefaultFormState('rueckruf', {
      leistungsartOptions: [],
      appointmentOptions: [],
      contactPhone: '+49 30 123456',
    });

    const payload = serializePortalRequestPayload('rueckruf', {
      ...(formState as ReturnType<typeof createDefaultFormState>),
      thema: 'allgemeine_frage',
      rueckrufzeit: 'mittag',
      telefonnummer: '+49 30 123456',
      nachricht: 'Bitte zeitnah',
    } as never);

    expect(payload).toMatchObject({
      requestType: 'rueckruf',
      thema: 'allgemeine_frage',
      rueckrufzeit: 'mittag',
      telefonnummer: '+49 30 123456',
      nachricht: 'Bitte zeitnah',
    });

    const description = buildPortalRequestDescription('rueckruf', {
      thema: 'allgemeine_frage',
      rueckrufzeit: 'mittag',
      telefonnummer: '+49 30 123456',
    });
    expect(description).toContain('Allgemeine Frage');
    expect(description).toContain('Mittags');
    expect(description).toContain('+49 30 123456');
  });

  it('serializes stammdaten, beschwerde and lob payloads', () => {
    expect(
      serializePortalRequestPayload('stammdaten', { feld: 'telefon', nachricht: 'Neue Nummer' }),
    ).toMatchObject({ feld: 'telefon', nachricht: 'Neue Nummer' });

    expect(
      serializePortalRequestPayload('beschwerde', {
        bereich: 'mitarbeiter',
        dringlichkeit: 'bald',
      }),
    ).toMatchObject({ bereich: 'mitarbeiter', dringlichkeit: 'bald' });

    expect(serializePortalRequestPayload('lob', { bereich: 'leistung' })).toMatchObject({
      bereich: 'leistung',
    });
  });

  it('falls back to empty assignment options with general request', () => {
    const options = buildAppointmentOptions([]);
    expect(options).toHaveLength(2);
    expect(options[0]?.key).toBe('none');
    expect(options[0]?.label).toBe('Kein geplanter Einsatz');
    expect(options[1]?.key).toBe('allgemein');
    expect(options[1]?.label).toBe('Allgemeine Anfrage');
  });
});

describe('PortalRequestFormModal UI', () => {
  it('renders dropdown fields for termin_aendern', () => {
    const source = readSrc('src/components/portal/assist/PortalRequestFormModal.tsx');
    expect(source).toContain('Geplanter Einsatz');
    expect(source).toContain('Art der Änderung');
    expect(source).toContain('Neue Tageszeit');
    expect(source).toContain('Neuer Wunschtag');
    expect(source).toContain('Absagegrund');
    expect(source).toContain("case 'termin_aendern'");
  });

  it('renders dropdown fields for zusatztermin', () => {
    const source = readSrc('src/components/portal/assist/PortalRequestFormModal.tsx');
    expect(source).toContain('ListFilterSelect');
    expect(source).toContain('Leistungsart');
    expect(source).toContain('Bevorzugter Wochentag');
    expect(source).toContain('Bevorzugte Tageszeit');
    expect(source).toContain('Dringlichkeit');
    expect(source).toContain("case 'zusatztermin'");
    expect(WEEKDAY_OPTIONS).toHaveLength(7);
  });

  it('wires AssistPortalOverview to structured form modal', () => {
    const source = readSrc('src/components/portal/assist/AssistPortalOverview.tsx');
    expect(source).toContain('PortalRequestFormModal');
    expect(source).toContain('serializePortalRequestPayload');
    expect(source).not.toContain('PremiumInput');
    expect(source).toContain('PortalDocumentUploadModal');
    expect(source).toContain('uploadModalOpen');
    expect(source).not.toContain('uploadModalVisible');
    expect(source).toContain('setProofsModalOpen(true)');
    expect(source).not.toContain("setRequestModal('nachweise')");
  });

  it('opens zusatztermin form from open requests modal via action route', () => {
    const overview = readSrc('src/components/portal/assist/AssistPortalOverview.tsx');
    const mobile = readSrc('src/components/portal/assist/MobilePortalDashboard.tsx');

    expect(overview).toContain('openZusatzterminRequest');
    expect(overview).toContain("router.replace('/portal/client?action=zusatztermin'");
    expect(overview).toContain("setRequestModal('zusatztermin')");
    expect(overview).not.toContain("setRequestModal('sonstiges')");
    expect(overview).toMatch(/onNewRequest=\{\(\) => \{[\s\S]*openZusatzterminRequest\(\)/);

    expect(mobile).toContain('openZusatzterminRequest');
    expect(mobile).toContain("router.replace('/portal/client?action=zusatztermin'");
    expect(mobile).not.toContain("setRequestModal('sonstiges')");
  });

  it('renders dropdown fields for rueckruf callback form', () => {
    const source = readSrc('src/components/portal/assist/PortalRequestFormModal.tsx');
    expect(source).toContain('Bevorzugte Rückrufzeit');
    expect(source).toContain('Grund/Thema');
    expect(source).toContain("case 'rueckruf'");
  });

  it('uses PortalGlassModal without duplicate in-body title', () => {
    const source = readSrc('src/components/portal/assist/PortalGlassModal.tsx');
    expect(source).toContain('PlatformModal');
    expect(source).not.toContain('GlassCard');
    expect(source).not.toMatch(/<Text[^>]*>\s*\{title\}/);
  });

  it('uses modal-based ListFilterSelect picker on all platforms', () => {
    const source = readSrc('src/components/ui/ListFilterSelect.tsx');
    expect(source).toContain('<Modal visible={open}');
    expect(source).not.toContain("Platform.OS === 'web'");
  });
});
