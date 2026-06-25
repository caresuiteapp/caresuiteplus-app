import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSIST_CATALOG_DEFINITIONS, buildAssistCatalogSnapshot } from '../src/data/seeds/assistCatalogSeeds';
import { getAllCatalogEntries } from '../src/data/demo/templates/seeds';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const MIGRATION_DEF_IDS: Record<string, string> = {
  'assist.assignment.subjects': 'b1000001-0000-4000-8000-000000000001',
  'assist.assignment.types': 'b1000001-0000-4000-8000-000000000002',
  'assist.service.categories': 'b1000001-0000-4000-8000-000000000003',
  'assist.task.packages': 'b1000001-0000-4000-8000-000000000004',
  'assist.task.items': 'b1000001-0000-4000-8000-000000000005',
  'assist.documentation.quick_blocks': 'b1000001-0000-4000-8000-000000000006',
  'assist.task.not_completed_reasons': 'b1000001-0000-4000-8000-000000000007',
  'assist.assignment.abort_reasons': 'b1000001-0000-4000-8000-000000000008',
  'assist.assignment.cancellation_reasons': 'b1000001-0000-4000-8000-000000000009',
  'assist.intake.templates': 'b1000001-0000-4000-8000-000000000010',
  'assist.intake.service_wish': 'b1000001-0000-4000-8000-000000000011',
  'assist.intake.household': 'b1000001-0000-4000-8000-000000000012',
  'assist.intake.mobility': 'b1000001-0000-4000-8000-000000000013',
  'assist.intake.orientation': 'b1000001-0000-4000-8000-000000000014',
  'assist.intake.access': 'b1000001-0000-4000-8000-000000000015',
  'assist.intake.risks': 'b1000001-0000-4000-8000-000000000016',
  'assist.intake.documents': 'b1000001-0000-4000-8000-000000000017',
  'assist.document.types': 'b1000001-0000-4000-8000-000000000018',
  'assist.service_proof.templates': 'b1000001-0000-4000-8000-000000000019',
  'assist.communication.templates': 'b1000001-0000-4000-8000-000000000020',
  'assist.billing.budget_sources': 'b1000001-0000-4000-8000-000000000021',
  'assist.billing.statuses': 'b1000001-0000-4000-8000-000000000022',
  'assist.billing.notes': 'b1000001-0000-4000-8000-000000000023',
  'assist.risk_flags': 'b1000001-0000-4000-8000-000000000024',
};

function catalogEntryUuid(catalogType: string, valueKey: string): string {
  const hash = createHash('sha256')
    .update(`caresuite-catalog-entry:v1:${catalogType}:${valueKey}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function esc(v: string | null | undefined): string {
  if (v == null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

function escJson(v: unknown): string {
  return esc(JSON.stringify(v ?? {}));
}

const defKeyBySeedId = new Map(ASSIST_CATALOG_DEFINITIONS.map((d) => [d.id, d.catalogKey]));
const snap = buildAssistCatalogSnapshot();

const itemValues = snap.items
  .map((item) => {
    const catalogKey = defKeyBySeedId.get(item.catalogId);
    const catalogId = catalogKey ? MIGRATION_DEF_IDS[catalogKey] : null;
    if (!catalogId) return null;
    return `(${[
      esc(item.id),
      'NULL',
      esc(catalogId),
      item.parentItemId ? esc(item.parentItemId) : 'NULL',
      esc(item.itemKey),
      esc(item.label),
      item.shortLabel ? esc(item.shortLabel) : 'NULL',
      item.description ? esc(item.description) : 'NULL',
      item.helperText ? esc(item.helperText) : 'NULL',
      escJson(item.tags),
      item.icon ? esc(item.icon) : 'NULL',
      item.color ? esc(item.color) : 'NULL',
      item.sortOrder,
      item.isSystemDefault,
      item.isActive,
      item.isBillableRelevant,
      item.isDocumentationRequired,
      item.isSignatureRelevant,
      item.isRiskRelevant,
      item.defaultDurationMinutes ?? 'NULL',
      item.defaultPriceHint ?? 'NULL',
      item.defaultUnit ? esc(item.defaultUnit) : 'NULL',
      escJson(item.payloadJson),
    ].join(', ')})`;
  })
  .filter(Boolean);

const entryValues = getAllCatalogEntries().map(
  (e) =>
    `(${[
      esc(catalogEntryUuid(e.catalogType, e.valueKey)),
      'NULL',
      esc(e.catalogType),
      esc(e.valueKey),
      esc(e.label),
      e.description ? esc(e.description) : 'NULL',
      esc(e.moduleKey),
      e.isSystem,
      e.isActive,
      e.sortOrder,
    ].join(', ')})`,
);

const sql = `-- ==========================================================================
-- CareSuite+ — Migration 0167: Assist catalog_items + template catalog_entries
-- Generated from assistCatalogSeeds.ts + demo template catalogs (idempotent)
-- ==========================================================================

INSERT INTO public.catalog_items (
  id, tenant_id, catalog_id, parent_item_id, item_key, label, short_label, description, helper_text,
  tags, icon, color, sort_order, is_system_default, is_active, is_billable_relevant,
  is_documentation_required, is_signature_relevant, is_risk_relevant,
  default_duration_minutes, default_price_hint, default_unit, payload_json
) VALUES
${itemValues.join(',\n')}
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.catalog_entries (
  id, tenant_id, catalog_type, value_key, label, description, module_key, is_system, is_active, sort_order
) VALUES
${entryValues.join(',\n')}
ON CONFLICT (id) DO NOTHING;
`;

const outPath = join(root, 'supabase/migrations/0167_assist_catalog_items_and_template_entries.sql');
writeFileSync(outPath, sql, 'utf8');
console.log(JSON.stringify({ items: itemValues.length, entries: entryValues.length, bytes: sql.length, outPath }));
