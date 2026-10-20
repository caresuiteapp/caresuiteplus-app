# Assist Live E2E — A.4.2 Auth Testuser Bootstrap

**Datum:** 2026-06-23  
**Branch:** `main` @ `92805ae`  
**Scope:** Supabase Auth Testuser Bootstrap, Test Pflege GmbH, Portal-Credentials — **ohne** A.4.3 Browser-E2E, K.6, Rechnungen, Deploy, Migrationen  
**Vorgänger:** `docs/audit/assist-live-e2e-a41-browser-retry-abnahmebericht.md`  
**Runner:** `.audit-assist-live-e2e-a42-auth-bootstrap.mjs`  
**Ergebnis:** ⛔ **BLOCKIERT** — Business-Login weiterhin `invalid_credentials`; kein `SUPABASE_SERVICE_ROLE_KEY` für Reparatur

---

## 1. Executive Summary

| Kriterium | Ergebnis |
|-----------|----------|
| A.4.2 erfolgreich | **Nein** (blockiert) |
| Business Login funktioniert | **Nein** (`invalid_credentials`) |
| Test Pflege GmbH eindeutig | **Ja** (1 Mandant in Remote-DB) |
| Business User zugeordnet | **Nein** (Login blockiert; Zuordnung nicht verifiziert) |
| Assist-Zugriff vorhanden | **Ja** (Mandant hat `assist` Produkt `trial`) |
| Mitarbeiterportal-Testzugang vorhanden | **Ja** (DB: 1 Account); Env für Runner: **Nein** |
| Klient:innenportal-Testzugang vorhanden | **Ja** (DB: 1 Access); Env für Runner: **Nein** |
| Demo-Assist-Daten vorbereitet | **Ja** (DB: mindestens 1 `assist_visits` auf Testmandant) |
| A.4.3 freigegeben | **Nein** |
| K.6 weiterhin gesperrt | **Ja** |

---

## 2. Secret-Sicherheit

| Prüfung | Ergebnis |
|---------|----------|
| Secrets in Report | **Nein** (nur ja/nein) |
| Secrets in Logs committed | **Nein** |
| `.env` staged | **Nein** |
| Bootstrap stdout | Nur strukturierte Status-Flags |

---

## 3. Supabase-Projektprüfung

| Prüfung | Ergebnis |
|---------|----------|
| Projekt-Ref aus `.env` erkannt | **Ja** |
| `netlify.toml` gleiche Ref | **Ja** |
| Projektverwechslung wahrscheinlich | **Nein** |
| localhost vs. production URL | Gleiches Projekt (`euagyyztvmemuaiumvxm`) |

---

## 4. Env-Gate (keine Werte)

| Variable | Vorhanden | Leer | Placeholder |
|----------|-----------|------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Ja | Nein | Nein |
| Anon/Publishable Key | Ja | Nein | — |
| `AUDIT_BUSINESS_EMAIL` | Ja | Nein | Nein |
| `AUDIT_BUSINESS_PASSWORD` | Ja | Nein | Nein |
| `SUPABASE_SERVICE_ROLE_KEY` | **Nein** | — | — |
| `AUDIT_EMPLOYEE_USERNAME` / `PASSWORD` | Nein | — | — |
| `AUDIT_CLIENT_USERNAME` / `PORTAL_CODE` | Nein | — | — |

---

## 5. Auth-User-Prüfung

| Prüfung | Ergebnis |
|---------|----------|
| Password-Grant Login | **Nein** — `invalid_credentials` (HTTP 400) |
| User existiert (Admin) | **Nicht geprüft** (kein Service Role) |
| User bestätigt | **Nicht geprüft** |
| Admin-Reparatur versucht | **Nein** (kein Service Role) |
| Fehlerklasse | `invalid_credentials` |

**Blocker:** Normales Login fehlgeschlagen; Auth-User kann ohne Service Role oder Supabase Dashboard nicht geprüft oder repariert werden.

### Manuelle Schritte (Supabase Dashboard)

