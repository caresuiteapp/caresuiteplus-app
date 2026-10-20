# CareSuite+ — Multi-Platform, Store & Desktop Readiness Report

**Stand:** 2026-06-13  
**Sprint:** Multi-Plattform-Architektur vorbereitet  
**Projekt:** `C:\Users\Kevin Reinhardt\Documents\CareSuite+`

---

## A. Executive Summary

CareSuite+ wurde um eine **responsive Plattform-Schicht** erweitert: Device Classes, drei Shell-Varianten (Mobile/Tablet/Desktop), Master-Detail für drei Kernscreens, Store-Dokumentation, EAS-Konfiguration und Quality-Gate-Skripte.

**Ehrliches Fazit:** Multi-Plattform-Architektur vorbereitet — **nicht** production-ready / store-ready, da `assets/` fehlen, EAS `projectId` Platzhalter ist und kein erfolgreicher `eas build` in diesem Sprint ausgeführt wurde.

---

## B. Plattform-Strategie

Siehe [`docs/platform/platform-strategy.md`](../platform/platform-strategy.md).

- **Empfehlung:** Option A (Expo Web + Tauri)
- **Mobile:** EAS Build iOS/Android
- **Tablet:** Eigene Shells ab 768px
- **Desktop Phase 1:** Expo Web + `DesktopShell`

---

## C. Store Readiness

| Dokument | Pfad | Status |
|----------|------|--------|
| App Store Checklist | `docs/store/app-store-checklist.md` | ✓ Erstellt |
| Google Play Checklist | `docs/store/google-play-checklist.md` | ✓ Erstellt |
| Screenshots Plan | `docs/store/screenshots-plan.md` | ✓ Erstellt |
| Listing Texts | `docs/store/store-listing-texts.md` | ✓ Erstellt |
| Privacy Data Map | `docs/store/privacy-data-map.md` | ✓ Erstellt |
| Reviewer Notes | `docs/store/reviewer-notes.md` | ✓ Erstellt |

**Blocker:** `assets/icon.png`, Splash, Android adaptive icons, favicon — Ordner fehlt (bekannt aus P0-Audit).

---

## D. App Config Audit

| Feld | Wert | Status |
|------|------|--------|
| iOS bundleIdentifier | `de.caresuiteplus.app` | ✓ |
| Android package | `de.caresuiteplus.app` | ✓ |
| iOS supportsTablet | `true` | ✓ |
| iOS buildNumber | `1` | ✓ |
| Android versionCode | `1` | ✓ |
| Android permissions | `INTERNET` only | ✓ |
| Web favicon | `./assets/favicon.png` | ⚠ Datei fehlt |
| EAS projectId | Platzhalter UUID | ⚠ `eas init` nötig |
| orientation | `default` (Portrait + Landscape Tablet) | ✓ |
| app.config.ts | Dynamische Config | ✓ Neu |
| eas.json | dev/preview/production | ✓ Neu |

---

## E. Responsive Design System (implementiert)

| Datei | Zweck |
|-------|-------|
| `src/lib/platform/platform.ts` | PlatformTarget, ShellVariant, Snapshot |
| `src/lib/platform/breakpoints.ts` | DeviceClass, Breakpoints |
| `src/hooks/platform/useDeviceClass.ts` | Hook |
| `src/hooks/platform/usePlatformLayout.ts` | Layout-Hook |
| `src/components/layout/ResponsiveLayout.tsx` | Shell-Auswahl |
| `src/components/layout/AdaptiveScreen.tsx` | Screen-Varianten |
| `src/components/layout/MasterDetailLayout.tsx` | Split-Pane |
| `src/components/layout/DesktopShell.tsx` | Sidebar, keine Bottom-Tabs |
| `src/components/layout/TabletShell.tsx` | Side Rail |
| `src/components/layout/MobileShell.tsx` | Bottom Tabs |
| `src/lib/platform/supportLinks.ts` | Hilfe/Datenschutz/Impressum |

**Verdrahtung:** `ShellLayout` → `ResponsiveLayout` → alle bestehenden `(tabs)/_layout.tsx` unverändert kompatibel.

---

## F. Layout Audit Table

| Bereich | Screen | Phone | Tablet | Desktop | Problem | Action |
|---------|--------|-------|--------|---------|---------|--------|
| **Auth** | Business Login | Vollbild Stack | Vollbild | Vollbild zentriert | Kein max-width Form | Form `maxWidth: 480` in Phase 2 |
| **Auth** | Portal Logins | Vollbild | Vollbild | Vollbild | Gleich | Optional Desktop-Card |
| **Public** | Start / Onboarding | Mobile | Mobile-ähnlich | Zu schmal | Kein Marketing-Layout Desktop | Landing-Layout später |
| **Business** | Dashboard | Bottom Tabs | Side Rail | Sidebar | OK (Shell) | KPI-Grid Desktop 3-spaltig |
| **Business** | Messages | Stack-Navigation | **Master-Detail** ✓ | **Master-Detail** ✓ | Implementiert | Weitere Sub-Screens |
| **Business** | Module/Reporting | Bottom Tabs | Side Rail | Sidebar | Listen full-width | Master-Detail für Reports |
| **Office** | Übersicht | Bottom Tabs | Side Rail | Sidebar | OK (Shell) | Widget-Grid Desktop |
| **Office** | Klient:innen | Stack → Detail | **Master-Detail** ✓ | **Master-Detail** ✓ | Implementiert | Restliche Tabs migrieren |
| **Office** | Nachrichten | Liste only | **Master-Detail** ✓ | **Master-Detail** ✓ | Detail Panel einfach | Vollständiger Detail-Screen |
| **Office** | Mitarbeiter | Stack | Side Rail + Stack | Sidebar + Stack | Kein Split | Master-Detail Pattern |
| **Office** | Rechnungen | Stack | Side Rail + Stack | Sidebar + Stack | Kein Split | Master-Detail Pattern |
| **Assist** | Einsätze | Bottom Tabs | Side Rail | Sidebar | OK (Shell) | Kalender Desktop breit |
| **Pflege** | Pflegepläne | Bottom Tabs | Side Rail | Sidebar | OK (Shell) | Plan-Editor Split |
| **Beratung** | Fälle | Bottom Tabs | Side Rail | Sidebar | OK (Shell) | Fallakte Split |
| **Akademie** | Kurse | Bottom Tabs | Side Rail | Sidebar | OK (Shell) | — |
| **Stationär** | Bewohner | Bottom Tabs | Side Rail | Sidebar | OK (Shell) | Bewohner-Split |
| **Portal Employee** | Übersicht | Bottom Tabs | Side Rail | Sidebar | OK (Shell) | Messages Split |
| **Portal Client** | Termine | Bottom Tabs | Side Rail | Sidebar | OK (Shell) | Messages Split |
| **TI** | KIM Mailbox | Stack | Side Rail + Stack | Sidebar + Stack | Kein Split | Mailbox Master-Detail |
| **QM** | MD-Pakete | Stack | Side Rail | Sidebar | Wizard full-screen | Desktop Wizard 2-col |

