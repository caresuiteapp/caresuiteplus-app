# CareSuite+ — Nachweise, Signaturen & PDF (WP 281–300)

## Status: Abgeschlossen

## Features

- Tab **Nachweise** (`/assist/nachweise`) — Liste aller Leistungsnachweise
- **Detail** mit Unterschrift und PDF-Export
- **Anlage aus Einsatz** nach Check-out (`Leistungsnachweis anlegen`)
- Demo-PDF als Textvorschau + `demo://` Speicherpfad

## Services

- `careRecordService.ts` — list, detail, create, sign, exportPdf

## Berechtigungen

- `assist.records.view` | `create` | `sign` | `export`
