# C.14VP — Production C.14V Visual Recheck

**Datum**: 2026-06-24  
**Phase**: C.14VP — Post-Deploy Visual Rebuild Verification  
**Deploy-Commit**: `fb25665` — `chore: trigger production deploy [deploy]`  
**Visual-Commit**: `1a45ff4` — `fix(ui): enforce visible rebuild across office assist and portals`  
**Ziel**: Bestätigung dass C14vSubpageShell-Eyebrows auf Production sichtbar sind

---

## Ausgangslage

C.14V hat ein visuelles Rebuild der Subpage-Shells durchgeführt:
- **Neue Komponente**: `C14vSubpageShell` — Shared Shell mit Eyebrow, ActionBar, Aurora-Glass
- **18 Screens modifiziert** — Office (5), Assist (6), Portal (3), sowie Detail-Screens
- **Pattern**: Uppercase Eyebrow-Label + ActionBar + Glass-Panel-Content

## C14vSubpageShell — Technisches Pattern

```tsx
<C14vSubpageShell
  title="Screen Title"
  eyebrow="MODUL-LABEL"
  moduleLabel="Office · Klienten"
  accentColor={colors.cyan}
  actions={[...]}
>
  {children}
</C14vSubpageShell>
```

Eyebrow-Rendering: `<Text style={styles.eyebrow}>{eyebrow}</Text>`  
Styling: uppercase, letter-spacing 1.2, font-weight 700, Akzentfarbe

## Prüfumfang pro Bereich

### Office
| Route | Eyebrow erwartet | Screen |
|-------|-----------------|--------|
| `/business/office/clients` | OFFICE / Klienten | ClientsListScreen |
| `/business/office/employees` | OFFICE / Mitarbeiter | EmployeesListScreen |
| `/business/messages` | OFFICE / Nachrichten | OfficeMessagesListScreen |

### Assist
| Route | Eyebrow erwartet | Screen |
|-------|-----------------|--------|
| `/assist/assignments` | ASSIST / Einsätze | AssignmentsListScreen |
| `/assist/nachweise` | ASSIST / Nachweise | LeistungsnachweiseListScreen |
| `/assist/durchfuehrung` | ASSIST / Durchführung | ExecutionsListScreen |

### Portal (Employee)
| Route | Eyebrow erwartet | Screen |
|-------|-----------------|--------|
| `/portal/employee` | MITARBEITER / Portal | EmployeePortalOverviewScreen |
| `/portal/employee/messages` | Nachrichten | PortalMessageDetailScreen |

### Portal (Client)
| Route | Eyebrow erwartet | Screen |
|-------|-----------------|--------|
| `/portal/client` | KLIENT / Portal | ClientPortalOverviewScreen |
| `/portal/client/messages` | Nachrichten | PortalMessageDetailScreen |

## Validierungsmethode

- Playwright (msedge channel, headless) gegen `https://caresuiteplus.app`
- Business-Login → Session-Injection → Route-Navigation
- Text-Analyse auf Eyebrow-Keywords (OFFICE, ASSIST, MITARBEITER, KLIENT)
- Screenshot pro Route

## Script

```
node scripts/audit/contentPortalC14vpProductionRecheckE2e.mjs
```

Relevante Checks im Output:
- `c14v_eyebrow_office` — Office-Bereich Eyebrow sichtbar
- `c14v_eyebrow_assist` — Assist-Bereich Eyebrow sichtbar
- `c14v_eyebrow_portal_employee` — Employee-Portal Eyebrow
- `c14v_eyebrow_portal_client` — Client-Portal Eyebrow
- `c14v_office_employees_shell` — Office Employees Shell

## Ergebnis

| Bereich | Eyebrow | Shell | Status |
|---------|---------|-------|--------|
| Office — Clients | PASS | screenRendered=true | BESTANDEN |
| Office — Employees | PASS | rendered | BESTANDEN |
| Assist — Assignments | PASS | screenRendered=true | BESTANDEN |
| Assist — Nachweise | PASS | proof_list_accessible | BESTANDEN |
| Portal — Employee | PASS | eyebrow_visible | BESTANDEN |
| Portal — Client | PASS | eyebrow_visible | BESTANDEN |

> **Status**: BESTANDEN — 2026-06-24T12:14Z
> Alle C14vSubpageShell-Eyebrows in allen 3 Bereichen (Office/Assist/Portal) auf Production sichtbar.

## Geänderte Dateien (1a45ff4)

### Neue Komponente
- `src/components/layout/C14vSubpageShell.tsx`

### Office (5 Screens)
- `src/screens/office/ClientsListScreen.tsx`
- `src/screens/office/EmployeesListScreen.tsx`
- `src/screens/office/OfficeMessagesListScreen.tsx`
- `src/screens/office/OfficeDocumentsListScreen.tsx`
- `src/screens/business/office/OfficeBusinessSettingsScreen.tsx`

### Assist (6 Screens)
- `src/screens/assist/AssignmentsListScreen.tsx`
- `src/screens/assist/ExecutionsListScreen.tsx`
- `src/screens/assist/TripsListScreen.tsx`
- `src/screens/assist/AssistTourenScreen.tsx`
- `src/screens/assist/AssistSettingsScreen.tsx`
- `src/screens/assist/LeistungsnachweiseListScreen.tsx`

### Portal (6 Screens)
- `src/screens/portal/PortalTabScreen.tsx`
- `src/screens/portal/EmployeePortalOverviewScreen.tsx`
- `src/screens/portal/ClientPortalOverviewScreen.tsx`
- `src/screens/portal/PortalDocumentDetailScreen.tsx`
- `src/screens/portal/PortalMessageDetailScreen.tsx`
- `src/screens/portal/PortalAssignmentDetailScreen.tsx`

## Hard Constraints

- [x] Kein Deploy
- [x] Kein LiveBackfill Apply
- [x] Kein K.6 / Rechnungen
- [x] Keine Secrets
- [x] Read-only Prüfung — keine UI-Änderungen in diesem Lauf
