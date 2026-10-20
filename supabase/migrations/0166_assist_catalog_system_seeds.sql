-- ==========================================================================
-- CareSuite+ — Migration 0166: Assist System Catalog Seeds
-- C.ASSIST-OFFICE-TEMPLATE.1 — idempotente System-Gruppen, Kataloge, Bindings
-- Vollständige Items werden zusätzlich via assistCatalogBootstrapService (TS) synchronisiert.
-- ==========================================================================

-- Gruppen
INSERT INTO public.catalog_groups (id, tenant_id, module_scope, group_key, name, description, icon, color, sort_order, is_system_default, is_active)
SELECT v.id::uuid, NULL, 'assist', v.group_key, v.name, v.description, v.icon, v.color, v.sort_order, TRUE, TRUE
FROM (VALUES
  ('a1000001-0000-4000-8000-000000000001', 'assist_einsatz', 'Assist Einsatz', 'Einsatzplanung und -durchführung', '📋', '#2563eb', 1),
  ('a1000001-0000-4000-8000-000000000002', 'neuaufnahme', 'Neuaufnahme', 'Aufnahme und Erstbesuch', '📝', '#7c3aed', 2),
  ('a1000001-0000-4000-8000-000000000003', 'dokumentation', 'Dokumentation', 'Textbausteine und Nachweise', '📄', '#059669', 3),
  ('a1000001-0000-4000-8000-000000000004', 'dokumente', 'Dokumente', 'Dokumentvorlagen', '📑', '#0891b2', 4),
  ('a1000001-0000-4000-8000-000000000005', 'aufgaben', 'Aufgaben', 'Pakete und Einzelaufgaben', '✅', '#d97706', 5),
  ('a1000001-0000-4000-8000-000000000006', 'abrechnung', 'Abrechnung', 'Budgets und Abrechnungsstatus', '💶', '#64748b', 6)
) AS v(id, group_key, name, description, icon, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_groups g WHERE g.tenant_id IS NULL AND g.group_key = v.group_key
);

-- Katalog-Definitionen (Kern)
INSERT INTO public.catalog_definitions (
  id, tenant_id, group_id, module_scope, catalog_key, name, catalog_type, selection_mode,
  visibility_scope, is_system_default, is_editable, is_active, sort_order
)
SELECT
  v.id::uuid,
  NULL,
  g.id,
  'assist',
  v.catalog_key,
  v.name,
  v.catalog_type,
  v.selection_mode,
  'assist',
  TRUE,
  FALSE,
  TRUE,
  v.sort_order
