import * as jsPdfModule from 'jspdf/dist/jspdf.es.min.js';
import { CARESUITE_DOCUMENT_WORDMARK } from '@/design/careSuiteDocumentWordmark';
import { SOURCE_SANS_3_PDF_FONT, registerSourceSans3PdfFont } from '@/design/fonts/sourceSans3Pdf';
import { registerCareSuitePdfFont, CARESUITE_PDF_FONT, createCareSuitePdfText } from './centuryGothicPdf';
import { CENTRAL_COMMON_FIELDS } from './centralCatalogModel';
import { sha256FileHex } from '@/lib/crypto/sha256Hex';
import type { CentralDocumentSnapshot } from '@/types/documents/centralCatalog';

// Keep Expo's static renderer on the browser build, as in the other PDF services.
const { jsPDF } = jsPdfModule as unknown as typeof import('jspdf');

const NAVY = '#122C3A';
const TEAL = '#26616C';
const INK = '#1A2D36';
const MUTED = '#465B65';
const LIGHT = '#F3F7F8';
const TINT = '#EAF2F4';
const RULE = '#C6D6DA';
const FORM_START = 42;
const CONTINUATION_START = 43;
export const CENTRAL_PDF_LAYOUT = { letterWindow: { x: 20, y: 45, width: 85, height: 45, addressY: 62.7 }, portraitMargin: 20, landscapeMargin: 15, signatureSpace: 20 } as const;
type CentralPdfResult = { bytes: Uint8Array; hash: string; pageCount: number; orientation: CentralDocumentSnapshot['definition']['orientation'] };
const SERVICE_PROOF_SIGNATURES: Readonly<Record<string, readonly [string, string]>> = {
  csdc_einsatz_006: ['Leistungserbringende Person', 'Klient:in / berechtigte Vertretung'],
  csdc_alltag_016: ['Leistungserbringende Person', 'Klient:in / berechtigte Vertretung'],
  csdc_abrechnung_001: ['Leistungserbringende Person', 'Klient:in / berechtigte Vertretung'],
};
const CONTRACT_CLOSING_SPACE = 58;
const SIGNATURE_BLOCK_HEIGHT = CENTRAL_PDF_LAYOUT.signatureSpace + 9;
const PROOF_CLOSING_SPACE = SIGNATURE_BLOCK_HEIGHT + 8;

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
  const edition2027 = d.edition === '2027';
  const proofSignatureRoles = d.sourceMode === 'create' ? SERVICE_PROOF_SIGNATURES[d.key] : undefined;
  const compactProof = !!proofSignatureRoles && d.orientation === 'landscape';
  const pdf = new jsPDF({ orientation: d.orientation, unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  registerCareSuitePdfFont(pdf);
  registerSourceSans3PdfFont(pdf);
  const displayText = createCareSuitePdfText(pdf);
  const text = pdf.text.bind(pdf);
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = d.orientation === 'landscape' ? CENTRAL_PDF_LAYOUT.landscapeMargin : CENTRAL_PDF_LAYOUT.portraitMargin;
  const contentWidth = width - margin * 2;
  const right = width - margin;
  let y = compactProof ? 36 : FORM_START;
  let lastPageLines = 0;
  const font = (size = 10.5, bold = false, color = INK, face = SOURCE_SANS_3_PDF_FONT) => {
    pdf.setFont(face, bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(color);
  };
  const wrap = (value: string, availableWidth = contentWidth, size = 10.5, bold = false, face = SOURCE_SANS_3_PDF_FONT): string[] => {
    font(size, bold, INK, face);
    return pdf.splitTextToSize(value.replace(/\r/g, ''), availableWidth) as string[];
  };
  const printLines = (lines: readonly string[], x: number, baseline: number, step: number) => {
    lines.forEach((line, index) => text(line, x, baseline + index * step));
  };
  const footerLogoWidth = 45;
  const footerLeading = 3.45;
  const traceLeading = 3.2;
  const contacts = [v.companyAddress?.replace(/\n/g, ' · '), c.company.phone, c.company.email, c.company.website].filter(Boolean).join(' · ');
  const legal = [c.company.representativeName && `Vertretung: ${c.company.representativeName}`, c.company.registerCourt, c.company.registerNumber, c.company.taxId && `Steuernr. ${c.company.taxId}`, c.company.vatId && `USt-IdNr. ${c.company.vatId}`, c.company.ikNumber && `IK ${c.company.ikNumber}`].filter(Boolean).join(' · ');
  const companyDetails = [contacts, legal].filter(Boolean).join('\n');
  const footerLines = companyDetails ? wrap(companyDetails, contentWidth - footerLogoWidth - 8, 8.25) : [];
  const trace = wrap(`${d.key} · Vorlage ${d.version}  /  ${snapshot.documentId} · Fassung ${snapshot.revision}`, contentWidth, 7.75);
  if (footerLines.length > 8 || trace.length > 4) throw new Error('Die Angaben zur Zuordnung sind für die Fußzeile zu lang. Bitte die Dokumenteinstellungen prüfen.');
  const traceTop = height - 6 - (trace.length - 1) * traceLeading;
  const footerTop = traceTop - Math.max(19, 10 + (footerLines.length - 1) * footerLeading);
  const bottom = footerTop - 6;
  const tenantLogo = options.logoDataUrl ? pdf.getImageProperties(options.logoDataUrl) : null;
  const header = (continued = false) => {
    const nameWidth = tenantLogo ? contentWidth - 51 : contentWidth - 5;
    const company = v.companyName || 'Unternehmen ergänzen';
    let companyLines = wrap(company, nameWidth, 15, true);
    const companySize = companyLines.length > 2 ? 12 : 15;
    if (companySize === 12) companyLines = wrap(company, nameWidth, companySize, true);
    if (companyLines.length > 3) throw new Error('Der Unternehmensname ist für den Briefkopf zu lang. Bitte eine passende Kurzbezeichnung verwenden.');
    font(companySize, true, NAVY);
    printLines(companyLines, margin, 15.5, 4.5);
    if (continued || edition2027) {
      const subtitle = continued ? `${d.title} · Fortsetzung` : 'Ausgabe 2027';
      const subtitleWidth = continued ? nameWidth : contentWidth;
      const subtitleLines = wrap(subtitle, subtitleWidth, 8.5);
      if (subtitleLines.length > 2) font(8, false, MUTED);
      else font(8.5, false, MUTED);
      // A full document title remains on the opening page. The continuation still identifies its template.
      printLines(subtitleLines.length <= 2 ? subtitleLines : [`${d.key} · Fortsetzung`], margin, 28.3, 3.5);
    }
    if (options.logoDataUrl && tenantLogo) {
      const logoWidth = Math.min(39, 15 * tenantLogo.width / tenantLogo.height);
      const logoHeight = logoWidth * tenantLogo.height / tenantLogo.width;
      pdf.addImage(options.logoDataUrl, tenantLogo.fileType, right - logoWidth, 18 - logoHeight / 2, logoWidth, logoHeight, 'tenant-document-logo');
    }
    const headerRule = compactProof && !continued ? 29 : 35;
    pdf.setDrawColor(RULE); pdf.setLineWidth(0.28); pdf.line(margin, headerRule, right, headerRule);
    pdf.setDrawColor(TEAL); pdf.setLineWidth(0.75); pdf.line(margin, headerRule, margin + 16, headerRule);
  };
  const next = () => { pdf.addPage('a4', d.orientation); header(true); y = CONTINUATION_START; lastPageLines = 0; };
  const room = (needed: number) => { if (y + needed > bottom) next(); };
  const longText = d.layout === 'contract' || d.categoryKey === 'software' || d.categoryKey === 'datenschutz';
  const bodySize = longText && d.orientation === 'portrait' ? 11 : 10.5;
  const bodyLeading = longText ? (d.orientation === 'landscape' ? 4.5 : compactClosing ? 4.65 : 5) : 5.15;
  const paragraph = (value: string, size = bodySize, leading = bodyLeading, keepWithNext = 0) => {
    const lines = wrap(value || '[Noch auszufüllen]', contentWidth, size);
    let index = 0;
    while (index < lines.length) {
      const remaining = lines.length - index;
      let slots = Math.floor((bottom - y) / leading);
      if (slots < 1 || (remaining > 1 && slots < 2)) { next(); slots = Math.floor((bottom - y) / leading); }
      let take = Math.min(slots, remaining);
      if (keepWithNext && remaining <= slots && remaining * leading + keepWithNext > bottom - y) {
        // Keep the last part of the agreement beside its signature block.
        if (remaining <= 8) { next(); continue; }
        take = remaining - 8;
      }
      if (remaining - take === 1 && take > 1) take--;
      if (take === 1 && remaining > 1) { next(); continue; }
      for (let i = 0; i < take; i++) { font(size); text(lines[index++], margin, y); y += leading; lastPageLines++; }
      if (index < lines.length) next();
    }
    y += longText ? (compactClosing ? 1.5 : 2) : proofSignatureRoles ? 1.5 : 3;
  };
  const heading = (value: string, size = 11) => {
    const display = size >= 17;
    const face = display ? CARESUITE_PDF_FONT : SOURCE_SANS_3_PDF_FONT;
    const lines = wrap(value, contentWidth, size, true, face);
    const lineHeight = Math.max(4.5, size * 0.42);
    room(lines.length * lineHeight + (compactClosing ? 12 : 16));
    font(size, true, NAVY, face);
    (display ? displayText : text)(lines, margin, y, { lineHeightFactor: lineHeight / (size * 0.352778) });
    y += (lines.length - 1) * lineHeight + (display ? 8.2 : lineHeight + (compactClosing ? 2 : 3));
    lastPageLines += lines.length;
  };
  const field = (label: string, value: string, writingSpace = false) => {
    const empty = !value?.trim();
    const lines = wrap(empty ? '[Noch auszufüllen]' : value, contentWidth - 10, 10.5);
    if (empty && writingSpace) lines.push('');
    const fieldLeading = compactClosing ? 4.45 : 4.95;
    const labelLeading = 4.3;
    const pad = compactClosing ? 4 : 5.5;
    let offset = 0;
    while (offset < lines.length) {
      const labelLines = wrap(offset ? `${label} · Fortsetzung` : label, contentWidth, 10, true);
      const labelHeight = labelLines.length * labelLeading;
      const labelAndPadding = labelHeight + pad;
      room(labelAndPadding + Math.min(2, lines.length - offset) * fieldLeading);
      const take = Math.min(lines.length - offset, Math.max(1, Math.floor((bottom - y - labelAndPadding) / fieldLeading)));
      const blockTop = y + labelHeight - 1.3;
      const blockHeight = take * fieldLeading + pad;
      font(10, true, TEAL);
      printLines(labelLines, margin, y, labelLeading);
      pdf.setFillColor(LIGHT); pdf.rect(margin, blockTop, contentWidth, blockHeight, 'F');
      pdf.setDrawColor(RULE); pdf.setLineWidth(0.32); pdf.line(margin, blockTop, margin, blockTop + blockHeight);
      font(10.5, false, empty ? MUTED : INK);
      printLines(lines.slice(offset, offset + take), margin + 4.5, blockTop + 4.9, fieldLeading);
      if (empty && writingSpace) {
        pdf.setDrawColor(RULE); pdf.setLineWidth(0.2);
        pdf.line(margin + 4.5, blockTop + blockHeight - 2.1, right - 4.5, blockTop + blockHeight - 2.1);
      }
      lastPageLines += labelLines.length + take;
      y = blockTop + blockHeight + (longText ? 3.7 : 5.4);
      offset += take;
      if (offset < lines.length) next();
    }
  };
  const informationPanel = (items: readonly { label: string; value: string; weight: number }[]) => {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    const labelSize = 8.5;
    const valueSize = 10;
    const leading = 4;
    const columns = items.map(item => {
      const cellWidth = contentWidth * item.weight / total;
      return { ...item, cellWidth, lines: wrap(item.value, cellWidth - 11, valueSize) };
    });
    const panelHeight = (compactProof ? 8.8 : 11.8) + Math.max(...columns.map(column => column.lines.length)) * leading;
    if (panelHeight > bottom - CONTINUATION_START) {
      items.forEach(item => field(item.label, item.value));
      return;
    }
    room(panelHeight + 2);
    const top = y - 1.8;
    pdf.setFillColor(TINT); pdf.rect(margin, top, contentWidth, panelHeight, 'F');
    let x = margin;
    columns.forEach((column, index) => {
      if (index > 0) {
        pdf.setDrawColor(RULE); pdf.setLineWidth(0.25); pdf.line(x, top + 4, x, top + panelHeight - 4);
      }
      font(labelSize, true, TEAL);
      text(column.label, x + 5, top + (compactProof ? 4.9 : 6));
      font(valueSize);
      printLines(column.lines, x + 5, top + (compactProof ? 9.35 : 11.2), leading);
      x += column.cellWidth;
    });
    y = top + panelHeight + (compactProof ? 5.5 : 6.5);
    lastPageLines += Math.max(...columns.map(column => column.lines.length)) + 1;
  };
  const tableAnnotation = (label: string, value: string) => {
    const labelWidth = Math.min(contentWidth * 0.36, 69);
    const labelLines = wrap(label, labelWidth - 5, 9.5, true);
    const valueLines = wrap(value || '[Noch auszufüllen]', contentWidth - labelWidth, 9.5);
    const rows = Math.max(labelLines.length, valueLines.length);
    if (rows > 6) { field(label, value); return; }
    const annotationHeight = rows * 4.25 + (compactProof ? 1 : 1.5);
    room(annotationHeight);
    font(9.5, true, TEAL); printLines(labelLines, margin, y, 4.25);
    font(9.5); printLines(valueLines, margin + labelWidth, y, 4.25);
    y += annotationHeight;
    lastPageLines += rows;
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
    y = 101; heading(v.letterSubject || d.title, 17);
  } else {
    font(8.7, true, TEAL); text(d.categoryName.toLocaleUpperCase('de-DE'), margin, y); y += compactProof ? 7.5 : 8.7;
    heading(d.title, d.orientation === 'landscape' ? 22 : 23);
    const subjectLabel = d.target === 'employee' ? 'Mitarbeiter:in' : d.target === 'company' ? 'Organisation' : 'Klient:in / Patient:in';
    const details = [v.birthDate && `Geb.: ${displayDate(v.birthDate)}`,v.careLevel && `Pflegegrad: ${v.careLevel}`,v.personnelNumber && `Personalnr.: ${v.personnelNumber}`,v.jobTitle].filter(Boolean).join(' · ');
    const payor = [v.payorName,v.insuranceNumber && `Versichertennr.: ${v.insuranceNumber}`].filter(Boolean).join(edition2027 ? '\n' : ' · ');
    const identity = [v.subjectName || '[ergänzen]', v.subjectAddress, details, payor].filter(Boolean).join('\n');
    if (d.layout === 'contract') {
      const companyParty = `${v.companyName}\n${v.companyAddress}`;
      const parties = [{ label: 'Unternehmen', value: companyParty, weight: 1 }];
      if (d.target !== 'company') parties.push({ label: subjectLabel, value: identity, weight: 1 });
      else if (v.cs_provider?.trim()) parties.push({ label: 'Softwareanbieter / Vertragspartner', value: v.cs_provider, weight: 1 });
      informationPanel(parties);
      paragraph(`Dokumentdatum: ${displayDate(v.date || '')}    Verantwortlich: ${v.author || '[ergänzen]'}`, 9.25, 4.5);
    } else {
      const compactIdentity = [v.subjectName || '[ergänzen]', [v.subjectAddress, details, payor].filter(Boolean).join(' · ').replace(/\n/g, ' · ')].filter(Boolean).join('\n');
      informationPanel([
        { label: subjectLabel, value: d.orientation === 'landscape' ? compactIdentity : identity, weight: 3.6 },
        { label: 'Dokumentdatum', value: displayDate(v.date || '') || '[ergänzen]', weight: 1.3 },
        { label: 'Verantwortlich', value: v.author || '[ergänzen]', weight: 1.7 },
      ]);
    }
  }
  if (d.sourceMode === 'original') { heading('Begleitblatt zur Originalunterlage'); paragraph(d.instructions, 9, 4.8); }
  else if (d.legalReviewRequired) { paragraph('Vorlagenentwurf · Die rechtliche Freigabe für den konkreten Anwendungsbereich steht aus.', 8, 4.5); }
  else if (d.clinicalReviewRequired) { paragraph('Fachlicher Entwurf · Angaben und Maßnahmen durch die zuständige qualifizierte Person prüfen.', 8, 4.5); }
  if (d.layout !== 'letter' || edition2027) for (const f of d.fields.filter((item) => !CENTRAL_COMMON_FIELDS.has(item.key) && (d.layout !== 'letter' || item.key.startsWith('legal_')))) {
    if (d.layout === 'table') tableAnnotation(f.label, v[f.key]);
    else field(f.label, v[f.key], f.type === 'multiline');
  }
  for (const [index, section] of d.sections.entries()) {
    if (d.layout !== 'letter' || edition2027 && index > 0) heading(edition2027 ? `${String(index + 1).padStart(2, '0')}  ${section.heading.replace(/^(?:§\s*)?\d+[.\s]+/, '')}` : section.heading);
    paragraph(snapshot.sectionTexts[section.key] ?? section.text, bodySize, bodyLeading, edition2027 && d.layout === 'contract' && index === d.sections.length - 1 && !snapshot.additionalText.trim() ? CONTRACT_CLOSING_SPACE + 2 : 0);
  }
  if (d.layout === 'letter' && v.enclosures?.trim()) { heading('Anlagen', 9); paragraph(v.enclosures, 9, 4.5); }

  if (d.columns.length) {
    const weights = d.columns.map(col => /^(Beginn|Ende)$/.test(col) ? 0.7 : /Leistung|Gegenstand|Prüfpunkt|Beobachtung|Maßnahme|Fahrtzweck|Arzneimittel/.test(col) ? 2.5 : 1.1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map(weight => contentWidth * weight / totalWeight);
    const offsets = widths.map((_, index) => widths.slice(0, index).reduce((sum, columnWidth) => sum + columnWidth, 0));
    const tableSize = 9.2;
    const tableLeading = 4.15;
    const rowPadding = compactProof ? 4.25 : 4.6;
    const cellInset = 2.6;
    const headerLines = d.columns.map((col, index) => wrap(col, widths[index] - 2 * cellInset, tableSize, true));
    const maxHeaderLines = Math.max(...headerLines.map(lines => lines.length));
    const headerHeight = maxHeaderLines * tableLeading + rowPadding;
    const tableHeader = () => {
      pdf.setFillColor(TINT); pdf.rect(margin, y, contentWidth, headerHeight, 'F');
      font(tableSize, true, NAVY);
      headerLines.forEach((lines, index) => printLines(lines, margin + offsets[index] + cellInset, y + 4.95, tableLeading));
      lastPageLines += maxHeaderLines;
      y += headerHeight;
      pdf.setDrawColor(TEAL); pdf.setLineWidth(0.38); pdf.line(margin, y, right, y);
    };
    const rows = snapshot.tableRows.length ? snapshot.tableRows : [d.columns.map(() => '')];
    const minimumRowHeight = tableLeading + rowPadding;
    const tableEndGap = proofSignatureRoles ? 6.5 : 10;
    const reserveClosing = proofSignatureRoles && !snapshot.additionalText.trim() ? PROOF_CLOSING_SPACE + tableEndGap : 0;
    y += 1.5;
    room(headerHeight + minimumRowHeight + (rows.length === 1 ? reserveClosing : 0));
    tableHeader();
    rows.forEach((row, rowIndex) => {
      const cellLines = d.columns.map((_, index) => wrap(row[index] || '—', widths[index] - 2 * cellInset, tableSize));
      let offset = 0;
      const maxLines = Math.max(...cellLines.map(lines => lines.length));
      const lastRowWithClosing = maxLines * tableLeading + rowPadding + reserveClosing;
      if (reserveClosing && rowIndex === rows.length - 1 && lastRowWithClosing > bottom - y && lastRowWithClosing <= bottom - CONTINUATION_START - headerHeight) {
        next(); tableHeader();
      }
      while (offset < maxLines) {
        if (bottom - y + 0.000001 < minimumRowHeight) { next(); tableHeader(); }
        const available = Math.max(1, Math.floor((bottom - y - rowPadding) / tableLeading));
        const take = Math.min(maxLines - offset, available);
        const rowHeight = take * tableLeading + rowPadding;
        if (rowIndex % 2 !== 0) { pdf.setFillColor(LIGHT); pdf.rect(margin, y, contentWidth, rowHeight, 'F'); }
        pdf.setDrawColor(RULE); pdf.setLineWidth(0.15);
        pdf.line(margin, y + rowHeight, right, y + rowHeight);
        font(tableSize);
        cellLines.forEach((lines, index) => printLines(lines.slice(offset, offset + take), margin + offsets[index] + cellInset, y + 4.95, tableLeading));
        lastPageLines += take;
        y += rowHeight; offset += take;
        if (offset < maxLines) { next(); tableHeader(); }
      }
    });
    y += tableEndGap;
  }
  const pageBeforeClosing = pdf.getNumberOfPages();
  if (snapshot.additionalText.trim()) { heading('Individuelle Ergänzungen / Vereinbarungen'); paragraph(snapshot.additionalText, bodySize, bodyLeading, edition2027 && d.layout === 'contract' ? CONTRACT_CLOSING_SPACE + 2 : 0); }
  const signatureRoles = d.sourceMode === 'create'
    ? proofSignatureRoles ?? (d.layout === 'contract' ? ['Unternehmen', 'Berechtigte Person'] : undefined)
    : undefined;
  if (signatureRoles) {
    if (edition2027) {
      room(CONTRACT_CLOSING_SPACE);
      heading('Erklärungen und Unterschriften');
      paragraph('Bitte prüfen Sie die Angaben und Anlagen vor der Unterzeichnung. Jede beteiligte Person erhält eine vollständige Kopie dieser Fassung.', 9, 4.5);
    } else if (d.layout !== 'contract') {
      room(PROOF_CLOSING_SPACE);
      heading('Bestätigung der erbrachten Leistungen');
    }
    room(SIGNATURE_BLOCK_HEIGHT);
    const signatureWidth = (contentWidth - 10) / 2;
    for (const [i, role] of signatureRoles.entries()) {
      const x = margin + i * (signatureWidth + 10);
      font(10, true, NAVY); text(role, x, y);
      const lineY = y + CENTRAL_PDF_LAYOUT.signatureSpace;
      pdf.setDrawColor(MUTED); pdf.setLineWidth(0.26); pdf.line(x, lineY, x + signatureWidth, lineY);
      font(8.5, false, MUTED); text('Unterschrift', x, lineY + 5);
      text('Name · Ort · Datum', x + signatureWidth, lineY + 5, { align: 'right' });
    }
    y += SIGNATURE_BLOCK_HEIGHT;
    lastPageLines += 2;
  }
  // Balance short final pages and keep closing fields with the contract.
  // Retry once, preserving the body font size and every supplied text.
  const splitClosing = d.layout === 'contract' && pdf.getNumberOfPages() > pageBeforeClosing;
  const shortFinalPage = longText && pdf.getNumberOfPages() > 1 && lastPageLines < 8;
  if (!compactClosing && (splitClosing || shortFinalPage)) {
    return renderCentralDocumentPdfLayout(snapshot, options, true);
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(RULE); pdf.setLineWidth(0.28); pdf.line(margin, footerTop, right, footerTop);
    const logoX = right - footerLogoWidth;
    pdf.setFillColor(NAVY);
    pdf.roundedRect(logoX, footerTop + 2.8, footerLogoWidth, 8, 0.9, 0.9, 'F');
    pdf.addImage(CARESUITE_DOCUMENT_WORDMARK, 'PNG', logoX + 4.5, footerTop + 4.55, 36, 4.5, 'care-suite-document-wordmark');
    font(8.25, false, MUTED); printLines(footerLines, margin, footerTop + 5, footerLeading);
    font(8.25, true, TEAL); text(`Entwurf · Seite ${page} von ${pages}`, right, footerTop + 15.1, { align: 'right' });
    font(7.75, false, MUTED); printLines(trace, margin, traceTop, traceLeading);
  }
  pdf.setProperties({ title: d.title, author: v.author, creator: 'CareSuite HealthOS Dokumentenkatalog', subject: `Entwurf · ${snapshot.documentId}` });
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  return { bytes, hash: sha256FileHex(bytes), pageCount: pages, orientation: d.orientation };
}
