import { describe, expect, it, vi } from 'vitest';
import type { DocumentContext } from '@/types/documents/csTemplateDatabase';
import { normalizeDocumentContext } from '@/lib/documents/csTemplates/csDocumentContextNormalize';
import {
  annotateSignatureRegions,
  extractPlaceholderKeys,
  injectSignatureIntoHtml,
  renderCsTemplateHtml,
} from '@/lib/documents/csTemplates/csTemplateRenderService';
import {
  validateRecipients,
  validateSignatureFieldsPresent,
  validateTemplateForSend,
} from '@/lib/documents/csTemplates/csTemplateValidation';
import {
  filterRequestsByTab,
  inspectBlockingCsDocumentsForAssignment,
  seedDemoCsDocumentRequestForTests,
  signCsDocumentRequest,
} from '@/lib/documents/csTemplates/csDocumentRequestService';
import type {
  CsDocumentRequestListItem,
  CsTemplateSignatureField,
  CsTemplateWithActiveVersion,
} from '@/types/documents/csTemplateDatabase';

vi.mock('@/lib/services/mode', () => ({
  getServiceMode: vi.fn(() => 'demo'),
}));

const baseTemplate: CsTemplateWithActiveVersion = {
  id: 't1',
  templateKey: 'test',
  categoryKey: 'client_contracts',
  title: 'Testvertrag',
  shortDescription: null,
  documentType: 'Vertrag',
  recipientScope: 'client',
  defaultSignatureRequirement: 'client',
  defaultPriority: 'normal',
  isRequiredBeforeService: false,
  isSystemTemplate: true,
  tags: [],
  dueInDays: 7,
  activeVersion: {
    id: 'v1',
    templateId: 't1',
    versionNo: 1,
    status: 'active',
    title: 'Testvertrag',
    bodyHtml:
      '<p>{{tenant.legal_name}}</p><p>{{client.full_name}}</p><span data-signature-anchor="client_signature">[SIGNATURE:client]</span>',
    legalNotice: null,
  },
  signatureFields: [
    {
      id: 's1',
      versionId: 'v1',
      signerRole: 'client',
      label: 'Klient',
      required: true,
      anchorToken: 'client_signature',
      inputType: 'signature',
      orderIndex: 1,
    },
  ],
};

describe('csTemplateRenderService', () => {
  it('renders tenant placeholders', () => {
    const html = '<p>{{tenant.legal_name}} · {{tenant.display_name}}</p>';
    const context: DocumentContext = {
      tenant: { legal_name: 'CareSuite GmbH', trade_name: 'CareSuite+' },
      document: { title: 'Test' },
    };
    const rendered = renderCsTemplateHtml(html, context);
    expect(rendered).toContain('CareSuite GmbH');
    expect(rendered).toContain('CareSuite+');
  });

  it('renders employee placeholders', () => {
    const html = '<p>{{employee.full_name}} · {{employee.role}}</p>';
    const context: DocumentContext = {
      tenant: { legal_name: 'X' },
      employee: { full_name: 'Anna Schmidt', job_title: 'Pflegekraft' },
      document: { title: 'T' },
    };
    expect(renderCsTemplateHtml(html, context)).toContain('Anna Schmidt');
    expect(renderCsTemplateHtml(html, context)).toContain('Pflegekraft');
  });

  it('renders client placeholders', () => {
    const html = '<p>{{client.full_name}} · {{client.payor_name}}</p>';
    const context: DocumentContext = {
      tenant: { legal_name: 'X' },
      client: { full_name: 'Ramona König', insurance_name: 'AOK NordWest' },
      document: { title: 'T' },
    };
    const rendered = renderCsTemplateHtml(html, context);
    expect(rendered).toContain('Ramona König');
    expect(rendered).toContain('AOK NordWest');
  });

  it('uses em dash for empty optional placeholders', () => {
    const html = '<p>{{employee.phone}}</p>';
    const context: DocumentContext = {
      tenant: { legal_name: 'X' },
      document: { title: 'T' },
    };
    expect(renderCsTemplateHtml(html, context)).toContain('—');
  });

  it('extracts placeholder keys from template html', () => {
    const keys = extractPlaceholderKeys('{{tenant.email}} und {{ client.full_name }}');
    expect(keys).toEqual(expect.arrayContaining(['tenant.email', 'client.full_name']));
  });

  it('annotates signature regions for preview', () => {
    const html =
      '<span data-signature-anchor="client_signature">[SIGNATURE:client]</span>';
    expect(annotateSignatureRegions(html)).toContain('Pflichtsignatur');
    expect(annotateSignatureRegions(html)).toContain('client_signature');
  });

  it('injects signature image into anchor', () => {
    const html =
      '<span data-signature-anchor="client_signature">[SIGNATURE:client]</span>';
    const next = injectSignatureIntoHtml(
      html,
      'client_signature',
      'data:image/png;base64,abc',
      'Ramona König',
      '2026-07-05T10:00:00.000Z',
    );
    expect(next).toContain('data:image/png;base64,abc');
    expect(next).toContain('Ramona König');
  });
});

