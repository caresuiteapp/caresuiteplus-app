import { extractPlaceholders, replacePlaceholderTokens } from './extractPlaceholders';
import { DEFAULT_PLACEHOLDER_REGISTRY } from './placeholderRegistryService';
import { resolvePlaceholderAsString } from './resolvePlaceholder';
import { sanitizeTemplateHtml } from './sanitizeTemplateHtml';
import type {
  DocumentContext,
  DocumentTemplateTypeKey,
  PlaceholderRegistry,
  RenderTemplateResult,
  TemplateValidationResult,
  TemplateVersionInput,
} from './types';
import type { TenantDocumentSettings } from '@/types/documents/tenantDocumentSettings';
import {
  buildDocumentCiCss,
  buildDocumentFooterHtml,
  buildDocumentHeaderHtml,
  wrapDocumentBodyWithLayoutAreas,
} from './documentLayout';
import { validateCiRequirements, validateDocumentTypeDisclosures } from './validateCiRequirements';
import { validateDocumentByType } from './finalizeDocument';
import { mergeValidationResults, validateRequiredFields } from './validateRequiredFields';
import { validateKnownPlaceholders, validateTemplateHtmlSafety } from './validateTemplate';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLayoutStyle(layoutSettings?: Record<string, unknown>): string {
  if (!layoutSettings || Object.keys(layoutSettings).length === 0) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(layoutSettings)) {
    if (typeof value === 'string' || typeof value === 'number') {
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.join('; ');
}

function wrapDocumentHtml(bodyHtml: string, cssTemplate: string, layoutStyle: string): string {
  const layoutAttr = layoutStyle ? ` style="${escapeHtml(layoutStyle)}"` : '';
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;" />
<style>${cssTemplate}</style>
</head>
<body>
<div class="cs-document-root"${layoutAttr}>
${bodyHtml}
</div>
</body>
</html>`;
}

function aggregateValidation(...parts: TemplateValidationResult[]): TemplateValidationResult {
  return mergeValidationResults(...parts);
}

export type RenderTemplateOptions = {
  context: DocumentContext;
  documentType?: DocumentTemplateTypeKey;
  registry?: PlaceholderRegistry;
  pageNumber?: number;
  pageTotal?: number;
  tenantDocumentSettings?: TenantDocumentSettings | null;
  applyLayoutShell?: boolean;
};

/**
 * Rendert eine Vorlagenversion zu finalem HTML.
 * Kein eval(), keine Script-Ausführung — Platzhalter werden escaped eingesetzt.
 */
export function renderTemplate(
  templateVersion: TemplateVersionInput,
  options: RenderTemplateOptions,
): RenderTemplateResult {
  const registry = options.registry ?? DEFAULT_PLACEHOLDER_REGISTRY;
  const { context } = options;

  const contextWithPage: DocumentContext = {
    ...context,
    page: {
      ...context.page,
      number: String(options.pageNumber ?? context.page.number ?? '1'),
      total: String(options.pageTotal ?? context.page.total ?? '1'),
    },
  };

  const sanitizedInput = sanitizeTemplateHtml(templateVersion.htmlTemplate);
  const placeholders = extractPlaceholders(sanitizedInput.html);

  const validation = aggregateValidation(
    validateKnownPlaceholders(placeholders, registry),
    validateTemplateHtmlSafety(sanitizedInput.html),
    validateRequiredFields(templateVersion, contextWithPage),
    options.documentType
      ? validateDocumentByType(options.documentType, contextWithPage)
      : { status: 'valid', issues: [] },
    options.documentType
      ? validateDocumentTypeDisclosures(options.documentType, contextWithPage)
      : { status: 'valid', issues: [] },
    options.tenantDocumentSettings && options.documentType
      ? validateCiRequirements(options.tenantDocumentSettings, options.documentType)
      : { status: 'valid', issues: [] },
  );

  const unresolved: string[] = [];
  const used: string[] = [];

  const bodyHtml = replacePlaceholderTokens(sanitizedInput.html, (key) => {
    used.push(key);
    const value = resolvePlaceholderAsString(key, contextWithPage);
    if (!value) {
      unresolved.push(key);
      return `<span class="cs-placeholder-unresolved" data-placeholder="${escapeHtml(key)}">{{${key}}}</span>`;
    }
    return escapeHtml(value);
  });

  const layoutBody =
    options.applyLayoutShell !== false && options.tenantDocumentSettings
      ? wrapDocumentBodyWithLayoutAreas(bodyHtml)
      : bodyHtml;

  const headerHtml =
    options.tenantDocumentSettings && options.applyLayoutShell !== false
      ? buildDocumentHeaderHtml({
          settings: options.tenantDocumentSettings,
          context: contextWithPage,
          documentType: options.documentType,
        })
      : '';

  const footerHtml =
    options.tenantDocumentSettings && options.documentType && options.applyLayoutShell !== false
      ? buildDocumentFooterHtml({
          settings: options.tenantDocumentSettings,
          context: contextWithPage,
          documentType: options.documentType,
        })
      : '';

  const ciCss = options.tenantDocumentSettings ? buildDocumentCiCss(options.tenantDocumentSettings) : '';
  const cssSanitized = sanitizeTemplateHtml(
    [ciCss, templateVersion.cssTemplate ?? ''].filter(Boolean).join('\n'),
  ).html;
  const layoutStyle = buildLayoutStyle(templateVersion.layoutSettings);
  const html = wrapDocumentHtml(`${headerHtml}${layoutBody}${footerHtml}`, cssSanitized, layoutStyle);

  const finalValidation =
    unresolved.length > 0
      ? aggregateValidation(validation, {
          status: 'warning',
          issues: unresolved.map((key) => ({
            code: 'unresolved_placeholder',
            message: `Platzhalter ohne Wert: {{${key}}}`,
            placeholderKey: key,
            severity: 'warning' as const,
          })),
        })
      : validation;

  const missingRequiredFields = finalValidation.issues
    .filter((i) => i.severity === 'error' && (i.fieldKey || i.placeholderKey))
    .map((i) => i.fieldKey ?? i.placeholderKey ?? i.code);

  return {
    html,
    placeholdersUsed: [...new Set(used)].sort(),
    unresolvedPlaceholders: [...new Set(unresolved)].sort(),
    validation: finalValidation,
    missingRequiredFields,
  };
}
