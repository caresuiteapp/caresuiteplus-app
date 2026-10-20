# CareSuite+ — Detailansicht (Arbeitspaket 005)

## Route

| Pfad | Screen |
|------|--------|
| `/office/clients/[id]` | `ClientDetailScreen` |

## Funktionsumfang

- **Tabs:** Übersicht, Verlauf, Freigaben, Aktionen (`SegmentedTabs`)
- **Übersicht:** Status-Hinweis, Kontextkarten (Einsätze, Dokumente, Rechnungen, Termine), Stammdaten, Kontakte
- **Verlauf:** Timeline + Audit-Einträge
- **Freigaben:** Portal-Consents mit Sichtbarkeits-Scope
- **Aktionen:** Erlaubte Statusübergänge mit Demo-Persistenz

## Datenfluss

```
ClientDetailScreen
  → useClientDetail(id)
    → fetchClientDetail() / updateClientStatus()
      → getDemoClientDetail() / updateDemoClientDetail()
```

## Typen & Komponenten

- `src/types/detail/index.ts` — `ClientDetail`, `AuditEntry`, `ClientContact`, `ClientConsent`
- `src/components/detail/` — `DetailInfoRow`, `ContextCard`
- `src/components/ui/SegmentedTabs.tsx`
- `src/lib/office/clientDetailService.ts`
- `src/data/demo/clientDetails.ts` — Session-Store inkl. `updateDemoClientDetail()`

## Nächste Schritte

- Bearbeiten-Wizard (WP 006 Create; Edit folgt später)
- Supabase-Anbindung (WP 010+)
