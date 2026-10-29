import { readMonthlyAuthority, AUTHORITY_BASES } from '../../src/lib/gkvExchange/monthlyAuthority.ts';
import { createHash } from 'node:crypto';
import { jsPDF } from 'jspdf';
import { CENTURY_GOTHIC_REGULAR_BASE64 } from '../../src/design/fonts/centuryGothicData.ts';
import { SERVICE_TYPES } from '../../src/lib/gkvExchange/model.ts';
import { readMonthlyProof } from '../../src/lib/gkvExchange/monthlyProof.ts';
import { isUuid } from './storage.mjs';

/** Server-owned visual original; no submitted HTML/PDF, existing signature or
 * external asset. It is not the normative XML or a CMS/PDF/A attestation. */
export function renderMonthlyOriginal(input) { return renderMonthlyOriginalDocument(input).bytes; }
export function renderMonthlyOriginalDocument({ proof: input, captureId, preparedAt, authority: authorityInput, method }) {
  const proof = readMonthlyProof(input, input?.tenant_id);
  const authority = authorityInput === undefined ? undefined : readMonthlyAuthority(authorityInput);
  if (authority && (authority.tenant_id !== proof.tenant_id || authority.client_id !== proof.payload.clientId
    || authority.service_type !== proof.payload.serviceType)) throw Error('MONTHLY_ORIGINAL_INPUT');
  if (proof.status !== 'open' || !isUuid(captureId) || !Number.isFinite(Date.parse(preparedAt))
    || proof.payload.clientName.length > 300 || Buffer.byteLength(JSON.stringify(proof)) > 2_000_000) throw new Error('MONTHLY_ORIGINAL_INPUT');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true, precision: 3 });
  pdf.addFileToVFS('CenturyGothic.ttf', CENTURY_GOTHIC_REGULAR_BASE64);
  pdf.addFont('CenturyGothic.ttf', 'CenturyGothic', 'normal', 'Identity-H');
  pdf.setFont('CenturyGothic', 'normal');
  pdf.setCreationDate(new Date(preparedAt));
  pdf.setFileId(createHash('sha256').update(`${proof.id}:${proof.revision}:${captureId}:${proof.content_sha256}`).digest('hex').slice(0, 32));
  pdf.setProperties({ title: 'Monatsnachweis zur persönlichen Bestätigung', author: 'CareSuite HealthOS', creator: 'CareSuite Monatsnachweise' });
  const margin = 18, width = 174, bottom = 266;
  let y = 24;
  const normalize = value => String(value).replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  const newPage = () => {
    if (pdf.getNumberOfPages() >= 200) throw new Error('MONTHLY_ORIGINAL_PAGE_LIMIT');
    pdf.addPage(); y = 24;
    text(`${proof.payload.clientName} · ${proof.payload.month.slice(5)}.${proof.payload.month.slice(0, 4)} · Fassung ${proof.version}`, 9, '#527083', 3);
    text(SERVICE_TYPES[proof.payload.serviceType],9,'#527083',6);
  };
  const text = (value, size = 10, color = '#1d3344', gap = 3) => {
    const content = normalize(value);
    const font = pdf.internal.getFont().metadata;
    for (const char of content) if (char !== '\n' && (/[\p{Cc}\p{Cf}]/u.test(char) || !font.characterToGlyph(char.codePointAt(0)))) throw new Error('MONTHLY_ORIGINAL_UNSUPPORTED_TEXT');
    pdf.setFontSize(size); pdf.setTextColor(color);
    const lines = pdf.splitTextToSize(content, width), lineHeight = size * 0.48;
    for (const line of lines) {
      if (y + lineHeight > bottom) newPage();
      pdf.setFontSize(size); pdf.setTextColor(color);
      pdf.text(line, margin, y); y += lineHeight;
    }
    y += gap;
  };
  const day = d => d.split('-').reverse().join('.');
  text('CareSuite HealthOS', 10, '#406174', 5);
  text('Monatsnachweis', 22, '#173c52', 5);
  text(proof.payload.clientName, 15, '#173c52', 4);
  text(`${proof.payload.month.slice(5)}.${proof.payload.month.slice(0, 4)} · ${SERVICE_TYPES[proof.payload.serviceType]}`, 11, '#173c52', 5);
  text(`Fassung ${proof.version} · Bearbeitungsstand ${proof.revision} · Noch nicht bestätigt`, 10, '#406174', 4);
  if(method==='paper')text(`Druckfassung ausgegeben: ${new Date(preparedAt).toISOString().slice(0,19).replace('T',' ')} UTC`,8,'#527083',4);
  if (authority) {
    text(`Bestätigung durch: ${authority.signer_name} · ${AUTHORITY_BASES[authority.basis]}`, 11, '#173c52', 3);
    text(`Geprüfte Berechtigung: ${authority.evidence_reference}`, 9, '#406174', 3);
    text(`Prüfkennung: ${authority.id}`, 8, '#527083', 4);
  }
  text('Bitte prüfen Sie alle Seiten, bevor Sie diesen Monatsnachweis persönlich bestätigen.', 10, '#406174', 7);
  const facts = proof.payload.xmlFacts;
  if (facts) {
    const c = facts.content;
    text(`Leistungserbringer-IK: ${c.providerIk}`, 10, '#173c52', 3);
    text(`Versichertennummer: ${c.insuranceNumber}`, 10, '#173c52', 3);
    text(`Vorname: ${c.firstName} · Nachname: ${c.lastName}`, 10, '#173c52', 3);
    text(`Leistungsart: ${c.serviceType} · Verantwortliche Pflegefachperson: ${c.responsibleEmployeeNumber}`, 10, '#173c52', 6);
  }
  const taskStatus = new Map([['done', 'Erledigt'], ['not_done', 'Nicht durchgeführt'], ['open', 'Offen'], ['skipped', 'Ausgelassen']]);
  let number = 0;
  const byId = new Map(proof.payload.records.map(r => [r.recordId, r]));
  const records = facts ? facts.sources.map(s => byId.get(s.recordId)) : proof.payload.records;
  for (const record of records) {
    const lines = [
      [`${++number}. Leistung am ${day(record.serviceDate)} · ${record.actualMinutes} Minuten`, 11, '#173c52', 2],
      [`Erbracht von: ${record.employeeName}`, 10, '#1d3344', 3],
      [record.description, 10, '#1d3344', 3],
    ];
    if (facts) {
      const source = facts.sources.find(s => s.recordId === record.recordId);
      const visit = facts.content.days.find(d => d.date === source.date).visits.find(v => v.sequence === source.sequence);
      lines.push([`Einsatz ${visit.sequence} · Beginn ${visit.startTime.slice(0,2)}:${visit.startTime.slice(2)} Uhr`, 10, '#173c52', 3]);
      for (const item of visit.lines) {
        lines.push([`${item.code} · ${item.description}`, 10, '#1d3344', 2]);
        lines.push([`${item.quantity !== undefined ? `Anzahl: ${item.quantity}` : `Minuten: ${item.minutes}`} · Beschäftigtennummer: ${item.employeeNumbers.join(', ')}`, 10, '#406174', 4]);
      }
    }
    for (const task of record.tasks) {
      const status = taskStatus.get(task.status) || `Status: ${task.status}`;
      lines.push([`${task.title} · ${status}`, 10, '#1d3344', 1]);
      if (task.completionNote) lines.push([task.completionNote, 10, '#406174', 2]);
    }
    lines.push([`Leistungsreferenz: ${record.recordId}`, 8, '#527083', 6]);
    const height = lines.reduce((sum, [value, size, _color, gap]) => {
      pdf.setFontSize(size); return sum + pdf.splitTextToSize(normalize(value), width).length * size * 0.48 + gap;
    }, 0);
    // Keep ordinary records together. Very long descriptions continue without
    // truncation; each new page repeats patient, period and version.
    if (y > bottom - 35 || height <= bottom - 45 && y + height > bottom) newPage();
    for (const line of lines) text(...line);
  }
  text(`Gesamte dokumentierte Dauer: ${proof.payload.records.reduce((sum, r) => sum + r.actualMinutes, 0)} Minuten`, 11, '#173c52', 5);
  text('Die Bestätigung gilt ausschließlich für die hier dargestellte Leistungsart und Fassung.', 10, '#406174', 3);
  let signatureBox;
  if(method==='paper'){
    const label=`Persönliche Unterschrift: ${authority?.signer_name ?? proof.payload.clientName}`;
    const instruction='Bitte innerhalb des Feldes unterschreiben. Alle Seiten zusammen zurückgeben.';
    const date='Datum und Uhrzeit der Unterschrift: __________________________________';
    const measured=(value,size)=>{pdf.setFontSize(size);return pdf.splitTextToSize(normalize(value),width).length*size*0.48;};
    if(y+measured(label,10)+3+measured(instruction,9)+4+39+measured(date,9)+3>bottom)newPage();
    text(label,10,'#173c52',3);
    text(instruction,9,'#406174',4);
    pdf.setDrawColor('#527083');pdf.setLineWidth(0.3);pdf.rect(margin,y,width,30);
    signatureBox={page:pdf.getNumberOfPages(),x:Math.ceil((margin+2)/210*1000),y:Math.ceil((y+2)/297*1000),
      width:Math.floor((width-4)/210*1000),height:Math.floor(26/297*1000)};
    y+=39;text(date,9,'#406174',3);
  }
  const pages = pdf.getNumberOfPages();
  if (pages > (method==='paper'?20:200)) throw new Error('MONTHLY_ORIGINAL_PAGE_LIMIT');
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor('#d7e2e8'); pdf.line(margin, 272, 192, 272);
    pdf.setFontSize(7.5); pdf.setTextColor('#527083');
    pdf.text(`Fassungskennung: ${proof.id} · Seite ${page} von ${pages}`, margin, 277);
    pdf.text(`Erfassung: ${captureId}`, margin, 281.5);
    pdf.setFontSize(6.8); pdf.text(`Inhaltsbindung: ${proof.content_sha256}`, margin, 286);
  }
  const bytes = Buffer.from(pdf.output('arraybuffer'));
  if (bytes.length > 10 * 1024 * 1024) throw new Error('MONTHLY_ORIGINAL_SIZE');
  return {bytes,...(method==='paper'?{paper:{pageCount:pages,signatureBox,preparedAt}}:{})};
}
