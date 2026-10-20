import { HELP_ARTICLES, HELP_CATEGORIES } from './helpCatalog';
import type { HelpArticle, HelpState } from './helpTypes';

export function normalizeHelpText(value: string): string {
  return value.toLocaleLowerCase('de-DE').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
const synonyms: Record<string, string> = { patient: 'klient', patienten: 'klient', mitarbeiter: 'mitarbeit', angestellte: 'personal', login: 'anmeld', pdf: 'dokument', signatur: 'unterschrift', signieren: 'unterschrift', kostentraeger: 'kostentraeger', ocr: 'erkennung', dienstplan: 'dienstplan', passwort: 'passwort', upload: 'hochlad', hochladen: 'hochlad' };
const index = HELP_ARTICLES.map(article => ({
  article,
  title: normalizeHelpText(article.title),
  keywords: normalizeHelpText(article.keywords.join(' ')),
  summary: normalizeHelpText(article.summary),
  body: normalizeHelpText([HELP_CATEGORIES.find(category => category.id === article.category)?.title, ...article.location, ...article.prerequisites, ...article.steps.flatMap(step => [step.title, step.text]), article.example.title, article.example.text, ...article.checks, ...article.troubleshooting.flatMap(item => [item.problem, item.solution])].join(' ')),
}));
export function searchHelpArticles(state: HelpState): HelpArticle[] {
  const tokens = [...new Set(normalizeHelpText((state.q ?? '').slice(0, 200)).split(' ').filter(Boolean))];
  return index.flatMap(entry => {
    if (state.category && entry.article.category !== state.category) return [];
    if (state.audience && !entry.article.audiences.includes(state.audience as never)) return [];
    let score = 0;
    for (const token of tokens) {
      const alternatives = [token, synonyms[token]].filter(Boolean);
      const match = alternatives.reduce((best, term) => Math.max(best,
        entry.title.includes(term) ? 16 : entry.keywords.includes(term) ? 12 : entry.summary.includes(term) ? 6 : entry.body.includes(term) ? 1 : 0), 0);
      if (!match) return [];
      score += match;
    }
    return [{ article: entry.article, score }];
  }).sort((a, b) => b.score - a.score).map(entry => entry.article);
}
export function helpArticle(id: string | undefined): HelpArticle | undefined {
  return HELP_ARTICLES.find(article => article.id === id);
}
export function helpReadingMinutes(article: HelpArticle): number {
  const text = [article.summary, ...article.prerequisites, ...article.steps.flatMap(step => [step.title, step.text]), article.example.text, ...article.checks, ...article.troubleshooting.flatMap(item => [item.problem, item.solution])].join(' ');
  return Math.max(2, Math.ceil(text.split(/\s+/).length / 180));
}
