import type { ReactNode } from 'react';
import { spaceGlyphGeometry } from './spaceGlyphGeometry.web';

/** Web-only drawing plane. The surrounding shell keeps its requested size,
 * glass treatment and active state; every part of a glyph scales together.
 */
export function SpaceGlyphStage({
  size,
  glyph,
  children,
}: {
  size: number;
  glyph?: string;
  children: ReactNode;
}) {
  const geometry = spaceGlyphGeometry(size, glyph);
  return (
    <span
      aria-hidden="true"
      data-space-glyph-stage={glyph ?? 'module-rail'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width: geometry.drawingSize,
        height: geometry.drawingSize,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        transform: `scale(${geometry.scale})`,
        transformOrigin: 'center',
      }}
    >
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translate(${geometry.offsetX}px, ${geometry.offsetY}px)`,
        }}
      >
        {children}
      </span>
    </span>
  );
}
