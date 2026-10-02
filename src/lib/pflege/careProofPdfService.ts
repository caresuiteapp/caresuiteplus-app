import { Platform } from 'react-native';
import type { PflegeServiceProofItem } from '@/types/modules/pflege';
import { registerCareSuitePdfFont, CARESUITE_PDF_FONT } from '@/lib/documents/centuryGothicPdf';
import { formatDate, formatTime } from '@/lib/formatters/dateTimeFormatters';
export type CareProofSignature = { dataUrl: string; signerName: string; capturedAt: string } | null;
const labels: Record<string, string> = { draft: 'Entwurf', submitted: 'Eingereicht', signed: 'Unterschrieben', approved: 'Freigegeben', rejected: 'Zurückgewiesen', cancelled: 'Storniert' };
/** Export the captured record. A download is not a payer submission or invoice. */
export async function generateCareProofPdf(proof: PflegeServiceProofItem, signature: CareProofSignature) {
  if (['signed', 'approved'].includes(proof.status) && !signature) throw new Error('Die gespeicherte Unterschrift muss vor dem Export geladen werden.');
  const { jsPDF } = await import('jspdf'); const pdf = new jsPDF({ unit: 'mm', format: 'a4' }); registerCareSuitePdfFont(pdf); pdf.setFont(CARESUITE_PDF_FONT, 'normal');
  let y = 20;
  function line(value: string, heading = false) {
    pdf.setFontSize(heading ? 13 : 10); pdf.setTextColor(heading ? '#0759BC' : '#182A40');
    const lines = pdf.splitTextToSize(value, 172) as string[];
    for (const text of lines) { if (y > 266) { pdf.addPage(); y = 20; } pdf.text(text, 19, y); y += heading ? 7 : 5; }
    y += 3;
  }
  line('CareSuite HealthOS · Leistungsnachweis', true); line(`Status: ${labels[proof.status] ?? proof.status} · Nachweis-ID: ${proof.id}`);
  line(`Klient:in: ${proof.clientName}`, true); line(`Leistungstag: ${formatDate(proof.serviceDate)} · ${formatTime(proof.startedAt)} bis ${formatTime(proof.endedAt)} · ${proof.durationMinutes} Minuten`);
  line(`${proof.serviceCode} · ${proof.serviceLabel}`, true); line(`Finanzierung: ${proof.legalBasis === 'sgb_v' ? 'SGB V' : proof.legalBasis === 'sgb_xi' ? 'SGB XI' : proof.legalBasis === 'private' ? 'Privat' : proof.legalBasis}`);
  line(`Kostenträger: ${proof.costCarrierName || 'Privat'}${proof.prescriptionReference ? ` · Verordnungsbezug: ${proof.prescriptionReference}` : ''}`);
  line(`Betrag: ${(proof.grossAmountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`);
  line('Durchführung', true); line(proof.performanceNote); line(`Erfasst durch: ${proof.employeeName}`);
  if (proof.rejectionReason) line(`Prüfrückmeldung: ${proof.rejectionReason}`);
  if (signature) {
    if (y > 213) { pdf.addPage(); y = 20; }
    line('Gespeicherte Unterschrift', true); pdf.addImage(signature.dataUrl, 'PNG', 19, y, 90, 28); y += 33;
    line(`${signature.signerName} · ${formatDate(signature.capturedAt)} · ${formatTime(signature.capturedAt)}`);
  } else line('Für diesen Nachweis ist keine gespeicherte Unterschrift enthalten.');
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor('#526074'); pdf.text(`Leistungsnachweis · ${proof.id} · Seite ${page}/${pages}`, 19, 284); }
  return { fileName: `CareSuite_Pflege_Nachweis_${proof.serviceDate}_${proof.id}.pdf`, bytes: new Uint8Array(pdf.output('arraybuffer')), base64: pdf.output('datauristring').split(',')[1] };
}
export async function downloadCareProofPdf(proof: PflegeServiceProofItem, signature: CareProofSignature): Promise<void> {
  const payload = await generateCareProofPdf(proof, signature);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([new Uint8Array(payload.bytes)], { type: 'application/pdf' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = payload.fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const files = await import('expo-file-system/legacy'); const sharing = await import('expo-sharing');
    if (!files.cacheDirectory || !(await sharing.isAvailableAsync())) throw new Error('PDF-Weitergabe ist auf diesem Gerät nicht verfügbar.');
    const path = files.cacheDirectory + payload.fileName;
    try { await files.writeAsStringAsync(path, payload.base64, { encoding: files.EncodingType.Base64 }); await sharing.shareAsync(path, { mimeType: 'application/pdf', dialogTitle: 'Pflege-Leistungsnachweis' }); }
    finally { await files.deleteAsync(path, { idempotent: true }); }
  }
}
