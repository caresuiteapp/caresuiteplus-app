/**
 * Preview-Renderer — Trennung Editor ↔ Renderer.
 * UI-Schichten rufen ausschließlich diese Funktionen auf, nicht renderTemplate direkt.
 */
import type { PreviewViewMode } from '@/types/documents/documentTemplate';
import type { TenantDocumentSettings } from '@/types/documents/tenantDocumentSettings';
import { renderTemplate, type RenderTemplateOptions } from './renderTemplate';
import type {
  DocumentContext,
  DocumentTemplateTypeKey,
  RenderTemplateResult,
  TemplateVersionInput,
} from './types';
import {
  buildDraftWatermarkCss,
  buildPreviewViewModeCss,
  wrapHtmlWithDraftWatermark,
} from './watermark';

export type DocumentPreviewInput = {
  templateVersion: TemplateVersionInput;
  context: DocumentContext;
  documentType: DocumentTemplateTypeKey;
  tenantDocumentSettings?: TenantDocumentSettings | null;
  viewMode?: PreviewViewMode;
  showDraftWatermark?: boolean;
  applyLayoutShell?: boolean;
};

export type DocumentPreviewOutput = {
  html: string;
  renderResult: RenderTemplateResult;
  viewMode: PreviewViewMode;
  hasDraftWatermark: boolean;
  hasPageBreaks: boolean;
  hasCiColors: boolean;
  hasLogo: boolean;
  hasFooter: boolean;
};

function injectPreviewStyles(html: string, extraCss: string): string {
  if (html.includes('</head>')) {
    return html.replace('</head>', `<style>${extraCss}</style></head>`);
  }
  return html;
}

export function buildDocumentPreview(input: DocumentPreviewInput): DocumentPreviewOutput {
  const viewMode = input.viewMode ?? 'desktop';
  const showDraft = input.showDraftWatermark ?? true;

  const renderOptions: RenderTemplateOptions = {
    context: input.context,
    documentType: input.documentType,
    tenantDocumentSettings: input.tenantDocumentSettings,
    applyLayoutShell: input.applyLayoutShell ?? true,
  };

  const renderResult = renderTemplate(input.templateVersion, renderOptions);

  let html = renderResult.html;
  const extraCss = [
    buildPreviewViewModeCss(viewMode),
    showDraft ? buildDraftWatermarkCss() : '',
  ]
    .filter(Boolean)
    .join('\n');

  html = injectPreviewStyles(html, extraCss);
  if (showDraft) {
    html = wrapHtmlWithDraftWatermark(html);
  }

  const hasCiColors =
    Boolean(input.tenantDocumentSettings?.primaryColor) &&
    html.includes(input.tenantDocumentSettings!.primaryColor);

  return {
    html,
    renderResult,
    viewMode,
    hasDraftWatermark: showDraft,
    hasPageBreaks: html.includes('page-break') || html.includes('cs-block-page-break'),
    hasCiColors,
    hasLogo: html.includes('cs-logo') || html.includes('cs-block-logo'),
    hasFooter: html.includes('cs-footer') || html.includes('cs-block-footer'),
  };
}
