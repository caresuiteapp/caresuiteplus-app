import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

export type DocumentTemplateVariables = Record<string, string>;

export type GenerateDocumentInput = {
  templateKey: string;
  title: string;
  variables: DocumentTemplateVariables;
  clientId?: string;
  assignmentId?: string;
};

export type GeneratedDocumentResult = {
  title: string;
  html: string;
  variables: DocumentTemplateVariables;
  generatedAt: string;
};

function interpolate(template: string, variables: DocumentTemplateVariables): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => variables[key.trim()] ?? '');
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  'assist.service_proof.templates:einzel_einsatznachweis_assist': `
<h1>Leistungsnachweis Assist</h1>
<p><strong>Mandant:</strong> {{tenant.name}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}}</p>
<p><strong>Datum:</strong> {{assignment.date}}</p>
<p><strong>Geplant:</strong> {{assignment.start_time}} – {{assignment.end_time}}</p>
<p><strong>Mitarbeitende:r:</strong> {{employee.full_name}}</p>
<p><strong>Leistung:</strong> {{assignment.subject}}</p>
<h2>Aufgaben</h2>
<p>{{assignment.tasks}}</p>
<h2>Dokumentation</h2>
<p>{{assignment.documentation}}</p>
<p>Unterschrift Klient:in / Vertretung: ____________________</p>
<p>Unterschrift Mitarbeitende:r: ____________________</p>
<p><em>Erstellt am {{created_at}} von {{created_by}}</em></p>
`.trim(),
  'assist.service_proof.templates:monatsnachweis_assist': `
<h1>Monatsnachweis Assist</h1>
<p><strong>Mandant:</strong> {{tenant.name}}</p>
<p><strong>Klient:in:</strong> {{client.full_name}}</p>
<p><strong>Monat:</strong> {{assignment.date}}</p>
<p>{{assignment.tasks}}</p>
`.trim(),
};

export async function generateDocumentFromTemplate(
  tenantId: string,
  input: GenerateDocumentInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<GeneratedDocumentResult>> {
  const denied = enforcePermission<GeneratedDocumentResult>(actorRoleKey, 'office.catalogs.view');
  if (denied) {
    const alt = enforcePermission<GeneratedDocumentResult>(actorRoleKey, 'assist.assignments.manage');
    if (alt) return alt;
  }
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;

  const templateBody =
    DEFAULT_TEMPLATES[input.templateKey] ??
    DEFAULT_TEMPLATES['assist.service_proof.templates:einzel_einsatznachweis_assist'];

  const html = interpolate(templateBody, input.variables);
  return {
    ok: true,
    data: {
      title: input.title,
      html,
      variables: input.variables,
      generatedAt: new Date().toISOString(),
    },
  };
}

export function buildDefaultDocumentVariables(partial: Partial<DocumentTemplateVariables>): DocumentTemplateVariables {
  return {
    'tenant.name': partial['tenant.name'] ?? 'CareSuite+ Mandant',
    'tenant.address': partial['tenant.address'] ?? '',
    'tenant.phone': partial['tenant.phone'] ?? '',
    'tenant.email': partial['tenant.email'] ?? '',
    'client.full_name': partial['client.full_name'] ?? '',
    'client.address': partial['client.address'] ?? '',
    'client.birth_date': partial['client.birth_date'] ?? '',
    'client.care_level': partial['client.care_level'] ?? '',
    'client.insurance': partial['client.insurance'] ?? '',
    'client.insurance_number': partial['client.insurance_number'] ?? '',
    'contact.full_name': partial['contact.full_name'] ?? '',
    'assignment.subject': partial['assignment.subject'] ?? '',
    'assignment.date': partial['assignment.date'] ?? '',
    'assignment.start_time': partial['assignment.start_time'] ?? '',
    'assignment.end_time': partial['assignment.end_time'] ?? '',
    'assignment.duration': partial['assignment.duration'] ?? '',
    'assignment.tasks': partial['assignment.tasks'] ?? '',
    'assignment.documentation': partial['assignment.documentation'] ?? '',
    'employee.full_name': partial['employee.full_name'] ?? '',
    'signature.client': partial['signature.client'] ?? '',
    'signature.employee': partial['signature.employee'] ?? '',
    'created_at': partial['created_at'] ?? new Date().toLocaleDateString('de-DE'),
    'created_by': partial['created_by'] ?? '',
  };
}
