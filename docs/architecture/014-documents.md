# CareSuite+ — Dokumente (Arbeitspaket 014)

## Ziel

Portal-Dokumente mit Sichtbarkeits-Scopes, Service und Tab-Integration.

## Typen

`src/types/portal/documents.ts`:

- `PortalDocument` — Titel, Dateiname, Kategorie, Größe
- `PortalDocumentCategory` — Pflegeplan, Rechnung, Bericht, Einwilligung

## Service

```typescript
import { fetchPortalDocuments, formatFileSize } from '@/lib/portal';
import { usePortalDocuments } from '@/hooks/usePortalDocuments';
```

## Demo-Daten

7 Dokumente in `src/data/demo/documents.ts` — inkl. `tenant_admin`-Eintrag als Negativtest (nicht im Portal sichtbar).

## Sicherheit

Sensibilitätsstufen (`SensitivityLevel`) werden als Badge angezeigt; hochsensible Dokumente nur bei Freigabe.
