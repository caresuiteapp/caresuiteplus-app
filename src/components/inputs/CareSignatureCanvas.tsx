import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumButton } from '@/components/ui';
import {
  clientToCanvasPoint,
  readCanvasCoordinateSpace,
  scaleCanvasPoints,
  type CanvasCoordinateSpace,
} from '@/components/inputs/signatureCanvasCoords';
import { exportSignatureCanvasPng } from '@/lib/signatures/normalizeSignatureCapture';
import { legacyColorsFromPalette } from '@/design/tokens/themeBridge';
import { resolveCareTypography } from '@/design/tokens/typography';
import { useOrientation } from '@/hooks/useOrientation';
import { spacing } from '@/theme';

type Point = { x: number; y: number };

const COMPACT_WIDTH = 320;
const COMPACT_HEIGHT = 120;
const STROKE_WIDTH_COMPACT = 2;
const STROKE_WIDTH_LARGE = 3.5;
const DEFAULT_LARGE_WIDTH = 600;
const DEFAULT_LARGE_HEIGHT = 320;

const FALLBACK_TYPOGRAPHY = resolveCareTypography('dark');
const FALLBACK_COLORS = legacyColorsFromPalette('dark');

function useSignatureCanvasStyles(fillAvailable: boolean, actionLayout: 'default' | 'bar') {
  return useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          gap: fillAvailable && actionLayout === 'bar' ? spacing.xs : spacing.sm,
          ...(fillAvailable
            ? { flex: 1, minHeight: 0, flexDirection: 'column' as const }
            : null),
        },
        label: { ...FALLBACK_TYPOGRAPHY.body, fontWeight: '600' },
        canvasWrap: {
          height: COMPACT_HEIGHT,
          borderWidth: 1,
          borderColor: FALLBACK_COLORS.borderSoft,
          borderRadius: fillAvailable ? 0 : 8,
          backgroundColor: '#fff',
          overflow: 'hidden',
          ...(fillAvailable
            ? {
                flex: 1,
                height: undefined,
                minHeight: 0,
                alignSelf: 'stretch',
              }
            : null),
        },
        actions: {
          flexDirection: 'row',
          gap: spacing.sm,
          flexWrap: actionLayout === 'bar' ? 'nowrap' : 'wrap',
          alignItems: 'center',
          flexShrink: 0,
          ...Platform.select({
            web: { touchAction: 'manipulation' as const },
            default: {},
          }),
        },
        actionsBar: {
          paddingTop: spacing.xs,
        },
        confirmBar: {
          flex: 1,
          minWidth: 0,
        },
        dot: {
          position: 'absolute',
          backgroundColor: '#111',
        },
      }),
    [actionLayout, fillAvailable],
  );
}

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
  fillAvailable?: boolean;
  actionLayout?: 'default' | 'bar';
};

