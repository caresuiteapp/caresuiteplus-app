import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ScreensaverBounceSpeed, ScreensaverLogoSize } from '@/lib/screensaver/screensaverTypes';
import { BOUNCE_SPEED_PX_PER_SEC, LOGO_SIZE_PX } from '@/lib/screensaver/screensaverTypes';
import { ScreensaverLogo } from '../ScreensaverLogo';

type ScreensaverLogoBounceProps = {
  logoSize: ScreensaverLogoSize;
  bounceSpeed: ScreensaverBounceSpeed;
  active: boolean;
};

function hashSeed(n: number): number {
  return ((n * 2654435761) >>> 0) % 10000;
}

export function ScreensaverLogoBounce({
  logoSize,
  bounceSpeed,
  active,
}: ScreensaverLogoBounceProps) {
  const hostRef = useRef<View>(null);
  const logoRef = useRef<View>(null);
  const frameRef = useRef<number | null>(null);
  const sizePx = LOGO_SIZE_PX[logoSize];
  const half = sizePx / 2;
  const speed = BOUNCE_SPEED_PX_PER_SEC[bounceSpeed];

  const stateRef = useRef({
    x: 120,
    y: 120,
    vx: 1,
    vy: 0.7,
    w: 800,
    h: 600,
  });

  useEffect(() => {
    if (!active || Platform.OS !== 'web') return undefined;

    const seed = hashSeed(sizePx + speed);
    const angle = (seed / 10000) * Math.PI * 2;
    stateRef.current.vx = Math.cos(angle) * speed;
    stateRef.current.vy = Math.sin(angle) * speed;
    stateRef.current.x = (stateRef.current.w * 0.3 + (seed % 200));
    stateRef.current.y = (stateRef.current.h * 0.25 + (seed % 180));

    const measure = () => {
      const host = hostRef.current as unknown as HTMLElement | null;
      if (!host) return;
      stateRef.current.w = host.clientWidth || 800;
      stateRef.current.h = host.clientHeight || 600;
      stateRef.current.x = Math.min(
        stateRef.current.w - half - 8,
        Math.max(half + 8, stateRef.current.x),
      );
      stateRef.current.y = Math.min(
        stateRef.current.h - half - 8,
        Math.max(half + 8, stateRef.current.y),
      );
    };

    measure();
    window.addEventListener('resize', measure);

    let last = performance.now();
    const tick = (now: number) => {
      frameRef.current = null;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const minX = half + 8;
      const minY = half + 8;
      const maxX = s.w - half - 8;
      const maxY = s.h - half - 8;
      if (s.x <= minX) {
        s.x = minX;
        s.vx = Math.abs(s.vx);
      } else if (s.x >= maxX) {
        s.x = maxX;
        s.vx = -Math.abs(s.vx);
      }
      if (s.y <= minY) {
        s.y = minY;
        s.vy = Math.abs(s.vy);
      } else if (s.y >= maxY) {
        s.y = maxY;
        s.vy = -Math.abs(s.vy);
      }

      const el = logoRef.current as unknown as HTMLElement | null;
      if (el) {
        el.style.transform = `translate3d(${s.x - half}px, ${s.y - half}px, 0)`;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', measure);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [active, half, sizePx, speed]);

  return (
    <View ref={hostRef} style={styles.host} collapsable={false}>
      <View
        ref={logoRef}
        style={[styles.logoWrap, { width: sizePx, height: sizePx }]}
        collapsable={false}
      >
        <ScreensaverLogo size={logoSize} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
  },
  logoWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          willChange: 'transform',
        } as const)
      : null),
  },
});
