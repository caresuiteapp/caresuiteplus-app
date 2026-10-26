// Generated native presentation from src/components/help/HelpCenterView.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeURL as URL,nativeNavigator as navigator,nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeDiv,NativeArticle,NativeNav,NativeButton,NativeSpan,NativeH1,NativeP,NativeInput,NativeSection,NativeH2,NativeUl,NativeLi,NativeOl,NativeH3,NativeLabel,NativeDetails,NativeSummary,NativeFooter,NativeAside,NativeA,NativeStrong,NativeMain,NativeStyle,NativeHeader,NativeForm,NativeSmall,NativeSelect,NativeOption,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { printNativeHelpArticle } from '@/features/help/nativeHelpArticlePrint.native';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import { useEffect, useId, useRef, useState } from 'react';
import { WEB_DESKTOP_ROUTE } from '@/lib/navigation/businessHome';
import { HELP_ARTICLES, HELP_AUDIENCES, HELP_CATEGORIES, HELP_JOURNEYS, HELP_REVIEWED_AT } from '@/features/help/helpCatalog';
import { helpArticle, helpReadingMinutes, searchHelpArticles } from '@/features/help/helpSearch';
import { helpCenterCss } from '@/features/help/helpCenterCss';
import type { HelpArticle, HelpState } from '@/features/help/helpTypes';
type Props = {
    state: HelpState;
    onNavigate: (state: HelpState) => void;
    onOpenRoute: (route: string) => void;
    onClose: () => void;
};
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
export function HelpIcon({ name = 'book', size = 20 }: {
    name?: string;
    size?: number;
}) {
    return <NativeWorkspaceStyleScope css={[helpCenterCss]}>{<WebActionIcon size={size}><NativeSvgPath d={ICONS[name] ?? ICONS.book}/></WebActionIcon>}</NativeWorkspaceStyleScope>;
}
async function printArticle(element: HTMLElement | null, title: string) { const article = HELP_ARTICLES.find(item => item.title === title); if (!article)
    return false; await printNativeHelpArticle(article); return true; }
