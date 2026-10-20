# CareSuite+ — UI-Komponentenbibliothek (Arbeitspaket 041–060)

## Ziel

Erweiterung der Premium-UI um wiederverwendbare Bausteine für Listen, Profile und Feedback — konsistent mit dem Dark-SaaS-Design aus WP 001 und dem Design-System (WP 021–040).

## Neue Komponenten

| Komponente | Pfad | Verwendung |
|------------|------|------------|
| `PremiumAvatar` | `src/components/ui/PremiumAvatar.tsx` | Initialen/Bild, Größen sm/md/lg, Online-Indikator |
| `PremiumDivider` | `src/components/ui/PremiumDivider.tsx` | Horizontale/vertikale Trenner, optionales Label |
| `PremiumListRow` | `src/components/ui/PremiumListRow.tsx` | Listenzeilen mit Leading/Trailing, Chevron |
| `InfoBanner` | `src/components/ui/InfoBanner.tsx` | Info, Erfolg, Warnung, Fehler — dismissible |

## Katalog

`src/components/ui/catalog.ts` exportiert `COMPONENT_CATALOG`: Metadaten aller UI-Komponenten inkl. Kategorie, Status und Arbeitspaket-Zuordnung.

```typescript
import { COMPONENT_CATALOG, getComponentsByCategory } from '@/components/ui';
```

## Design-System Showcase

Route: `/design-system`

| Datei | Inhalt |
|-------|--------|
| `app/design-system/index.tsx` | Farben, Typografie, Katalog-Übersicht |
| `app/design-system/components.tsx` | Live-Demo der WP 041–060 Komponenten |

Erreichbar über Startseite/Fundament oder direkt via Expo Router.

## Kategorien

- **layout** — SectionPanel, PremiumDivider, PremiumCard
- **input** — PremiumButton, PremiumInput, FilterChip
- **feedback** — StateViews, InfoBanner
- **data-display** — PremiumAvatar, PremiumListRow, PremiumKpiCard, Timeline
- **navigation** — ModuleTile

## Integration in Screens

Typische Kombination in Listenansichten (WP 004):

```
PremiumListRow
  leading={<PremiumAvatar name={client.name} />}
  title={client.name}
  subtitle={client.city}
  trailing={<PremiumBadge label={status} />}
  showChevron
  onPress={() => router.push(`/office/clients/${client.id}`)}
```

InfoBanner für mandantenweite Hinweise (Demo-Modus, Wartung, Fehler).

## Bekannte Grenzen (nach WP 041–060)

- Kein Storybook — Showcase nur über `/design-system`
- Avatar ohne Bild-Upload (nur `imageUri`-Prop)
- ListRow ohne Swipe-Aktionen (→ spätere WPs)
- Keine Accessibility-Audit-Tests (→ QA-WP)
