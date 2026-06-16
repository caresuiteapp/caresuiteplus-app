import { useCallback, useRef, useState } from 'react';
import { Platform, PanResponder, StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type Point = { x: number; y: number };

type Props = {
  label: string;
  onConfirm: (dataUrl: string) => void;
  onClear?: () => void;
  disabled?: boolean;
};

function pointsToSvgDataUrl(strokes: Point[][]): string {
  const width = 320;
  const height = 120;
  const paths = strokes
    .map((stroke) => {
      if (stroke.length < 2) return '';
      const d = stroke.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      return `<path d="${d}" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths}</svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function WebSignatureCanvas({ label, onConfirm, onClear, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

  const handleClear = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasStroke(false);
    onClear?.();
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    onConfirm(canvas.toDataURL('image/png'));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={320}
          height={120}
          style={{ width: '100%', height: 120, touchAction: 'none', background: '#fff', borderRadius: 8 }}
          onMouseDown={(e) => {
            if (disabled) return;
            drawing.current = true;
            const ctx = getCtx();
            if (!ctx) return;
            const rect = canvasRef.current!.getBoundingClientRect();
            ctx.beginPath();
            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
          }}
          onMouseMove={(e) => {
            if (!drawing.current || disabled) return;
            const ctx = getCtx();
            if (!ctx) return;
            const rect = canvasRef.current!.getBoundingClientRect();
            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();
            setHasStroke(true);
          }}
          onMouseUp={() => { drawing.current = false; }}
          onMouseLeave={() => { drawing.current = false; }}
          onTouchStart={(e) => {
            if (disabled) return;
            e.preventDefault();
            drawing.current = true;
            const ctx = getCtx();
            if (!ctx) return;
            const rect = canvasRef.current!.getBoundingClientRect();
            const touch = e.touches[0];
            ctx.beginPath();
            ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
          }}
          onTouchMove={(e) => {
            if (!drawing.current || disabled) return;
            e.preventDefault();
            const ctx = getCtx();
            if (!ctx) return;
            const rect = canvasRef.current!.getBoundingClientRect();
            const touch = e.touches[0];
            ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();
            setHasStroke(true);
          }}
          onTouchEnd={() => { drawing.current = false; }}
        />
      </View>
      <View style={styles.actions}>
        <PremiumButton title="Löschen" variant="ghost" onPress={handleClear} disabled={disabled} />
        <PremiumButton title="Unterschrift bestätigen" variant="secondary" onPress={handleConfirm} disabled={disabled || !hasStroke} />
      </View>
    </View>
  );
}

function NativeSignatureCanvas({ label, onConfirm, onClear, disabled }: Props) {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [current, setCurrent] = useState<Point[]>([]);

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
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
    onConfirm(pointsToSvgDataUrl(strokes));
  }, [onConfirm, strokes]);

  const allPoints = [...strokes, current];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.canvasWrap} {...pan.panHandlers}>
        {allPoints.map((stroke, si) =>
          stroke.map((p, pi) =>
            pi > 0 ? (
              <View
                key={`${si}-${pi}`}
                style={[styles.dot, { left: p.x - 1, top: p.y - 1 }]}
              />
            ) : null,
          ),
        )}
      </View>
      <View style={styles.actions}>
        <PremiumButton title="Löschen" variant="ghost" onPress={handleClear} disabled={disabled} />
        <PremiumButton title="Unterschrift bestätigen" variant="secondary" onPress={handleConfirm} disabled={disabled || strokes.length === 0} />
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
  wrap: { gap: spacing.sm },
  label: { ...typography.body, fontWeight: '600' },
  canvasWrap: {
    height: 120,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  dot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#111',
  },
});
