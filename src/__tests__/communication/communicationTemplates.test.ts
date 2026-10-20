import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_MESSAGE_TEMPLATES,
  getCommunicationTemplateCounts,
  getCommunicationCareSuiteTemplates,
} from '@/lib/communication/communicationTemplates';
import {
  findUnresolvedTemplatePlaceholders,
  getComposeVariableValues,
  renderTemplateWithVariables,
  validateComposePreview,
} from '@/lib/templates/templateVariables';
import { PRIORITY_LABELS } from '@/features/communication/communication.constants';

describe('communication message templates', () => {
  it('contains ~100 templates across audiences', () => {
    const counts = getCommunicationTemplateCounts();
    expect(counts.klient).toBe(26);
    expect(counts.mitarbeiter).toBe(26);
    expect(counts.team).toBe(18);
    expect(counts.intern).toBe(30);
    expect(COMMUNICATION_MESSAGE_TEMPLATES.length).toBe(100);
  });

  it('maps to CareSuite templates with stable ids', () => {
    const mapped = getCommunicationCareSuiteTemplates();
    expect(mapped.length).toBe(100);
    expect(new Set(mapped.map((t) => t.id)).size).toBe(100);
    expect(mapped.every((t) => t.moduleKey === 'communication' && t.templateType === 'message')).toBe(
      true,
    );
  });

  it('includes Kritisch priority label', () => {
    expect(PRIORITY_LABELS.critical).toBe('Kritisch');
  });

  it('resolves compose variables and validates preview', () => {
    const variables = getComposeVariableValues({
      recipientKind: 'client',
      recipientName: 'Ellen Zacharias',
    });
    const rendered = renderTemplateWithVariables('Guten Tag {{clientName}}, Termin am {{date}}.', variables);
    expect(rendered).toContain('Ellen Zacharias');
    expect(findUnresolvedTemplatePlaceholders(rendered)).toEqual([]);
    expect(validateComposePreview('Guten Tag {{clientName}}', rendered).ok).toBe(true);
  });

  it('warns on unresolved placeholders', () => {
    const rendered = renderTemplateWithVariables('Hallo {{unknownVar}}', getComposeVariableValues());
    expect(validateComposePreview('Hallo {{unknownVar}}', rendered).unresolvedPlaceholders).toContain(
      'unknownVar',
    );
  });
});
