import { useEffect, useState } from 'react';

/** Follow the visible browser area when a software keyboard opens; leave pinch zoom alone. */
export function useWebVisualViewport() {
  const [viewport, setViewport] = useState<{ height: number | null; keyboardVisible: boolean }>({ height: null, keyboardVisible: false });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const visual = window.visualViewport;
    let baseline = window.innerHeight;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (visual && Math.abs(visual.scale - 1) > 0.05) return;
        const element = document.activeElement;
        const editing = element instanceof HTMLElement && (element.isContentEditable || element.tagName === 'TEXTAREA' || (element instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'submit', 'range', 'file'].includes(element.type)));
        const height = Math.round(Math.min(window.innerHeight, visual?.height ?? window.innerHeight));
        if (!editing) baseline = window.innerHeight;
        const keyboardVisible = editing && baseline - height > 120;
        setViewport(previous => previous.height === height && previous.keyboardVisible === keyboardVisible ? previous : { height, keyboardVisible });
      });
    };
    const rotate = () => { baseline = window.innerHeight; update(); };
    update();
    visual?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', rotate);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(frame);
      visual?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', rotate);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  return viewport;
}
