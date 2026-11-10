import type { jsPDF } from 'jspdf';
import { CARESUITE_PDF_FONT, createCareSuitePdfText } from '@/lib/documents/centuryGothicPdf';
import { KLARBLATT_LOGO } from './klarblattLogo';
import type { AcademyCertificate } from './workspaceModel';
import { NRW_MODULES } from './nrwCourse';

type KlarblattCertificate = AcademyCertificate & { qualification: NonNullable<AcademyCertificate['qualification']> };

export function renderKlarblattPdf(pdf: jsPDF, certificate: KlarblattCertificate, displayDate: (value: string) => string) {
  const text = createCareSuitePdfText(pdf);
  const proof = certificate.qualification;
  const ink = '#11263A';
  const muted = '#40586C';
  const green = '#007D6D';
  const mint = '#EBF6F1';
  const deep = '#153B38';
  const white = '#FFFFFF';
  const label = (value: string, x: number, y: number, options: { align?: 'right'; color?: string; size?: number } = {}) => {
    pdf.setFont(CARESUITE_PDF_FONT, 'bold');
    pdf.setFontSize(options.size ?? 8.1);
    pdf.setTextColor(options.color ?? muted);
    pdf.setCharSpace(0.48);
    text(value, x, y, { align: options.align });
    pdf.setCharSpace(0);
  };
  const line = (value: string, x: number, y: number, width: number, size: number, color = ink, bold = false, align: 'left' | 'right' = 'left') => {
    const singleLine = value.replace(/\s+/g, ' ').trim();
    pdf.setFont(CARESUITE_PDF_FONT, bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    const naturalWidth = pdf.getTextWidth(singleLine);
    if (naturalWidth > width) pdf.setFontSize(size * width / naturalWidth);
    text(singleLine, x, y, { align });
  };
  const panel = (heading: string, value: string, x: number) => {
    pdf.setFillColor(mint);
    pdf.roundedRect(x, 95.3, 86, 22.5, 3.2, 3.2, 'F');
    label(heading, x + 5.5, 102.4, { color: deep });
    line(value, x + 5.5, 111, 75, 13, ink, true);
  };

  pdf.setProperties({
    title: `Zertifikat ${certificate.number}`, subject: certificate.courseTitle,
    author: certificate.organizationName, creator: 'CareSuite HealthOS Akademie',
  });
  pdf.setFillColor(green);
  pdf.rect(0, 0, 297, 2.7, 'F');
  label('04  KLARBLATT', 16, 13.6);
  label(certificate.revokedAt ? 'WIDERRUFEN' : 'CARESUITE AKADEMIE', 282, 13.6,
    { align: 'right', color: certificate.revokedAt ? '#983340' : muted });

  pdf.setFillColor(green);
  pdf.roundedRect(14.8, 24.7, 1.4, 54.6, 0.65, 0.65, 'F');
  label('ZERTIFIKAT', 22.5, 36.2, { size: 13, color: green });
  line(certificate.participantName, 21.9, 56.7, 259, 47);
  line([certificate.organizationName, proof.personnelNumber && `Personalnummer ${proof.personnelNumber}`].filter(Boolean).join(' · '),
    22.5, 66.1, 255, 11.8, muted);
  line(certificate.courseTitle, 22.5, 79.4, 255, 16.5, ink, true);
  line('Unterstützung im Alltag · § 8 AnFöVO NRW · §§ 45a, 45b SGB XI', 22.5, 86.2, 255, 10.3);

  panel('UMFANG', `${certificate.estimatedMinutes / 45} UE à 45 Minuten`, 15.2);
  panel('ABSCHLUSS', displayDate(proof.completedAt), 104.8);
  panel('PRÜFUNG', `Bestanden · ${proof.examScore} %`, 194.4);

  label('INHALTE DER SCHULUNG', 15.2, 127.1);
  NRW_MODULES.forEach((module, index) => {
    const x = index < 4 ? 15.2 : 148.5;
    const y = 134.7 + (index % 4) * 6;
    line(String(index + 1).padStart(2, '0'), x, y, 7.5, 8.3, green);
    line(module, x + 8.5, y, 116, 10.4);
  });

  pdf.setDrawColor('#A6BFC1');
  pdf.setLineWidth(0.2);
  pdf.line(15.2, 168.7, 99.5, 168.7);
  line(`${certificate.issuerName} · Fachlich geprüft`, 15.2, 174.1, 120, 10, ink, true);
  line(certificate.organizationName, 15.2, 179.4, 120, 10, muted);
  line(`${proof.practiceKind === 'first_aid' ? 'Erste-Hilfe-Nachweis' : 'Praktische Notfallschulung'} · ${displayDate(proof.practiceDate)}`,
    282, 169.7, 141, 9.2, muted, false, 'right');
  line(certificate.number, 282, 175.8, 141, 8.7, muted, false, 'right');
  line(`Fassung ${certificate.versionNumber} · Ausgestellt am ${displayDate(certificate.issuedAt)}`,
    282, 181.3, 141, 8.7, muted, false, 'right');
  if (certificate.revokedAt) line(`Widerrufen am ${displayDate(certificate.revokedAt)} · ${certificate.revokedReason ?? ''}`, 15.2, 188, 265, 9, '#983340');
  else if (certificate.validUntil) line(`Gültig bis ${displayDate(certificate.validUntil)}`, 282, 186.4, 141, 8.7, muted, false, 'right');

  pdf.setFillColor(deep);
  pdf.rect(0, 193.4, 297, 16.6, 'F');
  label('LERNPLATTFORM', 15.2, 201.4, { color: '#A3D7E5', size: 7 });
  line('CareSuite Akademie', 15.2, 206, 100, 9.4, white);
  const logo = pdf.getImageProperties(KLARBLATT_LOGO);
  const logoWidth = 64.5;
  const logoHeight = logo.height / logo.width * logoWidth;
  pdf.addImage(KLARBLATT_LOGO, 'PNG', 282 - logoWidth, 201.7 - logoHeight / 2, logoWidth, logoHeight);
}
