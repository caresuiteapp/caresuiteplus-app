# K.1 Production Verify — Abschlussbericht

**Datum:** 2026-07-06  
**Umgebung:** Production `https://caresuiteplus.app`  
**Deploy ausgelöst:** **nein**

---

## Migration angewendet: ja

| Feld | Wert |
|------|------|
| Migration | `0230_client_portal_settings_rls` |
| Supabase-Version | `20260706034328` |
| Methode | Supabase MCP `apply_migration` |
| Ergebnis | `success: true` |

### Supabase-Verifikation (SQL)

Vier neue Policies aktiv:

- `tenant_client_portal_defaults_portal_self_select`
- `client_portal_settings_portal_self_select`
- `client_service_portal_settings_portal_self_select`
- `tenant_service_type_portal_rules_portal_self_select`

API-Test mit Portal-JWT nach Login: `tenant_client_portal_defaults` **lesbar** (vorher blockiert durch `office.clients.view`).

---

## Portalaccount getestet

| Feld | Wert |
|------|------|
| Username | `audit-client@caresuiteplus.test` (aus `.env`, nicht geloggt) |
| Klient:in | Erika Mustermann |
| Mandant | Test Pflege GmbH |
| ClientId | `ec4f159f-e794-4326-8b0e-15c0166df1ea` |

**Hinweis:** AVENTA-Klient:innen (z. B. `hreinhardt`, `nina.emshoff`) haben in der DB Module + Einsätze, wurden im Browser **nicht** getestet — kein Portal-Code in `.env`. Nur DB-Stichprobe (siehe Blocker).

---

## Smoke-Nachweise

Skript: `.audit-client-portal-k1-smoke.mjs`  
Report: `docs/audit/client-portal-k1-production-verify.json`  
Screenshots: `docs/audit/client-portal-k1-smoke-screenshots/`

| Screenshot | Inhalt |
|------------|--------|
| `01-overview-iphone` | Profilname korrekt; „Portal noch nicht eingerichtet“ (0 Module) |
| `02-profile-iphone` | Profil vollständig, **kein** „Portal-Defaults nicht gefunden“ |
| `03-appointments-iphone` | 0 Einsätze (leerer Zustand) |
| `04-documents-iphone` | Dokumente-Route geladen |
| `05-messages-iphone` | Chat hell, 1 Thread sichtbar |
| `06-nachweise-section-iphone` | Nachweise nicht freigegeben (Tenant-Default) |
| `07-drawer-iphone` | Drawer geöffnet (alte Nav-Struktur) |

---

## Ergebnis je Bereich

| Bereich | Ergebnis | Details |
|---------|----------|---------|
| **Migration / RLS** | ✅ PASS | Defaults per Portal-JWT lesbar |
| **Profil** | ✅ PASS | Kein Defaults-Fehler; Felder sichtbar |
| **Begrüßung Name** | ✅ PASS | „Hallo, Erika Mustermann“ (nicht Mandantenname) |
| **AVENTA · Assist** | ⚠️ n/a | Audit-Mandant „Test Pflege GmbH“; AVENTA nicht im Browser getestet |
| **Einsätze** | ⚠️ BLOCKER | UI: 0 Einsätze — DB: **63** `assist_visits` für diesen Client. Production-Frontend ohne K.1-`clientId`-Fix |
| **Vergangene/Zukünftige** | ⚠️ offen | Keine Listendaten in UI; DB hat Mischung past/upcoming |
| **Begleitungen-KPI** | ✅ PASS | Karte nicht sichtbar (kein falscher Count) |
| **Nachweise** | ⚠️ erwartet | `show_proofs=false` im Mandanten-Default |
| **Dokumente** | ✅ PASS | Route lädt |
| **Nachrichten** | ✅ PASS | Heller Messenger, kein schwarzer Block |
| **Bottom-Nav** | ⚠️ alt | Production zeigt noch „Termine“ (K.1-Frontend **nicht** deployed) |
| **Drawer** | ⚠️ alt | Keine K.1-Drawer-Einträge (Nachweise/Anfragen…) — Frontend nicht deployed |
| **iPhone Safe-Area** | ⚠️ unklar | Playwright-Metrik `paddingBottom=0`; visuell wirkt Bottom-Bar auf Screenshots ok |

---

## Verbleibende Blocker

1. **K.1-Frontend nicht auf Production deployed** — Einsätze-`clientId`-Fix, Begrüßungs-Hero, Nav „Einsätze“, Drawer, Messenger-Wrapper erst nach Deploy wirksam.
2. **Audit-Client: 0 Modul-Zuweisungen** — Übersicht zeigt „Portal noch nicht eingerichtet“ trotz 63 Einsätzen in DB. Office muss `client_module_assignments` setzen.
3. **Mandanten-Defaults** — `show_appointments=false`, `show_proofs=false`, `show_documents=false` für Test Pflege GmbH und AVENTA. Office muss Portal-Sichtbarkeit freischalten.
4. **AVENTA-Smoke im Browser** — Credentials fehlen in `.env`; DB bestätigt 4+ kommende Einsätze für `hreinhardt` bei AVENTA.
5. **Einsätze-Diskrepanz** — 63 Visits in DB vs. 0 in Portal-UI = bestätigt Production-Bug bis Frontend-Deploy.

---

## Deploy ausgelöst

**Nein.** Nur DB-Migration; kein Netlify-Build, kein `[deploy]`-Commit.

---

## Nächste Schritte (empfohlen)

1. K.1-Frontend deployen (mit Freigabe + `[deploy]`)
2. Office: Modul „Assist“ für Audit-Client + AVENTA-Defaults (`show_appointments`, `show_proofs`) prüfen
3. AVENTA-Portal-Code in `.env` hinterlegen → erneuter Smoke mit `hreinhardt` oder Produktiv-Account
4. Nach Deploy: Einsätze-Count UI vs. DB erneut vergleichen
