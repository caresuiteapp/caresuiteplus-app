import { useEffect, useRef, useState } from 'react';
import { readMeasurementFrameMessage, type WoundMeasurementFrameProps } from './WoundMeasurementFrame.types';

export function WoundMeasurementFrame({ html, onMeasurement }: WoundMeasurementFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(640);
  useEffect(() => {
    const read = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null') return;
      const message = readMeasurementFrameMessage(event.data);
      if (message?.type === 'height') setHeight(message.value);
      if (message?.type === 'measurement') onMeasurement(message.value);
    };
    window.addEventListener('message', read);
    return () => window.removeEventListener('message', read);
  }, [onMeasurement]);
  return <iframe ref={frame} title="Fotovermessung und Gewebezuordnung" srcDoc={html}
    sandbox="allow-scripts" style={{ width: '100%', height, border: '1px solid #c5d9e7', borderRadius: 12 }} />;
}
