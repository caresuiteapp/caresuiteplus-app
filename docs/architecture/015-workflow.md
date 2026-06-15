# CareSuite+ — Workflow-Engine (Arbeitspaket 015)

## Ziel

Formalisierung der Statusmaschine auf Basis von `clientStatus.ts`.

## API

```typescript
import { validateTransition, getNextActions } from '@/lib/services';

const check = validateTransition('entwurf', 'aktiv'); // { valid: true }
const actions = getNextActions('aktiv'); // [{ targetStatus, label, hint }]
```

## Funktionen

| Funktion | Beschreibung |
|----------|--------------|
| `validateTransition(from, to)` | Prüft Übergang, liefert deutsche Fehlermeldung |
| `getNextActions(status)` | Erlaubte Aktionen mit Label und Hinweis |
| `getStatusTransitions(status)` | Vollständige Transition-Objekte |

## Basis

Übergangsregeln bleiben in `clientStatus.ts` — `workflowEngine.ts` baut darauf auf.
