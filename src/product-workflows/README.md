# Product workflow boundary

Product routes import their existing, tested business workflows through the
`@/product-workflows/*` aliases declared in `tsconfig.json`.

This boundary has one purpose:

- keep repositories, forms, validation, permissions and mutations intact;
- prevent route files from owning a second visual system;
- let `LiquidModuleRouteLayout` and `LiquidPortalRouteLayout` own navigation,
  background, page frame and responsive behavior;
- resolve all compatibility colors, cards and typography to the canonical
  Liquid Command tokens.

No route below `app/` may import `@/screens`, `@/components`, `@/design` or
`@/theme` directly after the Greenfield cutover.
