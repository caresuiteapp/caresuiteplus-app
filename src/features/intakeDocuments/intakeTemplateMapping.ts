import { getSystemIntakeTemplateByKey } from './intakeDocumentSystemTemplates';
import type { IntakeDocumentTemplate } from './intakeDocumentTypes';

export type SystemTemplateRow = {
  id: string;
  template_key: string;
  title: string;
  document_type: string;
  service_type: string | null;
  version: number;
  is_required: boolean;
  is_active: boolean;
  requires_client_signature: boolean;
  requires_employee_signature: boolean;
  requires_representative_signature: boolean;
  allows_custom_template: boolean;
  html_content: string;
  plain_text_content: string;
  placeholder_schema: Record<string, { label: string; required?: boolean }> | null;
  signature_slots: { role: string; placeholder: string; required: boolean }[] | null;
};

export type TenantTemplateRow = {
  id: string;
  tenant_id: string;
  system_template_id: string | null;
  template_key: string;
  title: string | null;
  document_type: string;
  service_type: string | null;
  html_content: string | null;
  is_default: boolean;
  is_active: boolean;
};

export function mapSystemRow(row: SystemTemplateRow): IntakeDocumentTemplate {
  return {
    id: row.id,
    templateKey: row.template_key,
    title: row.title,
    documentType: row.document_type as IntakeDocumentTemplate['documentType'],
    serviceType: row.service_type,
    version: row.version,
    isSystemTemplate: true,
    isRequired: row.is_required,
    isActive: row.is_active,
    requiresClientSignature: row.requires_client_signature,
    requiresEmployeeSignature: row.requires_employee_signature,
    requiresRepresentativeSignature: row.requires_representative_signature,
    allowsCustomTemplate: row.allows_custom_template,
    htmlContent: row.html_content,
    plainTextContent: row.plain_text_content,
    placeholderSchema: row.placeholder_schema ?? {},
    signatureSlots: (row.signature_slots ?? []).map((s) => ({
      role: s.role as IntakeDocumentTemplate['signatureSlots'][number]['role'],
      placeholder: s.placeholder,
      required: s.required,
    })),
    source: 'system',
  };
}

export function mapTenantRow(row: TenantTemplateRow, system?: IntakeDocumentTemplate): IntakeDocumentTemplate | null {
  const base = system ?? getSystemIntakeTemplateByKey(row.template_key);
  if (!base) return null;

  return {
    ...base,
    id: row.id,
    title: row.title ?? base.title,
    serviceType: row.service_type ?? base.serviceType,
    htmlContent: row.html_content ?? base.htmlContent,
    source: 'tenant',
    tenantTemplateId: row.id,
    isActive: row.is_active,
  };
}

