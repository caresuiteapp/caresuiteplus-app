// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MindMapEditor } from '@/components/office/notes/MindMapEditor.web';
import { HandwritingEditor } from '@/components/office/notes/HandwritingEditor.web';
import type { MindMapNode, NoteStroke } from '@/lib/office/notes/types.web';

let root: Root;
let host: HTMLDivElement;

const button = (text: string) => {
  const result = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent?.trim() === text);
  expect(result, `Button: ${text}`).toBeTruthy();
  return result!;
};
const labelled = <T extends Element = HTMLElement>(label: string) => {
  const result = Array.from(host.querySelectorAll<T>('[aria-label]')).find(node => node.getAttribute('aria-label') === label);
  expect(result, `Control: ${label}`).toBeTruthy();
  return result!;
};
const click = async (node: Element) => {
  await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};
const input = async (node: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  await act(async () => {
    const prototype = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const pointer = async (node: Element, type: string, x: number, y: number, pointerId = 7) => {
  await act(async () => {
    node.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: x, clientY: y,
      pointerId, pointerType: 'pen', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    }));
  });
};

function mapEditor(initial: MindMapNode[], disabled = false) {
  let value = structuredClone(initial);
  const onChange = vi.fn((next: MindMapNode[]) => { value = next; render(); });
  const render = () => root.render(<MindMapEditor nodes={value} onChange={onChange} disabled={disabled} />);
  return { render, onChange, value: () => value };
}

function handwritingEditor(initial: NoteStroke[], disabled = false) {
  let value = structuredClone(initial);
  const onChange = vi.fn((next: NoteStroke[]) => { value = next; render(); });
  const render = () => root.render(<HandwritingEditor strokes={value} onChange={onChange} disabled={disabled} />);
  const replace = (next: NoteStroke[]) => { value = structuredClone(next); render(); };
  return { render, replace, onChange, value: () => value };
}

function drawingSurface() {
  const svg = labelled<SVGSVGElement>('Zeichenfläche für handschriftliche Notizen');
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 100, top: 50, width: 500, height: 300, right: 600, bottom: 350, x: 100, y: 50, toJSON: () => ({}),
  });
  return svg;
}

