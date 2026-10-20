# Portal M.3 — Ist-Abgleich

Stand: 2026-06-27 (vor Abschluss-Implementierung)

Auftrag: **CareSuite+ M.3 – Vollständige Überarbeitung Mitarbeiterportal & Klient:innenportal**

Referenzen: Commit `01c379f` (M.3-Basis), `b9e8d4e` (tenantId Passwort-Reset), `docs/audit/portal-m3-abnahmebericht.md`

---

## 1. Mobile-Shell wie Verwaltung (Office)

| | |
|---|---|
| **Soll** | Fixierter Header, fixe Bottom-Nav, nur Content scrollt, `100dvh` + Safe-Areas, nichts abgeschnitten |
| **Ist (Code)** | `PortalShellLayout` mit `AutoScrollView`, absoluter Bottom-Nav-Host, `webDynamicViewportMinHeightStyle` + `webSafeAreaTopShell` — Shell auf `app/portal/employee|client/_layout.tsx`. Tests in `portalM3MobileLayout.test.ts` grün. |
| **Ist (Prod)** | Commit `01c379f` deployed; Nutzerabnahme verworfen — vermutlich visuell nicht als „Office-Qualität“ wahrgenommen oder Cache/Teil-Deploy. |
| **Gap** | Kein struktureller Shell-Mangel; feine Safe-Area-Doppel-Paddings in `PortalTabScreen` auf Phone teils redundant. `AdaptivePortalOverview` nutzt auf Tablet/Desktop noch eigenes `ScrollView` (Nested-Scroll-Risiko). |
| **Fix** | Mobile Nested-Scroll in `AdaptivePortalOverview` entfernen; Padding harmonisieren. |

---

## 2. Login: Welcome-Popup → echtes Dashboard

| | |
|---|---|
| **Soll** | Nach Login Willkommensdialog, danach echtes Dashboard, keine unfertigen Zwischenseiten |
| **Ist (Code)** | `PortalWelcomeGate` + `markPortalWelcomePending` in Login-Screens; `RedirectIfAuthenticated` leitet um. Login-Screens zeigen kurz Success-State ohne explizites `router.replace`. |
| **Ist (Prod)** | Welcome evtl. sichtbar; Zwischenzustand „Anmeldung erfolgreich — Weiterleitung…“ auf Login-Route bleibt sichtbar bis Redirect. |
| **Gap** | Kein direkter Navigations-Sprung nach Login; `FullScreenLoader` auf Auth-Stack kann als unfertige Seite wirken. |
| **Fix** | Nach erfolgreichem `signInPortalSession` sofort `router.replace` zum Portal-Dashboard. |

---

## 3. Mitarbeiterportal: echtes Dashboard

| | |
|---|---|
| **Soll** | Echtes Dashboard, Begrüßung mit Namen, Mandant, Rolle, Nav, Einsätze, Leerzustand „Keine Einsätze geplant“ |
| **Ist (Code)** | `EmployeePortalDashboardScreen` mit Hero, KPIs, `useEmployeePortalDashboard`; Schedule-Tab mit Empty-State. Mandantenname fallback „Ihr Mandant“. |
| **Ist (Prod)** | tenantId-Fix (`b9e8d4e`) für Passwort-Reset; Dashboard-Daten abhängig von `usePortalActor` tenantId — vor Fix ggf. leer/Fehler. |
| **Gap** | Platzhalter „Ihr Mandant“ statt geladenem Namen; Profilbild ohne Cache-Bust; Detail-Helos mit „Portal-Sicht“-Badge. |
| **Fix** | Tenant-Fallback „Ihr Unternehmen“ + Session-Cache; Avatar Cache-Bust; Platzhalter-Badges entfernen. |

---

## 4. Klient:innenportal: Shell + Senior-Layout

| | |
|---|---|
| **Soll** | Identische Mobile-Shell, Welcome, echtes Dashboard, ruhiges Senior-Layout |
| **Ist (Code)** | `MobilePortalDashboard` mit Begrüßung, Nächster Einsatz, „Wichtig für Sie“, KPI-Karten — ohne Nested-Scroll. Assist-Pfad aktiv. |
| **Ist (Prod)** | Sollte mit `01c379f` live sein; Abnahme negativ. |
| **Gap** | Terminologie-Fallbacks „Portal“ in `portalTerminology.ts`; Lade-Texte generisch „Portal wird geladen“. |
| **Fix** | Klient:innen-spezifische Texte; Terminologie ohne generisches „Portal“. |

---

## 5. Profilbild

| | |
|---|---|
| **Soll** | Header, Popup, Dashboard, Profil — korrektes Bild, kein falscher Avatar wenn Bild existiert |
| **Ist (Code)** | `profile.avatarUrl` direkt an `TopbarProfileAvatar` / `PremiumAvatar`; Public-URL ohne Cache-Bust nach Upload. |
| **Ist (Prod)** | Bekanntes Problem: nach Upload weiter Initialen-Avatar bis Hard-Refresh. |
| **Gap** | Kein einheitlicher Cache-Bust; `PortalEmployeeProfileHero` zeigt Emoji statt Foto. |
| **Fix** | `appendProfileAvatarCacheBust` in `TopbarProfileAvatar`; Hero mit Avatar auf Profilseite. |

---

## 6. Platzhalter entfernen

| | |
|---|---|
| **Soll** | Kein „Portal“, „Ihr Mandant“, „Portal-Sicht“, Demo-Texte, graue unfertige Karten |
| **Ist (Code)** | Restbestände: `Portal-Sicht` in Detail-Helos, `roleLabel ?? 'Portal'`, Breadcrumb „Portal“ in `PortalTopBar`, `Ihr Mandant` in Tenant-Hooks, `Demo / preparedOnly` in Profil-Hero, leere Landing-Beschreibungen. |
| **Ist (Prod)** | Sichtbar für Endnutzer auf Detail- und Profilseiten. |
| **Gap** | Breite Streuung generischer Strings. |
| **Fix** | Zentralisierte Labels (`portalDisplayLabels.ts`), Helos bereinigen, Landing-Beschreibungen ergänzen. |

---

## 7. Landing Page vereinheitlichen

| | |
|---|---|
| **Soll** | Verwaltung, Mitarbeiterportal, Klient:innenportal, Registrieren visuell auf Office-Niveau |
| **Ist (Code)** | `AppStartScreen` + `PortalCard` + Glass — aber `APP_START_ENTRIES` ohne Beschreibungstexte (`description: ''`). |
| **Ist (Prod)** | Karten nur mit Titel, wirken unfertig gegenüber Liquid-Glass-Office-Login. |
| **Gap** | Fehlende Kurzbeschreibungen pro Einstieg. |
| **Fix** | Deutsche Beschreibungen in `appStartEntries.ts`. |

---

## Zusammenfassung Gap-Priorität

| Prio | Bereich | Aufwand |
|------|---------|---------|
| P0 | Avatar Cache-Bust + Tenant-Name | Mittel |
| P0 | Platzhalter-Strings entfernen | Mittel |
| P1 | Login direkte Weiterleitung | Klein |
| P1 | Landing-Beschreibungen | Klein |
| P2 | AdaptivePortalOverview Scroll | Klein |
| P2 | Profil-Hero Avatar + Live-Badge | Klein |
