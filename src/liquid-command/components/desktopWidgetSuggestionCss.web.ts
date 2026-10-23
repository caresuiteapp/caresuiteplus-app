/** Suggestions share the existing card height; artwork yields to text and actions. */
export const desktopWidgetSuggestionCss = `
  .cs-desktop-suggestion,
  .cs-desktop-suggestion * { box-sizing: border-box; }
  .cs-desktop-suggestion {
    --cs-suggestion-scale: var(--cs-desktop-suggestion-scale, 1);
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    flex: 1 0 auto;
    gap: 4px;
    width: 100%;
    min-width: 0;
    height: var(--cs-desktop-card-height, 216px);
    min-height: min-content;
    padding: 8px 10px;
    border: 1px solid rgba(86, 214, 249, .72);
    border-radius: 18px;
    background: linear-gradient(145deg, rgba(10, 49, 71, .86), rgba(5, 24, 44, .78));
    color: #f3fbff;
    font-family: inherit;
    box-shadow: inset 0 1px 0 rgba(162, 232, 255, .12), 0 5px 18px rgba(0, 19, 41, .18);
    backdrop-filter: blur(20px) saturate(1.1);
    -webkit-backdrop-filter: blur(20px) saturate(1.1);
    transition: border-color 180ms ease, box-shadow 180ms ease;
  }
  .cs-desktop-suggestion-heading {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding-right: 34px;
  }
  .cs-desktop-suggestion-badge {
    align-self: flex-start;
    max-width: 100%;
    padding: 1px 6px;
    border: 1px solid rgba(113, 224, 255, .65);
    border-radius: 20px;
    background: rgba(8, 76, 104, .58);
    color: #9beaff;
    font-size: calc(10px * var(--cs-suggestion-scale));
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .cs-desktop-suggestion-title {
    min-width: 0;
    margin: 0;
    color: #f3fbff;
    font-size: calc(16px * var(--cs-suggestion-scale));
    font-weight: 700;
    line-height: 1.3;
    overflow-wrap: anywhere;
    hyphens: auto;
  }
  .cs-desktop-suggestion-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(40px, .65fr);
    grid-template-rows: minmax(0, 1fr);
    align-items: center;
    gap: 6px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    font-size: calc(12px * var(--cs-suggestion-scale));
    container-type: size;
    container-name: desktop-suggestion-body;
  }
  .cs-desktop-suggestion-description {
    min-width: 0;
    margin: 0;
    color: #c5e7f6;
    font-size: calc(12px * var(--cs-suggestion-scale));
    line-height: 1.35;
    overflow-wrap: anywhere;
    hyphens: auto;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .cs-desktop-suggestion-artwork {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    height: 100%;
    max-height: 80px;
    pointer-events: none;
    transition: transform 180ms ease;
  }
  .cs-desktop-suggestion-actions {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    align-items: stretch;
    gap: 4px;
  }
  .cs-desktop-suggestion button {
    appearance: none;
    max-width: 100%;
    min-width: 0;
    font-family: inherit;
    cursor: pointer;
    overflow-wrap: anywhere;
    transition: background 180ms ease, box-shadow 180ms ease;
  }
  .cs-desktop-suggestion-dismiss {
    position: absolute;
    top: 6px;
    right: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid rgba(113, 224, 255, .48);
    border-radius: 10px;
    background: rgba(5, 24, 44, .8);
    color: #d8f5ff;
    font-size: 23px;
    line-height: 1;
  }
  .cs-desktop-suggestion-accept {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 100%;
    min-height: 36px;
    padding: 5px 4px;
    border: 1px solid #66e5fc;
    border-radius: 12px;
    background: linear-gradient(180deg, #7ce8fb, #3bc9ec);
    color: #06283d;
    font-size: calc(12px * var(--cs-suggestion-scale));
    font-weight: 800;
    line-height: 1.35;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .3), 0 3px 10px rgba(24, 184, 219, .15);
  }
  .cs-desktop-suggestion-accept > span:last-child { min-width: 0; }
  .cs-desktop-suggestion-accept > span:first-child { flex-shrink: 0; }
  .cs-desktop-suggestion-other {
    min-height: 36px;
    padding: 5px 4px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: #c3eafa;
    font-size: calc(11px * var(--cs-suggestion-scale));
    font-weight: 600;
    line-height: 1.4;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  @container desktop-suggestion-body (max-height: 2.75em) {
    .cs-desktop-suggestion-description {
      position: absolute;
      width: 1px;
      height: 1px;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .cs-desktop-suggestion-artwork { grid-column: 1 / -1; }
  }
  .cs-desktop-suggestion button:focus-visible {
    outline: 3px solid #e6faff;
    outline-offset: 3px;
  }
  .cs-desktop-suggestion:focus-within {
    border-color: #a3edff;
    box-shadow: 0 0 0 1px rgba(131, 231, 255, .2), 0 5px 18px rgba(0, 19, 41, .18);
  }
  [data-cs-desktop-widget-grid][data-cs-desktop-has-suggestions="true"] [data-cs-desktop-widget-empty] {
    flex: 1;
  }
  @media (hover: hover) and (pointer: fine) {
    .cs-desktop-suggestion:hover {
      border-color: #a3edff;
      box-shadow: inset 0 1px 0 rgba(162, 232, 255, .16), 0 6px 22px rgba(35, 183, 228, .2);
    }
    .cs-desktop-suggestion:hover .cs-desktop-suggestion-artwork { transform: scale(1.035); }
    .cs-desktop-suggestion-accept:hover { background: linear-gradient(180deg, #a4f1ff, #65dbf4); }
    .cs-desktop-suggestion-other:hover { background: rgba(118, 223, 255, .12); }
    .cs-desktop-suggestion-dismiss:hover { background: rgba(35, 111, 140, .8); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-desktop-suggestion,
    .cs-desktop-suggestion-artwork,
    .cs-desktop-suggestion button { transition: none; }
    .cs-desktop-suggestion:hover .cs-desktop-suggestion-artwork { transform: none; }
  }
`;
