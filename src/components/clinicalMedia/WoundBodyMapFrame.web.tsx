import { useEffect, useRef, useState } from 'react';
import { BODY_MAP_PATH, EMPTY_BODY_MARKS, WOUND_BODY_BRIDGE_VERSION, bodyMapMessage, type WoundBodyMapFrameProps } from './WoundBodyMapFrame.types';

export function WoundBodyMapFrame({ marks = EMPTY_BODY_MARKS, canWrite = false, figure, onMark, view }: WoundBodyMapFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState(view ? 540 : 760);
  const writable = canWrite && view !== 'preview';
  const context = useRef({ type: 'caresuite-wound-context', bridgeVersion: WOUND_BODY_BRIDGE_VERSION, marks, canWrite: writable, figure });
  context.current = { type: 'caresuite-wound-context', bridgeVersion: WOUND_BODY_BRIDGE_VERSION, marks, canWrite: writable, figure };
  const publish = () => frame.current?.contentWindow?.postMessage(context.current, window.location.origin);

  useEffect(() => { publish(); }, [marks, writable, figure]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const message = bodyMapMessage(event.data);
      if (message?.type === 'ready') publish();
      if (message?.type === 'height') setHeight(message.height);
      if (message?.type === 'mark' && context.current.canWrite) onMark?.(message.mark);
      if (message?.type === 'expand') setExpanded(message.open);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onMark]);
  useEffect(() => {
    const node = wrapper.current;
    if (!expanded || !node) return;
    if (typeof node.showPopover === 'function') {
      node.setAttribute('popover', 'manual');
      try { node.showPopover(); } catch { node.removeAttribute('popover'); }
    }
    const bodyScroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      frame.current?.contentWindow?.postMessage({ type: 'caresuite-close-body-expand' }, window.location.origin);
      setExpanded(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    frame.current?.focus();
    return () => {
      document.body.style.overflow = bodyScroll;
      document.removeEventListener('keydown', closeOnEscape);
      if (node.hasAttribute('popover')) { node.hidePopover(); node.removeAttribute('popover'); }
    };
  }, [expanded]);
  return <div ref={wrapper} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined}
    aria-label={expanded ? '3D-Körperkarte im Vollbild' : undefined}
    style={expanded ? { position: 'fixed', inset: 0, zIndex: 2147483000, width: '100vw',
      height: '100dvh', margin: 0, padding: 0, border: 0, maxWidth: 'none', maxHeight: 'none', background: '#f5f8fb' } : { minWidth: 0 }}>
    <iframe ref={frame} src={view ? `${BODY_MAP_PATH}?view=${view}` : BODY_MAP_PATH} allowFullScreen
      title={view === 'location' ? 'Körperstelle in 3D auswählen' : 'CareSuite 3D-Körperkarte'} onLoad={publish}
      style={{ display: 'block', width: '100%', height: expanded ? '100%' : height, border: 0, borderRadius: expanded ? 0 : 12 }} />
  </div>;
}
