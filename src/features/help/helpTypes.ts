export type HelpAudience = 'verwaltung' | 'mitarbeitende' | 'klienten';
export type HelpCategoryId = 'start' | 'desktop' | 'unternehmen' | 'klienten' | 'personal' | 'planung' | 'einsatz' | 'nachweise' | 'dokumente' | 'abrechnung' | 'portale' | 'einstellungen' | 'fachbereiche' | 'probleme';
export type HelpArticle = {
  id: string;
  category: HelpCategoryId;
  title: string;
  summary: string;
  audiences: HelpAudience[];
  keywords: string[];
  location: string[];
  route?: string;
  prerequisites: string[];
  steps: { title: string; text: string }[];
  example: { title: string; text: string };
  checks: string[];
  troubleshooting: { problem: string; solution: string }[];
  related: string[];
  /** Maintainer reference; never shown as a user-facing navigation path. */
  sources: string[];
};
export type HelpState = { article?: string; category?: string; audience?: string; q?: string };
