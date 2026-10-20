export type CsvImportType = 'clients' | 'employees';
export type CsvExportType = 'clients' | 'employees';
export type CsvImportMode = 'create_only' | 'update_existing' | 'create_or_update';

export type CsvImportLogStatus =
  | 'uploaded'
  | 'validated'
  | 'failed_validation'
  | 'imported'
  | 'partially_imported'
  | 'failed'
  | 'cancelled';

export type CsvErrorSeverity = 'info' | 'warning' | 'error';

export type CsvFieldMappingConfidence = 'recognized' | 'uncertain' | 'unmapped';

export type CsvFieldMapping = {
  csvColumn: string;
  systemField: string | null;
  confidence: CsvFieldMappingConfidence;
};

export type CsvParseResult = {
  delimiter: ';' | ',';
  headers: string[];
  rows: string[][];
  totalRows: number;
};

export type CsvRowIssue = {
  rowNumber: number;
  fieldName: string | null;
  errorCode: string;
  errorMessage: string;
  rawValue: string | null;
  severity: CsvErrorSeverity;
  hint?: string;
};

export type CsvValidatedRow<T> = {
  rowNumber: number;
  raw: Record<string, string>;
  data: T;
  issues: CsvRowIssue[];
  isValid: boolean;
  isDuplicate: boolean;
  duplicateReason?: string;
};

export type CsvValidationSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  duplicateRows: number;
};

export type CsvImportPreview<T> = {
  importType: CsvImportType;
  fileName: string;
  fileSize: number;
  delimiter: ';' | ',';
  columnCount: number;
  mapping: CsvFieldMapping[];
  summary: CsvValidationSummary;
  rows: CsvValidatedRow<T>[];
  allIssues: CsvRowIssue[];
};

export type CsvImportLogRecord = {
  id: string;
  tenantId: string;
  userId: string;
  importType: CsvImportType;
  fileName: string | null;
  fileSize: number | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  skippedRows: number;
  updatedRows: number;
  failedRows: number;
  status: CsvImportLogStatus;
  rawMapping: CsvFieldMapping[] | null;
  validationResult: CsvValidationSummary | null;
  errorSummary: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  userDisplayName?: string | null;
};

export type CsvExportLogRecord = {
  id: string;
  tenantId: string;
  userId: string;
  exportType: CsvExportType;
  filters: Record<string, unknown> | null;
  numberOfRecords: number;
  fileName: string | null;
  createdAt: string;
};

export type CsvClientExportScope =
  | 'basis'
  | 'kontakt'
  | 'pflege'
  | 'kostentraeger'
  | 'notfall'
  | 'medizin'
  | 'notizen';

export type CsvEmployeeExportScope =
  | 'basis'
  | 'kontakt'
  | 'beschaeftigung'
  | 'qualifikation'
  | 'abrechnung'
  | 'notfall'
  | 'notizen';

export type CsvClientExportFilters = {
  statusFilter: 'all' | 'active' | 'inactive' | 'archived';
  careLevel?: string | null;
  leistungsart?: string | null;
  city?: string | null;
  serviceStartFrom?: string | null;
  serviceStartTo?: string | null;
  costBearer?: string | null;
  scopes: CsvClientExportScope[];
};

export type CsvEmployeeExportFilters = {
  statusFilter: 'all' | 'active' | 'inactive' | 'terminated';
  role?: string | null;
  employmentType?: string | null;
  entryFrom?: string | null;
  entryTo?: string | null;
  city?: string | null;
  einsatzbereich?: string | null;
  scopes: CsvEmployeeExportScope[];
};
