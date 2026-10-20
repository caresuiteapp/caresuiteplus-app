import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { INTAKE_DOCUMENT_SYSTEM_TEMPLATES } from '@/features/intakeDocuments/intakeDocumentSystemTemplates';

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

describe('generate intake migration', () => {
  it('writes 0059_intake_document_templates_v2.sql', () => {
    const lines = [
      '-- Upgrade all 12 intake document system templates to v2 (comprehensive German legal content)',
      '-- Source: src/features/intakeDocuments/intakeDocumentSystemTemplates.ts',
      '',
    ];

    for (const t of INTAKE_DOCUMENT_SYSTEM_TEMPLATES) {
      lines.push('UPDATE public.intake_document_system_templates SET');
      lines.push(`  title = '${sqlEscape(t.title)}',`);
      lines.push(`  version = ${t.version},`);
      lines.push(`  is_required = ${t.isRequired},`);
      lines.push(`  requires_client_signature = ${t.requiresClientSignature},`);
      lines.push(`  requires_employee_signature = ${t.requiresEmployeeSignature},`);
      lines.push(`  requires_representative_signature = ${t.requiresRepresentativeSignature},`);
      lines.push(`  html_content = '${sqlEscape(t.htmlContent)}',`);
      lines.push(`  plain_text_content = '${sqlEscape(t.plainTextContent)}',`);
      lines.push(`  placeholder_schema = '${sqlEscape(JSON.stringify(t.placeholderSchema))}'::jsonb,`);
      lines.push(`  signature_slots = '${sqlEscape(JSON.stringify(t.signatureSlots))}'::jsonb,`);
      lines.push('  updated_at = NOW()');
      lines.push(`WHERE template_key = '${sqlEscape(t.templateKey)}';`);
      lines.push('');
    }

    const outPath = path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '0059_intake_document_templates_v2.sql');
    writeFileSync(outPath, `${lines.join('\n')}\n`);
  });
});
