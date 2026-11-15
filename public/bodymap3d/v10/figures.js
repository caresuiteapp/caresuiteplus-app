"use strict";

window.figureGeometry = Object.create(null);
const approvedFigures = new Set(["older-man","older-woman","adult-man","adult-woman","boy","girl"]);
const pendingFigures = new Map();
async function loadCareFigure(key) {
  if (!approvedFigures.has(key)) throw Error("Unbekannte Figur");
  if (window.figureGeometry[key]) return;
  if (!pendingFigures.has(key)) {
    pendingFigures.set(key, (async () => {
      const response = await fetch(key + ".json.gz");
      if (!response.ok) throw Error("Figur nicht verfügbar");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const text = bytes[0] === 0x1f && bytes[1] === 0x8b
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
        : new TextDecoder().decode(bytes);
      window.figureGeometry[key] = JSON.parse(text);
    })());
  }
  try { await pendingFigures.get(key); }
  finally { pendingFigures.delete(key); }
}
