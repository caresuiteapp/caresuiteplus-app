import { jsPDF } from 'jspdf';
import { registerCareSuitePdfFont, CARESUITE_PDF_FONT, createCareSuitePdfText } from './centuryGothicPdf';
import { CENTRAL_COMMON_FIELDS } from './centralCatalogModel';
import { sha256FileHex } from '@/lib/crypto/sha256Hex';
import type { CentralDocumentSnapshot } from '@/types/documents/centralCatalog';

const NAVY = '#142C48';
const BLUE = '#086FDF';
const INK = '#253A51';
const MUTED = '#566B80';
const LIGHT = '#F1F6FC';
const RULE = '#D6E1EE';
export const CENTRAL_PDF_LAYOUT = { letterWindow: { x: 20, y: 45, width: 85, height: 45, addressY: 62.7 }, portraitMargin: 20, landscapeMargin: 15 } as const;
type CentralPdfResult = { bytes: Uint8Array; hash: string; pageCount: number; orientation: CentralDocumentSnapshot['definition']['orientation'] };

function displayDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('.') : value;
}

/** One vector renderer for preview, download, print and archive. No raster screenshots. */
export function renderCentralDocumentPdf(snapshot: CentralDocumentSnapshot, options: { logoDataUrl?: string } = {}) {
  return renderCentralDocumentPdfLayout(snapshot, options, false);
}