function resolveDimensions(
  size: 'compact' | 'large',
  width?: number,
  height?: number,
  measured?: { width: number; height: number },
) {
  if (measured && measured.width > 0 && measured.height > 0) {
    return measured;
  }
  if (size === 'large') {
    return {
      width: width ?? DEFAULT_LARGE_WIDTH,
      height: height ?? DEFAULT_LARGE_HEIGHT,
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

function SignatureActions({
  actionLayout,
  styles,
  disabled,
  hasStroke,
  onClear,
  onCancel,
  onConfirm,
  safeBottom = 0,
}: {
  actionLayout: 'default' | 'bar';
  styles: ReturnType<typeof useSignatureCanvasStyles>;
  disabled?: boolean;
  hasStroke: boolean;
  onClear: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  safeBottom?: number;
}) {
  const confirmButton = (
    <PremiumButton
      title="Unterschrift bestätigen"
      variant="primary"
      onPress={onConfirm}
      disabled={disabled || !hasStroke}
      testID="portal-signature-confirm-button"
      style={actionLayout === 'bar' ? styles.confirmBar : undefined}
    />
  );

  if (actionLayout === 'bar') {
    return (
      <View style={[styles.actions, styles.actionsBar, { paddingBottom: Math.max(spacing.sm, safeBottom) }]}>
        <PremiumButton title="Löschen" variant="ghost" onPress={onClear} disabled={disabled} />
        {onCancel ? (
          <PremiumButton title="Abbrechen" variant="secondary" onPress={onCancel} disabled={disabled} />
        ) : null}
        {confirmButton}
      </View>
    );
  }

  return (
    <View style={styles.actions}>
      <PremiumButton title="Löschen" variant="ghost" onPress={onClear} disabled={disabled} />
      {onCancel ? (
        <PremiumButton title="Abbrechen" variant="secondary" onPress={onCancel} disabled={disabled} />
      ) : null}
      {confirmButton}
    </View>
  );
}

function drawStrokePath(ctx: CanvasRenderingContext2D, stroke: Point[]) {
  if (stroke.length < 1) return;
  ctx.beginPath();
  ctx.moveTo(stroke[0].x, stroke[0].y);
  for (let index = 1; index < stroke.length; index += 1) {
    ctx.lineTo(stroke[index].x, stroke[index].y);
  }
  ctx.stroke();
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
  fillAvailable = false,
  actionLayout = 'default',
}: Props) {
  const styles = useSignatureCanvasStyles(fillAvailable, actionLayout);
  const insets = useSafeAreaInsets();
  const orientation = useOrientation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const strokesRef = useRef<Point[][]>([]);
  const currentStrokeRef = useRef<Point[]>([]);
  const drawSpaceRef = useRef<CanvasCoordinateSpace | null>(null);
  const [hasStroke, setHasStroke] = useState(false);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const dims = resolveDimensions(size, widthProp, heightProp, measured ?? undefined);
  const strokeWidth = size === 'large' ? STROKE_WIDTH_LARGE : STROKE_WIDTH_COMPACT;

  const handleCanvasLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!fillAvailable) return;
      const { width, height } = event.nativeEvent.layout;
      if (width < 1 || height < 1) return;
      setMeasured((prev) => {
        const next = { width: Math.floor(width), height: Math.floor(height) };
        if (prev?.width === next.width && prev?.height === next.height) return prev;
        return next;
      });
    },
    [fillAvailable],
  );

  const redrawStrokes = useCallback(
    (ctx: CanvasRenderingContext2D, space: CanvasCoordinateSpace) => {
      ctx.clearRect(0, 0, space.drawWidth, space.drawHeight);
      for (const stroke of strokesRef.current) {
        drawStrokePath(ctx, stroke);
      }
      if (currentStrokeRef.current.length > 0) {
        drawStrokePath(ctx, currentStrokeRef.current);
      }
    },
    [],
  );

  const syncCanvasToDisplay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    if (displayWidth < 1 || displayHeight < 1) return null;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const nextSpace: CanvasCoordinateSpace = {
      displayWidth,
      displayHeight,
      drawWidth: displayWidth,
      drawHeight: displayHeight,
    };
    const previousSpace = drawSpaceRef.current;

    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = strokeWidth;

    if (
      previousSpace &&
      (previousSpace.drawWidth !== nextSpace.drawWidth ||
        previousSpace.drawHeight !== nextSpace.drawHeight)
    ) {
      strokesRef.current = strokesRef.current.map((stroke) =>
        scaleCanvasPoints(stroke, previousSpace, nextSpace),
      );
      if (currentStrokeRef.current.length > 0) {
        currentStrokeRef.current = scaleCanvasPoints(
          currentStrokeRef.current,
          previousSpace,
          nextSpace,
        );
      }
    }

    drawSpaceRef.current = nextSpace;
    redrawStrokes(ctx, nextSpace);
    return { ctx, space: nextSpace };
  }, [redrawStrokes, strokeWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      syncCanvasToDisplay();
      return;
    }

    const observer = new ResizeObserver(() => {
      syncCanvasToDisplay();
    });
    observer.observe(canvas);
    syncCanvasToDisplay();

    return () => {
      observer.disconnect();
    };
  }, [dims.height, dims.width, syncCanvasToDisplay]);

  useEffect(() => {
    if (!fillAvailable || typeof window === 'undefined') return;

    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        syncCanvasToDisplay();
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [fillAvailable, syncCanvasToDisplay]);

  useEffect(() => {
    syncCanvasToDisplay();
  }, [orientation.isLandscape, orientation.width, orientation.height, syncCanvasToDisplay]);

  const handleClear = useCallback(() => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    const synced = syncCanvasToDisplay();
    if (synced) {
      synced.ctx.clearRect(0, 0, synced.space.drawWidth, synced.space.drawHeight);
    }
    setHasStroke(false);
    onClear?.();
  }, [onClear, syncCanvasToDisplay]);

  const handleConfirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    onConfirm(exportSignatureCanvasPng(canvas));
  }, [hasStroke, onConfirm]);

  const drawAt = useCallback((clientX: number, clientY: number, start: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const space = readCanvasCoordinateSpace(canvas);
    const point = clientToCanvasPoint(clientX, clientY, rect, space);

    if (start) {
      currentStrokeRef.current = [point];
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      return;
    }

    const stroke = currentStrokeRef.current;
    const lastPoint = stroke[stroke.length - 1];
    if (lastPoint && lastPoint.x === point.x && lastPoint.y === point.y) return;

    stroke.push(point);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasStroke(true);
  }, []);

  const endStroke = useCallback(() => {
    if (currentStrokeRef.current.length > 1) {
      strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
    }
    currentStrokeRef.current = [];
    drawing.current = false;
    activePointerId.current = null;
  }, []);

  const beginStroke = useCallback(
    (clientX: number, clientY: number, pointerId: number) => {
      if (disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        canvas.setPointerCapture(pointerId);
      } catch {
        /* Playwright mouse automation may not provide a capturable pointer id */
      }
      drawing.current = true;
      activePointerId.current = pointerId;
      drawAt(clientX, clientY, true);
    },
    [disabled, drawAt],
  );

  const continueStroke = useCallback(
    (clientX: number, clientY: number) => {
      if (!drawing.current || disabled) return;
      drawAt(clientX, clientY, false);
    },
    [disabled, drawAt],
  );

  const finishStroke = useCallback(
    (pointerId: number) => {
      if (activePointerId.current !== pointerId) return;
      try {
        canvasRef.current?.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      endStroke();
    },
    [endStroke],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      event.preventDefault();
      beginStroke(event.clientX, event.clientY, event.pointerId);
    },
    [disabled, beginStroke],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || disabled || activePointerId.current !== event.pointerId) return;
      event.preventDefault();
      continueStroke(event.clientX, event.clientY);
    },
    [disabled, continueStroke],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (activePointerId.current !== event.pointerId) return;
      event.preventDefault();
      finishStroke(event.pointerId);
    },
    [finishStroke],
  );

  /** Mouse fallback — Playwright automation uses mouse events, not always pointer capture. */
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (disabled || event.button !== 0 || activePointerId.current !== null) return;
      event.preventDefault();
      beginStroke(event.clientX, event.clientY, -1);
    },
    [disabled, beginStroke],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawing.current || disabled || activePointerId.current !== -1) return;
      event.preventDefault();
      continueStroke(event.clientX, event.clientY);
    },
    [disabled, continueStroke],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (activePointerId.current !== -1) return;
      event.preventDefault();
      finishStroke(-1);
    },
    [finishStroke],
  );

  return (
    <View style={styles.wrap}>
      {showLabel && label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.canvasWrap} onLayout={handleCanvasLayout}>
        <canvas
          ref={canvasRef}
          data-testid="portal-signature-canvas"
          style={{
            width: '100%',
            height: fillAvailable ? '100%' : dims.height,
            touchAction: 'none',
            background: '#fff',
            borderRadius: fillAvailable ? 0 : 8,
            display: 'block',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </View>
      <SignatureActions
        actionLayout={actionLayout}
        styles={styles}
        disabled={disabled}
        hasStroke={hasStroke}
        onClear={handleClear}
        onCancel={onCancel}
        onConfirm={handleConfirm}
        safeBottom={actionLayout === 'bar' ? insets.bottom : 0}
      />
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
  fillAvailable = false,
  actionLayout = 'default',
}: Props) {
  const styles = useSignatureCanvasStyles(fillAvailable, actionLayout);
  const insets = useSafeAreaInsets();
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [current, setCurrent] = useState<Point[]>([]);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const dims = resolveDimensions(size, widthProp, heightProp, measured ?? undefined);
  const dotSize = size === 'large' ? 3 : 2;

  const handleCanvasLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!fillAvailable) return;
      const { width, height } = event.nativeEvent.layout;
      if (width < 1 || height < 1) return;
      setMeasured((prev) => {
        const next = { width: Math.floor(width), height: Math.floor(height) };
        if (prev?.width === next.width && prev?.height === next.height) return prev;
        return next;
      });
    },
    [fillAvailable],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
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
      }),
    [current, disabled],
  );

  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrent([]);
    onClear?.();
  }, [onClear]);

  const handleConfirm = useCallback(() => {
    if (strokes.length === 0) return;
    onConfirm(pointsToSvgDataUrl(strokes, dims.width, dims.height));
  }, [dims.height, dims.width, onConfirm, strokes]);

  const allPoints = [...strokes, current];
  const hasStroke = strokes.length > 0;

  return (
    <View style={styles.wrap}>
      {showLabel && label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={styles.canvasWrap}
        onLayout={handleCanvasLayout}
        {...pan.panHandlers}
      >
        {allPoints.map((stroke, si) =>
          stroke.map((p, pi) =>
            pi > 0 ? (
              <View
                key={`${si}-${pi}`}
                style={[
                  styles.dot,
                  {
                    left: p.x - dotSize / 2,
                    top: p.y - dotSize / 2,
                    width: dotSize,
                    height: dotSize,
                    borderRadius: dotSize / 2,
                  },
                ]}
              />
            ) : null,
          ),
        )}
      </View>
      <SignatureActions
        actionLayout={actionLayout}
        styles={styles}
        disabled={disabled}
        hasStroke={hasStroke}
        onClear={handleClear}
        onCancel={onCancel}
        onConfirm={handleConfirm}
        safeBottom={actionLayout === 'bar' ? insets.bottom : 0}
      />
    </View>
  );
}

export function CareSignatureCanvas(props: Props) {
  if (Platform.OS === 'web') {
    return <WebSignatureCanvas {...props} />;
  }
  return <NativeSignatureCanvas {...props} />;
}
