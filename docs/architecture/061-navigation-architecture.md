# CareSuite+ — Navigationsarchitektur (Arbeitspaket 061)

## Ziel

Zentrale Breadcrumb-Generierung und erweiterte Routen-Registry für verschachtelte Bereiche (Office, Portale).

## Breadcrumbs

**Pfad:** `src/lib/navigation/breadcrumbs.ts`  
**Typen:** `src/types/navigation/breadcrumbs.ts`

```typescript
import { getBreadcrumbs, formatBreadcrumbTrail } from '@/lib/navigation';

const trail = getBreadcrumbs('/office/clients/create');
// → Start › Office › Klient:innen › Klient:in anlegen
```

### Algorithmus

1. Pfad normalisieren (Query-String entfernen, trailing slash)
2. Segmente iterieren und kumulative Pfade bilden
3. Label aus `APP_ROUTES` via `getRouteByPath` oder Fallback (`SEGMENT_LABELS`, „Detail“ für UUIDs)
4. Letztes Segment erhält `isCurrent: true`

### Fallback-Labels

| Segment | Label |
|---------|-------|
| `create` | Neu anlegen |
| UUID / lange ID | Detail |
| unbekannt | Kapitalisiertes Segment |

## APP_ROUTES — Portal-Unterrouten

| Portal | Unterrouten |
|--------|-------------|
| `/portal/employee` | `/assignments`, `/documents`, `/messages` |
| `/portal/client` | `/appointments`, `/documents`, `/messages` |

Jede Unterroute ist in `APP_ROUTES` mit `label`, `group: 'portal'` und `allowedRoles` registriert. Screens folgen in späteren WPs.

## APP_ROUTES — Office-Hierarchie

```
/office
  └── /office/clients
        └── /office/clients/create
```

Dynamische Detail-Routen (`/office/clients/[id]`) werden per Prefix-Matching und Breadcrumb-Fallback „Detail“ abgedeckt.

## Integration

Breadcrumbs können in `ScreenHeader` oder `ScreenShell` eingebunden werden:

```typescript
const trail = getBreadcrumbs(pathname);
const subtitle = formatBreadcrumbTrail(trail.slice(0, -1));
```

## Bezug zu WP 002

WP 002 definiert Guards und Redirects. WP 061 ergänzt die **Navigations-Metadaten-Schicht** — keine Änderung an Auth-Guards.

## Bekannte Grenzen (nach WP 061)

- Portal-Unterscreens noch nicht implementiert (nur Routen-Registry)
- Breadcrumb-UI nicht in allen Screens eingebunden
- Keine i18n für Segment-Labels
- Deep-Link-Handling unverändert (→ spätere WPs)