FROM (VALUES
  ('b1000001-0000-4000-8000-000000000001', 'assist_einsatz', 'assist.assignment.subjects', 'Einsatz-Betreff', 'single_select', 'searchable_dropdown', 1),
  ('b1000001-0000-4000-8000-000000000002', 'assist_einsatz', 'assist.assignment.types', 'Einsatzarten', 'chip_select', 'grouped_chips', 2),
  ('b1000001-0000-4000-8000-000000000003', 'assist_einsatz', 'assist.service.categories', 'Leistungskategorien', 'chip_select', 'chips', 3),
  ('b1000001-0000-4000-8000-000000000004', 'aufgaben', 'assist.task.packages', 'Aufgabenpakete', 'task_package', 'template_picker', 4),
  ('b1000001-0000-4000-8000-000000000005', 'aufgaben', 'assist.task.items', 'Einzelaufgaben', 'task_item', 'checkbox_list', 5),
  ('b1000001-0000-4000-8000-000000000006', 'dokumentation', 'assist.documentation.quick_blocks', 'Dokumentationsbausteine', 'text_block', 'quick_insert', 6),
  ('b1000001-0000-4000-8000-000000000007', 'assist_einsatz', 'assist.task.not_completed_reasons', 'Gründe: Aufgabe nicht erledigt', 'status_reason', 'dropdown', 7),
  ('b1000001-0000-4000-8000-000000000008', 'assist_einsatz', 'assist.assignment.abort_reasons', 'Einsatzabbruchgründe', 'status_reason', 'dropdown', 8),
  ('b1000001-0000-4000-8000-000000000009', 'assist_einsatz', 'assist.assignment.cancellation_reasons', 'Ausfallgründe', 'status_reason', 'dropdown', 9),
  ('b1000001-0000-4000-8000-000000000010', 'neuaufnahme', 'assist.intake.templates', 'Neuaufnahme-Vorlagen', 'form_template', 'template_picker', 10),
  ('b1000001-0000-4000-8000-000000000011', 'neuaufnahme', 'assist.intake.service_wish', 'Leistungswunsch', 'multi_select', 'chips', 11),
  ('b1000001-0000-4000-8000-000000000012', 'neuaufnahme', 'assist.intake.household', 'Haushaltssituation', 'multi_select', 'chips', 12),
  ('b1000001-0000-4000-8000-000000000013', 'neuaufnahme', 'assist.intake.mobility', 'Mobilität', 'multi_select', 'chips', 13),
  ('b1000001-0000-4000-8000-000000000014', 'neuaufnahme', 'assist.intake.orientation', 'Orientierung / Kommunikation', 'multi_select', 'chips', 14),
  ('b1000001-0000-4000-8000-000000000015', 'neuaufnahme', 'assist.intake.access', 'Zugang', 'multi_select', 'chips', 15),
  ('b1000001-0000-4000-8000-000000000016', 'neuaufnahme', 'assist.intake.risks', 'Risiken / Hinweise', 'multi_select', 'chips', 16),
  ('b1000001-0000-4000-8000-000000000017', 'neuaufnahme', 'assist.intake.documents', 'Dokumente / Einwilligungen', 'multi_select', 'chips', 17),
  ('b1000001-0000-4000-8000-000000000018', 'dokumente', 'assist.document.types', 'Dokumentarten', 'single_select', 'dropdown', 18),
  ('b1000001-0000-4000-8000-000000000019', 'dokumentation', 'assist.service_proof.templates', 'Leistungsnachweis-Vorlagen', 'document_template', 'template_picker', 19),
  ('b1000001-0000-4000-8000-000000000020', 'dokumentation', 'assist.communication.templates', 'Kommunikationsvorlagen', 'template', 'quick_insert', 20),
  ('b1000001-0000-4000-8000-000000000021', 'abrechnung', 'assist.billing.budget_sources', 'Abrechnungstöpfe', 'billing_category', 'dropdown', 21),
  ('b1000001-0000-4000-8000-000000000022', 'abrechnung', 'assist.billing.statuses', 'Abrechnungsstatus', 'single_select', 'dropdown', 22),
  ('b1000001-0000-4000-8000-000000000023', 'abrechnung', 'assist.billing.notes', 'Abrechnungshinweise', 'text_block', 'quick_insert', 23),
  ('b1000001-0000-4000-8000-000000000024', 'assist_einsatz', 'assist.risk_flags', 'Risiken & Hinweise', 'chip_select', 'chips', 24)
) AS v(id, group_key, catalog_key, name, catalog_type, selection_mode, sort_order)
JOIN public.catalog_groups g ON g.tenant_id IS NULL AND g.group_key = v.group_key
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_definitions d
  WHERE d.tenant_id IS NULL AND d.catalog_key = v.catalog_key
);

-- Standard-Bindings
INSERT INTO public.template_bindings (
  id, tenant_id, catalog_id, target_module, target_area, target_component, target_field,
  binding_type, is_required, sort_order
)
SELECT
  v.id::uuid,
  NULL,
  d.id,
  'assist',
  v.target_area,
  v.target_component,
  v.target_field,
  'catalog',
  v.is_required,
  v.sort_order
FROM (VALUES
  ('c1000001-0000-4000-8000-000000000001', 'assist.assignment.subjects', 'assist_new_assignment', 'AssignmentCreateForm', 'assignment_subject', FALSE, 1),
  ('c1000001-0000-4000-8000-000000000002', 'assist.assignment.types', 'assist_new_assignment', 'AssignmentCreateForm', 'assignment_type', FALSE, 2),
  ('c1000001-0000-4000-8000-000000000003', 'assist.task.packages', 'assist_new_assignment', 'AssignmentCreateForm', 'task_package', FALSE, 3),
  ('c1000001-0000-4000-8000-000000000004', 'assist.task.items', 'assist_assignment_execution', 'VisitTasksPanel', 'task_items', FALSE, 4),
  ('c1000001-0000-4000-8000-000000000005', 'assist.documentation.quick_blocks', 'assist_assignment_documentation', 'VisitExecutionScreen', 'documentation_quick_text', FALSE, 5),
  ('c1000001-0000-4000-8000-000000000006', 'assist.task.not_completed_reasons', 'assist_assignment_execution', 'VisitTasksPanel', 'not_completed_reason', FALSE, 6)
) AS v(id, catalog_key, target_area, target_component, target_field, is_required, sort_order)
JOIN public.catalog_definitions d ON d.tenant_id IS NULL AND d.catalog_key = v.catalog_key
WHERE NOT EXISTS (
  SELECT 1 FROM public.template_bindings b
  WHERE b.tenant_id IS NULL AND b.catalog_id = d.id AND b.target_field = v.target_field
);

COMMENT ON TABLE public.catalog_definitions IS
  'System-Seeds in 0166; vollständige catalog_items via assistCatalogBootstrapService';
