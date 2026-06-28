# Screenshot-Erfassung für CareSuite+ Schulung

**Stand:** 2026-06-27
**Produktion:** https://caresuiteplus.app  
**Checkliste:** `docs/schulung/screenshot-checkliste.csv` (44 Specs: SS-001 … SS-055, Lücken bei SS-008/009 und SS-021–029)

## Erfassungsregeln (Pflicht)

Jeder Screenshot durchläuft **dieselbe Warte-Kette** — kein Capture direkt nach `domcontentloaded`.

### 1. Netzwerk & Laden

1. `networkidle` (Timeout 30 s), Fallback auf `load`
2. Keine Lade-Texte mehr: `Wird geladen`, `wird geladen`, route-spezifische Meldungen (z. B. „Dienstplan wird geladen…“)
3. Kein `[aria-busy="true"]` im DOM

### 2. Route-spezifischer Inhalt

Pro Dateiname prüft das Skript, dass erwartete UI-Texte sichtbar sind (siehe `ROUTE_CONTENT` in `scripts/audit/captureSchulungScreenshots.mjs`). Beispiele:

| Route / Datei | Erwarteter Inhalt |
|---------------|-------------------|
| `41-employee-dashboard.png` | Begrüßung, KPI oder „Einsätze heute“ |
| `47-employee-schedule.png` | „Dienstplan“ / „Wochenplan“ / „Keine Einsätze geplant“ |
| `42-employee-assignments.png` | Einsatzliste oder leerer Zustand |
| `48-employee-messages.png` | Messenger-UI |
| `49-employee-profile.png` | Profil ohne Ladezustand |

### 3. Settle & Overlay

- **800 ms** Ruhepause nach sichtbarem Inhalt
- `waitForFunction`: kein blockierendes Overlay (Willkommens-Modal darf nur bei SS-040 / SS-051 sichtbar sein)

### 4. Willkommens-Popup

| ID | Datei | Regel |
|----|-------|-------|
| SS-040 | `40-employee-welcome-modal.png` | Modal **offen** lassen (`portal-welcome-pending=employee`) |
| SS-051 | `51-client-welcome-modal.png` | Modal **offen** lassen (`portal-welcome-pending=client`) |
| **Alle anderen Portal-Screenshots** | — | Modal **schließen** („Weiter zur Übersicht“ oder „Schließen“), warten bis weg, Seite erneut laden lassen, **dann** Screenshot |

Portal-Sessions für Nicht-Welcome-Shots setzen zusätzlich `portal-welcome-seen:*` in `localStorage`, damit das Modal nicht erneut erscheint.

### 5. Validierung nach Capture

Jede PNG wird geprüft:

- Dateigröße ≥ 10 KB
- Nicht überwiegend weiß (Pixel-Stichprobe)
- Kein Willkommens-Overlay (außer SS-040 / SS-051)

Ergebnis: `.audit-schulung-screenshots-results.json` → `validationPassed` / `validationFailed`

## Automatische Erfassung (Playwright)

```bash
# Aus Repo-Root (.env mit AUDIT_* Credentials)
node scripts/audit/contentPortalE2eSeed.mjs   # optional: Demo-Daten
node scripts/audit/captureSchulungScreenshots.mjs

# Nur ein Bereich:
node scripts/audit/captureSchulungScreenshots.mjs --only=employee
node scripts/audit/captureSchulungScreenshots.mjs --only=client
node scripts/audit/captureSchulungScreenshots.mjs --only=business
node scripts/audit/captureSchulungScreenshots.mjs --only-failed
node scripts/audit/captureSchulungScreenshots.mjs --only=43-employee-assignment-detail,44-employee-execution-consent
node scripts/audit/captureSchulungScreenshots.mjs --only=public
```

**Alle 44 PNGs werden überschrieben** — kein Wiederverwenden alter Dateien.

Ergebnis-Report: `.audit-schulung-screenshots-results.json`

## Viewports

| Typ | Auflösung | Verwendung |
|-----|-----------|------------|
| Desktop | 1440×900 | Office, Assist, Landing, Business-Login |
| Mobile | 390×844 (iPhone 12 Pro) | Mitarbeiter- und Klientenportal |

## Test-Zugänge (Audit)

| Rolle | Benutzername | Geheimnis |
|-------|--------------|-----------|
| Business | `audit-business@caresuiteplus.test` | `.env` → `AUDIT_BUSINESS_PASSWORD` |
| Mitarbeiter | `audit-employee@caresuiteplus.test` | OTP `CareSuiteEmployee2026!` (nach Repair) |
| Klient:in | `audit-client@caresuiteplus.test` | Portal-Code `123456` |

**Hinweis:** Nach Erstlogin-Flow ist das Mitarbeiter-OTP verbraucht — `repairEmployeePortalAccount` erneut ausführen (passiert automatisch im Skript).

## Manuelle Erfassung

1. **Desktop (Office/Assist):** Browser 1440×900, eingeloggt als Business-User, Seite vollständig geladen abwarten
2. **Mobile (Portale):** DevTools → iPhone 12 Pro (390×844), Willkommens-Popup schließen (außer gezielt für SS-040 / SS-051)
3. URLs siehe `screenshot-checkliste.csv`

