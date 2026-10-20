import type { DocumentationAiFunction } from '@/lib/portal/documentationAiTypes';

function capitalizeSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function toProfessionalCareTone(text: string): string {
  return text
    .replace(/\b(ich habe|ich war|ich bin)\b/gi, 'Die Pflegekraft war')
    .replace(/\b(wir haben|wir waren)\b/gi, 'Das Betreuungsteam hat')
    .replace(/\b(klient|kunde)\b/gi, 'Klient:in')
    .replace(/\s+/g, ' ')
    .trim();
}

function bulletsToSentences(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  return lines.map((line) => capitalizeSentence(line.replace(/[.!?]$/, ''))).join('. ') + '.';
}

export function applyDocumentationAiFallback(
  fn: DocumentationAiFunction,
  sourceText: string,
): string {
  const base = sourceText.trim();
  if (!base) return '';

  switch (fn) {
    case 'from_bullets':
      return bulletsToSentences(base);
    case 'professional':
      return capitalizeSentence(toProfessionalCareTone(base));
    case 'grammar':
      return capitalizeSentence(base.replace(/\s+/g, ' '));
    case 'summarize': {
      const sentences = base.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
      if (sentences.length <= 2) return capitalizeSentence(base);
      return capitalizeSentence(`${sentences[0]}. ${sentences[sentences.length - 1]}.`);
    }
    case 'neutral_care':
      return capitalizeSentence(toProfessionalCareTone(base));
    case 'short': {
      const sentences = base.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
      const short = sentences.slice(0, 3).join('. ');
      return capitalizeSentence(short.endsWith('.') ? short : `${short}.`);
    }
    case 'detailed':
      return `Einsatzverlauf: ${capitalizeSentence(toProfessionalCareTone(base))}`;
    default:
      return base;
  }
}
