import { resolvePlaceholder } from './resolvePlaceholder';
import type {
  DocumentContext,
  TemplateRequiredFieldInput,
  TemplateValidationIssue,
  TemplateValidationResult,
  TemplateValidationStatus,
  TemplateVersionInput,
} from './types';

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

function resolveFieldPath(context: DocumentContext, dataPath: string): unknown {
  const segments = dataPath.split('.');
  if (segments.length < 2) return undefined;
  const [group, ...rest] = segments;
  const section = context[group as keyof DocumentContext];
  if (!section || typeof section !== 'object' || Array.isArray(section)) return undefined;
  return (section as Record<string, unknown>)[rest.join('.')];
}

export function validateRequiredFields(
  templateVersion: Pick<TemplateVersionInput, 'requiredFields'>,
  context: DocumentContext,
): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];
  const fields = templateVersion.requiredFields ?? [];

  for (const field of fields) {
    if (field.isRequired === false) continue;

    const path = field.dataPath ?? field.fieldKey;
    const value = resolveFieldPath(context, path);

    if (isEmptyValue(value)) {
      issues.push({
        code: 'required_field_missing',
        message: field.errorMessage ?? `Pflichtfeld fehlt: ${field.label}`,
        fieldKey: field.fieldKey,
        severity: 'error',
      });
    }
  }

  const status: TemplateValidationStatus = issues.length > 0 ? 'error' : 'valid';
  return { status, issues };
}

export function mergeValidationResults(...results: TemplateValidationResult[]): TemplateValidationResult {
  const issues = results.flatMap((r) => r.issues);
  let status: TemplateValidationStatus = 'valid';
  for (const result of results) {
    if (result.status === 'error') status = 'error';
    else if (result.status === 'warning' && status !== 'error') status = 'warning';
  }
  return { status, issues };
}
