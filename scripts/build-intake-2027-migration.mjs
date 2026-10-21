import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const outputIndex = process.argv.indexOf('--output');
if (outputIndex < 0 || !process.argv[outputIndex + 1]) throw new Error('An explicit --output path is required. Existing migration history is never overwritten.');
const result = await build({ entryPoints: ['src/features/intakeDocuments/intakeDocumentTemplates2027.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} };
runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: createRequire(import.meta.url) });
const templates = module.exports.INTAKE_DOCUMENT_TEMPLATES_2027;
const catalogBundle = await build({ entryPoints: ['src/data/seeds/documentCatalog/centralCatalog.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const catalogModule = { exports: {} };
runInNewContext(catalogBundle.outputFiles[0].text, { module: catalogModule, exports: catalogModule.exports, require: createRequire(import.meta.url) });
const catalog = catalogModule.exports.CENTRAL_DOCUMENT_CATALOG.filter(d => d.edition === '2027');
if (catalog.length !== 40 || catalog.some(d => d.version !== 3 || d.target !== 'client' || d.sourceMode !== 'create')) throw new Error('The reviewed catalogue scope must contain 40 new client definitions.');
if (templates.length !== 12 || templates.some(template => template.version !== 4)) throw new Error('The prepared edition must contain all twelve version 4 templates.');
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const json = value => `${sql(JSON.stringify(value))}::jsonb`;
const catalogSql = catalog.map(d => `(${[sql(d.key), d.version, sql(d.title), sql(d.categoryKey), sql(d.target), sql(d.sourceMode), "'draft'", json(d)].join(',')})`).join(',\n');
const rows = templates.map(t => `(${[sql(t.templateKey), sql(t.title), sql(t.documentType), t.serviceType ? sql(t.serviceType) : 'NULL', '4', 'true', String(t.isRequired), 'true', String(t.requiresClientSignature), String(t.requiresEmployeeSignature), 'false', 'false', sql(t.htmlContent), sql(t.plainTextContent), json(t.placeholderSchema), json(t.signatureSlots)].join(',')})`);
const originalSelection = 'SELECT * INTO t FROM public.intake_document_system_templates WHERE template_key=key FOR SHARE;';
const editionSelection = `IF d.form_json->>'intakeTemplateEdition'='2027' THEN
   IF d.form_json->>'intakeWorkflowVersion' IS DISTINCT FROM '2' OR key='client_contract_stationary_care' THEN
    RAISE EXCEPTION 'Diese Ausgabe benötigt den vorgesehenen Web-Ablauf; ein WBVG-Vertrag kann nicht elektronisch abgeschlossen werden';
   END IF;
   IF EXISTS(SELECT 1 FROM public.tenant_document_templates x WHERE x.tenant_id=p_tenant AND x.template_key=key AND x.is_active) THEN
    RAISE EXCEPTION 'Eigene Vorlagen müssen vor Verwendung der Ausgabe 2027 getrennt geprüft werden';
   END IF;
   SELECT * INTO t FROM public.intake_document_templates_2027 WHERE template_key=key FOR SHARE;
  ELSE
   ${originalSelection}
  END IF;`;
const content = `-- Prepared Web edition 2027; reviewed 2026-10-21. No future draft law is assumed.
-- Existing/native templates and every stored signed original remain unchanged.
BEGIN;
CREATE TABLE public.intake_document_templates_2027 (LIKE public.intake_document_system_templates INCLUDING ALL);
ALTER TABLE public.intake_document_templates_2027 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.intake_document_templates_2027 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.intake_document_templates_2027 TO authenticated;
GRANT ALL ON public.intake_document_templates_2027 TO service_role;
CREATE POLICY intake_templates_2027_read ON public.intake_document_templates_2027 FOR SELECT TO authenticated USING (true);
COMMENT ON TABLE public.intake_document_templates_2027 IS 'Prepared edition 2027, source review 2026-10-21. Separate from existing signed/native template versions.';
INSERT INTO public.intake_document_templates_2027(template_key,title,document_type,service_type,version,is_system_template,is_required,is_active,requires_client_signature,requires_employee_signature,requires_representative_signature,allows_custom_template,html_content,plain_text_content,placeholder_schema,signature_slots) VALUES
${rows.join(',\n')};
DO $edition$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.client_intake_commit_completion(uuid,uuid,uuid,uuid,bigint,text,jsonb)'::regprocedure) INTO definition;
 IF position(${sql(originalSelection)} IN definition)=0 OR position('intake_document_templates_2027' IN definition)>0 THEN
  RAISE EXCEPTION 'The completion verifier changed; review it before applying this migration';
 END IF;
 definition:=replace(definition,${sql(originalSelection)},${sql(editionSelection)});
 EXECUTE definition;
END $edition$;
-- New catalogue versions only. Stored definitions and issued files stay intact.
INSERT INTO public.central_document_catalog(template_key,version,title,category_key,target,source_mode,review_status,definition_json) VALUES
${catalogSql};
COMMIT;
`;
await writeFile(resolve(process.argv[outputIndex + 1]), content);
console.log(`Prepared ${templates.length} templates and the guarded completion update.`);
