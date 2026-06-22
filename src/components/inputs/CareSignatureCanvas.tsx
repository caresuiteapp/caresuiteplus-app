import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, PanResponder, StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { legacyColorsFromPalette } from '@/design/tokens/themeBridge';
import { resolveCareTypography } from '@/design/tokens/typography';
import { spacing } from '@/theme';

type Point = { x: number; y: number };

const COMPACT_WIDTH = 320;
const COMPACT_HEIGHT = 120;
const STROKE_WIDTH_COMPACT = 2;
const STROKE_WIDTH_LARGE = 3.5;

const FALLBACK_TYPOGRAPHY = resolveCareTypography('dark');
const FALLBACK_COLORS = legacyColorsFromPalette('dark');

function useSignatureCanvasStyles() {
  return useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: spacing.sm },
        label: { ...FALLBACK_TYPOGRAPHY.body, fontWeight: '600' },
        canvasWrap: {
          height: COMPACT_HEIGHT,
          borderWidth: 1,
          borderColor: FALLBACK_COLORS.borderSoft,
          borderRadius: 8,
          backgroundColor: '#fff',
          overflow: 'hidden',
        },
        actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
        dot: {
          position: 'absolute',
          backgroundColor: '#111',
        },
      }),
    [],
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
  const styles = useSignatureCanvasStyles();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);
  const dims = resolveDimensions(size, widthProp, heightProp);
  const strokeWidth = size === 'large' ? STROKE_WIDTH_LARGE : STROKE_WIDTH_COMPACT;

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(dims.width * dpr);
    canvas.height = Math.round(dims.height * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = strokeWidth;
    }
  }, [dims.width, dims.height, strokeWidth]);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

  const handleClear = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
    setHasStroke(false);
    onClear?.();
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    onConfirm(canvas.toDataURL('image/png'));
  };

  const drawAt = (clientX: number, clientY: number, start: boolean) => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (start) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasStroke(true);
    }
  };

  return (
    <View style={styles.wrap}>
      {showLabel && label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.canvasWrap, { height: dims.height }]}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: dims.height,
            touchAction: 'none',
            background: '#fff',
            borderRadius: 8,
            display: 'block',
          }}
          onMouseDown={(e) => {
            if (disabled) return;
            drawing.current = true;
            drawAt(e.clientX, e.clientY, true);
          }}
          onMouseMove={(e) => {
            if (!drawing.current || disabled) return;
            drawAt(e.clientX, e.clientY, false);
          }}
          onMouseUp={() => { drawing.current = false; }}
          onMouseLeave={() => { drawing.current = false; }}
          onTouchStart={(e) => {
            if (disabled) return;
            e.preventDefault();
            drawing.current = true;
            const touch = e.touches[0];
            drawAt(touch.clientX, touch.clientY, true);
          }}
          onTouchMove={(e) => {
            if (!drawing.current || disabled) return;
            e.preventDefault();
            const touch = e.touches[0];
            drawAt(touch.clientX, touch.clientY, false);
          }}
          onTouchEnd={() => { drawing.current = false; }}
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
  const styles = useSignatureCanvasStyles();
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [current, setCurrent] = useState<Point[]>([]);
  const dims = resolveDimensions(size, widthProp, heightProp);
  const dotSize = size === 'large' ? 3 : 2;

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
