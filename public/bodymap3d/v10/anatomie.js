"use strict";

const pelvicViews = {
  male: { name: "Genitalien", zones: [
    ["Penisschaft", 47, 46, 22, 42], ["Eichel", 47, 63, 74, 61],
    ["Harnröhrenöffnung", 46.6, 68, 25, 73, "Katheterstelle"], ["Hodensack", 60.5, 53, 78, 44],
  ] },
  female: { name: "Vulva", zones: [
    ["Äußere Schamlippen", 37, 48, 22, 47], ["Innere Schamlippen", 57.5, 52, 80, 52],
    ["Harnröhrenöffnung", 50, 45.1, 75, 36, "Katheterstelle"], ["Scheideneingang", 50, 57, 25, 67],
    ["Klitorisvorhaut", 50, 36.7, 25, 29],
  ] },
  perineum: { name: "Damm und After", zones: [
    ["Damm", 50, 44, 24, 39], ["After", 50, 58, 76, 52], ["Perianalbereich", 57, 60, 79, 69],
  ] },
  buttocks: { name: "Gesäß", zones: [
    ["Steißbein", 50, 27, 50, 17], ["Linkes Gesäß", 31, 49, 16, 37],
    ["Rechtes Gesäß", 69, 49, 84, 37], ["Gesäßfalte", 50, 49, 50, 74],
  ] },
};

function pelvisDrawing(viewName, zones) {
  const bodyOutline = '<path class="outline" d="M77 55C70 100 41 141 37 203c-3 43 8 99 10 126 21 14 67 12 93-3 9-23 10-51 20-73 10 22 11 51 20 73 26 15 72 17 93 3 2-27 13-83 10-126-4-62-33-103-40-148-56-16-110-16-166 0Z"/>';
  const male = `<path class="detail-contour" d="M72 124c22 18 42 28 63 41m113-41c-20 17-37 24-55 33"/>
    <path class="tissue muted-tissue" d="M140 162c-18 13-27 46-19 62 5 11 19 18 35 18 17 0 34-3 43-17 11-17 4-44-13-59-12-11-33-12-46-4Z"/>
    <path class="detail-contour" d="M182 195c5 11 7 23 2 32"/>
    <path class="tissue" d="M139 143c-13 13-16 37-15 63l1 29c0 20 7 37 24 37 17 0 25-17 25-35l3-52c2-23-1-39-12-47-8-6-19-3-26 5Z"/>
    <path class="tissue pale-tissue" d="M125 234c8-11 35-13 49-1 1 22-10 40-25 40-17 0-24-19-24-39Z"/>
    <path class="detail-contour" d="m149 262-1 5"/>`;
  const female = `<path class="detail-contour" d="M73 128c21 13 39 24 54 42m120-42c-21 13-39 24-54 42"/>
    <path class="tissue" d="M160 120c-34 4-51 43-50 72 1 36 16 64 50 79 34-15 49-43 50-79 1-29-16-68-50-72Z"/>
    <path class="tissue muted-tissue" d="M160 147c-23 0-36 24-35 48 0 25 12 46 35 59 23-13 35-34 35-59 1-24-12-48-35-48Z"/>
    <path class="detail-contour" d="M134 172q-13 32 8 65m44-65q13 32-8 65"/>
    <path class="detail-contour" d="M147 155c3-8 9-14 13-14 5 0 10 6 13 14"/>
    <ellipse cx="160" cy="176" rx="4" ry="5" fill="#456575"/>
    <path class="opening" d="M160 204c8 0 15 9 15 18 0 13-12 19-15 19s-15-6-15-19c0-9 7-18 15-18Z"/>`;
  const perineum = `<path class="detail-contour" stroke-dasharray="5 5" d="M105 110c8 36 20 49 42 62m68-62c-8 36-20 49-42 62"/>
    <path class="tissue pale-tissue" d="M161 135c-17 0-24 15-22 38 2 23-11 35-11 57 0 20 13 36 32 36 20 0 33-16 33-36 0-22-13-34-11-57 2-23-4-38-21-38Z"/>
    <path class="detail-contour" d="M75 195c22 5 39 21 54 36m116-36c-22 5-39 21-54 36"/>
    <ellipse class="opening" cx="160" cy="226" rx="11" ry="9"/>
    <path class="detail-contour" d="M161 243c-1 10 2 26 7 37"/>`;
  const buttocks = `<path class="tissue pale-tissue" d="M88 125c-36 22-43 73-26 102 14 24 41 35 69 29 14-3 22-13 29-24 7 11 15 21 29 24 28 6 55-5 69-29 17-29 10-80-26-102-24-15-53-5-72 10-19-15-48-25-72-10Z"/>
    <path class="detail-contour" d="M160 116c4 27-4 57 0 116m-8-128c5-7 11-7 16 0M81 224c16 15 34 19 47 14m111-14c-16 15-34 19-47 14"/>`;
  const anatomy = bodyOutline + ({
    Genitalien: male, Vulva: female, "Damm und After": perineum, "Gesäß": buttocks,
  }[viewName] || "");
  const connectors = zones.map(({ x, y, bx, by }) => `<path class="leader" d="M${x * 3.2} ${y * 3.9}L${bx * 3.2} ${by * 3.9}"/><circle class="anchor" cx="${x * 3.2}" cy="${y * 3.9}" r="3.6"/>`).join("");
  return `<svg class="diagram" role="img" aria-label="${viewName} als anatomisches Schema" viewBox="0 0 320 390">
    <defs><linearGradient id="torso" x2="100%" y2="100%"><stop stop-color="#ecf6f7"/><stop offset="1" stop-color="#c9e1e4"/></linearGradient></defs>
    ${anatomy}${connectors}
  </svg>`;
}
