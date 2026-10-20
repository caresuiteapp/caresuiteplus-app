# K.1 Production Verify

**Datum:** 2026-07-06T03:55:37.960Z
**Base URL:** https://caresuiteplus.app

## Migration
- Angewendet: **ja**
- Version: `20260706034328` / `client_portal_settings_rls`
- Deploy ausgelöst: **nein**

## Portalaccount
- Username: `audit-client@caresuiteplus.test`
- DisplayName (API): Erika Mustermann
- TenantName (API): Test Pflege GmbH
- ClientId: `ec4f159f-e794-4326-8b0e-15c0166df1ea`

## Ergebnisse
- **api_client_portal_login**: PASS — ok
- **api_portal_defaults_readable**: PASS — tenant_defaults_select_ok
- **profile_no_defaults_error**: PASS — no_error_on_overview
- **greeting_client_name**: PASS — display=Erika Mustermann
- **greeting_tenant_module**: PASS — Test Pflege GmbH · Assist visible
- **begleitungen_kpi**: PASS — card_absent
- **profile_loads**: PASS — profile_content_visible
- **profile_fields_present**: PASS — field_scan
- **appointments_list**: PASS — appointments_visible
- **appointments_not_false_empty**: FAIL — consistency
- **documents_open**: PASS — documents_route_loaded
- **messages_open**: PASS — messages_route_loaded
- **messages_not_black_box**: PASS — light_messenger
- **nachweise_open**: FAIL — nachweise_section_route
- **bottom_navigation**: FAIL — 
- **drawer_navigation**: FAIL — drawer_items_visible
- **iphone_safe_area_padding**: FAIL — paddingBottom=0px

## Screenshots
- `C:/Users/Kevin Reinhardt/Documents/CareSuite+/docs/audit/client-portal-k1-smoke-screenshots/01-overview-iphone.png`
- `C:/Users/Kevin Reinhardt/Documents/CareSuite+/docs/audit/client-portal-k1-smoke-screenshots/02-profile-iphone.png`
- `C:/Users/Kevin Reinhardt/Documents/CareSuite+/docs/audit/client-portal-k1-smoke-screenshots/03-appointments-iphone.png`
- `C:/Users/Kevin Reinhardt/Documents/CareSuite+/docs/audit/client-portal-k1-smoke-screenshots/04-documents-iphone.png`
- `C:/Users/Kevin Reinhardt/Documents/CareSuite+/docs/audit/client-portal-k1-smoke-screenshots/05-messages-iphone.png`
- `C:/Users/Kevin Reinhardt/Documents/CareSuite+/docs/audit/client-portal-k1-smoke-screenshots/06-nachweise-section-iphone.png`
- `C:/Users/Kevin Reinhardt/Documents/CareSuite+/docs/audit/client-portal-k1-smoke-screenshots/07-drawer-iphone.png`

## Verbleibende Blocker
- appointments_not_false_empty
- nachweise_open
- bottom_navigation
- drawer_navigation
- iphone_safe_area_padding