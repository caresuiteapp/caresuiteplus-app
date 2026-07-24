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

  [data-cs-healthos-page="surface"] *,
  [data-cs-healthos-component="modal"] * {
    box-sizing: border-box;
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
    min-width: 0;
    gap: 12px;
  }

  [data-cs-healthos-page="surface"] [role="tab"],
  [data-cs-healthos-page="surface"] [role="button"] {
    min-height: 40px;
  }

  [data-cs-healthos-component="list-overview"],
  [data-cs-healthos-component="section"] {
    width: 100% !important;
    min-width: 0 !important;
    background: rgba(45, 46, 78, .92) !important;
    border: 1px solid rgba(255,255,255,.22) !important;
    border-radius: 20px !important;
    box-shadow: 0 12px 34px rgba(5,7,22,.24) !important;
  }

  [data-cs-healthos-component="card"],
  [data-cs-healthos-component="interactive-card"],
  [data-cs-healthos-component="kpi-card"],
  [data-cs-healthos-component="module-tile"] {
    min-width: 0;
    background: rgba(53, 54, 88, .76) !important;
    border-color: rgba(255,255,255,.22) !important;
  }

  [data-cs-healthos-component="interactive-card"] {
    cursor: pointer;
  }

  [data-cs-healthos-component="module-tile"] {
    min-height: 104px !important;
    border-radius: 16px !important;
  }

  [data-cs-healthos-component="interactive-card"]:focus-within,
  [data-cs-healthos-component="interactive-card"]:hover {
    border-color: rgba(105,232,255,.74) !important;
    background: rgba(105,232,255,.10) !important;
  }

  [data-cs-healthos-component="button"] {
    flex-shrink: 0;
  }

  [data-cs-healthos-component="filter-chip"],
  [data-cs-healthos-component="tab"],
  [data-cs-healthos-component="filter-select"] {
    min-height: 40px;
  }

  [data-cs-healthos-component="table"] {
    width: 100% !important;
    min-width: 0;
    overflow: hidden;
    border-radius: 16px !important;
    background: rgba(39, 40, 70, .82) !important;
    border: 1px solid rgba(255,255,255,.13) !important;
  }

  [data-cs-healthos-component="modal"] {
    isolation: isolate;
  }

  @media (max-width: 767px) {
    [data-cs-healthos-page="surface"] {
      border-radius: 18px !important;
    }

    [data-cs-healthos-component="list-overview"],
    [data-cs-healthos-component="section"] {
      border-radius: 16px !important;
    }

    [data-cs-healthos-zone="actions"] > *,
    [data-cs-healthos-zone="filters"] > *,
    [data-cs-healthos-zone="tabs"] > * {
      max-width: 100%;
    }
  }
`;