describe('csDocumentContextNormalize', () => {
  it('maps alias keys for Phase-2 placeholders', () => {
    const normalized = normalizeDocumentContext({
      tenant: { legal_name: 'CareSuite GmbH', trade_name: 'CareSuite+', address_full: 'Str. 1' },
      client: { full_name: 'Max', insurance_name: 'Barmer' },
      document: { title: 'Vertrag', document_type: 'Einwilligung' },
    });
    expect(normalized.tenant.display_name).toBe('CareSuite+');
    expect(normalized.tenant.address).toBe('Str. 1');
    expect(normalized.client?.payor_name).toBe('Barmer');
    expect(normalized.document.type).toBe('Einwilligung');
  });
});

describe('csTemplateValidation', () => {
  it('blocks send when required tenant data is missing', () => {
    const issues = validateTemplateForSend({
      template: baseTemplate,
      sendRecipientScope: 'client',
      clientId: 'client-1',
      context: {
        tenant: { legal_name: '' },
        client: { full_name: 'Ramona König' },
        document: { title: 'Test' },
      },
      placeholders: [
        {
          id: 'p1',
          placeholderKey: 'tenant.legal_name',
          label: 'Firmenname',
          entity: 'tenant',
          description: null,
          example: null,
          requiredContext: true,
          dataType: 'text',
          piiLevel: 'business',
        },
      ],
    });
    expect(issues.some((i) => i.code === 'missing_context_data')).toBe(true);
  });

  it('reports recipient mismatch', () => {
    const issues = validateTemplateForSend({
      template: baseTemplate,
      sendRecipientScope: 'employee',
      employeeId: 'emp-1',
      context: {
        tenant: { legal_name: 'CareSuite GmbH' },
        document: { title: 'Test' },
      },
      placeholders: [],
    });
    expect(issues.some((i) => i.code === 'recipient_mismatch')).toBe(true);
  });

  it('recognizes missing recipients', () => {
    const employeeIssue = validateRecipients({ recipientScope: 'employee', employeeId: null });
    expect(employeeIssue[0]?.message).toMatch(/Mitarbeitenden/);

    const clientIssue = validateRecipients({ recipientScope: 'client', clientId: null });
    expect(clientIssue[0]?.message).toMatch(/Klientin/);

    const bothIssues = validateRecipients({ recipientScope: 'both', employeeId: 'e1', clientId: null });
    expect(bothIssues.some((i) => i.message.match(/Klientin/))).toBe(true);
  });

  it('recognizes missing active version', () => {
    const issues = validateTemplateForSend({
      template: null,
      sendRecipientScope: 'client',
      context: { tenant: { legal_name: 'X' }, document: { title: 'T' } },
      placeholders: [],
    });
    expect(issues[0]?.message).toMatch(/aktive Version/);
  });

  it('recognizes missing signature fields when signature required', () => {
    const issues = validateSignatureFieldsPresent('client', []);
    expect(issues[0]?.message).toMatch(/Signaturfeld/);
  });

  it('warns when client placeholder cannot be resolved', () => {
    const issues = validateTemplateForSend({
      template: baseTemplate,
      sendRecipientScope: 'client',
      clientId: 'client-1',
      context: {
        tenant: { legal_name: 'CareSuite GmbH' },
        document: { title: 'Test' },
      },
      placeholders: [],
    });
    expect(
      issues.some((i) => i.message.includes('{{client.full_name}}') && i.message.includes('Klient')),
    ).toBe(true);
  });
});