---

## G. Tablet Adaptations (Master-Detail)

| Screen | Implementierung | Route |
|--------|-----------------|-------|
| Klient:innen Liste+Detail | `ClientsAdaptiveScreen` | `app/office/(tabs)/clients.tsx` |
| Kommunikationszentrum | `CommunicationAdaptiveScreen` | `app/business/messages/index.tsx` |
| Office Nachrichten | `OfficeMessagesAdaptiveScreen` | `app/office/(tabs)/messages.tsx` |

**Dokumentiert für spätere Migration:** Mitarbeiter, Rechnungen, KIM, Portal-Messages, Reporting.

---

## H. Desktop Strategy

Siehe [`docs/platform/desktop-app-strategy.md`](../platform/desktop-app-strategy.md).

- Phase 1: Expo Web (jetzt)
- Phase 2: Tauri Wrapper (empfohlen)
- Phase 3: Enterprise Distribution

---

## I. Web/Desktop Security

Siehe [`docs/platform/web-desktop-security.md`](../platform/web-desktop-security.md).

- PKCE für Web Auth
- Keine Service-Role Keys im Client
- CSP auf Hosting-Ebene
- Support-Links in DesktopShell

---

## J. Support / Privacy Links

| Link | Konstante | UI-Ort |
|------|-----------|--------|
| Hilfe | `SUPPORT_LINKS.help` | DesktopShell Footer, Tablet Rail |
| Datenschutz | `SUPPORT_LINKS.privacy` | DesktopShell Footer |
| Impressum | `SUPPORT_LINKS.imprint` | DesktopShell Footer |
| Abmelden | `signOut()` | DesktopShell, bestehende Dashboards (Mobile) |

Mobile: Abmelden weiterhin auf Dashboard/Profil-Screens (bestehendes Muster).

---

## K. Build Config & Commands

```bash
# Entwicklung
npm run web
npm run ios
npm run android

# Typecheck & Tests
npm run typecheck
npm run test
npm run smoke

# Quality Gates (neu)
npm run platform:audit
npm run store:audit
npm run responsive:audit

# EAS (nach eas init + assets)
eas build --profile development --platform all
eas build --profile preview --platform ios
eas build --profile preview --platform android
eas build --profile production --platform all

# Web Export (Desktop Phase 1)
npx expo export --platform web
```

---

## L. Quality Gate Scripts

| Script | Prüft |
|--------|-------|
| `platform:audit` | Platform-Dateien, app.config.ts, eas.json Profile |
| `store:audit` | Store-Docs, Bundle-IDs, Privacy-Map, Assets-Warnung |
| `responsive:audit` | Breakpoints, Shell-Verdrahtung, Master-Detail Screens |

---

## M. Tests

Neue Tests unter `src/__tests__/platform/`:

- `breakpoints.test.ts` — DeviceClass-Auflösung
- `platformLayout.test.ts` — Shell-Variant-Auswahl
- `storeConfig.test.ts` — Bundle-IDs, eas.json, Shell-Module, Privacy-Docs

**Verifikation (dieser Sprint):**

| Gate | Status |
|------|--------|
| `npm run typecheck` | **PASS** |
| `npm run test` | **PASS** (284 Tests, +21 neu) |
| `npm run smoke` | **PASS** |
| `npm run platform:audit` | **PASS** |
| `npm run store:audit` | **PASS** |
| `npm run responsive:audit` | **PASS** |

---

## N. Honest Readiness Verdict

> **Multi-Plattform-Architektur vorbereitet** — responsive Shells, Breakpoints, drei Master-Detail-Referenzen, Store-Dokumentation und EAS-Skelett sind im Code und in `docs/` angelegt.

**Nicht behauptet / nicht erfüllt:**

- ❌ Store-ready (Assets fehlen, kein erfolgreicher Store-Build)
- ❌ Production-ready Desktop-App (Tauri nicht gebaut)
- ❌ Web-Production deployed
- ❌ Alle Screens tablet/desktop-adaptiert (nur 3 Master-Detail + Shells)

**Nächste P0-Schritte:**

1. `assets/` Icon-Set erstellen
2. `eas init` → echte `projectId`
3. `eas build --profile preview` auf iOS + Android
4. `expo export -p web` verifizieren
5. Master-Detail auf Mitarbeiter + Rechnungen ausrollen

---

*Report erstellt im Multi-Platform Readiness Sprint.*
