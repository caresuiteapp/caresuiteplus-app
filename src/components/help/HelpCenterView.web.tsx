import { useEffect, useId, useRef, useState } from 'react';
import { HELP_ARTICLES, HELP_AUDIENCES, HELP_CATEGORIES, HELP_JOURNEYS, HELP_REVIEWED_AT } from '@/features/help/helpCatalog';
import { helpArticle, helpReadingMinutes, searchHelpArticles } from '@/features/help/helpSearch';
import { helpCenterCss } from '@/features/help/helpCenterCss';
import type { HelpArticle, HelpState } from '@/features/help/helpTypes';

type Props = { state: HelpState; onNavigate: (state: HelpState) => void; onOpenRoute: (route: string) => void; onClose: () => void };
const ICONS: Record<string, string> = {
  book: 'M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3zM12 6v15M6 9h3M6 13h3M15 9h3M15 13h3',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  compass: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m4 6-3 6-5 2 2-5z',
  desktop: 'M3 4h18v12H3zM8 21h8M12 16v5',
  building: 'M5 21V3h14v18M2 21h20M8 7h2m4 0h2M8 11h2m4 0h2M10 21v-5h4v5',
  people: 'M8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6M2 21v-4a6 6 0 0 1 12 0v4m3-17a3 3 0 0 1 0 6m0 4a5 5 0 0 1 5 5v2',
  badge: 'M5 5h14v16H5zM9 3h6v4H9zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-4 8a4 4 0 0 1 8 0',
  calendar: 'M3 5h18v16H3zM7 2v6m10-6v6M3 10h18M7 14h3m4 0h3m-10 4h3',
  route: 'M7 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6m10 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6M7 9v5a4 4 0 0 0 4 4h3M17 3h4m-2-2v4',
  check: 'M6 3h12v18H6zM9 3V1h6v2m-6 9 2 2 4-5M9 18h6',
  receipt: 'M5 3h14v18l-3-2-4 2-4-2-3 2zM8 7h8M8 11h8m-8 4h4',
  message: 'M3 3h18v14H9l-6 4zM7 7h10M7 11h6',
  settings: 'M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6M9 15v6',
  layers: 'm12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m-3 6a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01',
  link: 'm10 14 4-4m-6 8-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2-3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  print: 'M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1',
};
export function HelpIcon({ name = 'book', size = 20 }: { name?: string; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[name] ?? ICONS.book}/></svg>;
}

function printArticle(element: HTMLElement | null, title: string) {
  if (!element || typeof window === 'undefined') return;
  // A dedicated print document avoids clipping by the application's nested popup scroll containers.
  const popup = window.open('', '_blank', 'width=850,height=900');
  if (!popup) return false;
  const article = element.cloneNode(true) as HTMLElement;
  article.querySelectorAll('.hh-article-tools,.hh-breadcrumb,.hh-status,.hh-copy-fallback,button').forEach(node => node.remove());
  article.querySelectorAll('details').forEach(node => node.setAttribute('open', ''));
  article.querySelectorAll('input').forEach(node => node.remove());
  popup.document.open();
  popup.document.write('<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>');
  popup.document.close();
  popup.document.title = `${title} · CareSuite HealthOS`;
  const style = popup.document.createElement('style');
  style.textContent = helpCenterCss + '\n@page{size:A4;margin:16mm}body{margin:24px;background:#fff}.cs-help{container-type:normal}.hh-article{border:0!important;box-shadow:none!important}';
  popup.document.head.append(style);
  const main = popup.document.createElement('main');
  main.className = 'cs-help'; main.append(article); popup.document.body.append(main);
  popup.opener = null;
  popup.focus(); popup.print();
  return true;
}