function ArticleReader({ article, onNavigateArticle, onBrowse, onOpenRoute, onHome }: {
    article: HelpArticle;
    onNavigateArticle: (id: string) => void;
    onBrowse: () => void;
    onOpenRoute: (route: string) => void;
    onHome: () => void;
}) {
    const [checked, setChecked] = useState<string[]>([]);
    const [status, setStatus] = useState('');
    const [copyFallback, setCopyFallback] = useState('');
    const articleRef = useRef<HTMLElement>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    const prefix = useId().replace(/:/g, '');
    const category = HELP_CATEGORIES.find(category => category.id === article.category)!;
    useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'start' }); }, [article.id]);
    const copyLink = async () => {
        const url = new URL('/hilfe', 'https://www.caresuiteplus.app');
        url.searchParams.set('artikel', article.id);
        try {
            await navigator.clipboard.writeText(url.toString());
            setStatus('Link zur Anleitung kopiert.');
            setCopyFallback('');
        }
        catch {
            setCopyFallback(url.toString());
            setStatus('Bitte den angezeigten Link auswählen und kopieren.');
        }
    };
    const sections = [
        ...(article.prerequisites.length ? [['before', 'Bevor Sie beginnen']] : []),
        ['steps', 'Schritt für Schritt'], ['example', 'Beispiel'], ['checks', 'Zum Abschluss prüfen'], ['problems', 'Wenn etwas nicht klappt'], ['related', 'Passende Anleitungen'],
    ];
    return <NativeWorkspaceStyleScope css={[helpCenterCss]}>{<NativeDiv className="hh-article-layout">
    <NativeArticle className="hh-article" ref={articleRef} aria-labelledby={`${prefix}-heading`}>
      <NativeNav className="hh-breadcrumb" aria-label="Pfad der Anleitung"><NativeButton type="button" onClick={onHome}>Hilfe</NativeButton><NativeSpan aria-hidden="true">›</NativeSpan><NativeButton type="button" onClick={onBrowse}>{category.title}</NativeButton></NativeNav>
      <NativeDiv className="hh-eyebrow">{category.title}</NativeDiv>
      <NativeH1 id={`${prefix}-heading`} className="hh-article-heading" tabIndex={-1} ref={heading}>{article.title}</NativeH1>
      <NativeP className="hh-lead">{article.summary}</NativeP>
      <NativeDiv className="hh-article-meta"><NativeSpan>{helpReadingMinutes(article)} Min. Lesezeit</NativeSpan><NativeSpan>{article.steps.length} Schritte</NativeSpan><NativeSpan>{article.audiences.map(id => HELP_AUDIENCES.find(audience => audience.id === id)!.label).join(' · ')}</NativeSpan></NativeDiv>
      <NativeDiv className="hh-article-tools">
        <NativeButton type="button" className="hh-button" onClick={() => void copyLink()}><HelpIcon name="link" size={16}/>Link kopieren</NativeButton>
        <NativeButton type="button" className="hh-button" onClick={async () => { try {
        if (await printArticle(articleRef.current, article.title) === false)
            setStatus('Die Anleitung konnte nicht für den Druck gelesen werden.');
    }
    catch (error) {
        setStatus(error instanceof Error ? error.message : 'Der Android-Druckdialog konnte nicht geöffnet werden.');
    } }}><HelpIcon name="print" size={16}/>Drucken / PDF</NativeButton>
        <NativeButton type="button" className="hh-button" onClick={onBrowse}>Zur Themenübersicht</NativeButton>
      </NativeDiv>
      <NativeDiv className="hh-status" role="status" aria-live="polite">{status}</NativeDiv>
      {copyFallback ? <NativeInput className="hh-copy-fallback" aria-label="Link zur Anleitung zum Kopieren" readOnly value={copyFallback} onFocus={event => undefined}/> : null}
      <NativeDiv className="hh-location"><NativeSpan className="hh-location-label">HIER FINDEN SIE DIE FUNKTION</NativeSpan><NativeDiv className="hh-path">{article.location.map((part, index) => <NativeSpan key={`${index}-${part}`}>{index > 0 ? <NativeSpan aria-hidden="true">›</NativeSpan> : null}{part}</NativeSpan>)}</NativeDiv>{article.route ? <NativeButton type="button" className="hh-text-button" onClick={() => onOpenRoute(article.route === '/' ? WEB_DESKTOP_ROUTE : article.route!)}>Bereich öffnen <NativeSpan aria-hidden="true">↗</NativeSpan></NativeButton> : null}</NativeDiv>
      {article.prerequisites.length ? <NativeSection id={`${prefix}-before`}><NativeH2>Bevor Sie beginnen</NativeH2><NativeUl className="hh-prerequisites">{article.prerequisites.map(text => <NativeLi key={text}>{text}</NativeLi>)}</NativeUl></NativeSection> : null}
      <NativeSection id={`${prefix}-steps`}><NativeH2>Schritt für Schritt</NativeH2><NativeOl className="hh-steps">{article.steps.map(step => <NativeLi key={step.title}><NativeDiv><NativeH3>{step.title}</NativeH3><NativeP>{step.text}</NativeP></NativeDiv></NativeLi>)}</NativeOl></NativeSection>
      <NativeSection id={`${prefix}-example`} className="hh-example"><NativeSpan>BEISPIEL · FIKTIVER SACHVERHALT</NativeSpan><NativeH3>{article.example.title}</NativeH3><NativeP>{article.example.text}</NativeP></NativeSection>
      <NativeSection id={`${prefix}-checks`}><NativeH2>Zum Abschluss prüfen</NativeH2><NativeUl className="hh-checks">{article.checks.map(text => <NativeLi key={text}><NativeLabel><NativeInput type="checkbox" checked={checked.includes(text)} onChange={event => setChecked(previous => event.target.checked ? [...previous, text] : previous.filter(item => item !== text))}/><NativeSpan>{text}</NativeSpan></NativeLabel></NativeLi>)}</NativeUl><NativeP className="hh-muted">Die Häkchen sind eine Lesehilfe für diese Ansicht. Sie ändern keine Daten in CareSuite.</NativeP></NativeSection>
      <NativeSection id={`${prefix}-problems`}><NativeH2>Wenn etwas nicht klappt</NativeH2>{article.troubleshooting.map(item => <NativeDetails key={item.problem}><NativeSummary>{item.problem}</NativeSummary><NativeP>{item.solution}</NativeP></NativeDetails>)}</NativeSection>
      <NativeSection id={`${prefix}-related`}><NativeH2>Passende Anleitungen</NativeH2><NativeDiv className="hh-related">{article.related.map(id => { const target = helpArticle(id); return target ? <NativeButton type="button" key={id} onClick={() => onNavigateArticle(id)}>{target.title} <NativeSpan aria-hidden="true">→</NativeSpan></NativeButton> : null; })}</NativeDiv></NativeSection>
      <NativeFooter className="hh-bottom-note">CareSuite HealthOS · Hilfe für Web, Desktop & App · Stand {HELP_REVIEWED_AT}. Sichtbare Funktionen richten sich nach Zugang und Freigaben Ihres Unternehmens.</NativeFooter>
    </NativeArticle>
    <NativeAside className="hh-article-aside" aria-label="Inhaltsverzeichnis"><NativeNav className="hh-toc"><NativeSpan className="hh-label">IN DIESER ANLEITUNG</NativeSpan>{sections.map(([id, title]) => <NativeA key={id} href={`#${prefix}-${id}`} onClick={event => { event.preventDefault(); const section = document.getElementById(`${prefix}-${id}`); section?.scrollIntoView({ behavior: 'auto', block: 'start' }); section?.focus?.({ preventScroll: true }); }}>{title}</NativeA>)}</NativeNav><NativeDiv className="hh-sidebar-help"><NativeStrong>Noch eine Frage?</NativeStrong><NativeP>Beschreiben Sie dem Support den betroffenen Vorgang und die konkrete Meldung.</NativeP><NativeButton type="button" className="hh-text-button" onClick={() => onOpenRoute('/support')}>Support öffnen →</NativeButton></NativeDiv></NativeAside>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
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
    return <NativeWorkspaceStyleScope css={[helpCenterCss, helpCenterCss]}>{<NativeMain className="cs-help" data-cs-help-surface="light">
    <NativeStyle>{helpCenterCss}</NativeStyle>
    <NativeA className="hh-skip" href="#healthos-help-content">Zum Inhalt springen</NativeA>
    <NativeHeader className="hh-top"><NativeDiv className="hh-brand"><NativeSpan className="hh-brand-icon"><HelpIcon /></NativeSpan>Hilfe & Anleitungen</NativeDiv><NativeDiv className="hh-actions"><NativeButton type="button" className="hh-button" onClick={onClose}><NativeSpan aria-hidden="true">←</NativeSpan>Zurück zur Arbeit</NativeButton><NativeButton type="button" className="hh-button" onClick={() => onOpenRoute('/support')}>Support</NativeButton></NativeDiv></NativeHeader>
    {state.article ? <NativeDiv id="healthos-help-content">{article ? <ArticleReader key={article.id} article={article} onNavigateArticle={openArticle} onBrowse={() => onNavigate({ ...activeState, q: query, article: undefined, category: article.category })} onOpenRoute={onOpenRoute} onHome={home}/> : <NativeDiv className="hh-article-layout"><NativeDiv className="hh-empty" role="status"><NativeH1>Anleitung nicht gefunden</NativeH1><NativeP>Dieser Link führt zu keiner vorhandenen Anleitung. Sie können das Thema in der Hilfe suchen.</NativeP><NativeButton type="button" className="hh-button hh-button-primary" onClick={home}>Hilfeübersicht öffnen</NativeButton></NativeDiv></NativeDiv>}</NativeDiv> : <>
      <NativeSection className="hh-hero"><NativeDiv className="hh-hero-copy"><NativeDiv className="hh-eyebrow">CARESUITE HEALTHOS · WISSEN FÜR DEN ALLTAG</NativeDiv><NativeH1>Was möchten Sie erledigen?</NativeH1><NativeP>Finden Sie den richtigen Weg durch CareSuite. Mit genauen Schritten, Beispielen und Antworten, wenn etwas nicht klappt.</NativeP><NativeDiv className="hh-hero-meta"><NativeSpan>{HELP_ARTICLES.length} ausführliche Anleitungen</NativeSpan><NativeSpan>{HELP_CATEGORIES.length} Themenbereiche</NativeSpan><NativeSpan>Web, Desktop & App</NativeSpan></NativeDiv></NativeDiv><NativeDiv className="hh-hero-art" aria-hidden="true"><HelpIcon size={80}/></NativeDiv></NativeSection>
      <NativeDiv className="hh-search-zone"><NativeForm className="hh-search" role="search" onSubmit={event => { event.preventDefault(); onNavigate({ ...activeState, article: undefined, q: query }); mainHeading.current?.focus({ preventScroll: true }); }}><HelpIcon name="search" size={24}/><NativeLabel className="hh-sr" htmlFor="healthos-help-search">Anleitungen durchsuchen</NativeLabel><NativeInput id="healthos-help-search" type="search" autoComplete="off" maxLength={200} value={query} onChange={event => setQuery(event.target.value)} placeholder="Zum Beispiel: Logo hochladen, Einsatz planen, Unterschrift …"/><NativeButton type="submit" className="hh-button hh-button-primary">Suchen</NativeButton></NativeForm><NativeDiv className="hh-search-hints"><NativeSpan>Häufig gesucht</NativeSpan>{['Logo hochladen', 'Einsatz planen', 'Unterschrift', 'Verfügbarkeit'].map(term => <NativeButton type="button" key={term} onClick={() => { setQuery(term); onNavigate({ q: term }); }}>{term}</NativeButton>)}</NativeDiv></NativeDiv>
      <NativeDiv className="hh-layout"><NativeAside className="hh-sidebar" aria-label="Hilfethemen"><NativeSpan className="hh-label">THEMEN</NativeSpan><NativeNav><NativeButton type="button" className="hh-category" aria-current={!category ? 'page' : undefined} onClick={() => browse()}><HelpIcon name="layers" size={20}/><NativeSpan>Alle Themen</NativeSpan><NativeSmall>{searchHelpArticles({ audience: audience?.id }).length}</NativeSmall></NativeButton>{HELP_CATEGORIES.map(item => <NativeButton type="button" key={item.id} className="hh-category" aria-current={category?.id === item.id ? 'page' : undefined} onClick={() => browse(item.id)}><HelpIcon name={item.icon} size={20}/><NativeSpan>{item.title}</NativeSpan><NativeSmall>{searchHelpArticles({ category: item.id, audience: audience?.id }).length}</NativeSmall></NativeButton>)}</NativeNav><NativeDiv className="hh-sidebar-help"><NativeStrong>Hilfe aus Ihrer Arbeitsseite</NativeStrong><NativeP>Das Fragezeichen in der oberen Leiste führt bei vielen Seiten direkt zur passenden Anleitung.</NativeP><NativeButton type="button" className="hh-text-button" onClick={() => openArticle('desktop-fenster')}>So funktioniert es →</NativeButton></NativeDiv></NativeAside>
        <NativeDiv className="hh-main" id="healthos-help-content"><NativeDiv className="hh-filter-row"><NativeLabel><NativeSpan className="hh-sr">Anleitungen nach Zielgruppe filtern</NativeSpan><NativeSelect aria-label="Zielgruppe" value={audience?.id ?? ''} onChange={event => onNavigate({ ...activeState, article: undefined, q: query, audience: event.target.value || undefined })}><NativeOption value="">Für alle Zugänge</NativeOption>{HELP_AUDIENCES.map(item => <NativeOption key={item.id} value={item.id}>{item.label}</NativeOption>)}</NativeSelect></NativeLabel><NativeSpan className="hh-muted" role="status" aria-live="polite">{filtered ? `${results.length} passende ${results.length === 1 ? 'Anleitung' : 'Anleitungen'}` : `Inhaltlich geprüft am ${HELP_REVIEWED_AT}`}</NativeSpan></NativeDiv>
          {!filtered ? <><NativeDiv className="hh-section-heading"><NativeDiv><NativeH2>Ein Ablauf, Schritt für Schritt</NativeH2><NativeP>Diese Lesepfade verbinden mehrere Anleitungen.</NativeP></NativeDiv></NativeDiv><NativeDiv className="hh-journeys">{HELP_JOURNEYS.map((journey, index) => <NativeSection key={journey.id} className="hh-journey"><NativeSpan className="hh-journey-number">0{index + 1}</NativeSpan><NativeH3>{journey.title}</NativeH3><NativeP>{journey.description}</NativeP><NativeOl>{journey.articles.map((id, index) => <NativeLi key={id}><NativeButton type="button" onClick={() => openArticle(id)}><NativeSpan>{index + 1}.</NativeSpan>{helpArticle(id)!.title}</NativeButton></NativeLi>)}</NativeOl></NativeSection>)}</NativeDiv></> : null}
          <NativeDiv className="hh-section-heading"><NativeDiv><NativeH2 ref={mainHeading} tabIndex={-1}>{resultsLabel}</NativeH2>{category ? <NativeP>{category.description}</NativeP> : null}</NativeDiv>{filtered ? <NativeButton type="button" className="hh-text-button" onClick={home}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>
          {!filtered ? <NativeDiv className="hh-cards">{HELP_CATEGORIES.map(item => <NativeButton type="button" className="hh-card" key={item.id} onClick={() => browse(item.id)}><NativeSpan className="hh-card-icon"><HelpIcon name={item.icon}/></NativeSpan><NativeH3>{item.title}</NativeH3><NativeP>{item.description}</NativeP><NativeSpan className="hh-card-footer">{HELP_ARTICLES.filter(article => article.category === item.id).length} Anleitungen <NativeSpan aria-hidden="true">→</NativeSpan></NativeSpan></NativeButton>)}</NativeDiv> : results.length ? <NativeDiv className="hh-results">{results.map(article => <NativeButton type="button" className="hh-result" key={article.id} onClick={() => openArticle(article.id)}><NativeSpan className="hh-result-meta">{HELP_CATEGORIES.find(item => item.id === article.category)!.title} · {helpReadingMinutes(article)} Min. · {article.steps.length} Schritte</NativeSpan><NativeH3>{article.title}</NativeH3><NativeP>{article.summary}</NativeP></NativeButton>)}</NativeDiv> : <NativeDiv className="hh-empty"><HelpIcon name="search" size={32}/><NativeH3>Keine passende Anleitung gefunden</NativeH3><NativeP>Versuchen Sie einen kürzeren Begriff oder setzen Sie die Themen- und Zielgruppenfilter zurück. Gesucht wird auch in den Schritten und Beispielen.</NativeP><NativeDiv className="hh-actions"><NativeButton type="button" className="hh-button" onClick={home}>Alle Themen anzeigen</NativeButton>{category || audience ? <NativeButton type="button" className="hh-button" onClick={() => onNavigate({ q: query })}>In allen Themen suchen</NativeButton> : null}<NativeButton type="button" className="hh-button" onClick={() => onOpenRoute('/support')}>Support fragen</NativeButton></NativeDiv></NativeDiv>}
          <NativeFooter className="hh-bottom-note">Die Anleitungen erklären die Bedienung. Welche Funktionen Sie öffnen und bearbeiten können, hängt von Ihrem Zugang und den Freigaben Ihres Unternehmens ab. Personen und Beträge in den Beispielen sind fiktiv.</NativeFooter>
        </NativeDiv>
      </NativeDiv>
    </>}
  </NativeMain>}</NativeWorkspaceStyleScope>;
}
