-- ==========================================================================
-- CareSuite+ — Migration 0169: Dokumenten-Engine Permission Keys
-- settings.templates.* und documents.* gemäß Masteranforderung §13
-- ==========================================================================

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('settings.templates.view'),
    ('settings.templates.create'),
    ('settings.templates.update'),
    ('settings.templates.delete'),
    ('settings.templates.deactivate'),
    ('settings.templates.copy'),
    ('settings.templates.publish'),
    ('settings.templates.version'),
    ('settings.templates.mapping'),
    ('settings.templates.layout'),
    ('settings.templates.send_settings'),
    ('settings.templates.audit'),
    ('documents.preview'),
    ('documents.create'),
    ('documents.edit_draft'),
    ('documents.finalize'),
    ('documents.pdf_create'),
    ('documents.download'),
    ('documents.email_send'),
    ('documents.fax_send'),
    ('documents.save_to_file'),
    ('documents.archive'),
    ('documents.delete_draft')
) AS p(key)
WHERE r.key IN ('business_admin', 'business_manager')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Office-Rollen: Dokumentnutzung ohne Vorlagenverwaltung
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('documents.preview'),
    ('documents.create'),
    ('documents.edit_draft'),
    ('documents.finalize'),
    ('documents.pdf_create'),
    ('documents.download'),
    ('documents.email_send'),
    ('documents.fax_send'),
    ('documents.save_to_file'),
    ('documents.archive'),
    ('settings.templates.view')
) AS p(key)
WHERE r.key IN ('billing', 'dispatch', 'nurse', 'caregiver', 'counselor')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Assist-Fachkräfte: eingeschränkte Dokumentrechte
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('documents.preview'),
    ('documents.create'),
    ('documents.edit_draft'),
    ('documents.pdf_create'),
    ('documents.download'),
    ('documents.save_to_file'),
    ('settings.templates.view')
) AS p(key)
WHERE r.key IN ('caregiver', 'counselor')
ON CONFLICT (role_id, permission_key) DO NOTHING;
