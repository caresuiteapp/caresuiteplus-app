import { TISSUE_LABELS, woundPlanimetryRuntime, type PhotoPoint, type PhotoScale, type Tissue, type TissueSection } from './woundPlanimetry';

function startMeasurementEditor(math: ReturnType<typeof woundPlanimetryRuntime>, labels: typeof TISSUE_LABELS) {
  const keys = Object.keys(labels).filter(key => key !== 'unassigned') as Tissue[];
  const palette = [[44, 180, 255], [226, 101, 127], [255, 201, 72], [104, 221, 172]];
  const state = {
    tool: 'outline', outline: [] as PhotoPoint[], working: [] as PhotoPoint[],
    reference: [] as PhotoPoint[], sections: [] as TissueSection[],
    sample: null as [number, number, number] | null, pointer: -1,
    cursor: { x: .5, y: .5 }, keyboard: false, ready: false,
  };
  const byId = (id: string) => document.getElementById(id)!;
  const canvas = byId('trace') as HTMLCanvasElement;
  const canvas2d = canvas.getContext('2d', { willReadFrequently: true })!;
  const source = document.createElement('canvas');
  const source2d = source.getContext('2d', { willReadFrequently: true })!;
  const overlay = document.createElement('canvas');
  const overlay2d = overlay.getContext('2d')!;
  const photo = new Image();
  const distance = byId('distance') as HTMLInputElement;
  const tissue = byId('tissue') as HTMLSelectElement;
  const tolerance = byId('tolerance') as HTMLInputElement;
  const save = byId('save') as HTMLButtonElement;
  const accept = byId('accept-colour') as HTMLButtonElement;
  let sourcePixels: ImageData;
  let lastMask: ReturnType<typeof math.segment> = null;
  let lastOutline: PhotoPoint[] | null = null;
  let lastSections: TissueSection[] | null = null;
  let frame = 0;
  let dirty = false;

  function send(message: Record<string, unknown>) {
    const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (data: string) => void } }).ReactNativeWebView;
    if (bridge) bridge.postMessage(JSON.stringify(message));
    else if (window.parent !== window) window.parent.postMessage(message, '*');
  }

  function selectTool(tool: string) {
    state.tool = tool;
    state.working = [];
    state.sample = null;
    state.pointer = -1;
    for (const button of document.querySelectorAll('button[data-tool]')) {
      button.setAttribute('aria-pressed', String((button as HTMLButtonElement).dataset.tool === tool));
    }
    byId('calibration').hidden = tool !== 'scale';
    byId('tissue-controls').hidden = !['region', 'colour'].includes(tool);
    byId('colour-controls').hidden = tool !== 'colour';
    byId('keyboard-finish').hidden = !['outline', 'region'].includes(tool);
    byId('instruction').textContent = {
      outline: 'Fahre den gesamten Wundrand mit Stift, Maus oder Finger ab. Zum Schließen loslassen.',
      scale: 'Setze zwei Punkte auf der Skala im Foto. Gib den tatsächlichen Abstand in Millimetern ein.',
      region: 'Wähle den Gewebetyp und fahre die Fläche innerhalb der Wunde ab.',
      colour: 'Tippe auf eine repräsentative Farbe im Wundbett. Prüfe die Vorschau und bestätige die Zuordnung.',
    }[tool] ?? '';
    byId('status').textContent = '';
    refresh();
  }

  function currentScale(): PhotoScale | undefined {
    const mm = Number(distance.value.trim().replace(',', '.'));
    return state.reference.length === 2 && mm > 0 ? {
      from: state.reference[0], to: state.reference[1], millimetres: mm,
    } : undefined;
  }

  function position(event: PointerEvent): PhotoPoint {
    const rect = canvas.getBoundingClientRect();
    const clamp = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 100000) / 100000;
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  }

  function point(path: PhotoPoint[], p: PhotoPoint) {
    const last = path.at(-1);
    if (last && Math.hypot(last.x - p.x, last.y - p.y) < .0015) return;
    // Keep a detailed contour within the stored shape's bounded point count.
    if (path.length >= 590) path.splice(1, path.length - 1, ...path.slice(1).filter((_, index) => index % 2 === 0));
    path.push(p);
  }

  function addSection(section: TissueSection) {
    if (state.sections.length >= 24) {
      byId('status').textContent = 'Für dieses Foto sind 24 Gewebezuordnungen erreicht. Du kannst die letzte entfernen.';
      return;
    }
    state.sections = [...state.sections, section];
    state.sample = null;
  }

  function finish() {
    if (!state.working.length) return;
    const shape = [...state.working];
    state.working = [];
    if (shape.length > 3 && Math.hypot(shape[0].x - shape.at(-1)!.x, shape[0].y - shape.at(-1)!.y) < .009) shape.pop();
    if (!math.usableContour(shape)) {
      byId('status').textContent = 'Die Kontur braucht eine geschlossene Fläche ohne Kreuzung. Zeichne sie erneut.';
    } else if (state.tool === 'outline') {
      state.outline = shape;
      byId('status').textContent = 'Wundrand erfasst.';
      if (!state.reference.length) selectTool('scale');
    } else if (state.tool === 'region' && state.outline.length) {
      addSection({ tissue: tissue.value as Tissue, shape });
    }
    refresh();
  }

  function selectAt(p: PhotoPoint) {
    if (state.tool === 'scale') {
      state.reference = state.reference.length >= 2 ? [p] : [...state.reference, p];
      byId('status').textContent = state.reference.length === 1 ? 'Erster Referenzpunkt gesetzt.' : 'Zweiter Referenzpunkt gesetzt.';
    } else if (state.tool === 'colour') {
      const { width, height, data } = sourcePixels;
      const i = (Math.min(height - 1, Math.floor(p.y * height)) * width + Math.min(width - 1, Math.floor(p.x * width))) * 4;
      const mask = math.segment(state.outline, [], sourcePixels);
      if (!mask?.mask[i / 4]) {
        byId('status').textContent = 'Wähle einen Punkt innerhalb der Wundkontur.';
        return;
      }
      state.sample = [data[i], data[i + 1], data[i + 2]];
      byId('status').textContent = 'Farbprobe gewählt. Prüfe den markierten Bereich.';
    }
    refresh();
  }

  function outlinePath(points: PhotoPoint[], closed: boolean, color: string, width: number, dotted = false) {
    if (!points.length) return;
    const w = canvas.width, h = canvas.height;
    canvas2d.beginPath();
    for (const [index, p] of points.entries()) {
      if (!index) canvas2d.moveTo(p.x * w, p.y * h);
      else canvas2d.lineTo(p.x * w, p.y * h);
    }
    if (closed) canvas2d.closePath();
    canvas2d.lineWidth = width;
    canvas2d.strokeStyle = color;
    canvas2d.setLineDash(dotted ? [6, 4] : []);
    canvas2d.stroke();
    canvas2d.setLineDash([]);
  }

  function redraw() {
    frame = 0;
    if (!state.ready) return;
    const w = canvas.width, h = canvas.height;
    const contour = state.tool === 'outline' && state.working.length >= 3 ? state.working : state.outline;
    const trace = { width: photo.naturalWidth, height: photo.naturalHeight, outline: contour, scale: currentScale() };
    const result = math.dimensions(trace);
    const cm = result?.centimetres;
    const number = (n: number | undefined, digits = 2) => n == null ? '—' : n.toLocaleString('de-DE', { maximumFractionDigits: digits });
    byId('area').textContent = cm ? number(cm.areaCm2) + ' cm²' : result ? number(result.areaPx2, 0) + ' px²' : '—';
    byId('length').textContent = cm ? number(cm.lengthCm) + ' cm' : result ? number(result.lengthPx, 0) + ' px' : '—';
    byId('width').textContent = cm ? number(cm.widthCm) + ' cm' : result ? number(result.widthPx, 0) + ' px' : '—';
    if (!cm && state.reference.length === 2 && state.outline.length > 2 && currentScale()) {
      byId('scale-state').textContent = 'Die Referenzpunkte liegen zu dicht beieinander. Verwende eine längere Strecke im Bild.';
    } else byId('scale-state').textContent = cm ? 'Maßstab angewendet' : 'Maßstab für cm und cm² erforderlich';

    const base = state.sections;
    let sections = base;
    if (state.tool === 'region' && math.usableContour(state.working)) {
      sections = [...base, { tissue: tissue.value as Tissue, shape: state.working }];
    }
    if (state.tool === 'colour' && state.sample) {
      sections = [...base, { tissue: tissue.value as Tissue, sample: state.sample, tolerance: tolerance.valueAsNumber }];
    }
    if (lastOutline !== contour || lastSections !== sections || dirty) {
      lastOutline = contour;
      lastSections = sections;
      lastMask = contour.length >= 3 ? math.segment(contour, sections, sourcePixels) : null;
      const image = overlay2d.createImageData(w, h);
      if (lastMask && sections.length) {
        for (let i = 0; i < lastMask.mask.length; i++) {
          const code = lastMask.mask[i] - 2;
          if (code < 0) continue;
          const pixel = palette[code];
          image.data.set([pixel[0], pixel[1], pixel[2], 110], i * 4);
        }
      }
      overlay2d.putImageData(image, 0, 0);
    }
    dirty = false;
    canvas2d.drawImage(source, 0, 0);
    canvas2d.drawImage(overlay, 0, 0);
    for (const [points, closed, colour, stroke] of [
      [state.outline, true, '#59e7ff', 2.6],
      [state.reference, false, '#ffdc67', 3],
      [state.working, false, state.tool === 'outline' ? '#59e7ff' : '#ffffff', 2.6],
    ] as const) {
      outlinePath(points, closed, '#162432', stroke + 2);
      outlinePath(points, closed, colour, stroke, points === state.working);
    }
    for (const p of state.reference) {
      canvas2d.beginPath();
      canvas2d.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
      canvas2d.fillStyle = '#ffdc67';
      canvas2d.fill();
      canvas2d.strokeStyle = '#162432';
      canvas2d.lineWidth = 1;
      canvas2d.stroke();
    }
    if (state.keyboard) {
      const { x, y } = state.cursor;
      outlinePath([{ x: x - .013, y }, { x: x + .013, y }], false, 'white', 2);
      outlinePath([{ x, y: y - .013 }, { x, y: y + .013 }], false, 'white', 2);
    }
    for (const key of [...keys, 'unassigned'] as const) {
      byId(key).textContent = lastMask ? number(lastMask.shares[key]) + ' %' : '—';
    }
    accept.disabled = !state.sample || state.sections.length >= 24;
    save.disabled = !cm || !lastMask || state.working.length > 0 || !!state.sample;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool="region"],[data-tool="colour"]')) {
      button.disabled = !state.outline.length;
    }
  }

  function refresh() { if (!frame) frame = requestAnimationFrame(redraw); }

  canvas.addEventListener('pointerdown', event => {
    if (!state.ready || state.pointer >= 0 || event.button !== 0) return;
    state.keyboard = false;
    state.pointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    const p = position(event);
    if (state.tool === 'outline' || state.tool === 'region') state.working = [p];
    else selectAt(p);
    refresh();
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== state.pointer || !state.working.length) return;
    point(state.working, position(event));
    dirty = true;
    refresh();
  });
  canvas.addEventListener('pointerup', event => {
    if (event.pointerId !== state.pointer) return;
    state.pointer = -1;
    finish();
  });
  canvas.addEventListener('pointercancel', () => { state.pointer = -1; state.working = []; refresh(); });
  canvas.addEventListener('keydown', event => {
    if (!state.ready) return;
    const move = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, number[]>)[event.key];
    if (move) {
      event.preventDefault();
      const step = event.shiftKey ? .04 : .007;
      const clamp = (n: number) => Math.min(1, Math.max(0, n));
      state.cursor = { x: clamp(state.cursor.x + step * move[0]), y: clamp(state.cursor.y + step * move[1]) };
      state.keyboard = true;
      refresh();
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      state.keyboard = true;
      if (['outline', 'region'].includes(state.tool)) {
        if (event.key === 'Enter' && state.working.length > 2) finish();
        else point(state.working, state.cursor);
      } else selectAt(state.cursor);
      dirty = true;
      refresh();
    }
  });
  distance.addEventListener('input', refresh);
  tissue.addEventListener('change', refresh);
  tolerance.addEventListener('input', refresh);
  byId('keyboard-finish').addEventListener('click', finish);
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-tool]')) {
    button.addEventListener('click', () => selectTool(button.dataset.tool!));
  }
  accept.addEventListener('click', () => {
    if (state.sample) addSection({ tissue: tissue.value as Tissue, sample: state.sample, tolerance: tolerance.valueAsNumber });
    refresh();
  });
  byId('undo').addEventListener('click', () => {
    if (state.sample) state.sample = null;
    else if (state.working.length) state.working = state.working.slice(0, -1);
    else if (state.sections.length) state.sections = state.sections.slice(0, -1);
    else if (state.reference.length) state.reference = state.reference.slice(0, -1);
    else state.outline = [];
    refresh();
  });
  byId('reset').addEventListener('click', () => {
    state.outline = []; state.reference = []; state.sections = [];
    selectTool('outline');
  });
  save.addEventListener('click', () => {
    const trace = { width: photo.naturalWidth, height: photo.naturalHeight, outline: state.outline, scale: currentScale(), sections: state.sections };
    const cm = math.dimensions(trace)?.centimetres;
    const masked = math.segment(trace.outline, trace.sections, sourcePixels);
    if (!trace.scale || !cm || !masked || state.sample || state.working.length) return;
    send({ type: 'wound-measurement', measurement: { ...trace, ...cm, shares: masked.shares } });
    byId('status').textContent = 'Messwerte übergeben. Speichere sie in der Wundakte.';
  });
  for (const key of keys) {
    const option = document.createElement('option');
    option.value = key; option.textContent = labels[key]; tissue.append(option);
  }
  photo.onload = () => {
    if (photo.naturalWidth > 50000 || photo.naturalHeight > 50000) return;
    const ratio = Math.min(1, 680 / Math.max(photo.naturalWidth, photo.naturalHeight));
    const width = Math.max(2, Math.round(photo.naturalWidth * ratio));
    const height = Math.max(2, Math.round(photo.naturalHeight * ratio));
    for (const target of [canvas, source, overlay]) { target.width = width; target.height = height; }
    canvas.style.aspectRatio = width + '/' + height;
    canvas.style.maxWidth = Math.round(475 * width / height) + 'px';
    source2d.drawImage(photo, 0, 0, width, height);
    sourcePixels = source2d.getImageData(0, 0, width, height);
    state.ready = true;
    canvas.hidden = false;
    selectTool('outline');
  };
  photo.onerror = () => { byId('status').textContent = 'Das Foto lässt sich auf diesem Gerät nicht öffnen.'; };
  photo.src = (byId('source') as HTMLImageElement).src;
  new ResizeObserver(() => send({ type: 'wound-editor-height', height: Math.ceil(document.body.getBoundingClientRect().height) + 4 })).observe(document.body);
}

