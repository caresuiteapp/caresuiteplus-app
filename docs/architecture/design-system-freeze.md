# Design System Freeze (Prompt 105)

CareSuite+ UI is frozen to central premium components under `@/design/components`.

## Central components

| Component | Use for |
|-----------|---------|
| `AppScreen` | Premium screen shell (space gradient, safe area) |
| `AppHeader` | Screen title + back navigation |
| `AuthLayout` | Login / password flows |
| `RegisterLayout` | Business registration wizard |
| `GlassCard` | Glass panels — cards, form groups |
| `PortalCard` | Start page entry tiles |
| `PremiumButton` | All CTAs — Aurora primary gradient (Purple/Pink) |
| `AuroraPageHeader` / `@/components/aurora` | Gradient headers, glass cards, menu items |
| `ModuleCard` | Module picker / activation |
| `StatusBadge` / `FeatureBadge` | Status chips — never raw keys |
| `InputField` | Auth & registration inputs |
| `SectionHeader` | Section titles in forms |
| `EmptyState` / `ErrorState` / `LoadingState` | Async & empty UI |
| `FooterLinks` | Public footer (legal, demo, version) |

Import from `@/design/components` or `@/design`.

## Deprecated (do not use in new screens)

- Ad-hoc `CareLightCard` on public/auth flows → `PortalCard` / `GlassCard`
- `CareLightPageShell` / `ScreenShell` on auth → `AuthLayout` / `RegisterLayout`
- `PremiumBadge label="preparedOnly"` → `StatusBadge kind="preparedOnly"`
- Inline hex colors when `resolveSemanticTokens()` or `galaxyPalette` exists

## Status mapping

All status labels go through `StatusBadge` or `userFriendlyLabel()`:

- `preparedOnly` → Vorbereitet
- `coming_soon` → Demnächst
- `internal` → Intern (hidden from normal users)
- `beta` → Beta
- `disabled` → Nicht aktiv
- `active` / `live` → Aktiv
- `error` → Fehler
- `warning` → Hinweis
- `required` → Erforderlich

Visibility rules: `getUiVisibilityForRole()` / `getUiVisibilityForWorkspaceRole()`.

## Migrated screens (minimum)

- Start → `AppScreen`, `PortalCard`, `FooterLinks`
- Business / employee / portal login → `AuthLayout`, `InputField`, `PremiumButton`, `GlassCard`
- Registration → `RegisterLayout`, `ModuleCard`
- Forgot password → `AuthLayout`

## Enforcement

- `npm run test -- src/__tests__/ui/designSystemFreeze.test.ts`
- `npm run design:audit`
- `npm run content:audit`
