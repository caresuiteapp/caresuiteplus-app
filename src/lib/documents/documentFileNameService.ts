export type DocumentFileNameInput = {
  date?: string;
  templateShortName: string;
  clientLastName?: string | null;
  clientFirstName?: string | null;
  employeeLastName?: string | null;
  employeeFirstName?: string | null;
};

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '')
    .slice(0, 48);
}

export function buildGeneratedDocumentFileName(input: DocumentFileNameInput): string {
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const shortName = sanitizeSegment(input.templateShortName || 'Dokument');
  const last =
    sanitizeSegment(input.clientLastName ?? input.employeeLastName ?? 'Unbekannt') || 'Unbekannt';
  const first =
    sanitizeSegment(input.clientFirstName ?? input.employeeFirstName ?? '') || 'X';
  return `${date}_${shortName}_${last}_${first}.pdf`;
}