export function woundMeasurementEditor(imageUrl: string) {
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageUrl)) throw new Error('Ungültiges Fotoformat.');
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>Digitale Wundvermessung</title>
<style>
:root{font:15px/1.42 system-ui,sans-serif;color:#19314a;background:#f1f7fb;color-scheme:light}
*{box-sizing:border-box}body{margin:0;padding:12px} [hidden]{display:none!important}
.bar,.field,.legend{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
button,select,input{font:inherit;color:inherit}button{background:#fff;border:1px solid #bdcedd;border-radius:10px;padding:8px 12px;min-height:40px;font-weight:650;cursor:pointer}
button[aria-pressed=true],#save{background:#0e537a;color:#fff;border-color:#0e537a}
button:disabled{opacity:.48;cursor:default}button:focus-visible,canvas:focus-visible{outline:3px solid #0c7dae;outline-offset:2px}
#instruction,#scale-state{margin:8px 0;color:#344e66} .field{margin:8px 0}input[type=text],select{border:1px solid #bdcedd;border-radius:9px;padding:7px 9px;background:#fff}input[type=text]{width:8em}
figure{margin:10px 0;background:#102c40;border-radius:12px;padding:6px;min-height:48px;display:grid;justify-items:center}
canvas{display:block;width:100%;height:auto;touch-action:none;border-radius:5px;cursor:crosshair}
.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:9px 0}
.metrics div{background:#fff;border:1px solid #d7e4ed;border-radius:9px;padding:7px 10px}dt{color:#465f75;font-size:.82rem}dd{margin:2px 0 0;font-weight:750;overflow-wrap:anywhere}
.legend{gap:6px;margin:10px 0}.legend span{background:#fff;border:1px solid #d7e4ed;border-radius:7px;padding:4px 6px;border-left:4px solid var(--t,#8da1b5);font-size:.83rem}
#status:empty{display:none} #status{margin:8px 0;color:#154867}.help{margin:8px 0;font-size:.82rem;color:#465f75}
@media(max-width:400px){body{padding:8px}button{padding:7px 8px}.metrics div{padding:6px}}
</style>
<body><img hidden id="source" alt="" src="${imageUrl}">
<div class="bar" aria-label="Werkzeuge">
<button type="button" data-tool="outline">Wundrand</button><button type="button" data-tool="scale">Maßstab</button>
<button type="button" data-tool="region" disabled>Gewebe umranden</button><button type="button" data-tool="colour" disabled>Nach Farbe</button>
</div>
<p id="instruction">Foto wird geöffnet …</p>
<div class="field" id="calibration" hidden><label for="distance">Referenzlänge in mm</label><input id="distance" inputmode="decimal" type="text" maxlength="10" placeholder="z. B. 20"></div>
<div class="field" id="tissue-controls" hidden><label for="tissue">Gewebe</label><select id="tissue"></select>
<div class="field" id="colour-controls" hidden><label for="tolerance">Farbtoleranz</label><input id="tolerance" type="range" min="0" max="165" value="36"><button id="accept-colour" type="button" disabled>Farbauswahl übernehmen</button></div></div>
<figure><canvas id="trace" tabindex="0" aria-label="Foto zum Umfahren und Vermessen" aria-describedby="keyboard-help" hidden></canvas></figure>
<p id="keyboard-help" class="help">Mit der Tastatur den Cursor mit Pfeiltasten bewegen. Leertaste setzt einen Punkt, Enter schließt die Kontur.</p>
<dl class="metrics"><div><dt>Fläche</dt><dd id="area">—</dd></div><div><dt>Länge</dt><dd id="length">—</dd></div><div><dt>Breite</dt><dd id="width">—</dd></div></dl>
<div class="legend"><span style="--t:#2cb4ff">Nekrose <b id="necrosis">—</b></span><span style="--t:#e2657f">Granulation <b id="granulation">—</b></span><span style="--t:#ffc948">Fibrin <b id="fibrin">—</b></span><span style="--t:#68ddac">Epithel <b id="epithelium">—</b></span><span>Offen <b id="unassigned">—</b></span></div>
<p id="scale-state"></p>
<div class="bar"><button type="button" id="keyboard-finish" hidden>Kontur schließen</button><button type="button" id="undo">Rückgängig</button><button type="button" id="reset">Neu beginnen</button><button type="button" id="save" disabled>Messwerte übernehmen</button></div>
<p role="status" id="status"></p>
<script>
const woundPlanimetryRuntime = ${woundPlanimetryRuntime.toString()};
const TISSUE_LABELS = ${JSON.stringify(TISSUE_LABELS)};
(${startMeasurementEditor.toString()})(woundPlanimetryRuntime(), TISSUE_LABELS);
</script></body></html>`;
}
