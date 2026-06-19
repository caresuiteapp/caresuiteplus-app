import { describe, expect, it } from 'vitest';
import { getCommunicationCareSuiteTemplates } from '@/lib/communication/communicationTemplates';
import {
  getCommunicationMessageTemplateDefaults,
  mergeCommunicationMessageTemplates,
} from '@/lib/templates/communicationTemplateDefaults';
import type { CareSuiteTemplate } from '@/types/templates';

describe('communicationTemplateDefaults', () => {
  it('exposes 100 in-app compose message templates', () => {
    expect(getCommunicationMessageTemplateDefaults().length).toBe(100);
    expect(getCommunicationCareSuiteTemplates().length).toBe(100);
  });

  it('merges defaults when Supabase returns no communication message rows', () => {
    const merged = mergeCommunicationMessageTemplates([], {
      moduleKey: 'communication',
      templateType: 'message',
      status: 'active',
    });
    expect(merged.length).toBe(100);
    expect(merged.every((t) => t.moduleKey === 'communication' && t.templateType === 'message')).toBe(
      true,
    );
  });

  it('prefers DB rows over defaults with the same id', () => {
    const defaults = getCommunicationMessageTemplateDefaults();
    const first = defaults[0];
    const customized: CareSuiteTemplate = {
      ...first,
      title: 'Angepasste Vorlage aus DB',
      content: 'Individueller Inhalt',
    };

    const merged = mergeCommunicationMessageTemplates([customized], {
      moduleKey: 'communication',
      templateType: 'message',
      status: 'active',
    });

    const found = merged.find((t) => t.id === first.id);
    expect(found?.title).toBe('Angepasste Vorlage aus DB');
    expect(merged.length).toBe(100);
  });

  it('does not merge for unrelated module queries', () => {
    const officeOnly: CareSuiteTemplate[] = [
      {
        id: 'office-1',
        tenantId: null,
        scope: 'system',
        moduleKey: 'office',
        templateType: 'documentation_text',
        status: 'active',
        title: 'Office',
        description: null,
        categoryKey: null,
        content: 'Text',
        variables: [],
        tags: [],
        sortOrder: 1,
        isDefault: false,
        isRequired: false,
        createdBy: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const merged = mergeCommunicationMessageTemplates(officeOnly, {
      moduleKey: 'office',
      status: 'active',
    });
    expect(merged).toEqual(officeOnly);
  });
});
