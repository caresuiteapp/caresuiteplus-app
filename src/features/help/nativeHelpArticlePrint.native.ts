import type { HelpArticle } from './helpTypes';
import { helpArticlePrintHtml } from './helpArticlePrint.shared';
import { deliverNativeArchive } from '@/lib/platform/nativeFileDelivery.native';

export async function printNativeHelpArticle(article: HelpArticle): Promise<void> {
  await deliverNativeArchive({ html: helpArticlePrintHtml(article), json: '', filename: `CareSuite-Anleitung-${article.id}` }, 'print');
}
