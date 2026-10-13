import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import type { PDFPage, PDFFont } from 'npm:pdf-lib@1.17.1';
import { canonicalJson, signatureImageKind } from './proofBytes.ts';
export type ProofSource = {
  receipt: Record<string, unknown>; snapshot: Record<string, unknown>; signature_hash: string;
  signature_storage_path: string; signature_id: string; tenant_name: string; client_name: string; employee_name: string;
  pdf_storage_path?: string | null; pdf_hash?: string | null; attested_pdf?: boolean;
};
/** Deterministic signed PDF, generated from the server-validated source only. */
export async function renderVisitProofPdf(source: ProofSource, signature: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const receipt = source.receipt, snap = source.snapshot;
  const signed = snap.signature as Record<string,unknown>;
  const at = new Date(String(signed.signedAt));
  if (!Number.isFinite(at.getTime())) throw new Error('Unterschriftszeit fehlt.');
  doc.setCreationDate(at); doc.setModificationDate(at); doc.setTitle('Leistungsnachweis');
  doc.setAuthor(source.tenant_name); doc.setCreator('CareSuite HealthOS'); doc.setProducer('CareSuite verified-original-bytes-v1');
  const blue = rgb(.02,.20,.35), ink = rgb(.08,.13,.2), pale = rgb(.92,.96,.99);
  let page: PDFPage; let y = 0;
  const clean = (value: unknown, f: PDFFont = font) => [...String(value ?? '').replace(/[\x00-\x08\x0b-\x1f]/g,'')].map(char => {
    try { f.encodeText(char); return char; } catch { return `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`; }
  }).join('');
  const newPage = () => {
    page = doc.addPage([595.28,841.89]); y = 752;
    page.drawRectangle({x:0,y:783,width:595.28,height:59,color:blue});
    page.drawText('CareSuite HealthOS', {x:40,y:810,size:13,font:bold,color:rgb(1,1,1)});
    page.drawText('Leistungsnachweis', {x:40,y:790,size:11,font,color:rgb(1,1,1)});
  };
  const lines = (value: unknown, size=10, f:PDFFont=font) => {
    const result: string[] = [];
    for (const paragraph of clean(value,f).split(/\r?\n/)) {
      let line = '';
      for (const char of paragraph) {
        if (line && f.widthOfTextAtSize(line+char,size)>515) { result.push(line); line=''; }
        line += char;
      }
      result.push(line);
    }
    return result;
  };
  const text = (value: unknown, size=10, f:PDFFont=font) => {
    for (const line of lines(value,size,f)) {
      if (y<65) newPage();
      page.drawText(line, {x:40,y,size,font:f,color:ink}); y-=size+5;
    }
    y-=5;
  };
  const section = (label:string) => { if(y<110)newPage(); y-=8; page.drawRectangle({x:35,y:y-5,width:525,height:22,color:pale});text(label,11,bold); };
  const date = (value: unknown) => new Date(String(value)).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium',timeStyle:'short'});
  newPage();
  text(source.tenant_name,15,bold);
  text(`Klient:in: ${source.client_name}`); text(`Mitarbeitende: ${source.employee_name}`);
  text(`Leistung: ${String(snap.serviceName ?? snap.title ?? '')}`);
  text(`Tatsächlich erbracht: ${date(receipt.service_started_at)} bis ${date(receipt.service_ended_at)}`);
  text(`Leistungsdauer nach Pausenabzug: ${receipt.actual_minutes} Minuten`);
  section('Durchführung');
  const status:Record<string,string> = {done:'Erledigt',open:'Offen',not_done:'Nicht erledigt',not_requested:'Nicht gewünscht',cancelled:'Abgesagt',requires_follow_up:'Nachbearbeitung erforderlich'};
  const tasks = snap.tasks as Record<string,unknown>[];
  for(const task of tasks) { text(`${String(task.title)}: ${status[String(task.status)] ?? String(task.status)}`,10,bold); if(task.completionNote ?? task.note) text(task.completionNote ?? task.note); }
  if(!tasks.length) text('Keine Einzelaufgaben hinterlegt.');
  section('Dokumentation'); text(snap.documentationNote ?? snap.documentation);
  if(y<220)newPage(); section('Bestätigung der Leistung');
  const kind=signatureImageKind(signature);
  const image = kind==='png' ? await doc.embedPng(signature) : await doc.embedJpg(signature);
  const factor = Math.min(350/image.width,120/image.height);
  page.drawImage(image,{x:40,y:y-image.height*factor,width:image.width*factor,height:image.height*factor});y-=image.height*factor+18;
  text(`Unterschrieben von ${String(signed.signerName)} (${String(signed.signerRole)})`);
  text(`Unterschrift: ${date(signed.signedAt)}`);
  const json = canonicalJson({receipt,snapshot:snap,signatureHash:source.signature_hash});
  await doc.attach(new TextEncoder().encode(json),'nachweisquelle.json',{mimeType:'application/json',description:'Vollständige bestätigte Nachweisquelle',creationDate:at,modificationDate:at});
  for(const [index,p]of doc.getPages().entries()) {
    p.drawText(`Nachweis ${receipt.proof_id} | Seite ${index+1}/${doc.getPageCount()}`,{x:40,y:28,size:8,font,color:ink});
  }
  return doc.save();
}
