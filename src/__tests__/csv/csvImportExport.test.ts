import { parseCsvContent, serializeCsv } from '@/lib/csv/csvParser';
import { normalizeHeaderKey, mapCsvHeaders } from '@/lib/csv/csvHeaderMapping';
import {
  formatBooleanGerman,
  normalizeCareLevel,
  parseBoolean,
  parseFlexibleDate,
} from '@/lib/csv/csvValueUtils';
import { validateCsvImport } from '@/lib/csv/csvValidation';
import { buildTemplateCsv, getTemplateFileName } from '@/lib/csv/csvTemplates';
import { markDuplicateRows } from '@/lib/csv/csvDuplicateCheck';
import type { ClientImportRow } from '@/types/clientImport';

describe('csvParser', () => {
  it('parst Semikolon-CSV mit Umlauten', () => {
    const csv = 'vorname;nachname;straße\nErika;Müller;Musterstraße';
    const result = parseCsvContent(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.delimiter).toBe(';');
    expect(result.data.headers[2]).toBe('straße');
    expect(result.data.rows[0]?.[2]).toBe('Musterstraße');
  });

  it('parst Komma-CSV', () => {
    const csv = 'vorname,nachname,email\nMax,Test,max@example.de';
    const result = parseCsvContent(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.delimiter).toBe(',');
  });

  it('entfernt BOM', () => {
    const csv = '\uFEFFvorname;nachname\nA;B';
    const result = parseCsvContent(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.headers[0]).toBe('vorname');
  });

  it('serialisiert CSV mit Semikolon', () => {
    const out = serializeCsv(['a', 'b'], [['1', '2']], ';');
    expect(out).toBe('a;b\n1;2');
  });
});

describe('csvHeaderMapping', () => {
  it('normalisiert Header mit Umlauten und Synonymen', () => {
    expect(normalizeHeaderKey('Straße')).toBe('strasse');
    const mapping = mapCsvHeaders(['Vorname', 'Handy', 'PG'], 'clients');
    expect(mapping.find((m) => m.csvColumn === 'Handy')?.systemField).toBe('mobil');
    expect(mapping.find((m) => m.csvColumn === 'PG')?.systemField).toBe('pflegegrad');
  });
});

describe('csvValueUtils', () => {
  it('validiert und normalisiert Datum, Boolean und Pflegegrad', () => {
    expect(parseFlexibleDate('15.04.1938')).toBe('1938-04-15');
    expect(parseFlexibleDate('2026-07-01')).toBe('2026-07-01');
    expect(parseBoolean('ja')).toBe(true);
    expect(parseBoolean('nein')).toBe(false);
    expect(formatBooleanGerman(true)).toBe('ja');
    expect(normalizeCareLevel('PG2')).toBe('pg2');
  });
});

describe('csvValidation clients', () => {
  const header =
    'vorname;nachname;geburtsdatum;strasse;hausnummer;plz;ort;telefon_1;pflegegrad;leistungsart;status';
  const validRow =
    'Erika;Mustermann;15.04.1938;Musterstraße;12;44137;Dortmund;0231123456;PG2;Alltagsbegleitung;aktiv';

  it('meldet Pflichtfeldfehler', async () => {
    const csv = `${header}\n;Mustermann;15.04.1938;Musterstraße;12;44137;Dortmund;0231123456;PG2;Alltagsbegleitung;aktiv`;
    const result = await validateCsvImport({
      csvContent: csv,
      fileName: 'test.csv',
      fileSize: 100,
      importType: 'clients',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.summary.invalidRows).toBeGreaterThan(0);
  });

  it('akzeptiert gültige Klient:innen-Zeile', async () => {
    const csv = `${header}\n${validRow}`;
    const result = await validateCsvImport({
      csvContent: csv,
      fileName: 'test.csv',
      fileSize: 100,
      importType: 'clients',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.summary.validRows).toBe(1);
  });
});

describe('csvTemplates', () => {
  it('liefert Vorlagen mit Kopfzeile und Beispiel', () => {
    expect(getTemplateFileName('clients')).toBe('caresuite_klientinnen_import_vorlage.csv');
    const csv = buildTemplateCsv('employees');
    expect(csv).toContain('personalnummer');
    expect(csv).toContain('Maria');
  });
});

describe('csvDuplicateCheck', () => {
  it('markiert Dubletten in der Datei', () => {
    const rows = [
      {
        rowNumber: 2,
        raw: {},
        data: {
          vorname: 'Erika',
          nachname: 'Test',
          geburtsdatum: '1938-04-15',
        } as ClientImportRow,
        issues: [],
        isValid: true,
        isDuplicate: false,
      },
      {
        rowNumber: 3,
        raw: {},
        data: {
          vorname: 'Erika',
          nachname: 'Test',
          geburtsdatum: '1938-04-15',
        } as ClientImportRow,
        issues: [],
        isValid: true,
        isDuplicate: false,
      },
    ];
    const marked = markDuplicateRows(rows, 'clients');
    expect(marked[1]?.isDuplicate).toBe(true);
  });
});

describe('csvFieldHints', () => {
  it('liefert Korrekturhinweise für typische Importfehler', async () => {
    const csv =
      'vorname;nachname;geburtsdatum;email;telefon;eintrittsdatum;rolle;beschaeftigungsart;status\n' +
      'Max;Test;ungültig;keine-email;0231;01.01.2020;Unbekannt;Falsch;aktiv';
    const result = await validateCsvImport({
      csvContent: csv,
      fileName: 'test.csv',
      fileSize: 100,
      importType: 'employees',
      roleOptions: ['Pflegekraft', 'Verwaltung'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dateIssue = result.data.allIssues.find((i) => i.fieldName === 'geburtsdatum');
    expect(dateIssue?.hint).toContain('TT.MM.JJJJ');
    const roleIssue = result.data.allIssues.find((i) => i.fieldName === 'rolle');
    expect(roleIssue?.hint).toContain('Pflegekraft');
    const employmentIssue = result.data.allIssues.find((i) => i.fieldName === 'beschaeftigungsart');
    expect(employmentIssue?.hint).toContain('Vollzeit');
  });
});

describe('csv tenant isolation', () => {
  it('ignoriert tenant_id aus CSV als Warning', async () => {
    const csv =
      'vorname;nachname;geburtsdatum;strasse;hausnummer;plz;ort;telefon_1;pflegegrad;leistungsart;tenant_id\n' +
      'Erika;Mustermann;15.04.1938;Musterstraße;12;44137;Dortmund;0231123456;PG2;Alltagsbegleitung;foreign-tenant';
    const result = await validateCsvImport({
      csvContent: csv,
      fileName: 'test.csv',
      fileSize: 100,
      importType: 'clients',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.allIssues.some((i) => i.errorCode === 'IGNORED_TENANT')).toBe(true);
  });
});
