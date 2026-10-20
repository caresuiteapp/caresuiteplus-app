/**
 * Generates supabase/migrations/0059_intake_document_templates_v2.sql
 * from INTAKE_DOCUMENT_SYSTEM_TEMPLATES (source of truth in TypeScript).
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync as writeTmp, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = mkdtempSync(join(tmpdir(), 'intake-mig-'));
const testFile = join(tmpDir, 'gen.test.ts');

writeTmp(
  testFile,
  `import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { INTAKE_DOCUMENT_SYSTEM_TEMPLATES } from '@/features/intakeDocuments/intakeDocumentSystemTemplates';

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

describe('generate migration', () => {
  it('writes 0059 sql', () => {
    const lines = [
      '-- Upgrade all 12 intake document system templates to v2 (comprehensive German legal content)',
      '-- Source: src/features/intakeDocuments/intakeDocumentSystemTemplates.ts',
      '',
    ];

    for (const t of INTAKE_DOCUMENT_SYSTEM_TEMPLATES) {
      lines.push(\`UPDATE public.intake_document_system_templates SET\`);
      lines.push(\`  title = '\${sqlEscape(t.title)}',\`);
      lines.push(\`  version = \${t.version},\`);
      lines.push(\`  is_required = \${t.isRequired},\`);
      lines.push(\`  requires_client_signature = \${t.requiresClientSignature},\`);
      lines.push(\`  requires_employee_signature = \${t.requiresEmployeeSignature},\`);
      lines.push(\`  requires_representative_signature = \${t.requiresRepresentativeSignature},\`);
      lines.push(\`  html_content = '\${sqlEscape(t.htmlContent)}',\`);
      lines.push(\`  plain_text_content = '\${sqlEscape(t.plainTextContent)}',\`);
      lines.push(\`  placeholder_schema = '\${sqlEscape(JSON.stringify(t.placeholderSchema))}'::jsonb,\`);
      lines.push(\`  signature_slots = '\${sqlEscape(JSON.stringify(t.signatureSlots))}'::jsonb,\`);
      lines.push(\`  updated_at = NOW()\`);
      lines.push(\`WHERE template_key = '\${sqlEscape(t.templateKey)}';\`);
      lines.push('');
    }

    writeFileSync('${root.replace(/\\/g, '/')}/supabase/migrations/0059_intake_document_templates_v2.sql', lines.join('\\n'));
  });
});
`,
);

execSync(`npx vitest run "${testFile}"`, { cwd: root, stdio: 'inherit' });
rmSync(tmpDir, { recursive: true, force: true });
console.log('Generated supabase/migrations/0059_intake_document_templates_v2.sql');