1. Supabase Dashboard → Projekt `euagyyztvmemuaiumvxm` öffnen  
2. **Authentication → Users**  
3. Audit-Business-E-Mail aus lokaler `.env` suchen (Wert nicht im Report)  
4. Falls User fehlt: **Add user** → E-Mail + Passwort aus `.env` → **Auto Confirm User** aktivieren  
5. Falls User existiert: Passwort neu setzen, E-Mail als bestätigt markieren  
6. Optional: `SUPABASE_SERVICE_ROLE_KEY` in lokale `.env` ergänzen (nicht committen)  
7. `node .audit-assist-live-e2e-a42-auth-bootstrap.mjs` erneut ausführen  

---

## 6. Tenant-/Profil-/Rollenprüfung (Remote-DB, Test Pflege GmbH)

| Prüfung | Ergebnis |
|---------|----------|
| „Test Pflege GmbH“ eindeutig | **Ja** (1 Treffer) |
| Mandant aktiv/trial | **Ja** (`status: trial`) |
| Assist-Modul | **Ja** (`tenant_products.assist`, `status: trial`) |
| Profile auf Mandant | **Ja** (≥1) |
| Business-Audit-User verknüpft | **Nein** (nicht verifiziert — Login fehlgeschlagen) |
| `tenant_users` Membership Audit-User | **Nein** (nicht verifiziert) |

---

## 7. Portal-Testzugänge

### Mitarbeiterportal

| Aspekt | Ergebnis |
|--------|----------|
| Login-Route | `/auth/employee-login` |
| Login-Methode | **Benutzername + Passwort** (Edge `employee-portal-login`) |
| DB-Account auf Testmandant | **Ja** (1 `employee_portal_accounts`) |
| Env für Runner | **Nein** — erwartet `AUDIT_EMPLOYEE_USERNAME`, `AUDIT_EMPLOYEE_PASSWORD` (Fallback: `TEST_EMPLOYEE_*`) |
| Edge-Login in A.4.2 | **Nein** (keine Env-Credentials; Business-Blocker) |

### Klient:innenportal

| Aspekt | Ergebnis |
|--------|----------|
| Login-Route | `/auth/portal-code-login` |
| Login-Methode | **Benutzername + 6-stelliger Code** (Edge `client-portal-login`) |
| DB-Access auf Testmandant | **Ja** (1 `client_portal_access`, portal enabled) |
| Env für Runner | **Nein** — erwartet `AUDIT_CLIENT_USERNAME`, `AUDIT_CLIENT_PORTAL_CODE` (Fallback: `TEST_CLIENT_*`) |
| Edge-Login in A.4.2 | **Nein** |

**Hinweis:** Portal-Zugänge wurden in P.5.1 scoped angelegt; Credentials liegen nur lokal (nicht im Repo). Für A.4.3 müssen die Werte in `.env` gesetzt werden — ohne Werte im Report.

---

## 8. Demo-Assist-Daten

| Artefakt | Ergebnis |
|----------|----------|
| Demo-Klient:in (Erika Mustermann) | **Ja** (bestehend) |
| Demo-Mitarbeiter:in (Test Admin) | **Ja** (bestehend) |
| Assist-Einsatz | **Ja** (≥1 Visit auf Testmandant) |
| Billing/Rechnung | **Nein** (nicht erzeugt) |
| Idempotenter Bootstrap bei grünem Login | Runner vorbereitet (`a0420001-…` Visit-ID) |

---

## 9. Login-Validierung (Ende A.4.2)

| Zugang | Login | Assist-/Portal erreichbar |
|--------|-------|---------------------------|
| Business/Office | **Nein** | `/assist` **Nein** |
| Mitarbeiterportal | **Nein** | Einsätze **Nein** (Env fehlt) |
| Klient:innenportal | **Nein** | Portal **Nein** (Env fehlt) |

**A.4.3 Freigabe:** **Nein** — Business-Login weiterhin blockiert; Portal-Env unvollständig.

---

## 10. Tests / Typecheck

| Suite | Ergebnis | Log |
|-------|----------|-----|
| `assistLiveWorkflow.test.ts` | ✅ 8/8 | `.audit-test-assist-live-e2e-a42-auth-bootstrap.log` |
| `assistProofToPortalFlow.test.ts` | ✅ 10/10 | (同上) |
| `npm run typecheck` | ⚠️ Repo-Baseline rot (exit ≠ 0) | `.audit-typecheck-assist-live-e2e-a42-auth-bootstrap.log` |

