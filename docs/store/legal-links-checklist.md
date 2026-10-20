# Legal Links Checklist — CareSuite+

**Stand:** 2026-06-13  
**Zweck:** Store-Compliance und DSGVO vor Submission

---

## In-App Links (`src/lib/platform/supportLinks.ts`)

| Link | URL | UI-Ort | Live vor Launch |
|------|-----|--------|-----------------|
| Hilfe | https://caresuiteplus.de/hilfe | DesktopShell Footer, Tablet Rail | ☐ |
| Datenschutz | https://caresuiteplus.de/datenschutz | DesktopShell Footer | ☐ |
| Impressum | https://caresuiteplus.de/impressum | DesktopShell Footer | ☐ |
| Nutzungsbedingungen | https://caresuiteplus.de/nutzungsbedingungen | Konstante vorhanden, UI optional | ☐ |
| Support-E-Mail | support@caresuiteplus.de | reviewer-notes, Store-Listing | ☐ |

---

## Store Console (extern eintragen)

| Feld | App Store Connect | Google Play Console |
|------|-------------------|---------------------|
| Privacy Policy URL | ☐ | ☐ |
| Support URL | ☐ | ☐ |
| Marketing URL (optional) | ☐ | ☐ |
| Impressum / Anbieter | ☐ Firmendaten | ☐ Entwicklerkontakt |

---

## DSGVO / Betroffenenrechte

| Anforderung | Status | Hinweis |
|-------------|--------|---------|
| Datenschutzerklärung (Web) | ☐ Platzhalter-URL | Muss vor Launch live sein |
| Auskunft / Berichtigung | UI vorbereitet | `DataRequestScreen` — **preparedOnly**, Support-E-Mail aktiv |
| Datenexport | UI vorbereitet | `DataRequestScreen` — Backend noch nicht live |
| Kontolöschung | UI vorbereitet | `AccountDeletionRequestScreen` — **preparedOnly**, Support-E-Mail aktiv |
| AV-Vertrag (B2B) | ☐ | Separat vom App-Store-Prozess |

**Settings-Screens:** `DataRequestScreen` und `AccountDeletionRequestScreen` unter `/settings/data-request` und `/settings/account-deletion`. Submit **deaktiviert** (`preparedOnly`) bis Live-Backend — keine Fake-Erfolge. Support-E-Mail und Datenschutz-Links über `supportLinks.ts`.

---

## App Store Privacy Nutrition Labels

Siehe `docs/store/privacy-data-map.md` — Kontakt, Gesundheitsdaten, User-ID.

---

## Google Data Safety

Siehe `docs/store/privacy-data-map.md` — Personal info, Health info, keine App-Activity.

---

## Checkliste vor Submission

- [ ] Alle URLs erreichbar (HTTP 200, DE-Inhalt)
- [ ] Impressum mit verantwortlicher Stelle
- [ ] Datenschutz aktualisiert (Supabase, Gesundheitsdaten, Aufbewahrung)
- [ ] Reviewer-Demo-Zugang **nicht** im Repo (nur App Store Connect / Play Console)
- [ ] Keine Passwörter in `reviewer-notes.md` oder Git
