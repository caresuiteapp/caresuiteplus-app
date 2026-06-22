import type { CsvParseResult } from '@/types/csv';

const MAX_ROWS = 5000;

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(headerLine: string): ';' | ',' {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ';' : ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      current += char;
      if (char === '"' && next === '"') {
        current += next;
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      current += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      if (current.trim()) records.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) records.push(current);
  return records;
}

export type CsvParseOptions = {
  maxRows?: number;
};

export function parseCsvContent(
  csvContent: string,
  options: CsvParseOptions = {},
): { ok: true; data: CsvParseResult } | { ok: false; error: string } {
  const maxRows = options.maxRows ?? MAX_ROWS;
  const normalized = stripBom(csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')).trim();

  if (!normalized) {
    return { ok: false, error: 'Die Datei konnte nicht gelesen werden.' };
  }

  const records = splitCsvRecords(normalized);
  if (records.length < 1) {
    return { ok: false, error: 'Die Datei enthält keine gültige Kopfzeile.' };
  }

  const delimiter = detectDelimiter(records[0] ?? '');
  const headers = parseCsvLine(records[0] ?? '', delimiter).map((h) => h.trim());

  if (headers.length === 0 || headers.every((h) => !h)) {
    return { ok: false, error: 'Die Datei enthält keine gültige Kopfzeile.' };
  }

  const rows: string[][] = [];
  for (let i = 1; i < records.length; i += 1) {
    const parsed = parseCsvLine(records[i] ?? '', delimiter);
    if (parsed.every((cell) => !cell)) continue;
    rows.push(parsed);
    if (rows.length > maxRows) {
      return {
        ok: false,
        error: `Die Datei enthält mehr als ${maxRows} Datenzeilen. Bitte in kleinere Dateien aufteilen.`,
      };
    }
  }

  return {
    ok: true,
    data: {
      delimiter,
      headers,
      rows,
      totalRows: rows.length,
    },
  };
}

export function rowsToObjects(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index]?.trim() ?? '';
    });
    return obj;
  });
}

export function serializeCsv(headers: string[], rows: string[][], delimiter: ';' | ',' = ';'): string {
  const escape = (value: string): string => {
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const lines = [headers.map(escape).join(delimiter)];
  for (const row of rows) {
    lines.push(row.map((cell) => escape(cell ?? '')).join(delimiter));
  }
  return lines.join('\n');
}

export { MAX_ROWS as CSV_MAX_ROWS };