Keine neuen Assist-Workflow-Regressionen. Typecheck-Fehler sind Repo-Baseline.

---

## 11. Nicht ausgeführt

| Kriterium | Status |
|-----------|--------|
| K.6 | ✅ nicht gestartet |
| Finale Rechnungen | ✅ nicht erzeugt |
| Rechnungsnummern | ✅ nicht verbraucht |
| Deploy | ✅ nicht ausgeführt |
| Migrationen / `db push` | ✅ nicht ausgeführt |
| Produktive Mandanten geändert | ✅ nicht (nur Read via MCP) |
| A.4.3 Browser-E2E | ✅ nicht gestartet |

---

## 12. Nächster Schritt

1. Business-Auth reparieren (Dashboard oder `SUPABASE_SERVICE_ROLE_KEY` + Bootstrap-Retry)  
2. `.env` ergänzen: `AUDIT_EMPLOYEE_USERNAME`, `AUDIT_EMPLOYEE_PASSWORD`, `AUDIT_CLIENT_USERNAME`, `AUDIT_CLIENT_PORTAL_CODE` (Werte aus P.5.1 lokaler Notiz oder Office-Portal-Setup)  
3. `node .audit-assist-live-e2e-a42-auth-bootstrap.mjs` → Exit 0  
4. Dann A.4.3 Browser-Abnahme starten  

---

## 13. §18 Abschlussantwort (22 Punkte)

| # | Frage | Antwort |
|---|-------|---------|
| 1 | A.4.2 erfolgreich oder blockiert? | **Blockiert** |
| 2 | Supabase-Projekt konsistent? | **Ja** |
| 3 | Business-Testuser existiert? | **Unbekannt** (kein Service Role) |
| 4 | Business-Testuser Login erfolgreich? | **Nein** |
| 5 | Test Pflege GmbH eindeutig? | **Ja** |
| 6 | Business-Testuser mit Test Pflege verbunden? | **Nein** (nicht verifiziert) |
| 7 | Assist-Zugriff vorhanden? | **Ja** (Mandant-Produkt) |
| 8 | Mitarbeiterportal-Testzugang vorhanden? | **Ja** (DB); Env **Nein** |
| 9 | Klient:innenportal-Testzugang vorhanden? | **Ja** (DB); Env **Nein** |
| 10 | Demo-Assist-Einsatz vorbereitet? | **Ja** (DB) |
| 11 | Secrets geloggt? | **Nein** |
| 12 | `.env` staged? | **Nein** |
| 13 | Produktive Daten verändert? | **Nein** |
| 14 | Finale Rechnungen erzeugt? | **Nein** |
| 15 | Rechnungsnummern verbraucht? | **Nein** |
| 16 | Tests Ergebnis? | **18/18 passed** (Assist-Scope) |
| 17 | Typecheck Ergebnis? | **Repo-Baseline rot** |
| 18 | Commit Hash? | `dc18743` |
| 19 | Push erfolgreich? | **Ja** (`dc18743` → `origin/main`) |
| 20 | A.4.3 freigegeben? | **Nein** |
| 21 | K.6 weiterhin gesperrt? | **Ja** |
| 22 | Berichtspfad? | `docs/audit/assist-live-e2e-a42-auth-testuser-bootstrap-abnahmebericht.md` |

---

## 14. Artefakte

| Artefakt | Pfad |
|----------|------|
| A.4.2 Bericht | `docs/audit/assist-live-e2e-a42-auth-testuser-bootstrap-abnahmebericht.md` |
| Bootstrap Runner | `.audit-assist-live-e2e-a42-auth-bootstrap.mjs` |
| Bootstrap JSON (untracked) | `.audit-assist-live-e2e-a42-auth-bootstrap-results.json` |

---

*Erstellt im Rahmen ASSIST LIVE E2E A.4.2 — Supabase Auth Testuser Bootstrap (ohne Browser-E2E).*
