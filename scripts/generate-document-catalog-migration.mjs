/**
 * Generates supabase/migrations/0170_document_catalog_seed.sql from catalog TS manifest.
 * Run: node scripts/generate-document-catalog-migration.mjs
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Dynamic import compiled catalog via tsx alternative: read manifest from built json export
const catalogPath = pathToFileURL(resolve(root, 'src/data/seeds/documentCatalog/index.ts')).href;

async function main() {
  // Use vitest/tsconfig path — import via jiti or read manifestEntries directly as text parse
  const { SYSTEM_DOCUMENT_CATALOG_TEMPLATES } = await import(
    pathToFileURL(resolve(root, 'src/data/seeds/documentCatalog/index.ts')).href
  );

  const lines = [
    '-- ==========================================================================',
    '-- CareSuite+ — Migration 0170: Systemvorlagen-Katalog (179 Einträge)',
    '-- Idempotent: überspringt bereits vorhandene template_key.',
    '-- ==========================================================================',
    '',
    'DO $$',
    'DECLARE',
    '  tpl RECORD;',
    '  tid UUID;',
    '  vid UUID;',
    '  seed_tenant UUID;',
    'BEGIN',
    '  SELECT id INTO seed_tenant FROM public.tenants ORDER BY created_at NULLS LAST LIMIT 1;',
    '  IF seed_tenant IS NULL THEN',
    "    seed_tenant := '00000000-0000-4000-8000-000000000001'::uuid;",
    '  END IF;',
    '',
  ];

  for (const tpl of SYSTEM_DOCUMENT_CATALOG_TEMPLATES) {
    const esc = (s) => String(s ?? '').replace(/'/g, "''");
    const moduleScope = `{${tpl.moduleScope.map((m) => `"${esc(m)}"`).join(',')}}`;
    const html = esc(tpl.htmlTemplate);
    const css = esc(tpl.cssTemplate);
    const manualFields = JSON.stringify(tpl.manualFields ?? []).replace(/'/g, "''");

    lines.push(`  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = '${esc(tpl.templateKey)}' AND tenant_id IS NULL) THEN`);
    lines.push(`    INSERT INTO public.document_templates (`);
    lines.push(`      tenant_id, template_key, template_type, label, template_name, short_name, description,`);
    lines.push(`      module_scope, template_number, category, layout_kind, document_category, template_status,`);
    lines.push(`      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,`);
    lines.push(`      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,`);
    lines.push(`      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,`);
    lines.push(`      default_file_name_pattern, content_json, mapping_schema_json, version`);
    lines.push(`    ) VALUES (`);
    lines.push(`      NULL, '${esc(tpl.templateKey)}', '${esc(tpl.templateType)}', '${esc(tpl.name)}', '${esc(tpl.name)}',`);
    lines.push(`      '${esc(tpl.shortName)}', '${esc(tpl.description)}', '${moduleScope}'::text[], ${tpl.templateNumber ?? 'NULL'},`);
    lines.push(`      '${esc(tpl.category)}', '${esc(tpl.layoutKind)}', '${esc(tpl.category)}', 'active',`);
    lines.push(`      true, false, false, true, true, true, true, true, true,`);
    lines.push(`      ${tpl.isAssistAllowed}, ${tpl.isMedicalOrTreatmentRelated}, ${tpl.isCareRelated ?? false},`);
    lines.push(`      '${esc(tpl.targetRecordType)}', '${esc(tpl.defaultStorageArea)}',`);
    lines.push(`      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',`);
    lines.push(`      '{"layoutFamily":"${esc(tpl.layoutFamily ?? 'generic_form')}"}'::jsonb, '{"complete":true}'::jsonb, 1`);
    lines.push(`    ) RETURNING id INTO tid;`);
    lines.push(`    INSERT INTO public.document_template_versions (`);
    lines.push(`      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings`);
    lines.push(`    ) VALUES (`);
    lines.push(`      seed_tenant, tid, 1, '${html}', '${css}', '${manualFields}'::jsonb, 'active',`);
    lines.push(`      '{"layoutFamily":"${esc(tpl.layoutFamily ?? 'generic_form')}"}'::jsonb`);
    lines.push(`    ) RETURNING id INTO vid;`);
    lines.push(`    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;`);
    lines.push(`    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value)`);
    lines.push(`    VALUES (NULL, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','${esc(tpl.templateKey)}','source','migration_0170'));`);
    lines.push(`  END IF;`);
    lines.push('');
  }

  lines.push('END $$;');
  lines.push('');

  const out = resolve(root, 'supabase/migrations/0170_document_catalog_seed.sql');
  writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`Wrote ${out} (${SYSTEM_DOCUMENT_CATALOG_TEMPLATES.length} templates)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
