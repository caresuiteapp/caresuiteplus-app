import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** True when the device supports precise hover (desktop mouse), not touch-primary. */
export function useFinePointerHover(): boolean {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) {
      setCanHover(false);
      return;
    }
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return canHover;
}
