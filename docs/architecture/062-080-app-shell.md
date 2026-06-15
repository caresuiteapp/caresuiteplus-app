# CareSuite+ — App-Shell & Navigation (Arbeitspakete 062–080)

## Status: Abgeschlossen

Abschnitt 04 liefert die persistente Navigationshülle für Business, Office und Portale.

## Umsetzung

| WP | Thema | Ergebnis |
|----|-------|----------|
| 062 | Routen & Navigationsfluss | Tab-Routen unter `(tabs)/`, Stack für Detail/Create, `+not-found` |
| 063–066 | Dashboard, Listen, Detail, Wizard | Bestehende Screens in Tab-Shell integriert |
| 067–068 | Service & Hooks | `shellConfig.ts`, `useAppShell` |
| 069 | Rollen & Rechte | Guards unverändert in `_layout.tsx`, Tabs rollenunabhängig |
| 070–071 | Supabase & Demo | Shell-Konfiguration aus `APP_ROUTES` + Demo-Produkten |
| 072 | Portal-Sicht | Portal-Tabs via `ShellLayout` statt In-Screen-SegmentedTabs |
| 073–077 | Querschnitt | Portal-Tabs nutzen bestehende Tab-Komponenten |
| 078 | Barrierefreiheit | `accessibilityRole="tab"`, `accessibilityLabel` in `AppTabBar` |
| 079 | Tests | Smoke-Check erweitert |
| 080 | Dokumentation | Dieses Dokument |

## Architektur

```
app/office/_layout.tsx          → Stack + Guards
app/office/(tabs)/_layout.tsx   → ShellLayout + AppTabBar
app/office/clients/[id]/        → Stack-Detail (ohne Tab-Leiste)

app/business/(tabs)/            → Dashboard | Module
app/portal/employee/(tabs)/     → Übersicht | Einsätze | Nachrichten | Dokumente
app/portal/client/(tabs)/       → Übersicht | Termine | Nachrichten | Dokumente
```

## Kern-Dateien

- `src/lib/navigation/shellConfig.ts` — Tab-Definitionen pro Bereich
- `src/components/layout/ShellLayout.tsx` — Tab-Leiste + Modul-Switcher
- `src/components/layout/AppTabBar.tsx` — Premium Bottom Navigation
- `src/components/layout/ModuleSwitcher.tsx` — Modul-Wechsler (Sheet)
- `src/components/layout/BreadcrumbTrail.tsx` — Klickbare Breadcrumbs
- `src/hooks/useAppShell.ts` — Shell-State

## Deep Links

Schema `caresuiteplus://` in `app.json`. Portal- und Office-Pfade unverändert kompatibel.
