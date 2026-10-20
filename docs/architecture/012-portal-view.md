# CareSuite+ — Portal-Sicht (Arbeitspaket 012)

## Ziel

Vollständige Portal-UI für Mitarbeiter- und Klient:innenportal mit Tab-Navigation und sichtbarkeitsgefilterten Demo-Daten.

## Tabs

| Tab | Mitarbeiterportal | Klient:innenportal |
|-----|-------------------|---------------------|
| Übersicht | Dashboard-KPIs | Dashboard-KPIs |
| Einsätze/Termine | Einsätze | Termine |
| Nachrichten | Portal-Nachrichten | Portal-Nachrichten |
| Dokumente | Freigegebene Dokumente | Freigegebene Dokumente |

## Sichtbarkeitsfilter

`src/lib/portal/portalVisibility.ts` filtert nach `DataVisibilityScope`:

- Mitarbeiter: `own`, `team`
- Klient:in: `own`, `shared`
- Angehörige:r: nur `shared`

## Dateien

```
src/screens/portal/PortalViewScreen.tsx
src/components/portal/*.tsx
app/portal/client/index.tsx
app/portal/employee/index.tsx
```

## Zustände

Jeder Tab implementiert Loading-, Error- und Empty-States auf Deutsch.