function ArticleReader({ article, onNavigateArticle, onBrowse, onOpenRoute, onHome }: { article: HelpArticle; onNavigateArticle: (id: string) => void; onBrowse: () => void; onOpenRoute: (route: string) => void; onHome: () => void }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [copyFallback, setCopyFallback] = useState('');
  const articleRef = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const prefix = useId().replace(/:/g, '');
  const category = HELP_CATEGORIES.find(category => category.id === article.category)!;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'start' }); }, [article.id]);
  const copyLink = async () => {
    const url = new URL('/hilfe', window.location.origin); url.searchParams.set('artikel', article.id);
    try { await navigator.clipboard.writeText(url.toString()); setStatus('Link zur Anleitung kopiert.'); setCopyFallback(''); }
    catch { setCopyFallback(url.toString()); setStatus('Bitte den angezeigten Link auswählen und kopieren.'); }
  };
  const sections = [
    ...(article.prerequisites.length ? [['before', 'Bevor Sie beginnen']] : []),
    ['steps', 'Schritt für Schritt'], ['example', 'Beispiel'], ['checks', 'Zum Abschluss prüfen'], ['problems', 'Wenn etwas nicht klappt'], ['related', 'Passende Anleitungen'],
  ];
  return <div className="hh-article-layout">
    <article className="hh-article" ref={articleRef} aria-labelledby={`${prefix}-heading`}>
      <nav className="hh-breadcrumb" aria-label="Pfad der Anleitung"><button type="button" onClick={onHome}>Hilfe</button><span aria-hidden="true">›</span><button type="button" onClick={onBrowse}>{category.title}</button></nav>
      <div className="hh-eyebrow">{category.title}</div>
      <h1 id={`${prefix}-heading`} className="hh-article-heading" tabIndex={-1} ref={heading}>{article.title}</h1>
      <p className="hh-lead">{article.summary}</p>
      <div className="hh-article-meta"><span>{helpReadingMinutes(article)} Min. Lesezeit</span><span>{article.steps.length} Schritte</span><span>{article.audiences.map(id => HELP_AUDIENCES.find(audience => audience.id === id)!.label).join(' · ')}</span></div>
      <div className="hh-article-tools">
        <button type="button" className="hh-button" onClick={() => void copyLink()}><HelpIcon name="link" size={17}/>Link kopieren</button>
        <button type="button" className="hh-button" onClick={() => { if (printArticle(articleRef.current, article.title) === false) setStatus('Das Druckfenster wurde blockiert. Bitte erlauben Sie Pop-ups für diese Seite.'); }}><HelpIcon name="print" size={17}/>Drucken / PDF</button>
        <button type="button" className="hh-button" onClick={onBrowse}>Zur Themenübersicht</button>
      </div>
      <div className="hh-status" role="status" aria-live="polite">{status}</div>
      {copyFallback ? <input className="hh-copy-fallback" aria-label="Link zur Anleitung zum Kopieren" readOnly value={copyFallback} onFocus={event => event.target.select()}/> : null}
      <div className="hh-location"><span className="hh-location-label">HIER FINDEN SIE DIE FUNKTION</span><div className="hh-path">{article.location.map((part, index) => <span key={`${index}-${part}`}>{index > 0 ? <span aria-hidden="true">›</span> : null}{part}</span>)}</div>{article.route ? <button type="button" className="hh-text-button" onClick={() => onOpenRoute(article.route!)}>Bereich öffnen <span aria-hidden="true">↗</span></button> : null}</div>
      {article.prerequisites.length ? <section id={`${prefix}-before`}><h2>Bevor Sie beginnen</h2><ul className="hh-prerequisites">{article.prerequisites.map(text => <li key={text}>{text}</li>)}</ul></section> : null}
      <section id={`${prefix}-steps`}><h2>Schritt für Schritt</h2><ol className="hh-steps">{article.steps.map(step => <li key={step.title}><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol></section>
      <section id={`${prefix}-example`} className="hh-example"><span>BEISPIEL · FIKTIVER SACHVERHALT</span><h3>{article.example.title}</h3><p>{article.example.text}</p></section>
      <section id={`${prefix}-checks`}><h2>Zum Abschluss prüfen</h2><ul className="hh-checks">{article.checks.map(text => <li key={text}><label><input type="checkbox" checked={checked.includes(text)} onChange={event => setChecked(previous => event.target.checked ? [...previous, text] : previous.filter(item => item !== text))}/><span>{text}</span></label></li>)}</ul><p className="hh-muted">Die Häkchen sind eine Lesehilfe für diese Ansicht. Sie ändern keine Daten in CareSuite.</p></section>
      <section id={`${prefix}-problems`}><h2>Wenn etwas nicht klappt</h2>{article.troubleshooting.map(item => <details key={item.problem}><summary>{item.problem}</summary><p>{item.solution}</p></details>)}</section>
      <section id={`${prefix}-related`}><h2>Passende Anleitungen</h2><div className="hh-related">{article.related.map(id => { const target = helpArticle(id); return target ? <button type="button" key={id} onClick={() => onNavigateArticle(id)}>{target.title} <span aria-hidden="true">→</span></button> : null; })}</div></section>
      <footer className="hh-bottom-note">CareSuite HealthOS · Hilfe für Web & Desktop · Stand {HELP_REVIEWED_AT}. Sichtbare Funktionen richten sich nach Zugang und Freigaben Ihres Unternehmens.</footer>
    </article>
    <aside className="hh-article-aside" aria-label="Inhaltsverzeichnis"><nav className="hh-toc"><span className="hh-label">IN DIESER ANLEITUNG</span>{sections.map(([id, title]) => <a key={id} href={`#${prefix}-${id}`} onClick={event => { event.preventDefault(); const section = document.getElementById(`${prefix}-${id}`); section?.scrollIntoView({ behavior: 'auto', block: 'start' }); const heading = section?.querySelector<HTMLElement>('h2,h3'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } }}>{title}</a>)}</nav><div className="hh-sidebar-help"><strong>Noch eine Frage?</strong><p>Beschreiben Sie dem Support den betroffenen Vorgang und die konkrete Meldung.</p><button type="button" className="hh-text-button" onClick={() => onOpenRoute('/support')}>Support öffnen →</button></div></aside>
  </div>;
}

export function HelpCenterView({ state, onNavigate, onOpenRoute, onClose }: Props) {
  const article = helpArticle(state.article);
  const category = HELP_CATEGORIES.find(category => category.id === state.category);
  const audience = HELP_AUDIENCES.find(audience => audience.id === state.audience);
  const activeState = { ...state, category: category?.id, audience: audience?.id, q: (state.q ?? '').slice(0, 200) };
  const [query, setQuery] = useState(activeState.q);
  const mainHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setQuery(activeState.q); }, [activeState.q]);
  const results = searchHelpArticles({ ...activeState, q: query });
  const filtered = Boolean(query.trim() || category || audience);
  const openArticle = (id: string) => onNavigate({ ...activeState, q: query, article: id });
  const browse = (id?: string) => { onNavigate({ ...activeState, q: query, article: undefined, category: id }); };
  const home = () => { setQuery(''); onNavigate({}); };
  const resultsLabel = query.trim() ? `Suchergebnisse für „${query.trim()}“` : category?.title ?? (audience ? `Anleitungen für ${audience.label}` : 'Alle Themen');
  return <main className="cs-help" data-cs-help-surface="light">
    <style>{helpCenterCss}</style>
    <a className="hh-skip" href="#healthos-help-content">Zum Inhalt springen</a>
    <header className="hh-top"><div className="hh-brand"><span className="hh-brand-icon"><HelpIcon/></span>Hilfe & Anleitungen</div><div className="hh-actions"><button type="button" className="hh-button" onClick={onClose}><span aria-hidden="true">←</span>Zurück zur Arbeit</button><button type="button" className="hh-button" onClick={() => onOpenRoute('/support')}>Support</button></div></header>
    {state.article ? <div id="healthos-help-content">{article ? <ArticleReader key={article.id} article={article} onNavigateArticle={openArticle} onBrowse={() => onNavigate({ ...activeState, q: query, article: undefined, category: article.category })} onOpenRoute={onOpenRoute} onHome={home}/> : <div className="hh-article-layout"><div className="hh-empty" role="status"><h1>Anleitung nicht gefunden</h1><p>Dieser Link führt zu keiner vorhandenen Anleitung. Sie können das Thema in der Hilfe suchen.</p><button type="button" className="hh-button hh-button-primary" onClick={home}>Hilfeübersicht öffnen</button></div></div>}</div> : <>
      <section className="hh-hero"><div className="hh-hero-copy"><div className="hh-eyebrow">CARESUITE HEALTHOS · WISSEN FÜR DEN ALLTAG</div><h1>Was möchten Sie erledigen?</h1><p>Finden Sie den richtigen Weg durch CareSuite. Mit genauen Schritten, Beispielen und Antworten, wenn etwas nicht klappt.</p><div className="hh-hero-meta"><span>{HELP_ARTICLES.length} ausführliche Anleitungen</span><span>{HELP_CATEGORIES.length} Themenbereiche</span><span>Web & Desktop</span></div></div><div className="hh-hero-art" aria-hidden="true"><HelpIcon size={80}/></div></section>
      <div className="hh-search-zone"><form className="hh-search" role="search" onSubmit={event => { event.preventDefault(); onNavigate({ ...activeState, article: undefined, q: query }); mainHeading.current?.focus({ preventScroll: true }); }}><HelpIcon name="search" size={23}/><label className="hh-sr" htmlFor="healthos-help-search">Anleitungen durchsuchen</label><input id="healthos-help-search" type="search" autoComplete="off" maxLength={200} value={query} onChange={event => setQuery(event.target.value)} placeholder="Zum Beispiel: Logo hochladen, Einsatz planen, Unterschrift …"/><button type="submit" className="hh-button hh-button-primary">Suchen</button></form><div className="hh-search-hints"><span>Häufig gesucht</span>{['Logo hochladen', 'Einsatz planen', 'Unterschrift', 'Verfügbarkeit'].map(term => <button type="button" key={term} onClick={() => { setQuery(term); onNavigate({ q: term }); }}>{term}</button>)}</div></div>
      <div className="hh-layout"><aside className="hh-sidebar" aria-label="Hilfethemen"><span className="hh-label">THEMEN</span><nav><button type="button" className="hh-category" aria-current={!category ? 'page' : undefined} onClick={() => browse()}><HelpIcon name="layers" size={18}/><span>Alle Themen</span><small>{searchHelpArticles({ audience: audience?.id }).length}</small></button>{HELP_CATEGORIES.map(item => <button type="button" key={item.id} className="hh-category" aria-current={category?.id === item.id ? 'page' : undefined} onClick={() => browse(item.id)}><HelpIcon name={item.icon} size={18}/><span>{item.title}</span><small>{searchHelpArticles({ category: item.id, audience: audience?.id }).length}</small></button>)}</nav><div className="hh-sidebar-help"><strong>Hilfe aus Ihrer Arbeitsseite</strong><p>Das Fragezeichen in der oberen Leiste führt bei vielen Seiten direkt zur passenden Anleitung.</p><button type="button" className="hh-text-button" onClick={() => openArticle('desktop-fenster')}>So funktioniert es →</button></div></aside>
        <div className="hh-main" id="healthos-help-content"><div className="hh-filter-row"><label><span className="hh-sr">Anleitungen nach Zielgruppe filtern</span><select aria-label="Zielgruppe" value={audience?.id ?? ''} onChange={event => onNavigate({ ...activeState, article: undefined, q: query, audience: event.target.value || undefined })}><option value="">Für alle Zugänge</option>{HELP_AUDIENCES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><span className="hh-muted" role="status" aria-live="polite">{filtered ? `${results.length} passende ${results.length === 1 ? 'Anleitung' : 'Anleitungen'}` : `Inhaltlich geprüft am ${HELP_REVIEWED_AT}`}</span></div>
          {!filtered ? <><div className="hh-section-heading"><div><h2>Ein Ablauf, Schritt für Schritt</h2><p>Diese Lesepfade verbinden mehrere Anleitungen.</p></div></div><div className="hh-journeys">{HELP_JOURNEYS.map((journey, index) => <section key={journey.id} className="hh-journey"><span className="hh-journey-number">0{index + 1}</span><h3>{journey.title}</h3><p>{journey.description}</p><ol>{journey.articles.map((id, index) => <li key={id}><button type="button" onClick={() => openArticle(id)}><span>{index + 1}.</span>{helpArticle(id)!.title}</button></li>)}</ol></section>)}</div></> : null}
          <div className="hh-section-heading"><div><h2 ref={mainHeading} tabIndex={-1}>{resultsLabel}</h2>{category ? <p>{category.description}</p> : null}</div>{filtered ? <button type="button" className="hh-text-button" onClick={home}>Filter zurücksetzen</button> : null}</div>
          {!filtered ? <div className="hh-cards">{HELP_CATEGORIES.map(item => <button type="button" className="hh-card" key={item.id} onClick={() => browse(item.id)}><span className="hh-card-icon"><HelpIcon name={item.icon}/></span><h3>{item.title}</h3><p>{item.description}</p><span className="hh-card-footer">{HELP_ARTICLES.filter(article => article.category === item.id).length} Anleitungen <span aria-hidden="true">→</span></span></button>)}</div> : results.length ? <div className="hh-results">{results.map(article => <button type="button" className="hh-result" key={article.id} onClick={() => openArticle(article.id)}><span className="hh-result-meta">{HELP_CATEGORIES.find(item => item.id === article.category)!.title} · {helpReadingMinutes(article)} Min. · {article.steps.length} Schritte</span><h3>{article.title}</h3><p>{article.summary}</p></button>)}</div> : <div className="hh-empty"><HelpIcon name="search" size={30}/><h3>Keine passende Anleitung gefunden</h3><p>Versuchen Sie einen kürzeren Begriff oder setzen Sie die Themen- und Zielgruppenfilter zurück. Gesucht wird auch in den Schritten und Beispielen.</p><div className="hh-actions"><button type="button" className="hh-button" onClick={home}>Alle Themen anzeigen</button>{category || audience ? <button type="button" className="hh-button" onClick={() => onNavigate({ q: query })}>In allen Themen suchen</button> : null}<button type="button" className="hh-button" onClick={() => onOpenRoute('/support')}>Support fragen</button></div></div>}
          <footer className="hh-bottom-note">Die Anleitungen erklären die Bedienung. Welche Funktionen Sie öffnen und bearbeiten können, hängt von Ihrem Zugang und den Freigaben Ihres Unternehmens ab. Personen und Beträge in den Beispielen sind fiktiv.</footer>
        </div>
      </div>
    </>}
  </main>;
}
