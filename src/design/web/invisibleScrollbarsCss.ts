/**
 * Web-only CSS: hide scrollbar chrome while keeping scroll/slide behavior
 * (wheel, trackpad, touch, keyboard, drag).
 */
export const INVISIBLE_SCROLLBARS_CSS = `
  html,
  body {
    height: 100%;
    overflow: hidden;
  }
  #root,
  #expo-root {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  * {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  *::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
    background: transparent;
  }
  *::-webkit-scrollbar-thumb,
  *::-webkit-scrollbar-track {
    display: none;
    background: transparent;
  }
`;
