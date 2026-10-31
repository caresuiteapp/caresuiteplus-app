// Generated native presentation from src/components/office/notes/HandwritingEditor.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto,nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSvg,NativeSvgDefs,NativeSvgPattern,NativeSvgPath,NativeSvgRect,NativeSvgCircle} from '@/components/layout/NativeSvgPresentation.native';
import {NativeSection,NativeDiv,NativeButton,NativeSpan,NativeLabel,NativeInput,NativeOutput,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { NoteStroke } from "../../../lib/office/notes/types.native.ts";
type Props = {
    strokes: NoteStroke[];
    onChange: (strokes: NoteStroke[]) => void;
    disabled?: boolean;
};
const WIDTH = 1000, HEIGHT = 600, MAX_STROKES = 500, MAX_POINTS = 30000;
const COLORS = [{ label: 'Dunkelblau', value: '#17384d' }, { label: 'Türkis', value: '#0f766e' }, { label: 'Blau', value: '#1d4ed8' }, { label: 'Rot', value: '#be123c' }, { label: 'Orange', value: '#b45309' }];
const sameStrokes = (first: NoteStroke[], second: NoteStroke[]) => first === second || JSON.stringify(first) === JSON.stringify(second);
const path = (points: NoteStroke['points']) => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ');
export function HandwritingEditor({ strokes, onChange, disabled = false }: Props) {
    const id = useId();
    const board = useRef<SVGSVGElement>(null);
    const active = useRef<{
        stroke: NoteStroke;
        pointerId: number;
    } | null>(null);
    const [preview, setPreview] = useState<NoteStroke | null>(null);
    const [redo, setRedo] = useState<NoteStroke[]>([]);
    const [color, setColor] = useState(COLORS[0].value);
    const [width, setWidth] = useState(4);
    const [notice, setNotice] = useState('');
    const expected = useRef<NoteStroke[] | null>(null);
    const latest = useRef(strokes);
    latest.current = strokes;
    const count = strokes.reduce((total, stroke) => total + stroke.points.length, 0);
    const limited = strokes.length >= MAX_STROKES || count >= MAX_POINTS;
    useEffect(() => {
        if (!expected.current || !sameStrokes(expected.current, strokes)) {
            setRedo([]);
            active.current = null;
            setPreview(null);
        }
        expected.current = null;
    }, [strokes]);
    useEffect(() => { if (disabled) {
        active.current = null;
        setPreview(null);
    } }, [disabled]);
    function commit(next: NoteStroke[]) { expected.current = next; onChange(next); }
    function point(clientX: number, clientY: number, strokeWidth: number): [
        number,
        number
    ] | null {
        const rect = board.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0)
            return null;
        const inset = strokeWidth / 2;
        return [Math.max(inset, Math.min(WIDTH - inset, (clientX - rect.left) / rect.width * WIDTH)), Math.max(inset, Math.min(HEIGHT - inset, (clientY - rect.top) / rect.height * HEIGHT))];
    }
    function start(event: PointerEvent<SVGSVGElement>) {
        if (disabled || active.current || event.button !== 0 || event.isPrimary === false)
            return;
        if (limited) {
            setNotice('Die Zeichnung hat die Grenze von 500 Strichen oder 30.000 Punkten erreicht. Bitte eine weitere Notiz anlegen.');
            return;
        }
        const first = point(event.clientX, event.clientY, width);
        if (!first)
            return;
        const stroke = { id: crypto.randomUUID(), color, width, points: [first] };
        active.current = { pointerId: event.pointerId, stroke };
        setPreview(stroke);
        setNotice('');
        try {
            board.current?.setPointerCapture(event.pointerId);
        }
        catch { /* Older browsers can still draw while the pointer remains on the board. */ }
    }
    function move(event: PointerEvent<SVGSVGElement>) {
        const current = active.current;
        if (disabled || !current || event.pointerId !== current.pointerId)
            return;
        const samples = typeof event.nativeEvent.getCoalescedEvents === 'function' ? event.nativeEvent.getCoalescedEvents() : [];
        const events = samples.length ? samples : [event];
        const points = [...current.stroke.points];
        const remaining = MAX_POINTS - latest.current.reduce((sum, stroke) => sum + stroke.points.length, 0);
        for (const sample of events) {
            if (points.length >= remaining) {
                setNotice('30.000 Punkte erreicht. Dieser Strich wird bis zur Grenze übernommen.');
                break;
            }
            const next = point(sample.clientX, sample.clientY, current.stroke.width);
            if (!next)
                continue;
            const previous = points[points.length - 1];
            if (Math.hypot(next[0] - previous[0], next[1] - previous[1]) >= .8)
                points.push(next);
        }
        current.stroke = { ...current.stroke, points };
        setPreview(current.stroke);
    }
    function finish(event: PointerEvent<SVGSVGElement>, cancelled = false) {
        const current = active.current;
        if (!current || event.pointerId !== current.pointerId)
            return;
        active.current = null;
        setPreview(null);
        if (!disabled && !cancelled) {
            const last = point(event.clientX, event.clientY, current.stroke.width);
            const previous = current.stroke.points[current.stroke.points.length - 1];
            const total = latest.current.reduce((sum, stroke) => sum + stroke.points.length, current.stroke.points.length);
            const completed = last && total < MAX_POINTS && Math.hypot(last[0] - previous[0], last[1] - previous[1]) >= .8
                ? { ...current.stroke, points: [...current.stroke.points, last] } : current.stroke;
            commit([...latest.current, completed]);
            setRedo([]);
        }
        try {
            if (board.current?.hasPointerCapture(event.pointerId))
                board.current.releasePointerCapture(event.pointerId);
        }
        catch { /* Capture may already be released. */ }
    }
    function undo() { if (disabled || !strokes.length || active.current)
        return; setRedo(previous => [...previous, strokes[strokes.length - 1]]); commit(strokes.slice(0, -1)); setNotice(''); }
    function repeat() { if (disabled || !redo.length || active.current || limited)
        return; const next = redo[redo.length - 1]; if (count + next.points.length > MAX_POINTS)
        return; commit([...strokes, next]); setRedo(previous => previous.slice(0, -1)); }
    async function clear() {
        if (disabled || !strokes.length || active.current || !await confirmNativeWorkspaceAction('Die gesamte Zeichnung löschen?'))
            return;
        commit([]);
        setRedo([]);
        setNotice('Zeichnung geleert. Die Änderung wird mit der Notiz gespeichert.');
    }
    return <NativeSection className="nw-visual-editor" aria-label="Handschrift bearbeiten">
    <NativeDiv className="nw-visual-toolbar"><NativeDiv className="nw-pen-controls"><NativeDiv className="nw-pen-colors" aria-label="Stiftfarbe">{COLORS.map(item => <NativeButton key={item.value} type="button" aria-label={`Stiftfarbe ${item.label}`} title={item.label} aria-pressed={color === item.value} disabled={disabled} onClick={() => { if (!disabled)
        setColor(item.value); }} style={{ '--nw-pen-color': item.value } as CSSProperties}><NativeSpan aria-hidden="true">{color === item.value ? '✓' : ''}</NativeSpan></NativeButton>)}</NativeDiv>
      <NativeLabel className="nw-pen-width">Stiftbreite<NativeInput aria-label="Stiftbreite" type="range" min="2" max="10" step="2" value={width} disabled={disabled} onChange={event => { if (!disabled)
        setWidth(Number(event.target.value)); }}/><NativeOutput>{width}</NativeOutput></NativeLabel></NativeDiv>
      <NativeDiv className="nw-visual-actions"><NativeButton type="button" disabled={disabled || !strokes.length || !!preview} onClick={undo}>Rückgängig</NativeButton><NativeButton type="button" disabled={disabled || !redo.length || !!preview || limited} onClick={repeat}>Wiederholen</NativeButton><NativeButton type="button" className="nw-visual-danger" disabled={disabled || !strokes.length || !!preview} onClick={clear}>Zeichnung löschen</NativeButton></NativeDiv>
    </NativeDiv>
    <NativeDiv className="nw-visual-board"><NativeSvg ref={board} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="nw-handwriting-board" role="img" aria-label="Zeichenfläche für handschriftliche Notizen" aria-disabled={disabled} onPointerDown={start} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={() => { active.current = null; setPreview(null); }}>
      <NativeSvgDefs><NativeSvgPattern id={`${id}-lines`} width="1000" height="40" patternUnits="userSpaceOnUse"><NativeSvgPath d="M0 39.5H1000" stroke="#deebe7"/></NativeSvgPattern></NativeSvgDefs><NativeSvgRect width={WIDTH} height={HEIGHT} fill={`url(#${id}-lines)`}/>
      {[...strokes, ...(preview ? [preview] : [])].map(stroke => stroke.points.length === 1 ? <NativeSvgCircle key={stroke.id} cx={stroke.points[0][0]} cy={stroke.points[0][1]} r={stroke.width / 2} fill={stroke.color}/> : <NativeSvgPath key={stroke.id} d={path(stroke.points)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round"/>)}
    </NativeSvg></NativeDiv>
    <NativeDiv className="nw-visual-footnote"><NativeP>Mit Stift, Maus oder Finger schreiben. Zum Scrollen den Bereich außerhalb der Zeichenfläche verwenden.</NativeP><NativeSpan>{strokes.length} / {MAX_STROKES} Striche · {count.toLocaleString('de-DE')} / 30.000 Punkte</NativeSpan></NativeDiv>
    {(notice || limited) && <NativeP className="nw-visual-notice" role="status">{notice || 'Die Zeichnung ist voll. Für weitere Inhalte eine neue Notiz anlegen.'}</NativeP>}
  </NativeSection>;
}
