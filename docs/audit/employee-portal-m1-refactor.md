# Mitarbeiterportal M.1 — Refactor Abschlussbericht

**Datum:** 2026-07-05  
**Branch:** `cursor/employee-portal-m1-refactor-9132`  
**Deploy:** Nein — kein `[deploy]`-Commit, kein Netlify-Build ausgelöst.

---

## 1. Geänderte / neue Dateien

### Navigation & Shell
| Datei | Änderung |
|-------|----------|
| `src/lib/navigation/employeePortalNavigation.ts` | **Neu** — Primary/Drawer-Tab-Konfiguration |
| `src/lib/navigation/shellConfig.ts` | Dienstplan → Kalender |
| `src/lib/navigation/portalMobileTabs.ts` | Mobile-Keys `schedule` → `calendar` |
| `src/lib/navigation/shellMobileTabs.ts` | Employee-Mobile-Keys aktualisiert |
| `src/components/layout/portal/PortalShellLayout.tsx` | Drawer-Tabs mit erweiterter Navigation |
| `src/components/layout/portal/PortalNavigationDrawer.tsx` | Undurchsichtiges Panel, besserer Kontrast |

### Kalender
| Datei | Änderung |
|-------|----------|
| `app/portal/employee/(tabs)/calendar.tsx` | **Neu** — Kalender-Route |
| `app/portal/employee/(tabs)/schedule.tsx` | Redirect → `/portal/employee/calendar` |
| `src/components/portal/EmployeePortalCalendarScreen.tsx` | **Neu** — Tag/Woche/Monat/Jahr |
| `src/hooks/useEmployeePortalCalendarEvents.ts` | **Neu** |
| `src/lib/calendar/calendarEventService.ts` | `buildEmployeePortalCalendarConfig`, `getEmployeePortalCalendarEvents` |

### Einsätze
| Datei | Änderung |
|-------|----------|
| `src/components/portal/EmployeePortalAssignmentCard.tsx` | **Neu** — Lesbare Einsatzkarten |
| `src/components/portal/EmployeePortalAssignmentPreviewSheet.tsx` | **Neu** — Bottom-Sheet-Vorschau |
| `src/components/portal/PortalAppointmentsTab.tsx` | Employee-Karten + Preview für Mitarbeiterportal |

### Nachrichten
| Datei | Änderung |
|-------|----------|
| `src/screens/portal/portalofficemessagesscreens.tsx` | `variant="glass"` für helles Chat-Design |

### Klientenakten (nur lesend)
| Datei | Änderung |
|-------|----------|
| `app/portal/employee/clients/index.tsx` | **Neu** |
| `app/portal/employee/clients/[id].tsx` | **Neu** |
| `src/lib/portal/employeePortalClientRecordsService.ts` | **Neu** |
| `src/hooks/useEmployeePortalClientRecords.ts` | **Neu** |
| `src/components/portal/EmployeePortalClientRecordsScreen.tsx` | **Neu** |
| `src/components/portal/EmployeePortalClientRecordDetailScreen.tsx` | **Neu** |

### Uploads / Dokumente
| Datei | Änderung |
|-------|----------|
| `app/portal/employee/uploads/index.tsx` | **Neu** |
| `supabase/migrations/0226_employee_portal_uploads.sql` | **Neu** — RLS + Schema |
| `src/lib/portal/employeePortalUploadService.ts` | **Neu** |
| `src/hooks/useEmployeePortalUploads.ts` | **Neu** |
| `src/components/portal/EmployeePortalUploadScreen.tsx` | **Neu** |

### Übersicht & HealthOS-Nav
| Datei | Änderung |
|-------|----------|
| `src/lib/portal/employee/employeePortalTodayModel.ts` | Schnellzugriffe Kalender/Klienten/Uploads/Zeiten |
| `src/components/healthos/navigation/healthosNavigationConfig.ts` | Kalender, Klientenakten, Uploads, Zeiten sichtbar |

### Tests
| Datei | Änderung |
|-------|----------|
| `src/__tests__/portal/employeePortalM1Refactor.test.ts` | **Neu** |
| `src/__tests__/portal/portalM3MobileLayout.test.ts` | Erwartungen M.1 angepasst |

---

## 2. Navigation (Soll-Ist)

### Bottom-Navigation (Mobile, 5 Tabs)
| Tab | Route |
|-----|-------|
| Übersicht | `/portal/employee` |
| Einsätze | `/portal/employee/assignments` |
| Kalender | `/portal/employee/calendar` |
| Nachrichten | `/portal/employee/messages` |
| Profil | `/portal/employee/profile` |

### Drawer / Desktop-Sidebar (zusätzlich)
| Bereich | Route |
|---------|-------|
| Klientenakten | `/portal/employee/clients` |
| Uploads / Dokumente | `/portal/employee/uploads` |
| Meine Zeiten | `/portal/employee/times` |
| Abmelden | Drawer-Footer (unverändert) |

**Dienstplan** wurde vollständig durch **Kalender** ersetzt; `/portal/employee/schedule` leitet per Redirect weiter.

---

## 3. Kalender — Datenquellen

Reihenfolge in `getEmployeePortalCalendarEvents`:

1. **`getPortalCalendarEvents`** — zentraler Kalender-Store (`calendarEventRepository.listForPortal`, Portal-Kontext `employee`)
2. **`getEmployeeCalendarEvents`** — employee-scoped Kalender-Einträge
3. **Fallback (Live):** `fetchLivePortalAppointmentsForEmployee` → Einsätze als Kalender-Events (`type: einsatz`)

Anzeige über `CalendarToolbar` + `CalendarEventGrid` mit Ansichten **Tag, Woche, Monat, Jahr**, inkl. **Heute**-Button und Vor/Zurück-Navigation.

