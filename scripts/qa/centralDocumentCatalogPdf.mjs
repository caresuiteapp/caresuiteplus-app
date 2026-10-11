import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const dir = path.resolve('tmp/pdfs/central-catalog'); await fs.mkdir(dir, { recursive: true });
await build({ stdin: { contents: `export { CENTRAL_DOCUMENT_CATALOG } from './src/data/seeds/documentCatalog/centralCatalog'; export { createCentralSnapshot } from './src/lib/documents/centralCatalogModel'; export { renderCentralDocumentPdf } from './src/lib/documents/centralCatalogPdf';`, loader: 'ts', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: path.join(dir, 'render.mjs'), packages: 'external' });
const { CENTRAL_DOCUMENT_CATALOG: catalog, createCentralSnapshot, renderCentralDocumentPdf } = await import(pathToFileURL(path.join(dir, 'render.mjs')).href);
const makeContext = (d) => ({ tenantId:'11111111-1111-4111-8111-111111111111',target:d.target,entityId:'22222222-2222-4222-8222-222222222222',
  company:{name:'Pflege am Park GmbH',address:'Parkstraße 12\n10115 Berlin',phone:'030 555 123',email:'kontakt@example.test',website:'www.example.test',registerCourt:'AG Berlin',registerNumber:'HRB 0000 (Beispiel)',ikNumber:'000000000'},
  subject:{name:d.target==='company'?'Pflege am Park GmbH':'Mara Muster',address:'Blumenstraße 8\n10117 Berlin'},representative:{},payor:{},employee:{},sourceFetchedAt:'2026-10-11T10:00:00Z' });
const cases = [
  ['window-letter','Schriftverkehr mit Pflegekassen, Krankenkassen und Behörden'],
  ['service-proof','Leistungsnachweis mit Leistungsbestätigung'],
  ['contract','Ambulanter Pflegevertrag'],
  ['wound-form','Wundassessment'],
];
const samples=[]; let rendered=0;
for (const d of catalog) {
  const s=createCentralSnapshot(d,makeContext(d),'Anna Fachkraft',crypto.randomUUID());
  d.fields.forEach(f=>{if(!s.values[f.key] && !f.sourcePath && !['reference','enclosures'].includes(f.key))s.values[f.key]=`Dokumentierter Inhalt zu ${f.label}. Individuelle Angaben werden nach der fachlichen Prüfung ergänzt.`;});
  if (d.columns.length) s.tableRows=Array.from({length:3},(_,r)=>d.columns.map((col,i)=>i===0?`11.10.2026 / ${r+1}`:`${col}: individuelle Prüfangabe`));
  const sample=cases.find(([,title])=>title===d.title);
  if(sample){
    if(d.layout==='table')s.tableRows=Array.from({length:48},(_,r)=>['11.10.2026','08:00','09:00',`Körperbezogene Pflege; individuell vereinbarte Unterstützung, Eintrag ${r+1}`,'1 Einsatz','Anna Fachkraft','Mara Muster']);
    if(d.layout==='letter'){s.values.subjectName='Pflegekasse Beispiel';s.values.subjectAddress='Kassenstraße 4\n10119 Berlin';s.values.letterSubject='Anfrage zur Kostenübernahme · Mara Muster';s.values.reference='Vorgang 2026-1042';s.sectionTexts.letter='Sehr geehrte Damen und Herren,\n\nfür die geplante Versorgung übersenden wir Ihnen die vereinbarten Angaben und bitten um Prüfung der Kostenübernahme. Der aktuelle Leistungsumfang ist in der beigefügten Aufstellung beschrieben.\n\nBitte teilen Sie uns Ihre Entscheidung mit. Bei Rückfragen erreichen Sie uns unter den im Briefkopf genannten Kontaktdaten.\n\nMit freundlichen Grüßen\nAnna Fachkraft';}
    s.additionalText='Individuelle Ergänzung: Der Umfang wird mit Mara Muster abgestimmt. Die vorliegenden Beispieldaten dienen ausschließlich der Layoutprüfung.';
  }
  const result=renderCentralDocumentPdf(s);
  if(!result.bytes.length||result.hash!==createHash('sha256').update(result.bytes).digest('hex'))throw new Error(`Invalid PDF: ${d.key}`);
  rendered++;
  if(sample){await fs.writeFile(path.join(dir,`${sample[0]}.pdf`),result.bytes);samples.push({name:sample[0],title:d.title,pages:result.pageCount,orientation:result.orientation,hash:result.hash});}
}
if(samples.length!==4)throw new Error('Missing QA sample: '+JSON.stringify(samples));
await fs.writeFile(path.join(dir,'results.json'),JSON.stringify({rendered,samples},null,2));
console.log(JSON.stringify({rendered,samples}));