function renderCentralDocumentPdfLayout(snapshot: CentralDocumentSnapshot, options: { logoDataUrl?: string }, compactClosing: boolean): CentralPdfResult {
  if (JSON.stringify(snapshot).length > 1000000 || snapshot.tableRows.length > 1500) throw new Error('Der Dokumentinhalt ist zu groß. Bitte den Zeitraum oder die Anzahl der Tabellenzeilen reduzieren.');
  const { definition: d, values: v, context: c } = snapshot;
  const pdf = new jsPDF({ orientation: d.orientation, unit: 'mm', format: 'a4', compress: true });
  registerCareSuitePdfFont(pdf);
  const text = createCareSuitePdfText(pdf);
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = d.orientation === 'landscape' ? CENTRAL_PDF_LAYOUT.landscapeMargin : CENTRAL_PDF_LAYOUT.portraitMargin;
  const contentWidth = width - margin * 2;
  const bottom = height - 31;
  let y = 43;
  const font = (size = 10, bold = false, color = INK) => { pdf.setFont(CARESUITE_PDF_FONT, bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(color); };
  const wrap = (value: string, availableWidth = contentWidth, size = 10): string[] => {
    font(size);
    return pdf.splitTextToSize(value.replace(/\r/g, ''), availableWidth) as string[];
  };
  const header = (continued = false) => {
    pdf.setFillColor(BLUE); pdf.rect(margin, 13, 1.4, 15, 'F');
    const nameWidth = contentWidth - (options.logoDataUrl ? 55 : 38);
    const companyLines = wrap(v.companyName || 'Unternehmen ergänzen', nameWidth - 8, 13);
    if (companyLines.length > 2) throw new Error('Der Unternehmensname ist für den Briefkopf zu lang. Bitte eine passende Kurzbezeichnung verwenden.');
    font(13, true, NAVY); text(companyLines, margin + 5, 18, { lineHeightFactor: 1.25 });
    font(8, false, MUTED); text(continued ? 'Dokumentenkatalog · Fortsetzung' : 'Dokumentenkatalog · CareSuite HealthOS', margin + 5, 30);
    if (options.logoDataUrl) {
      const props = pdf.getImageProperties(options.logoDataUrl);
      const logoWidth = Math.min(34, 14 * props.width / props.height);
      const logoHeight = logoWidth * props.height / props.width;
      pdf.addImage(options.logoDataUrl, props.fileType, width - margin - logoWidth, 13, logoWidth, logoHeight);
    }
    font(8, true, BLUE); text('ENTWURF', width - margin, 33, { align: 'right' });
    pdf.setDrawColor(RULE); pdf.setLineWidth(0.3); pdf.line(margin, 36, width - margin, 36);
  };
  const next = () => { pdf.addPage('a4', d.orientation); header(true); y = 44; };
  const room = (needed: number) => { if (y + needed > bottom) next(); };
  const longText = d.layout === 'contract' || d.categoryKey === 'software' || d.categoryKey === 'datenschutz';
  const bodySize = longText && d.orientation === 'portrait' ? 11 : 10;
  const bodyLeading = longText ? (d.orientation === 'landscape' ? 4.5 : compactClosing ? 4.7 : 5) : 5.2;
  const paragraph = (value: string, size = bodySize, leading = bodyLeading) => {
    const lines = wrap(value || '[Noch auszufüllen]', contentWidth, size);
    let index = 0;
    while (index < lines.length) {
      const remaining = lines.length - index;
      let slots = Math.floor((bottom - y) / leading);
      if (slots < 1 || (remaining > 1 && slots < 2)) { next(); slots = Math.floor((bottom - y) / leading); }
      let take = Math.min(slots, remaining);
      if (remaining - take === 1 && take > 1) take--;
      if (take === 1 && remaining > 1) { next(); continue; }
      for (let i = 0; i < take; i++) { font(size); text(lines[index++], margin, y); y += leading; }
      if (index < lines.length) next();
    }
    y += longText ? (compactClosing ? 1.5 : 2) : 3;
  };
  const heading = (value: string, size = 11) => {
    const lines = wrap(value, contentWidth, size);
    room(lines.length * 5 + (compactClosing ? 13 : 18));
    font(size, true, NAVY); text(lines, margin, y, { lineHeightFactor: 1.3 }); y += lines.length * 5 + (compactClosing ? 2 : 3);
  };
  const field = (label: string, value: string) => {
    const lines = wrap(value || '[Noch auszufüllen]', contentWidth - 8, 9.5);
    const labelLines = wrap(label, contentWidth, 9);
    const fieldLeading = compactClosing ? 4.8 : 5.2;
    room(labelLines.length * 5 + Math.min(lines.length, 2) * fieldLeading + 5);
    font(9, true, NAVY); text(labelLines, margin, y, { lineHeightFactor: 1.3 });
    y += labelLines.length * 5 + (longText ? (compactClosing ? 0.5 : 1.5) : 3);
    for (const line of lines) {
      room(fieldLeading); pdf.setFillColor(LIGHT); pdf.rect(margin, y - 3.9, contentWidth, fieldLeading + 0.2, 'F');
      font(9.5); text(line, margin + 4, y); y += fieldLeading;
    }
    y += longText ? (compactClosing ? 2 : 3) : 4;
  };
  header();
  if (d.layout === 'letter') {
    // Form-B zones. Physical envelope/printer verification remains an acceptance step.
    const zone = CENTRAL_PDF_LAYOUT.letterWindow;
    const sender = `${v.companyName} · ${(v.companyAddress || '').replace(/\n/g, ' · ')}`;
    const senderLines = wrap(sender, zone.width, 8);
    if (senderLines.length > 2) throw new Error('Die Rücksendeangabe passt nicht in das Briefsichtfenster. Bitte eine kurze Anschrift verwenden.');
    font(8, false, MUTED); text(senderLines, zone.x, zone.y + 4.5, { lineHeightFactor: 1.2 });
    const recipient = [v.subjectName, v.subjectAddress].filter(Boolean).join('\n');
    const addressLines = wrap(recipient || '[Empfänger ergänzen]', zone.width, 10);
    if (addressLines.length > 6) throw new Error('Die Empfängeranschrift ist zu lang für das Sichtfenster. Bitte höchstens sechs Anschriftzeilen verwenden.');
    font(10); text(addressLines, zone.x, zone.addressY, { lineHeightFactor: 1.25 });
    font(8, false, MUTED); text('Datum', 128, 51); font(10); text(displayDate(v.date || ''), 128, 57);
    font(8, false, MUTED); text('Kontakt', 128, 68); const authorLines = wrap(v.author || '[ergänzen]', 62, 9);
    if (authorLines.length > 3) throw new Error('Die Kontaktangabe im Brief ist zu lang. Bitte eine kurze Bezeichnung verwenden.');
    font(9); text(authorLines, 128, 74, { lineHeightFactor: 1.25 });
    pdf.setDrawColor(RULE); pdf.line(4, 105, 8, 105); pdf.line(4, 210, 8, 210); pdf.line(4, 148.5, 8, 148.5);
    if (v.reference) { const references = wrap(`Ihr Zeichen: ${v.reference}`, 62, 8); if (references.length > 2) throw new Error('Das Aktenzeichen im Brief ist zu lang.'); font(8, false, MUTED); text(references, 128, 88, { lineHeightFactor: 1.2 }); }
    y = 101; heading(v.letterSubject || d.title, 13);
  } else {
    font(8, false, BLUE); text(d.categoryName.toLocaleUpperCase('de-DE'), margin, y); y += 8;
    heading(d.title, 17);
    const details = [v.birthDate && `Geb.: ${displayDate(v.birthDate)}`,v.careLevel && `Pflegegrad: ${v.careLevel}`,v.personnelNumber && `Personalnr.: ${v.personnelNumber}`,v.jobTitle].filter(Boolean).join(' · ');
    const payor = [v.payorName,v.insuranceNumber && `Versichertennr.: ${v.insuranceNumber}`].filter(Boolean).join(' · ');
    const identity = [`${d.target === 'employee' ? 'Mitarbeiter:in' : d.target === 'company' ? 'Organisation' : 'Klient:in / Patient:in'}: ${v.subjectName || '[ergänzen]'}`,v.subjectAddress,details,payor].filter(Boolean).join('\n');
    if (d.layout === 'contract') {
      heading('Vertragsparteien / Beteiligte',9);
      const cardWidth = (contentWidth-6)/2;
      const parties = [`${v.companyName}\n${v.companyAddress}`,identity];
      const lines = parties.map((value) => wrap(value,cardWidth-8,9.5));
      const cardHeight = Math.max(...lines.map((l) => l.length))*(compactClosing ? 4.8 : 5.2)+(compactClosing ? 6 : 8);
      room(cardHeight+4);
      lines.forEach((line,i) => { pdf.setFillColor(LIGHT); pdf.rect(margin+i*(cardWidth+6),y,cardWidth,cardHeight,'F'); font(9.5); text(line,margin+i*(cardWidth+6)+4,y+(compactClosing ? 5 : 6),{lineHeightFactor:compactClosing ? 1.43 : 1.55}); });
      y += cardHeight+(compactClosing ? 7 : 9);
    } else if (d.layout === 'table') paragraph(identity.replace(/\n/g,' · '),8.5,4.3);
    else field('Zuordnung', identity);
    paragraph(`Datum: ${displayDate(v.date || '')}    Verantwortlich: ${v.author || '[ergänzen]'}`, 8, 4.5);
    paragraph(`Dokument-ID: ${snapshot.documentId} · Fassung ${snapshot.revision} · Vorlage ${d.version}`, 8, 4);
  }
  if (d.sourceMode === 'original') { heading('Begleitblatt zur Originalunterlage'); paragraph(d.instructions, 9, 4.8); }
  else if (d.legalReviewRequired) { paragraph('Vorlagenentwurf · Die rechtliche Freigabe für den konkreten Anwendungsbereich steht aus.', 8, 4.5); }
  else if (d.clinicalReviewRequired) { paragraph('Fachlicher Entwurf · Angaben und Maßnahmen durch die zuständige qualifizierte Person prüfen.', 8, 4.5); }
  if (d.layout !== 'letter') for (const f of d.fields.filter((item) => !CENTRAL_COMMON_FIELDS.has(item.key))) {
    if (d.layout === 'table') paragraph(`${f.label}: ${v[f.key] || '[Noch auszufüllen]'}`,8.5,4.3);
    else field(f.label, v[f.key]);
  }
  for (const section of d.sections) { if (d.layout !== 'letter') heading(section.heading); paragraph(snapshot.sectionTexts[section.key] ?? section.text); }
  if (d.layout === 'letter' && v.enclosures?.trim()) { heading('Anlagen', 9); paragraph(v.enclosures, 9, 4.5); }

  if (d.columns.length) {
    const count = d.columns.length;
    const weights = d.columns.map((col) => /^(Beginn|Ende)$/.test(col) ? 0.65 : /Leistung|Gegenstand|Prüfpunkt|Beobachtung|Maßnahme|Fahrtzweck|Arzneimittel/.test(col) ? 2.5 : 1.1);
    const totalWeight = weights.reduce((a,b) => a+b,0);
    const widths = weights.map((w) => contentWidth*w/totalWeight);
    const offsets = widths.map((_,i) => widths.slice(0,i).reduce((a,b) => a+b,0));
    const headerLines = d.columns.map((col,i) => wrap(col, widths[i] - 5, 8));
    const headerHeight = Math.max(...headerLines.map((lines) => lines.length)) * 4.2 + 5;
    const tableHeader = () => {
      pdf.setFillColor(NAVY); pdf.rect(margin, y, contentWidth, headerHeight, 'F');
      headerLines.forEach((lines, i) => { font(8, true, '#FFFFFF'); text(lines, margin + offsets[i] + 2.5, y + 4.5, { lineHeightFactor: 1.45 }); });
      y += headerHeight;
    };
    const minimumRowHeight = 8.2;
    room(headerHeight + minimumRowHeight); tableHeader();
    const rows = snapshot.tableRows.length ? snapshot.tableRows : [d.columns.map(() => '')];
    rows.forEach((row, rowIndex) => {
      const cellLines = d.columns.map((_, i) => wrap(row[i] || '—', widths[i] - 5, 8));
      let offset = 0;
      const maxLines = Math.max(...cellLines.map((lines) => lines.length));
      while (offset < maxLines) {
        if (bottom - y + 0.000001 < minimumRowHeight) { next(); tableHeader(); }
        const available = Math.max(1, Math.floor((bottom - y - 4) / 4.2));
        const take = Math.min(maxLines - offset, available);
        const rowHeight = take * 4.2 + 4;
        pdf.setFillColor(rowIndex % 2 === 0 ? LIGHT : '#FFFFFF'); pdf.rect(margin, y, contentWidth, rowHeight, 'F');
        pdf.setDrawColor(RULE); pdf.setLineWidth(0.15);
        for (const offsetX of [...offsets,contentWidth]) pdf.line(margin + offsetX, y, margin + offsetX, y + rowHeight);
        pdf.line(margin, y + rowHeight, width - margin, y + rowHeight);
        cellLines.forEach((lines, i) => { const chunk = lines.slice(offset, offset + take); if (chunk.length) { font(8); text(chunk, margin + offsets[i] + 2.5, y + 4.2, { lineHeightFactor: 1.48 }); } });
        y += rowHeight; offset += take;
        if (offset < maxLines) { next(); tableHeader(); }
      }
    });
    y += 10;
  }
  const pageBeforeClosing = pdf.getNumberOfPages();
  if (snapshot.additionalText.trim()) { heading('Individuelle Ergänzungen / Vereinbarungen'); paragraph(snapshot.additionalText); }
  if (d.layout === 'contract') {
    room(22); y += 10; pdf.setDrawColor(RULE); pdf.line(margin, y, margin + contentWidth * 0.43, y); pdf.line(margin + contentWidth * 0.55, y, width - margin, y);
    font(8, false, MUTED); text('Ort, Datum · Unternehmen', margin, y + 5); text('Ort, Datum · berechtigte Person', margin + contentWidth * 0.55, y + 5);
  }
  // Keep closing fields with the contract where modest spacing changes suffice.
  // Retry once, preserving the body font size and every supplied text.
  if (d.layout === 'contract' && !compactClosing && pdf.getNumberOfPages() > pageBeforeClosing) {
    return renderCentralDocumentPdfLayout(snapshot, options, true);
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor(RULE); pdf.line(margin, height - 24, width - margin, height - 24);
    const contacts = [v.companyAddress?.replace(/\n/g,' · '),c.company.phone,c.company.email,c.company.website].filter(Boolean).join(' · ');
    const legal = [c.company.representativeName && `Vertretung: ${c.company.representativeName}`,c.company.registerCourt, c.company.registerNumber, c.company.taxId && `Steuernr. ${c.company.taxId}`, c.company.vatId && `USt-IdNr. ${c.company.vatId}`, c.company.ikNumber && `IK ${c.company.ikNumber}`].filter(Boolean).join(' · ');
    const footerLines = wrap([contacts, legal].filter(Boolean).join('\n'), contentWidth * 0.74, 8);
    if (footerLines.length > 4) throw new Error('Die Unternehmensangaben sind für die Fußzeile zu lang. Bitte die Dokumenteinstellungen prüfen.');
    font(8, false, MUTED); if (footerLines.length) text(footerLines, margin, height - 21, { lineHeightFactor: 1.25 });
    font(8, true, BLUE); text(`ENTWURF · ${page} / ${pages}`, width - margin, height - 21, { align: 'right' });
    font(8, false, MUTED); text(`CareSuite HealthOS · ${snapshot.documentId} · v${snapshot.revision}`, margin, height - 5);
  }
  pdf.setProperties({ title: d.title, author: v.author, creator: 'CareSuite HealthOS Dokumentenkatalog', subject: `Entwurf · ${snapshot.documentId}` });
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  return { bytes, hash: sha256FileHex(bytes), pageCount: pages, orientation: d.orientation };
}
