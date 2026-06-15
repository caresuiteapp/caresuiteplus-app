# CareSuite+ — Hooks & State (Arbeitspaket 008)

## Kern-Hooks (`src/hooks/core/`)

| Hook | Zweck |
|------|-------|
| `useAsyncQuery` | `data`, `loading`, `error`, `refresh`, `setData` (optimistic) |
| `useMutation` | `mutate`, `loading`, `error`, `successMessage`, Doppel-Submit-Schutz |
| `useListState` | Suche, Status-Filter, Sortierung, Pagination |

## Verwendung

- `useClientList` — `useAsyncQuery` + `useListState`
- `useClientDetail` — `useAsyncQuery` + `useMutation` (Statuswechsel mit optimistic `setData`)
- `useClientWizard` — eigener Submit-Lock (Wizard-spezifisch)

## Konventionen

- Hooks kapseln keine UI-Texte außer Success-Messages
- Services liefern `ServiceResult<T>` — Hooks setzen deutsche Fehler in `error`
- Filter/Pagination-State bleibt lokal im Hook, nicht global
