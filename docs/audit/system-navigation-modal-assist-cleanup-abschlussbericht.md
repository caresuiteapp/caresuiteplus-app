# System Navigation + Modal Stack + Assist Cleanup — Abschlussbericht

**Datum:** 2026-06-20  
**HEAD (Start):** `a5c4b38` · **Branch:** `main`  
**Scope:** UI-Navigation, Modal-Stack, Assist-Stale-Banner, Touren/Fahrten-Trennung, Client/Employee Modal-Vorbereitung — **kein** Schema, **kein** Permissions, **kein** db push

---

## 1. Git-Precheck

| Prüfung | Ergebnis |
|---------|----------|
| Branch `main` | ✅ |
| HEAD ≥ `a5c4b38` | ✅ (`a5c4b38`) |
| Staged at start | ✅ leer |
| Diverged from origin | ✅ `main...origin/main` synchron nach fetch |
| 0154–0158 / staticRolePermissions | ✅ nicht geändert |

Migration-Liste (read-only): `.audit-migration-list-system-navigation-precheck.log`

---

## 2. Routing-Matrix (Auszug)

| Bereich | Route | Navigation-Typ | Modal-Stack |
|---------|-------|----------------|-------------|
| Assist Dashboard | `/assist` | Sidebar | — |
| Einsätze | `/assist/assignments` | Sidebar + Tabs | Detail weiter Route/Modal je Screen |
| Touren | `/assist/touren` | Sidebar | eigene Empty-State-Seite (kein Redirect) |
| Fahrten/Mobilität | `/assist/fahrten` | Sidebar | `TripDetailGlassModal` in-page |
| Live-Status | `/assist/live-status` | Sidebar | — |
| Qualität | `/assist/qualitaet` | Sidebar | Liste → `/assist/nachweise/[id]` |
| Einstellungen | `/assist/einstellungen` | Sidebar | Web/Desktop: `assist.settings` Modal |
| Zugeordnete Klient:innen | `/assist/zugeordnete-klienten` | Sidebar | Web/Desktop: `prep.client.record` |
| Office Klient:innen | `/business/office/clients` | Sidebar | Modal-Vorbereitung via Hook |
| Admin Settings | `/settings/*` | Sidebar | `openInModal` → Modal-Stack |

---

## 3. Modal-Stack-Architektur

Neu / erweitert:

- `src/types/modalNavigation.ts`
- `src/hooks/useModalStack.ts` — `openModal`, `pushModal`, `closeTopModal`, `goBackModal`, `modalStack`
- `src/components/navigation/ModalStackProvider.tsx` + `ModalStackRenderer.tsx`
- Root: `app/_layout.tsx` wrapped mit `ModalStackProvider`
- Registry erweitert: `assist.settings`, `prep.client.record`, `prep.employee.record`
- `navigateModuleNavItem` für Sidebar / Context-Panels (Web/Desktop → Modal, Mobile → Route)

Design: Aurora `PlatformModal` / Glass — keine weißen CareLight-Seiten.

---

## 4. Assist Banner / Setup-Hints

- `assistSetupHints.ts`: Stale-Text „Migration 0156 vorbereitet / nicht remote“ entfernt
- Stattdessen: **Persistenz aktiv**, **Map-Provider optional**, Demo-/Touren-Hinweise ehrlich
- `visitSignatureSessionStore.ts` Kommentar auf aktiven Persistenz-Stand angepasst

---

## 5. Live-Status

- Kein „GPS Backend in Vorbereitung“ wenn Persistenz aktiv
- Texte referenzieren `assist_tracking_sessions`, `assist_location_points` (nicht `assist_tracking_points`)
- Kartenbereich: Map-Provider leer vs. Backend leer getrennt

---

## 6. Mobilität / Fahrten

- Tab-Layout Fahrtenbuch / Live-Tracking in `TripsListScreen` beibehalten
- Tracking-Banner nutzt Persistenz-Status aus `gpsTrackingConfig.ts`
- Fahrten-Detail weiter über `TripsAdaptiveScreen` + `TripDetailGlassModal`

---

## 7. Touren

- `app/assist/touren.tsx`: **kein** Redirect nach `/assist/fahrten`
- `AssistTourenScreen` mit eigener Empty-State + Link zum Fahrtenbuch
- Sidebar-Active-State: `resolveActiveModuleNavKey` matcht `/assist/touren` separat

---

## 8. Qualität

- `fetchAssistQualityProofs`: Live via `listVisitProofs`, kein „Live-Repository erweitern“
- Empty-State verlinkt Nachweise + Review-Pfad

---

## 9. Empty States (Zugeordnete / Einstellungen)

- `ModuleAssignedClientsScreen`: Office-Link + Modal-Open für Klient:in (Desktop/Web)
- `AssistSettingsScreen` für `/assist/einstellungen` (vorher fälschlich Dashboard)
- `AssistTourenScreen` Empty-State

---

## 10. Client / Employee Modal-Vorbereitung

- `useOpenClientRecordModal` / `useOpenEmployeeRecordModal`
- `ClientRecordModalPrepScreen`, `EmployeeRecordModalPrepScreen` in Modal-Registry
- Kein vollständiger Klient:innen/Mitarbeiter:innen Core

---

## 11. Tests

| Suite | Ergebnis |
|-------|----------|
| `assistNavigation.test.ts` | ✅ 5/5 |
| `modalStack.test.ts` | ✅ 5/5 |
| `assistProofToPortalFlow.test.ts` | ✅ 10/10 |

Logs: `.audit-typecheck-system-navigation-modal-precommit.log`, `.audit-test-system-navigation-modal-precommit.log`

Typecheck: keine neuen Fehler in geänderten Navigation/Assist-Dateien (Repo-weite Altfehler unverändert).

---

## 12. Harte Grenzen

| Grenze | eingehalten |
|--------|-------------|
| Kein Klient:innen Core | ✅ |
| Kein Mitarbeiter:innen Core | ✅ |
| Kein B.2/B.3 / assignmentWorkflowService | ✅ |
| Kein staticRolePermissions | ✅ |
| Kein git add . | ✅ selektiver Commit |
| Kein db push / Migration edit | ✅ |

---

## 13. Commit & Push

Commit-Message wie Master-Spec. Push `origin main` nach Commit.

---

## Offene Punkte (bewusst nicht in diesem Lauf)

- Vollständige Map-Provider-Anbindung (Google/Mapbox)
- `assist_routes` Persistenz für Touren
- Weitere Assist-Details (Proof PDF, Visit) vollständig in Modal-Stack migrieren (incremental folgt)