const savedStroke: NoteStroke = { id: 'saved-stroke', color: '#16335A', width: 3, points: [[20, 40], [80, 100], [160, 120]] };

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('mind map editor interactions', () => {
  it('creates linked topics, edits and moves a topic, then reopens the persisted graph', async () => {
    const editor = mapEditor([]);
    await act(async () => editor.render());
    await click(button('Hauptthema hinzufügen'));
    expect(editor.value()).toHaveLength(1);
    const parent = editor.value()[0];
    expect(parent.parentId).toBeNull();
    await input(labelled<HTMLTextAreaElement>('Text des ausgewählten Themas'), 'Teamplanung');
    await click(button('Unterthema hinzufügen'));
    expect(editor.value()).toHaveLength(2);
    const child = editor.value().find(node => node.parentId === parent.id)!;
    expect(child).toBeTruthy();
    await input(labelled<HTMLTextAreaElement>('Text des ausgewählten Themas'), 'Urlaubsvertretung');
    await click(labelled('Thema nach rechts verschieben'));
    const moved = editor.value().find(node => node.id === child.id)!;
    expect(moved.x).toBeGreaterThan(child.x);
    expect(moved.y).toBe(child.y);
    expect(moved.text).toBe('Urlaubsvertretung');
    const persisted = JSON.parse(JSON.stringify(editor.value())) as MindMapNode[];
    await act(async () => root.render(null));
    const reopened = mapEditor(persisted);
    await act(async () => reopened.render());
    await click(labelled('Thema auswählen: Urlaubsvertretung'));
    expect(labelled<HTMLTextAreaElement>('Text des ausgewählten Themas').value).toBe('Urlaubsvertretung');
    expect(reopened.value()).toEqual(persisted);
    expect(reopened.onChange).not.toHaveBeenCalled();
  });

  it('keeps a declined subtree deletion and removes only the selected branch when confirmed', async () => {
    const graph: MindMapNode[] = [
      { id: 'root', parentId: null, text: 'Planung', x: 250, y: 300 },
      { id: 'branch', parentId: 'root', text: 'Personal', x: 500, y: 150 },
      { id: 'leaf', parentId: 'branch', text: 'Vertretung', x: 750, y: 150 },
      { id: 'sibling', parentId: 'root', text: 'Finanzen', x: 500, y: 450 },
    ];
    const editor = mapEditor(graph);
    await act(async () => editor.render());
    await click(labelled('Thema auswählen: Personal'));
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await click(button('Thema löschen'));
    expect(editor.value()).toEqual(graph);
    expect(editor.onChange).not.toHaveBeenCalled();
    await click(button('Thema löschen'));
    expect(editor.value()).toEqual([graph[0], graph[3]]);
    expect(labelled('Thema auswählen: Finanzen')).toBeTruthy();
    expect(host.querySelector('[aria-label="Thema auswählen: Vertretung"]')).toBeNull();
  });

  it('drags only the chosen topic using the active pointer and keeps its relationship', async () => {
    const graph: MindMapNode[] = [
      { id: 'root', parentId: null, text: 'Planung', x: 250, y: 300 },
      { id: 'child', parentId: 'root', text: 'Personal', x: 500, y: 300 },
    ];
    const editor = mapEditor(graph);
    await act(async () => editor.render());
    const svg = labelled<SVGSVGElement>('Mindmap mit verbundenen Themen');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 50, width: 500, height: 300, right: 600, bottom: 350, x: 100, y: 50, toJSON: () => ({}),
    });
    await pointer(labelled('Thema auswählen: Personal'), 'pointerdown', 350, 200);
    await pointer(svg, 'pointermove', 450, 250, 99);
    expect(editor.onChange).not.toHaveBeenCalled();
    await pointer(svg, 'pointermove', 450, 250);
    expect(editor.value()).toEqual([graph[0], { ...graph[1], x: 700, y: 400 }]);
    await pointer(svg, 'pointerup', 450, 250);
    editor.onChange.mockClear();
    await pointer(svg, 'pointermove', 500, 300);
    expect(editor.onChange).not.toHaveBeenCalled();
  });

  it('does not change the graph while disabled', async () => {
    const graph: MindMapNode[] = [{ id: 'root', parentId: null, text: 'Geschützt', x: 300, y: 200 }];
    const editor = mapEditor(graph, true);
    await act(async () => editor.render());
    await click(labelled('Thema auswählen: Geschützt'));
    for (const control of host.querySelectorAll<HTMLButtonElement>('button')) {
      expect(control.disabled).toBe(true);
      await click(control);
    }
    expect(labelled<HTMLTextAreaElement>('Text des ausgewählten Themas').disabled).toBe(true);
    expect(editor.value()).toEqual(graph);
    expect(editor.onChange).not.toHaveBeenCalled();
  });
});

