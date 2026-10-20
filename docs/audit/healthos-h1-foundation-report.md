# CareSuite+ HealthOS — H1 Foundation Report

**Stand:** 2026-07-02  
**Phase:** H1 — Design System Foundation  
**Deploy:** nein · **Commit:** ausstehend (Freigabe)

---

## Angelegte Tokens

| Bereich | Datei | Inhalt |
|---------|-------|--------|
| Semantic bridge | `src/components/healthos/tokens/healthosTokens.ts` | Farben via `resolveHealthOSPalette`, Statusfarben, Spacing, Radius, Shadows (`careEffects`), Typography, Z-Index, Breakpoints, Card-/Portal-Dichte |
| Export | `src/components/healthos/tokens/index.ts` | Public token API |

Bestehende Themes (Aurora, Premium, CareLight) **nicht** entfernt — HealthOS ergänzt kompatibel.

---

## Angelegte Foundation-Komponenten

| # | Komponente | Datei | Basis-Wrapper |
|---|------------|-------|---------------|
| 1 | HealthOSPage | `HealthOSPage.tsx` | View / ScrollView + Dichte-Tokens |
| 2 | HealthOSSection | `HealthOSSection.tsx` | `SectionPanel` |
| 3 | HealthOSCard | `HealthOSCard.tsx` | `PremiumCard` |
| 4 | HealthOSMetricCard | `HealthOSMetricCard.tsx` | `PremiumKpiCard` |
| 5 | HealthOSStatusBadge | `HealthOSStatusBadge.tsx` | `PremiumBadge` + Mapping |
| 6 | HealthOSActionButton | `HealthOSActionButton.tsx` | `PremiumButton` (+ danger) |
| 7 | HealthOSAlert | `HealthOSAlert.tsx` | `InfoBanner` |
| 8 | HealthOSEmptyState | `HealthOSEmptyState.tsx` | `EmptyState` |
| 9 | HealthOSLoadingState | `HealthOSLoadingState.tsx` | `LoadingState` |
| 10 | HealthOSErrorState | `HealthOSErrorState.tsx` | `ErrorState` |

Barrel: `src/components/healthos/index.ts`

**Keine** bestehende Produktionsseite umgestellt.

---

## Status-Mapping

| Domain | Datei | Quellen |
|--------|-------|---------|
| Einsatz | `status/healthosStatusMapping.ts` | `ASSIGNMENT_STATUS_LABELS` |
| Budget | ↑ | Lifecycle + Account Labels |
| WFM/Zeit | ↑ | Session + Display Labels (read-only copy) |
| Dokument | ↑ | `LIFECYCLE_STATUS_LABELS` + Portal-Workflow |
| Blocker | ↑ | `AssistExecutionProblemCode` Labels |

API: `resolveHealthOSStatusDisplay(domain, technicalValue)` — **keine** DB-/Persistenz-Änderung.

---

## Bewusst nicht angefasst (rote Zonen)

- `src/features/assistWorkflow/*`
- `finalizeVisit.ts`, Proof, Budget-Transaktionen, WFM-Sync RPC
- Employee Execute, Assist Assignment Detail Workflow
- RLS, Migrationen, Routen (`/office` vs `/business/office`)
- Netlify / Production Bundle
- Live-Menü / Demo-Route (keine Preview-Seite in H1)

---

## Tests

| Test | Datei | Ergebnis |
|------|-------|----------|
| Status-Mapping | `src/__tests__/healthos/healthosStatusMapping.test.ts` | 8 Tests |
| Foundation guard | `src/__tests__/healthos/healthosFoundation.test.ts` | 7+ Tests |
| P0 Regression | bestehende P0.1 Suite | unverändert ausführen |

---

## Risiken

| Risiko | Bewertung | Mitigation |
|--------|-----------|------------|
| Wrapper brechen Theme-Modi | gering | Nutzt bestehende Premium/CareLight-Pfade |
| Status-Mapping drift | mittel | H7 vereinheitlicht; Tests auf Deutsch |
| Versehentlicher Workflow-Import | gering | Foundation-Test verbietet P0-Imports |

---

## Empfehlung H2

**Go für H2 (Shell & Navigation)** nach Commit von H1:

1. `HealthOSShell` als schrittweiser Wrapper für `PlatformShell` / `PortalShellLayout`
2. `HealthOSDesktopSidebar` / `HealthOSMobileBottomNav` — Layout only
3. Weiterhin **keine** Route-Konsolidierung, **keine** Execute/Detail-Touch

**Deploy-Readiness H1:** nein (Dokumentation + Wrapper only; kein `[deploy]` nötig)