## Validierungslog (letzter Lauf)

**Zeitpunkt:** 2026-06-27 17:07:38  
**Ergebnis:** 40/44 PASS · Willkommen-Popup fälschlich sichtbar: **0** (erlaubt nur SS-040 / SS-051)

| ID | Datei | Status | Willkommen-Popup | Bytes | Hinweis |
|----|-------|--------|------------------|-------|---------|
| SS-001 | `01-landing-startseite.png` | **PASS** | n/a | 455651 | kept |
| SS-002 | `01b-landing-startseite-mobile.png` | **PASS** | n/a | 709816 | kept |
| SS-003 | `02-auth-business-login.png` | **PASS** | n/a | 363153 | kept |
| SS-004 | `03-auth-employee-login.png` | **PASS** | n/a | 423222 | kept |
| SS-005 | `04-auth-employee-first-login.png` | **PASS** | n/a | 387489 | kept |
| SS-006 | `05-auth-portal-code-login.png` | **PASS** | n/a | 508858 | kept |
| SS-007 | `06-auth-forgot-password.png` | **PASS** | n/a | 268971 | kept |
| SS-010 | `10-office-dashboard.png` | **PASS** | n/a | 456035 | kept |
| SS-011 | `11-office-clients-list.png` | **PASS** | n/a | 424613 | kept |
| SS-012 | `12-office-client-record-tabs.png` | **PASS** | n/a | 572696 | kept |
| SS-013 | `13-office-client-portal-tab.png` | **PASS** | n/a | 566966 | kept |
| SS-014 | `14-office-client-new-intake.png` | **PASS** | n/a | 458222 | kept |
| SS-015 | `15-office-employees-list.png` | **PASS** | n/a | 442936 | kept |
| SS-016 | `16-office-personnel-file-portal.png` | **PASS** | n/a | 488071 | kept |
| SS-017 | `17-office-access-dashboard.png` | **PASS** | n/a | 425936 | kept |
| SS-018 | `18-office-messages.png` | **PASS** | n/a | 400382 | kept |
| SS-019 | `19-office-calendar.png` | **PASS** | n/a | 426785 | kept |
| SS-020 | `20-office-invoices.png` | **PASS** | n/a | 458435 | kept |
| SS-030 | `30-assist-dashboard.png` | **PASS** | n/a | 443225 | kept |
| SS-031 | `31-assist-assignments-list.png` | **PASS** | n/a | 418529 | kept |
| SS-032 | `32-assist-assignment-create.png` | **PASS** | n/a | 435215 | kept |
| SS-033 | `33-assist-assignment-detail.png` | **PASS** | n/a | 381698 | kept |
| SS-034 | `34-assist-calendar.png` | **PASS** | n/a | 395680 | kept |
| SS-035 | `35-assist-durchfuehrung.png` | **PASS** | n/a | 358747 | kept |
| SS-036 | `36-assist-nachweise.png` | **PASS** | n/a | 371791 | kept |
| SS-037 | `37-assist-fahrten.png` | **PASS** | n/a | 363358 | kept |
| SS-038 | `38-assist-live-status.png` | **PASS** | n/a | 445591 | kept |
| SS-039 | `39-assist-zugeordnete-klienten.png` | **PASS** | n/a | 471101 | kept |
| SS-040 | `40-employee-welcome-modal.png` | **PASS** | expected | 591758 | kept |
| SS-041 | `41-employee-dashboard.png` | **PASS** | none | 586591 | kept |
| SS-042 | `42-employee-assignments.png` | **PASS** | none | 372329 | kept |
| SS-043 | `43-employee-assignment-detail.png` | **FAIL** | n/a | — | assignment_detail_empty:43-employee-assignment-detail.png |
| SS-044 | `44-employee-execution-consent.png` | **FAIL** | n/a | — | assignment_detail_empty:44-employee-execution-consent.png |
| SS-045 | `45-employee-execution-unterwegs.png` | **FAIL** | n/a | — | assignment_detail_empty:45-employee-execution-unterwegs.png |
| SS-046 | `46-employee-execution-gestartet.png` | **FAIL** | n/a | — | assignment_detail_empty:46-employee-execution-gestartet.png |
| SS-047 | `47-employee-schedule.png` | **PASS** | none | 429774 | kept |
| SS-048 | `48-employee-messages.png` | **PASS** | none | 418247 | kept |
| SS-049 | `49-employee-profile.png` | **PASS** | none | 350791 | kept |
| SS-050 | `50-employee-bottom-nav.png` | **PASS** | none | 586425 | kept |
| SS-051 | `51-client-welcome-modal.png` | **PASS** | expected | 533603 | kept |
| SS-052 | `52-client-dashboard.png` | **PASS** | none | 464326 | kept |
| SS-053 | `53-client-appointments.png` | **PASS** | none | 372990 | kept |
| SS-054 | `54-client-documents.png` | **PASS** | none | 421024 | kept |
| SS-055 | `55-client-messages-profile.png` | **PASS** | none | 469404 | kept |
