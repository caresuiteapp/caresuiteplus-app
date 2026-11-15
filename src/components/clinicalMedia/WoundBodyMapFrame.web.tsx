import { useEffect, useRef, useState } from 'react';
import { BODY_MAP_PATH, bodyMapMessage, type WoundBodyMapFrameProps } from './WoundBodyMapFrame.types';

export function WoundBodyMapFrame({ marks, canWrite, figure, onMark }: WoundBodyMapFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(760);
  const context = useRef({ type: 'caresuite-wound-context', marks, canWrite, figure });
  context.current = { type: 'caresuite-wound-context', marks, canWrite, figure };
  const publish = () => frame.current?.contentWindow?.postMessage(context.current, window.location.origin);

  useEffect(() => { publish(); }, [marks, canWrite, figure]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const message = bodyMapMessage(event.data);
      if (message?.type === 'ready') publish();
      if (message?.type === 'height') setHeight(message.height);
      if (message?.type === 'mark' && context.current.canWrite) onMark(message.mark);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onMark]);
  return <iframe ref={frame} src={BODY_MAP_PATH} title="CareSuite Körperkarte" onLoad={publish}
    style={{ width: '100%', height, border: '1px solid #c5d9e7', borderRadius: 14 }} />;
}
