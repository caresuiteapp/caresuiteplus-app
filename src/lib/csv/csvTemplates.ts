import { CLIENT_IMPORT_ALL_FIELDS } from '@/types/clientImport';
import { EMPLOYEE_IMPORT_ALL_FIELDS } from '@/types/employeeImport';
import type { CsvImportType } from '@/types/csv';
import { serializeCsv } from './csvParser';

const CLIENT_HEADERS = [...CLIENT_IMPORT_ALL_FIELDS] as string[];

const CLIENT_EXAMPLE = [
  'K-1001', 'Frau', '', 'Erika', 'Mustermann', '15.04.1938', 'Musterstraße', '12', '44137', 'Dortmund',
  '0231123456', '', '017612345678', 'erika.mustermann@example.de', 'PG2', '01.01.2026', 'Alltagsbegleitung',
  'AOK NordWest', 'Pflegekasse', 'A123456789', 'AOK NordWest', 'AOK NordWest', 'nein', 'nein', 'ja', 'nein', 'nein',
  'Pflegekasse', '01.07.2026', 'nein', '', '', '', '', 'Max Mustermann', 'Sohn', '017698765432', '', '', '',
  'Dr. Beispiel', '0231987654', 'Demenz leicht', 'Keine bekannt', 'Rollator', 'ja', 'Katze', 'Bitte langsam sprechen',
  'Import-Test', 'aktiv',
];

const EMPLOYEE_HEADERS = [...EMPLOYEE_IMPORT_ALL_FIELDS] as string[];

const EMPLOYEE_EXAMPLE = [
  'M-1001', 'Frau', '', 'Maria', 'Beispiel', '22.08.1985', 'maria.beispiel@example.de', '0231123456', '017612345678',
  'Musterweg', '5', '44263', 'Dortmund', 'Dortmund', 'deutsch', '12345678901', '12123456A123', 'AOK NordWest',
  'DE00123456781234567890', 'GENODED1XXX', '01.07.2026', 'Alltagsbegleiterin', 'Teilzeit', '25', '15.50', '20',
  '31.12.2026', '', 'Max Beispiel', 'Ehemann', '017698765432', 'ja', '01.06.2026', 'Betreuungskraft nach §43b', 'nein',
  '15.05.2025', 'ja', 'ja', 'Dortmund Hörde, Dortmund Innenstadt', 'Import-Test', 'aktiv',
];

export function getTemplateHeaders(importType: CsvImportType): string[] {
  return importType === 'clients' ? CLIENT_HEADERS : EMPLOYEE_HEADERS;
}

export function buildTemplateCsv(importType: CsvImportType): string {
  if (importType === 'clients') {
    return serializeCsv(CLIENT_HEADERS, [CLIENT_EXAMPLE], ';');
  }
  return serializeCsv(EMPLOYEE_HEADERS, [EMPLOYEE_EXAMPLE], ';');
}

export function getTemplateFileName(importType: CsvImportType): string {
  return importType === 'clients'
    ? 'caresuite_klientinnen_import_vorlage.csv'
    : 'caresuite_mitarbeiterinnen_import_vorlage.csv';
}
