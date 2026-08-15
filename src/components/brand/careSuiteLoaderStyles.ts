export const CARESUITE_LOADER_STYLE_ID = 'caresuite-healthos-loading-keyframes';

export const careSuiteLoaderAnimationCss = `
@keyframes caresuite-healthos-orbit {
  0% {
    transform: rotate(0deg) scale(0.985);
    filter: drop-shadow(0 0 7px rgba(85, 216, 255, 0.56));
  }
  50% {
    transform: rotate(180deg) scale(1.015);
    filter: drop-shadow(0 0 15px rgba(139, 124, 255, 0.72));
  }
  100% {
    transform: rotate(360deg) scale(0.985);
    filter: drop-shadow(0 0 7px rgba(85, 216, 255, 0.56));
  }
}
`;
