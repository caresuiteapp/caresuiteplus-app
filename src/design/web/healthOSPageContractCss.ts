/**
 * Web fallback for legacy controls rendered inside the canonical HealthOS
 * work surface. Component tokens remain the primary source of truth; these
 * rules prevent old inline light-world colours from making controls unreadable
 * while screens are migrated to the shared page architecture.
 */
export const HEALTHOS_PAGE_CONTRACT_CSS = `
  [data-cs-healthos-page="surface"] {
    color: var(--cs-white);
    isolation: isolate;
  }

  [data-cs-healthos-page="surface"] input,
  [data-cs-healthos-page="surface"] textarea,
  [data-cs-healthos-page="surface"] select {
    color: #F8F6FF !important;
    caret-color: #69E8FF;
  }

  [data-cs-healthos-page="surface"] input::placeholder,
  [data-cs-healthos-page="surface"] textarea::placeholder {
    color: rgba(248, 246, 255, .62) !important;
    opacity: 1;
  }

  [data-cs-healthos-page="surface"] input:focus,
  [data-cs-healthos-page="surface"] textarea:focus,
  [data-cs-healthos-page="surface"] select:focus {
    border-color: rgba(105,232,255,.78) !important;
    outline: 3px solid rgba(105,232,255,.14);
    outline-offset: 1px;
  }

  [data-cs-healthos-zone="actions"],
  [data-cs-healthos-zone="filters"],
  [data-cs-healthos-zone="tabs"] {
    width: 100%;
  }

  [data-cs-healthos-page="surface"] [role="tab"],
  [data-cs-healthos-page="surface"] [role="button"] {
    min-height: 40px;
  }
`;
