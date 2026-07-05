export type DocumentationAiFunction =
  | 'from_bullets'
  | 'professional'
  | 'grammar'
  | 'summarize'
  | 'neutral_care'
  | 'short'
  | 'detailed';

export const DOCUMENTATION_AI_FUNCTION_LABELS: Record<DocumentationAiFunction, string> = {
  from_bullets: 'Aus Stichpunkten erstellen',
  professional: 'Professioneller formulieren',
  grammar: 'Grammatik korrigieren',
  summarize: 'Einsatz zusammenfassen',
  neutral_care: 'Neutrale Pflegeformulierung',
  short: 'Kurze Version',
  detailed: 'Ausführliche Version',
};
