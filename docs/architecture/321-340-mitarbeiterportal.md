# CareSuite+ — Mitarbeiterportal (WP 321–340)

## Umfang

Vertiefung des Mitarbeiterportals mit Detailansichten, Profil/Zeiterfassung und Portal-Berechtigungen.

## Funktionen

| Bereich | Feature |
|---------|---------|
| Einsätze | Liste → Detail mit Aufgaben, Klient:innen-Kontakt, Link zur Assist-Durchführung |
| Nachrichten | Liste → Detail, automatisch als gelesen markieren, Antwort senden (Demo) |
| Dokumente | Liste → Detail mit Metadaten, Download-Aktion (Demo) |
| Profil | Neuer Tab: Stammdaten, KPIs (Soll/Ist-Stunden), Zeiterfassung |

## Berechtigungen

- `portal.employee.appointments.view`
- `portal.employee.messages.view` / `.reply`
- `portal.employee.documents.view` / `.download`
- `portal.employee.profile.view`
- `portal.employee.timesheet.view`

Rolle `employee_portal` erhält alle Portal-Rechte.

## Architektur

```
app/portal/employee/(tabs)/*     → Listen-Tabs
app/portal/employee/*/ [id]      → Stack-Details
src/lib/portal/*Service.ts       → Demo-Services + enforcePermission
src/hooks/usePortal*Detail.ts    → AsyncQuery + Mutation
```

## Demo-Zugang

Login: `/auth/employee-login` → Profil `Sandra Meier` (`employee-003`)
