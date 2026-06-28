export type WfmPdfRow = {
  workDate: string;
  employeeId: string;
  statusLabel: string;
  netMinutes: number;
  pauseMinutes: number;
};

type JsPdfConstructor = typeof import('jspdf').jsPDF;

let jsPdfPromise: Promise<JsPdfConstructor> | null = null;

async function loadJsPdf(): Promise<JsPdfConstructor> {
  if (!jsPdfPromise) {
    jsPdfPromise = import('jspdf/dist/jspdf.es.min.js').then(
      // @ts-expect-error jspdf ships no type declarations for ESM entry
      (module) => module.jsPDF,
    );
  }
  return jsPdfPromise;
}

function buildWfmPdfLines(
  rows: WfmPdfRow[],
  year: number,
  month: number,
  tenantId: string,
): string[] {
  const lines = [
    'CareSuite+ Arbeitszeit-Export',
    `Mandant: ${tenantId.slice(0, 8)}…`,
    `Zeitraum: ${String(month).padStart(2, '0')}/${year}`,
    `Erstellt: ${new Date().toLocaleString('de-DE')}`,
    '',
    'Datum       | MA-ID    | Status        | Netto-Min | Pause',
    '------------|----------|---------------|-----------|------',
    ...rows.slice(0, 200).map(
      (r) =>
        `${r.workDate} | ${r.employeeId.slice(0, 8)} | ${r.statusLabel.padEnd(13).slice(0, 13)} | ${String(r.netMinutes).padStart(9)} | ${r.pauseMinutes}`,
    ),
  ];
  if (rows.length > 200) lines.push(`… und ${rows.length - 200} weitere Datensätze`);
  return lines;
}

export function buildWfmPdfPlainText(
  rows: WfmPdfRow[],
  year: number,
  month: number,
  tenantId: string,
): string {
  return buildWfmPdfLines(rows, year, month, tenantId).join('\n');
}

/** Browser-only: renders WFM rows as PDF data URI via jsPDF. */
export async function renderWfmPdfDataUri(
  rows: WfmPdfRow[],
  year: number,
  month: number,
  tenantId: string,
): Promise<string> {
  const lines = buildWfmPdfLines(rows, year, month, tenantId);
  const jsPDF = await loadJsPdf();
  const pdf = new jsPDF('p', 'mm', 'a4');
  pdf.setFontSize(14);
  pdf.text('CareSuite+ Arbeitszeit-Export', 14, 20);
  pdf.setFontSize(10);
  pdf.text(`Zeitraum: ${String(month).padStart(2, '0')}/${year}`, 14, 28);
  pdf.text(`Datensätze: ${rows.length}`, 14, 34);
  pdf.setFontSize(8);
  let y = 44;
  for (const line of lines.slice(5)) {
    if (y > 280) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(line, 14, y);
    y += 4;
  }
  return pdf.output('datauristring');
}
