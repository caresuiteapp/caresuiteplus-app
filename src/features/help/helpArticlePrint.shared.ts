import type { HelpArticle } from './helpTypes';

const escape = (text: string) => text.replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value]!);
const list = (items: readonly string[]) => `<ul>${items.map(text => `<li>${escape(text)}</li>`).join('')}</ul>`;

/** Complete article content for the existing native Android print/PDF dialog. */
export function helpArticlePrintHtml(article: HelpArticle): string {
  const section = (title: string, body: string) => `<section><h2>${title}</h2>${body}</section>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(article.title)} · CareSuite HealthOS</title><style>
  @page{size:A4;margin:16mm}body{font:11pt/1.55 sans-serif;color:#17334f;margin:0}header{color:#1764d4;border-bottom:2px solid #c6dbf2;padding-bottom:8pt}h1{font-size:22pt;line-height:1.25}h2{font-size:15pt;margin:20pt 0 8pt}h3{font-size:12pt;margin:10pt 0 4pt}p{margin:6pt 0}li{margin:5pt 0}section{break-inside:auto}h2,h3{break-after:avoid}.location,.example{background:#edf5ff;border:1px solid #c6dbf2;padding:12pt;border-radius:8pt}.muted{color:#536c87}footer{margin-top:22pt;border-top:1px solid #c6dbf2;padding-top:8pt;font-size:9pt}
  </style></head><body><header>CareSuite HealthOS · Hilfe &amp; Anleitungen</header><main><h1>${escape(article.title)}</h1><p>${escape(article.summary)}</p><div class="location"><strong>Hier finden Sie die Funktion</strong><p>${article.location.map(escape).join(' › ')}</p></div>
  ${article.prerequisites.length ? section('Bevor Sie beginnen', list(article.prerequisites)) : ''}
  ${section('Schritt für Schritt', `<ol>${article.steps.map(step => `<li><h3>${escape(step.title)}</h3><p>${escape(step.text)}</p></li>`).join('')}</ol>`)}
  <section class="example"><p class="muted">Beispiel · Fiktiver Sachverhalt</p><h2>${escape(article.example.title)}</h2><p>${escape(article.example.text)}</p></section>
  ${section('Zum Abschluss prüfen', list(article.checks))}
  ${section('Wenn etwas nicht klappt', article.troubleshooting.map(item => `<h3>${escape(item.problem)}</h3><p>${escape(item.solution)}</p>`).join(''))}
  </main><footer>Die Anleitung erklärt die Bedienung. Sichtbare Funktionen richten sich nach Ihrem Zugang und den Freigaben Ihres Unternehmens.</footer></body></html>`;
}
