import type { DocumentRecommendationContext } from '@/lib/documents/documentRecommendations';
export type DocumentRecommendationsProps = DocumentRecommendationContext & { title?: string; compact?: boolean; widget?: boolean };
/** The Office integration is web-only; the released native portal remains unchanged. */
export function DocumentRecommendations(_props: DocumentRecommendationsProps) { return null; }
