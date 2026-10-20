import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import type { MindMapNode } from '@/lib/office/notes/types.web';

type Props = { nodes: MindMapNode[]; onChange: (nodes: MindMapNode[]) => void; disabled?: boolean };
const WIDTH = 1000, HEIGHT = 600, MAX_NODES = 80;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const fit = (x: number, y: number) => ({ x: clamp(x, 90, WIDTH - 90), y: clamp(y, 42, HEIGHT - 42) });

export function MindMapEditor({ nodes, onChange, disabled = false }: Props) {
  const id = useId();
  const [selectedId, setSelectedId] = useState<string | null>(nodes[0]?.id ?? null);
  const [notice, setNotice] = useState('');
  const board = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const selected = nodes.find(node => node.id === selectedId);
  useEffect(() => { if (!nodes.some(node => node.id === selectedId)) setSelectedId(nodes[0]?.id ?? null); }, [nodes, selectedId]);
  useEffect(() => { if (disabled) drag.current = null; }, [disabled]);
  const changeNode = (id: string, patch: Partial<MindMapNode>) => {
    if (!disabled) onChange(nodes.map(node => node.id === id ? { ...node, ...patch } : node));
  };
  function add(parentId: string | null) {
    if (disabled) return;
    if (nodes.length >= MAX_NODES) { setNotice('Eine Mindmap kann höchstens 80 Themen enthalten.'); return; }
    const parent = nodes.find(node => node.id === parentId);
    const count = nodes.filter(node => node.parentId === parentId).length;
    const point = parent ? fit(parent.x + (parent.x < 660 ? 215 : -215), parent.y + (count % 5 - 2) * 92)
      : fit(220 + count % 3 * 280, 150 + Math.floor(count / 3) % 3 * 150);
    const next = { id: crypto.randomUUID(), parentId, text: parent ? 'Neues Unterthema' : 'Neues Hauptthema', ...point };
    onChange([...nodes, next]); setSelectedId(next.id); setNotice('');
  }
  function remove() {
    if (disabled || !selected) return;
    const ids = new Set([selected.id]);
    let added = true;
    while (added) { added = false; for (const node of nodes) if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) { ids.add(node.id); added = true; } }
    const meaningful = nodes.some(node => ids.has(node.id) && node.text.trim());
    if ((meaningful || ids.size > 1) && !window.confirm(`„${selected.text || 'Unbenanntes Thema'}“${ids.size > 1 ? ` mit ${ids.size - 1} Unterthemen` : ''} löschen?`)) return;
    onChange(nodes.filter(node => !ids.has(node.id))); setSelectedId(null); setNotice('');
  }
  function point(event: PointerEvent) {
    const rect = board.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    // The SVG has the same aspect ratio as its viewport, so pointer coordinates remain stable at any width.
    return { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT };
  }
  function start(event: PointerEvent<SVGGElement>, node: MindMapNode) {
    if (disabled || event.isPrimary === false || event.button !== 0) return;
    const current = point(event); if (!current) return;
    setSelectedId(node.id); drag.current = { id: node.id, pointerId: event.pointerId, offsetX: node.x - current.x, offsetY: node.y - current.y };
    try { board.current?.setPointerCapture(event.pointerId); } catch { /* Pointer capture is unavailable in older browsers. */ }
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (disabled || !current || event.pointerId !== current.pointerId) return;
    const position = point(event); if (!position) return;
    changeNode(current.id, fit(position.x + current.offsetX, position.y + current.offsetY));
  }
  function finish(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    try { if (board.current?.hasPointerCapture(event.pointerId)) board.current.releasePointerCapture(event.pointerId); } catch { /* Capture may already be released. */ }
  }
  return <section className="nw-visual-editor" aria-label="Mindmap bearbeiten">
    <div className="nw-visual-toolbar"><div className="nw-visual-actions">
      <button type="button" disabled={disabled || nodes.length >= MAX_NODES} onClick={() => add(null)}>Hauptthema hinzufügen</button>
      <button type="button" disabled={disabled || !selected || nodes.length >= MAX_NODES} onClick={() => add(selected!.id)}>Unterthema hinzufügen</button>
    </div><span>{nodes.length} / {MAX_NODES} Themen</span></div>
    {notice && <p className="nw-visual-notice" role="status">{notice}</p>}
    <div className="nw-mindmap-layout"><div className="nw-visual-board">
      <svg ref={board} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="nw-mindmap-board" role="group" aria-label="Mindmap mit verbundenen Themen"
        onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={() => { drag.current = null; }}>
        <defs><pattern id={`${id}-dots`} x="0" y="0" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#cbded9" /></pattern></defs>
        <rect width={WIDTH} height={HEIGHT} fill={`url(#${id}-dots)`} />
        {nodes.map(node => { const parent = nodes.find(item => item.id === node.parentId); return parent ? <path key={`link-${node.id}`} d={`M ${parent.x} ${parent.y} C ${(parent.x + node.x) / 2} ${parent.y}, ${(parent.x + node.x) / 2} ${node.y}, ${node.x} ${node.y}`} fill="none" stroke="#81b7aa" strokeWidth="2.5" /> : null; })}
        {nodes.map(node => <g key={node.id} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-pressed={node.id === selectedId} aria-label={`Thema auswählen: ${node.text || 'Unbenanntes Thema'}`}
          className="nw-mindmap-node" data-selected={node.id === selectedId} transform={`translate(${node.x},${node.y})`}
          onClick={() => { if (!disabled) setSelectedId(node.id); }} onPointerDown={event => start(event, node)}
          onKeyDown={event => { if (disabled) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(node.id); } if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); setSelectedId(node.id); const step = event.shiftKey ? 30 : 10; changeNode(node.id, fit(node.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), node.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0))); } }}>
          <rect x="-80" y="-32" width="160" height="64" rx="16" />
          <text textAnchor="middle" y={node.text.length > 20 ? -4 : 5}><tspan x="0">{node.text.slice(0, 20) || 'Unbenanntes Thema'}</tspan>{node.text.length > 20 && <tspan x="0" dy="19">{node.text.slice(20, 39)}{node.text.length > 39 ? '…' : ''}</tspan>}</text>
          <title>{node.text || 'Unbenanntes Thema'}</title>
        </g>)}
        {!nodes.length && <text x="500" y="300" textAnchor="middle" className="nw-board-hint">Mit einem Hauptthema beginnen</text>}
      </svg>
    </div><div className="nw-mindmap-inspector">
      {selected ? <><label>Ausgewähltes Thema<textarea aria-label="Text des ausgewählten Themas" value={selected.text} maxLength={500} rows={3} disabled={disabled} onChange={event => changeNode(selected.id, { text: event.target.value })} /></label>
        <p>{selected.parentId ? `Verbunden mit: ${nodes.find(node => node.id === selected.parentId)?.text || 'Übergeordnetes Thema'}` : 'Hauptthema ohne übergeordnete Verbindung'}</p>
        <div className="nw-position-controls" aria-label="Thema verschieben">{[['links', -20, 0, '←'], ['oben', 0, -20, '↑'], ['unten', 0, 20, '↓'], ['rechts', 20, 0, '→']].map(([direction, x, y, symbol]) => <button key={direction} type="button" aria-label={`Thema nach ${direction} verschieben`} disabled={disabled} onClick={() => changeNode(selected.id, fit(selected.x + Number(x), selected.y + Number(y)))}>{symbol}</button>)}</div>
        <button type="button" className="nw-visual-danger" disabled={disabled} onClick={remove}>Thema löschen</button></> : <p>Ein Thema auswählen, um Text und Position zu bearbeiten.</p>}
      <small>Themen ziehen oder mit den Pfeiltasten verschieben. Neue Unterthemen werden mit dem ausgewählten Thema verbunden.</small>
    </div></div>
  </section>;
}