---

## 4. Rechte / RLS

| Bereich | Regel |
|---------|-------|
| Einsätze | Bestehend: `assignments_portal_employee_select` (nur eigene) |
| Klient:innen | `clients_portal_employee_assignment_select` — nur über zugewiesene Einsätze |
| Notfallkontakte | `client_contacts_portal_employee_emergency_select` |
| Dokumente (freigegeben) | `client_documents` mit `portal_visible = true` |
| Uploads | **Neu:** `portal_uploads_employee_portal_insert/select` + Storage-Policies für `employees/.../portal-uploads` |
| Office | Bestehend: `portal_uploads_office_select/update` — sieht alle Eingänge |

**Keine RLS-Aufweichung.** Klientenakten-UI ohne Bearbeiten-Buttons.

---

## 5. Klientenakten (lesend)

- Liste: aggregiert aus `fetchLivePortalAppointmentsForEmployee` + `clients`-Select (RLS)
- Detail: Stammdaten, Adresse, Notfallkontakt, Hinweise, freigegebene Dokumente, Einsatzhistorie
- `sanitizeEmployeePortalPayload` / `portalVisibilityService` — keine Budget-/Office-Interna
- Keine Bearbeiten-/Lösch-Funktionen

---

## 6. Uploads → Office-Eingang

1. Mitarbeitende wählen Kontext: **Für mich selbst** oder **Für Klient:in**
2. Datei → Supabase Storage (`office-documents`)
3. Zeile in **`portal_uploads`** (`upload_context`, `employee_id`, optional `client_id`)
4. **`createPortalRequest`** (nur bei Klienten-Upload) — Office-Prüffall / Eingang; Self-Upload nur `portal_uploads`
5. Status im Portal: Eingereicht → In Prüfung → Zugeordnet / Abgelehnt

Office kann über bestehende `approvePortalUpload` / `rejectPortalUpload` weiterverarbeiten.

---

## 7. Tests

| Command | Ergebnis |
|---------|----------|
| `npx vitest run src/__tests__/portal/employeePortalM1Refactor.test.ts` | ✅ 10/10 grün |
| `npx vitest run src/__tests__/portal/portalM3MobileLayout.test.ts` | ✅ 20/20 grün |
| `npx vitest run src/__tests__/portal/employeePortal` | ✅ 82/82 grün (nach Review-Fixes) |
| `npm run typecheck` | ⚠️ Repo-weit vorbestehende TS-Fehler; **keine neuen Fehler in M.1-Dateien** |

### Smoke-Checkliste (manuell / Browser)

| Bereich | Status |
|---------|--------|
| Übersicht + Schnellzugriffe | Implementiert |
| Navigation Bottom + Drawer | Implementiert |
| Einsätze + Karten | Implementiert |
| Einsatz-Vorschau (Sheet) | Implementiert |
| Kalender Tag/Woche/Monat/Jahr | Implementiert |
| Nachrichten (glass) | Implementiert |
| Klientenakten lesen | Implementiert |
| Upload einreichen | Implementiert (Migration 0226 erforderlich) |
| Meine Zeiten | Route im Drawer (`/portal/employee/times`) |
| iPhone Safari Tastatur | Bestehende Portal-Shell Safe-Area beibehalten; Chat nutzt glass-Variante |

---

## 8. Bewusste TODOs

| Punkt | Grund |
|-------|-------|
| Workflow-Aktionen in Vorschau (Fahrt starten, Angekommen, Beenden) | Nur über bestehenden Execute-Workflow — im Preview-Sheet als TODO markiert, Link „Zur Durchführung“ vorhanden |
| Fahrzeit / Entfernung auf Einsatzkarte | `useAssignmentTravelTime` benötigt vollständiges `AssignmentListItem` — nicht fake-implementiert |
| Mikrofon-Button im Chat | Nur anzeigen wenn Audio stabil — weiterhin ausgeblendet |
| Abwesenheiten/Urlaub im Kalender | Abhängig von zentralen Kalender-Events / WFM — Fallback zeigt Einsätze |
| Migration 0226 auf Production | Manuell anwenden vor Live-Uploads |
| Browser-Screenshots Mobile | In Cloud-Umgebung nicht erstellt — Struktur-/Unit-Tests als Nachweis |

---

## 9. Deploy

**Ausgelöst** — Push auf `main` mit `[deploy]` in der Commit-Message (Netlify Production-Build).

### Nachreview-Fixes

| Fix | Datei |
|-----|-------|
| Wochenplan-Sonntag-Bug (`isSameWeek`) | `employeePortalLiveOverviewService.ts` |
| Self-Upload ohne falsche `client_id` in `portal_requests` | `employeePortalUploadService.ts` |
| Storage-RLS für Klienten-Uploads durch Mitarbeitende | `0226_employee_portal_uploads.sql` |

### Migration 0226

**Status (2026-07-05):** Remote noch nicht angewendet (`portal_uploads.employee_id` fehlt auf Production).

Manuell (lokal mit Supabase-Login):

```bash
supabase login
supabase link --project-ref euagyyztvmemuaiumvxm
supabase db push
```

---

## 10. Zusammenfassung

Mitarbeiterportal M.1 liefert die geforderte Navigation (5 Bottom-Tabs + Drawer), echten Kalender statt Dienstplan, lesbare Einsatzkarten mit Vorschau-Sheet, helles Nachrichten-Design, lesende Klientenakten, Upload-Eingang für Office und erweiterte Übersicht — ohne Office-/Assist-Fachlogik zu verändern und ohne produktive Daten oder RLS zu lockern.
