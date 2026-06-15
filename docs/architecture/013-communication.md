# CareSuite+ — Kommunikation (Arbeitspaket 013)

## Ziel

Typen, Demo-Daten und Service-Schicht für Portal-Nachrichten und Benachrichtigungen.

## Typen

`src/types/portal/communication.ts`:

- `PortalMessage` — Betreff, Body, Kanal, Richtung, Sichtbarkeit
- `PortalNotification` — Typ, Titel, Aktionsroute

## Service

```typescript
import { fetchPortalMessages } from '@/lib/portal';
import { useMessages } from '@/hooks/useMessages';
```

## Demo-Daten

6 Nachrichten in `src/data/demo/messages.ts` mit Abdeckung aller Sichtbarkeitsstufen.

## Hook

`useMessages` — lädt gefilterte Nachrichten, liefert `unreadCount`, Refresh und Zustände.
