import type { AcademyCertificate } from './workspaceModel';

const displayDate = (value: string) => {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) throw new Error('Das Ausstellungsdatum des Nachweises ist ungültig.');
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', dateStyle: 'long' }).format(date);
};

/** The caller passes the immutable, server-issued certificate snapshot. */
export async function createAcademyCertificatePdf(certificate: AcademyCertificate): Promise<import('jspdf').jsPDF> {
  if (!certificate.id || !certificate.number || !certificate.participantName || !certificate.courseTitle || !certificate.issuedAt) {
    throw new Error('Der Teilnahmenachweis ist unvollständig. Bitte den aktuellen Stand laden.');
  }
  const [module, font] = await Promise.all([
    import('jspdf/dist/jspdf.es.min.js'), import('@/lib/documents/centuryGothicPdf'),
  ]);
  const { jsPDF } = module as unknown as typeof import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  font.registerCareSuitePdfFont(pdf);
  const text = font.createCareSuitePdfText(pdf);
  const ink = '#12363D';
  const muted = '#526C72';
  const accent = '#007E87';
  pdf.setProperties({ title: `Teilnahmenachweis ${certificate.number}`, subject: certificate.courseTitle,
    author: certificate.organizationName, creator: 'CareSuite+ Akademie' });
  pdf.setFillColor('#EAF7F7');
  pdf.rect(0, 0, 210, 48, 'F');
  pdf.setFillColor(accent);
  pdf.rect(20, 17, 3, 15, 'F');
  pdf.setFont(font.CARESUITE_PDF_FONT, 'bold');
  pdf.setFontSize(17);
  pdf.setTextColor(ink);
  text('CareSuite+ Akademie', 29, 26);
  pdf.setFont(font.CARESUITE_PDF_FONT, 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(muted);
  text('Lernen · Schulungen · Wissensvermittlung', 29, 34);
  let y = 68;
  const block = (value: string, size: number, bold = false, color = ink, gap = 8) => {
    pdf.setFont(font.CARESUITE_PDF_FONT, bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    const lines = pdf.splitTextToSize(value, 170) as string[];
    const lineHeight = size * 0.3528 * 1.4;
    for (const line of lines) {
      if (y + lineHeight > 270) { pdf.addPage(); y = 28; }
      text(line, 20, y);
      y += lineHeight;
    }
    y += gap;
  };
  block('Teilnahmenachweis', 27, true, ink, 9);
  if (certificate.revokedAt) {
    block(`Widerrufen am ${displayDate(certificate.revokedAt)}`, 12, true, '#A33138', 5);
    if (certificate.revokedReason) block(certificate.revokedReason, 10, false, '#A33138', 8);
  }
  block(certificate.participantName, 21, true, accent, 4);
  block('hat die folgende Schulung abgeschlossen:', 11, false, muted, 7);
  block(certificate.courseTitle, 18, true, ink, 5);
  block(`Kursfassung ${certificate.versionNumber} · Geplanter Lernumfang ${certificate.estimatedMinutes} Minuten`, 10, false, muted, 10);
  block(`Abschluss bestätigt am ${displayDate(certificate.issuedAt)}`, 11, false, ink, 4);
  if (certificate.validUntil) block(`Gültig bis ${displayDate(certificate.validUntil)}`, 11, false, ink, 4);
  block(`Ausgestellt durch ${certificate.organizationName}`, 11, true, ink, 3);
  block(`Geprüft von ${certificate.issuerName}`, 10, false, muted, 8);
  block('Dieser Nachweis dokumentiert den bestätigten Lernabschluss. Er begründet keine berufliche Zulassung oder eigenständige Einsatzberechtigung.', 9, false, muted, 6);
  block(`Nachweisnummer: ${certificate.number}`, 9, false, ink, 3);
  block(`Referenz: ${certificate.id}`, 8, false, muted, 4);
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor('#D2E5E7');
    pdf.setLineWidth(0.3);
    pdf.line(20, 279, 190, 279);
    pdf.setTextColor(muted);
    pdf.setFont(font.CARESUITE_PDF_FONT, 'normal');
    pdf.setFontSize(8);
    text(`CareSuite+ Akademie · ${certificate.number}`, 20, 286);
    text(`${page} / ${pages}`, 190, 286, { align: 'right' });
  }
  return pdf;
}

export async function downloadAcademyCertificate(certificate: AcademyCertificate): Promise<void> {
  const pdf = await createAcademyCertificatePdf(certificate);
  const safeNumber = certificate.number.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80);
  pdf.save(`Teilnahmenachweis-${safeNumber || certificate.id}.pdf`);
}