describe('handwriting editor interactions', () => {
  it('keeps saved strokes on parent renders and reopens their coordinates and pen attributes', async () => {
    const editor = handwritingEditor([savedStroke]);
    await act(async () => editor.render());
    await act(async () => editor.replace([savedStroke]));
    expect(editor.value()).toEqual([savedStroke]);
    expect(editor.onChange).not.toHaveBeenCalled();
    const persisted = JSON.parse(JSON.stringify(editor.value())) as NoteStroke[];
    await act(async () => root.render(null));
    const reopened = handwritingEditor(persisted);
    await act(async () => reopened.render());
    expect(reopened.value()).toEqual([savedStroke]);
    const stroke = labelled<SVGSVGElement>('Zeichenfläche für handschriftliche Notizen').querySelector(`[stroke="${savedStroke.color}"]`);
    expect(stroke).toBeTruthy();
    expect(stroke!.getAttribute('stroke-width')).toBe(String(savedStroke.width));
    expect(reopened.onChange).not.toHaveBeenCalled();
  });

  it('scales pen coordinates to the stored drawing size and clamps points outside the sheet', async () => {
    const editor = handwritingEditor([savedStroke]);
    await act(async () => editor.render());
    await click(labelled('Stiftfarbe Türkis'));
    await input(labelled<HTMLInputElement>('Stiftbreite'), '6');
    const svg = drawingSurface();
    await pointer(svg, 'pointerdown', 125, 80);
    await pointer(svg, 'pointermove', 350, 200);
    await pointer(svg, 'pointermove', 650, 400);
    await pointer(svg, 'pointerup', 650, 400);
    expect(editor.value()).toHaveLength(2);
    expect(editor.value()[0]).toEqual(savedStroke);
    const drawn = editor.value()[1];
    expect(drawn.id).toBeTruthy();
    expect(drawn.color).toBe('#0f766e');
    expect(drawn.width).toBe(6);
    expect(drawn.points[0]).toEqual([50, 60]);
    expect(drawn.points).toContainEqual([500, 300]);
    expect(drawn.points).toContainEqual([997, 597]);
    const inset = drawn.width / 2;
    expect(drawn.points.every(([x, y]) => x >= inset && x <= 1000 - inset && y >= inset && y <= 600 - inset)).toBe(true);
  });

  it('undoes and restores the exact stroke and discards redo when a new stroke is drawn', async () => {
    const editor = handwritingEditor([savedStroke]);
    await act(async () => editor.render());
    const svg = drawingSurface();
    await pointer(svg, 'pointerdown', 200, 150);
    await pointer(svg, 'pointermove', 250, 200);
    await pointer(svg, 'pointerup', 250, 200);
    const drawn = structuredClone(editor.value()[1]);
    await click(button('Rückgängig'));
    expect(editor.value()).toEqual([savedStroke]);
    await click(button('Wiederholen'));
    expect(editor.value()).toEqual([savedStroke, drawn]);
    await click(button('Rückgängig'));
    await pointer(svg, 'pointerdown', 300, 200);
    await pointer(svg, 'pointermove', 400, 250);
    await pointer(svg, 'pointerup', 400, 250);
    expect(editor.value()).toHaveLength(2);
    expect(editor.value()[1].points).not.toEqual(drawn.points);
    expect(button('Wiederholen').disabled).toBe(true);
  });

  it('retains the final pen position when pointer-up is beyond the last movement event', async () => {
    const editor = handwritingEditor([]);
    await act(async () => editor.render());
    const svg = drawingSurface();
    await pointer(svg, 'pointerdown', 200, 150);
    await pointer(svg, 'pointermove', 250, 200);
    await pointer(svg, 'pointerup', 350, 250);
    expect(editor.value()).toHaveLength(1);
    expect(editor.value()[0].points).toEqual([[200, 200], [300, 300], [500, 400]]);
    expect(editor.onChange).toHaveBeenCalledTimes(1);
  });

  it('requires confirmation before clearing the drawing', async () => {
    const editor = handwritingEditor([savedStroke]);
    await act(async () => editor.render());
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await click(button('Zeichnung löschen'));
    expect(editor.value()).toEqual([savedStroke]);
    expect(editor.onChange).not.toHaveBeenCalled();
    await click(button('Zeichnung löschen'));
    expect(editor.value()).toEqual([]);
    expect(editor.onChange).toHaveBeenCalledTimes(1);
  });

  it('discards a cancelled pen gesture without changing the saved drawing', async () => {
    const editor = handwritingEditor([savedStroke]);
    await act(async () => editor.render());
    const svg = drawingSurface();
    await pointer(svg, 'pointerdown', 200, 150);
    await pointer(svg, 'pointermove', 250, 200);
    await pointer(svg, 'pointercancel', 250, 200);
    await pointer(svg, 'pointerup', 300, 250);
    expect(editor.value()).toEqual([savedStroke]);
    expect(editor.onChange).not.toHaveBeenCalled();
    expect(button('Rückgängig').disabled).toBe(false);
  });

  it('does not write strokes or allow editing while disabled', async () => {
    const editor = handwritingEditor([savedStroke], true);
    await act(async () => editor.render());
    const svg = drawingSurface();
    await pointer(svg, 'pointerdown', 200, 150);
    await pointer(svg, 'pointermove', 250, 200);
    await pointer(svg, 'pointerup', 250, 200);
    for (const control of host.querySelectorAll<HTMLButtonElement>('button')) {
      expect(control.disabled).toBe(true);
      await click(control);
    }
    expect(labelled<HTMLInputElement>('Stiftbreite').disabled).toBe(true);
    expect(editor.value()).toEqual([savedStroke]);
    expect(editor.onChange).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
