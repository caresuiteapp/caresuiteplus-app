import { useEffect, useRef, useState } from 'react';
import { BODY_MAP_PATH, EMPTY_BODY_MARKS, bodyMapMessage, type WoundBodyMapFrameProps } from './WoundBodyMapFrame.types';

export function WoundBodyMapFrame({ marks = EMPTY_BODY_MARKS, canWrite = false, figure, onMark, view }: WoundBodyMapFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(view ? 540 : 760);
  const writable = canWrite && view !== 'preview';
  const context = useRef({ type: 'caresuite-wound-context', marks, canWrite: writable, figure });
  context.current = { type: 'caresuite-wound-context', marks, canWrite: writable, figure };
  const publish = () => frame.current?.contentWindow?.postMessage(context.current, window.location.origin);

  useEffect(() => { publish(); }, [marks, writable, figure]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const message = bodyMapMessage(event.data);
      if (message?.type === 'ready') publish();
      if (message?.type === 'height') setHeight(message.height);
      if (message?.type === 'mark' && context.current.canWrite) onMark?.(message.mark);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onMark]);
  return <iframe ref={frame} src={view ? `${BODY_MAP_PATH}?view=${view}` : BODY_MAP_PATH}
    title={view === 'location' ? 'Körperstelle in 3D auswählen' : 'CareSuite 3D-Körperkarte'} onLoad={publish}
    style={{ display: 'block', width: '100%', height, border: 0, borderRadius: 12 }} />;
}