describe('csDocumentRequestService (demo mode)', () => {
  const tenantId = '56180c22-b894-4fab-b55e-a563c94dd6e7';

  it('filters completed requests out of open portal tab', () => {
    const openItem: CsDocumentRequestListItem = {
      id: 'r1',
      ownerTenantId: tenantId,
      templateVersionId: 'v1',
      sourceTemplateKey: 'test',
      title: 'Offen',
      recipientScope: 'client',
      employeeId: null,
      clientId: 'c1',
      representativeId: null,
      assignmentId: null,
      invoiceId: null,
      priority: 'normal',
      status: 'sent',
      dueDate: '2026-07-10',
      requiredBeforeService: false,
      portalVisible: true,
      renderedHtml: '<p>Test</p>',
      completedAt: null,
      createdAt: '2026-07-05T08:00:00.000Z',
      updatedAt: '2026-07-05T08:00:00.000Z',
      signatures: [{ id: 's1', requestId: 'r1', signerRole: 'client', signerName: null, status: 'pending', signedAt: null }],
      pendingSignatureRoles: ['client'],
    };

    const completedItem: CsDocumentRequestListItem = {
      ...openItem,
      id: 'r2',
      title: 'Erledigt',
      status: 'completed',
      portalVisible: false,
      completedAt: '2026-07-05T09:00:00.000Z',
      signatures: [{ id: 's2', requestId: 'r2', signerRole: 'client', signerName: 'Ramona', status: 'signed', signedAt: '2026-07-05T09:00:00.000Z' }],
      pendingSignatureRoles: [],
    };

    expect(filterRequestsByTab([openItem, completedItem], 'open')).toHaveLength(1);
    expect(filterRequestsByTab([openItem, completedItem], 'completed')).toHaveLength(1);
  });

  it('completes request when all required signatures are signed', async () => {
    const requestId = `demo-sign-${Date.now()}`;
    const item: CsDocumentRequestListItem = {
      id: requestId,
      ownerTenantId: tenantId,
      templateVersionId: 'v1',
      sourceTemplateKey: 'test',
      title: 'Signatur-Test',
      recipientScope: 'client',
      employeeId: null,
      clientId: 'client-1',
      representativeId: null,
      assignmentId: null,
      invoiceId: null,
      priority: 'normal',
      status: 'sent',
      dueDate: '2026-07-10',
      requiredBeforeService: false,
      portalVisible: true,
      renderedHtml:
        '<span data-signature-anchor="client_signature">[SIGNATURE:client]</span>',
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      signatures: [
        {
          id: 'sig-1',
          requestId,
          signerRole: 'client',
          signerName: null,
          status: 'pending',
          signedAt: null,
        },
      ],
      pendingSignatureRoles: ['client'],
    };

    seedDemoCsDocumentRequestForTests(item);

    const result = await signCsDocumentRequest({
      tenantId,
      requestId,
      signerRole: 'client',
      signerName: 'Ramona König',
      signatureDataUrl: 'data:image/png;base64,abc',
      anchorToken: 'client_signature',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.status).toBe('completed');
    expect(result.data.portalVisible).toBe(false);
    expect(result.data.pendingSignatureRoles).toHaveLength(0);
    expect(filterRequestsByTab([result.data], 'open')).toHaveLength(0);
    expect(filterRequestsByTab([result.data], 'completed')).toHaveLength(1);
  });

  it('returns no blocking documents in demo mode', async () => {
    const result = await inspectBlockingCsDocumentsForAssignment(tenantId, 'assignment-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hasBlockingDocuments).toBe(false);
      expect(result.data.blockingRequests).toEqual([]);
    }
  });
});

describe('active version discovery (structural)', () => {
  it('finds active version on template fixture', () => {
    expect(baseTemplate.activeVersion?.status).toBe('active');
    expect(baseTemplate.activeVersion?.bodyHtml).toContain('{{tenant.legal_name}}');
  });

  it('signature field list is non-empty for client signature template', () => {
    const fields: CsTemplateSignatureField[] = baseTemplate.signatureFields;
    expect(fields.length).toBeGreaterThan(0);
    expect(fields[0]?.signerRole).toBe('client');
  });
});
