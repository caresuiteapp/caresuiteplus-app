export const CARESUITE_LOADER_STYLE_ID = 'caresuite-loading-indicator-keyframes';

export const careSuiteLoaderAnimationCss = `
@keyframes caresuite-loader-gradient-flow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

@keyframes caresuite-loader-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.012); }
}

@keyframes caresuite-loader-shimmer {
  0% { transform: translateX(-120%); opacity: 0; }
  12% { opacity: 0.85; }
  50% { opacity: 0.95; }
  88% { opacity: 0.85; }
  100% { transform: translateX(120%); opacity: 0; }
}

@keyframes caresuite-loader-dot {
  0%, 72%, 100% {
    opacity: 0.32;
    transform: scale(0.88);
  }
  36% {
    opacity: 1;
    transform: scale(1.08);
  }
}
`;

export const CARESUITE_LOADER_GRADIENT =
  'linear-gradient(90deg, #5B9CFF 0%, #48D2F2 22%, #6E88FF 46%, #A878FF 72%, #F08AD0 100%)';

export const CARESUITE_LOADER_DOT_COLORS = ['#5B9CFF', '#6E88FF', '#C080F0'] as const;
