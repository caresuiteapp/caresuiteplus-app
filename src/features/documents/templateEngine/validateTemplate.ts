import { DEFAULT_PLACEHOLDER_REGISTRY, isKnownPlaceholder } from './placeholderRegistry';
import { sanitizeTemplateHtml } from './sanitizeTemplateHtml';
import type {
  PlaceholderRegistry,
  TemplateValidationIssue,
  TemplateValidationResult,
  TemplateValidationSeverity,
  TemplateValidationStatus,
} from './types';

function mergeStatus(current: TemplateValidationStatus, next: TemplateValidationSeverity): TemplateValidationStatus {
  if (current === 'error' || next === 'error') return 'error';
  if (current === 'warning' || next === 'warning') return 'warning';
  return 'valid';
}

export function validateKnownPlaceholders(
  placeholders: string[],
  registry: PlaceholderRegistry = DEFAULT_PLACEHOLDER_REGISTRY,
): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];

  for (const key of placeholders) {
    if (!isKnownPlaceholder(key, registry)) {
      issues.push({
        code: 'unknown_placeholder',
        message: `Unbekannter Platzhalter: {{${key}}}`,
        placeholderKey: key,
        severity: 'error',
      });
    }
  }

  const status: TemplateValidationStatus = issues.some((i) => i.severity === 'error') ? 'error' : 'valid';
  return { status, issues };
}

export function validateTemplateHtmlSafety(htmlTemplate: string): TemplateValidationResult {
  const { blocked } = sanitizeTemplateHtml(htmlTemplate);
  const status: TemplateValidationStatus = blocked.length > 0 ? 'error' : 'valid';
  return { status, issues: blocked };
}

export function validateTemplate(input: {
  htmlTemplate: string;
  placeholders?: string[];
  registry?: PlaceholderRegistry;
}): TemplateValidationResult {
  const placeholders = input.placeholders ?? [];
  const known = validateKnownPlaceholders(placeholders, input.registry);
  const safety = validateTemplateHtmlSafety(input.htmlTemplate);

  const issues = [...known.issues, ...safety.issues];
  let status: TemplateValidationStatus = 'valid';
  for (const issue of issues) {
    status = mergeStatus(status, issue.severity);
  }

  return { status, issues };
}
