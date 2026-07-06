/**
 * Web-only CSS overrides for thermal / battery performance.
 * Applied via PerformanceProvider on document.documentElement.
 */
export const PERFORMANCE_CSS_STYLE_ID = 'caresuite-perf-1-css';

export const PERFORMANCE_CSS = `
  /* Phase 3 — mobile glass / GPU reduction */
  .performance-mobile .cs-glass-scroll::-webkit-scrollbar-track,
  .performance-mobile .cs-glass-scroll::-webkit-scrollbar-thumb,
  .performance-mobile [data-cs-glass-scroll="true"]::-webkit-scrollbar-track,
  .performance-mobile [data-cs-glass-scroll="true"]::-webkit-scrollbar-thumb {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  .performance-mobile [style*="backdrop-filter"],
  .performance-mobile [style*="backdropFilter"] {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  .performance-tracking-active *,
  .performance-battery-saver * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .performance-tracking-active [class*="aurora"],
  .performance-tracking-active [data-animated-background="true"],
  .performance-battery-saver [class*="aurora"],
  .performance-battery-saver [data-animated-background="true"] {
    animation: none !important;
  }

  .reduce-motion *,
  .disable-heavy-effects * {
    animation: none !important;
    transition: none !important;
  }

  .disable-heavy-effects,
  .disable-heavy-effects * {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    filter: none !important;
  }

  /* Phase 11 — iOS Safari compositor relief */
  .performance-mobile.performance-ios-safari {
    -webkit-transform: translateZ(0);
  }

  .performance-mobile.performance-ios-safari [style*="backdrop-filter"],
  .performance-mobile.performance-ios-safari [style*="backdropFilter"] {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background-color: rgba(255, 255, 255, 0.92) !important;
  }

  html.dark .performance-mobile.performance-ios-safari [style*="backdrop-filter"],
  html.dark .performance-mobile.performance-ios-safari [style*="backdropFilter"] {
    background-color: rgba(15, 23, 42, 0.92) !important;
  }

  .performance-mobile .voice-orb-glow {
    display: none !important;
  }
`;

export const PERFORMANCE_BODY_CLASSES = {
  mobile: 'performance-mobile',
  tracking: 'performance-tracking-active',
  batterySaver: 'performance-battery-saver',
  reducedMotion: 'reduce-motion',
  heavyEffectsOff: 'disable-heavy-effects',
  iosSafari: 'performance-ios-safari',
} as const;

export function ensurePerformanceCssInjected(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PERFORMANCE_CSS_STYLE_ID)) return;
  const tag = document.createElement('style');
  tag.id = PERFORMANCE_CSS_STYLE_ID;
  tag.textContent = PERFORMANCE_CSS;
  document.head.appendChild(tag);
}

export function syncPerformanceBodyClasses(snapshot: {
  isMobile: boolean;
  isIOS: boolean;
  isSafari: boolean;
  prefersReducedMotion: boolean;
  batterySaver: boolean;
  activeTracking: boolean;
  profile: string;
}): void {
  if (typeof document === 'undefined') return;
  ensurePerformanceCssInjected();
  const root = document.documentElement;
  const cls = PERFORMANCE_BODY_CLASSES;

  root.classList.toggle(cls.mobile, snapshot.isMobile);
  root.classList.toggle(cls.tracking, snapshot.activeTracking);
  root.classList.toggle(cls.batterySaver, snapshot.batterySaver || snapshot.profile === 'mobileBatterySaver');
  root.classList.toggle(cls.reducedMotion, snapshot.prefersReducedMotion);
  root.classList.toggle(
    cls.heavyEffectsOff,
    snapshot.isMobile ||
      snapshot.prefersReducedMotion ||
      snapshot.batterySaver ||
      snapshot.activeTracking ||
      snapshot.profile === 'mobileBatterySaver' ||
      snapshot.profile === 'activeTrackingSaver',
  );
  root.classList.toggle(cls.iosSafari, snapshot.isMobile && snapshot.isIOS && snapshot.isSafari);
}
