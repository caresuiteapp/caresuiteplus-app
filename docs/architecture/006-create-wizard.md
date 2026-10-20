# CareSuite+ — Create/Edit Wizard (Arbeitspaket 006)

## Route

| Pfad | Screen |
|------|--------|
| `/office/clients/create` | `ClientCreateScreen` |

## Wizard-Schritte

1. **Stammdaten** — Vorname, Nachname, Geburtsdatum (optional)
2. **Adresse & Kontakt** — Straße, PLZ, Ort, Telefon, E-Mail
3. **Pflege & Status** — Pflegegrad, Notizen (Startstatus: Entwurf)
4. **Zusammenfassung** — Prüfung + Anlegen

## Validierung

- Schrittweise via `validateClientFormStep()` — deutsche Fehlermeldungen
- Vollständige Prüfung vor Submit
- Doppel-Submit-Schutz (`submitLock` Ref + `submitting` State)

## Datenfluss

```
ClientCreateScreen
  → useClientWizard()
    → createClient(DEMO_TENANT_ID, form)
      → addDemoClient() → Session-Store
```

Nach Erfolg: Weiterleitung zu `/office/clients/[id]`.

## Komponenten

- `src/components/ui/FormStepper.tsx`
- `src/types/forms/clientForm.ts`
- `src/lib/office/clientFormValidation.ts`
- `src/lib/office/clientCreateService.ts`
- `src/hooks/useClientWizard.ts`

## Offen

- Edit-Wizard (`/office/clients/[id]/edit`) — separates Arbeitspaket
