import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Platform, PanResponder, StyleSheet, Text, View } from 'react-native';
import {
  pointerToCanvasPoint,
  readCanvasCoordinateSpace,
  readPointerOffset,
} from '@/components/inputs/signatureCanvasCoords';
import { PremiumButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type Point = { x: number; y: number };

const COMPACT_WIDTH = 320;
const COMPACT_HEIGHT = 120;
const STROKE_WIDTH_COMPACT = 2;
const STROKE_WIDTH_LARGE = 3.5;

type Props = {
  label?: string;
  onConfirm: (dataUrl: string) => void;
  onClear?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  size?: 'compact' | 'large';
  width?: number;
  height?: number;
  showLabel?: boolean;
};

function resolveDimensions(size: 'compact' | 'large', width?: number, height?: number) {
  if (size === 'large') {
    return {
      width: width ?? 600,
      height: height ?? 320,
    };
  }
  return { width: COMPACT_WIDTH, height: COMPACT_HEIGHT };
}

function pointsToSvgDataUrl(strokes: Point[][], width: number, height: number): string {
  const paths = strokes
    .map((stroke) => {
      if (stroke.length < 2) return '';
      const d = stroke.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      return `<path d="${d}" fill="none" stroke="#111" stroke-width="${STROKE_WIDTH_LARGE}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths}</svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function WebSignatureCanvas({
  label,
  onConfirm,
  onClear,
  onCancel,
  disabled,
  size = 'compact',
  width: widthProp,
  height: heightProp,
  showLabel = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);
  const dims = resolveDimensions(size, widthProp, heightProp);
  const strokeWidth = size === 'large' ? STROKE_WIDTH_LARGE : STROKE_WIDTH_COMPACT;
  const fillWidth = size === 'large' && widthProp == null;

  const syncCanvasToDisplay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    const bufferW = Math.round(cssW * dpr);
    const bufferH = Math.round(cssH * dpr);

    if (canvas.width !== bufferW || canvas.height !== bufferH) {
      canvas.width = bufferW;
      canvas.height = bufferH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = strokeWidth;
  }, [strokeWidth]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return;

    syncCanvasToDisplay();

    const observer = new ResizeObserver(() => {
      syncCanvasToDisplay();
    });
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [syncCanvasToDisplay, dims.width, dims.height, fillWidth]);

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

  const handleClear = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      const { drawWidth, drawHeight } = readCanvasCoordinateSpace(canvas);
      ctx.clearRect(0, 0, drawWidth, drawHeight);
    }
    setHasStroke(false);
    onClear?.();
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    onConfirm(canvas.toDataURL('image/png'));
  };

  const drawAt = (offsetX: number, offsetY: number, start: boolean) => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const space = readCanvasCoordinateSpace(canvas);
    if (space.displayWidth <= 0 || space.displayHeight <= 0) return;

    const { x, y } = pointerToCanvasPoint(offsetX, offsetY, space);

    if (start) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasStroke(true);
    }
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { offsetX, offsetY } = readPointerOffset(e);
    drawAt(offsetX, offsetY, true);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const { offsetX, offsetY } = readPointerOffset(e);
    drawAt(offsetX, offsetY, false);
  };

  const endStroke = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drawing.current) {
      drawing.current = false;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const hostStyle = fillWidth
    ? { width: '100%' as const, height: dims.height }
    : { width: dims.width, maxWidth: '100%' as const, height: dims.height };

  return (
    <View style={styles.wrap}>
      {showLabel && label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.canvasHost, styles.canvasHostBorder, hostStyle]}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            touchAction: 'none',
            display: 'block',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
      </View>
      <View style={styles.actions}>
        <PremiumButton title="Löschen" variant="ghost" onPress={handleClear} disabled={disabled} />
        {onCancel ? (
          <PremiumButton title="Abbrechen" variant="secondary" onPress={onCancel} disabled={disabled} />
        ) : null}
        <PremiumButton
          title="Unterschrift bestätigen"
          variant="primary"
          onPress={handleConfirm}
          disabled={disabled || !hasStroke}
        />
      </View>
    </View>
  );
}

function NativeSignatureCanvas({
  label,
  onConfirm,
  onClear,
  onCancel,
  disabled,
  size = 'compact',
  width: widthProp,
  height: heightProp,
  showLabel = true,
}: Props) {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [current, setCurrent] = useState<Point[]>([]);
  const dims = resolveDimensions(size, widthProp, heightProp);
  const dotSize = size === 'large' ? 3 : 2;

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setCurrent([{ x: locationX, y: locationY }]);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setCurrent((prev) => [...prev, { x: locationX, y: locationY }]);
    },
    onPanResponderRelease: () => {
      setStrokes((prev) => (current.length > 1 ? [...prev, current] : prev));
      setCurrent([]);
    },
  });

  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrent([]);
    onClear?.();
  }, [onClear]);

  const handleConfirm = useCallback(() => {
    if (strokes.length === 0) return;
    onConfirm(pointsToSvgDataUrl(strokes, dims.width, dims.height));
  }, [onConfirm, strokes, dims.width, dims.height]);

  const allPoints = [...strokes, current];
  const hasStroke = strokes.length > 0;

  return (
    <View style={styles.wrap}>
      {showLabel && label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.canvasWrap, { height: dims.height }]} {...pan.panHandlers}>
        {allPoints.map((stroke, si) =>
          stroke.map((p, pi) =>
            pi > 0 ? (
              <View
                key={`${si}-${pi}`}
                style={[styles.dot, { left: p.x - dotSize / 2, top: p.y - dotSize / 2, width: dotSize, height: dotSize, borderRadius: dotSize / 2 }]}
              />
            ) : null,
          ),
        )}
      </View>
      <View style={styles.actions}>
        <PremiumButton title="Löschen" variant="ghost" onPress={handleClear} disabled={disabled} />
        {onCancel ? (
          <PremiumButton title="Abbrechen" variant="secondary" onPress={onCancel} disabled={disabled} />
        ) : null}
        <PremiumButton
          title="Unterschrift bestätigen"
          variant="primary"
          onPress={handleConfirm}
          disabled={disabled || !hasStroke}
        />
      </View>
    </View>
  );
}

export function CareSignatureCanvas(props: Props) {
  if (Platform.OS === 'web') {
    return <WebSignatureCanvas {...props} />;
  }
  return <NativeSignatureCanvas {...props} />;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, width: '100%' },
  label: { ...typography.body, fontWeight: '600' },
  canvasHost: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  canvasHostBorder: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  canvasWrap: {
    height: COMPACT_HEIGHT,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  dot: {
    position: 'absolute',
    backgroundColor: '#111',
  },
});
