# CareSuite+ — Integrationen (WP 481–500)

## Umfang

Verwaltung externer Anbieter (DATEV, Lexoffice, Azure DI, OpenAI, Twilio) und Outbox-Monitoring.

## Funktionen

| Bereich | Feature |
|---------|---------|
| Integrationen | Liste aller Provider, Detail, Aktivieren/Deaktivieren (Demo) |
| Outbox | Ausgehende E-Mails, SMS, Webhooks — Retry bei Fehler |
| DATEV | Rechnungsdetail → „DATEV-Export (Outbox)“ |

## Routen

- `/business/integrations` — Provider-Liste
- `/business/integrations/[id]` — Detail
- `/business/integrations/outbox` — Outbox-Monitor

## Berechtigungen

- `integrations.view` / `integrations.manage`
- `integrations.outbox.view`
