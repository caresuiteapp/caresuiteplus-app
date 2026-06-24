import { StyleSheet, View } from 'react-native';
import { withAlpha } from '@/design/tokens/motion';
import type { MainModuleKey } from '@/types/navigation/platform';

type ModuleRailGlyphProps = {
  accent: string;
  size: number;
};

/** Fette, gut lesbare Modul-Icons speziell für die linke Haupt-Rail (48px). */
export function ModuleRailGlyph({
  moduleKey,
  accent,
  size = 36,
}: ModuleRailGlyphProps & { moduleKey: MainModuleKey }) {
  switch (moduleKey) {
    case 'zentrale':
      return <RailZentraleGlyph accent={accent} size={size} />;
    case 'office':
      return <RailOfficeGlyph accent={accent} size={size} />;
    case 'assist':
      return <RailAssistGlyph accent={accent} size={size} />;
    case 'pflege':
      return <RailPflegeGlyph accent={accent} size={size} />;
    case 'stationaer':
      return <RailStationaerGlyph accent={accent} size={size} />;
    case 'beratung':
      return <RailBeratungGlyph accent={accent} size={size} />;
    case 'akademie':
      return <RailAkademieGlyph accent={accent} size={size} />;
    case 'admin':
      return <RailAdminGlyph accent={accent} size={size} />;
    default:
      return <RailZentraleGlyph accent={accent} size={size} />;
  }
}

/** Zentrale — 2×2 Dashboard-Kacheln */
function RailZentraleGlyph({ accent, size }: ModuleRailGlyphProps) {
  const tile = Math.round(size * 0.17);
  const gap = Math.round(size * 0.07);
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={{ gap, flexDirection: 'row' }}>
        <View style={[styles.tile, { width: tile, height: tile, backgroundColor: accent }]} />
        <View style={[styles.tile, { width: tile, height: tile, backgroundColor: withAlpha(accent, 0.55) }]} />
      </View>
      <View style={{ gap, flexDirection: 'row', marginTop: gap }}>
        <View style={[styles.tile, { width: tile, height: tile, backgroundColor: withAlpha(accent, 0.75) }]} />
        <View style={[styles.tile, { width: tile, height: tile, backgroundColor: withAlpha(accent, 0.45) }]} />
      </View>
    </View>
  );
}

/** Office — Gebäude mit Fenstern und Eingang */
function RailOfficeGlyph({ accent, size }: ModuleRailGlyphProps) {
  const w = Math.round(size * 0.58);
  const h = Math.round(size * 0.72);
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={[styles.officeBlock, { width: w, height: h, borderColor: withAlpha(accent, 0.85) }]}>
        <View style={styles.officeWinRow}>
          <View style={[styles.officeWin, { backgroundColor: accent }]} />
          <View style={[styles.officeWin, { backgroundColor: withAlpha(accent, 0.55) }]} />
        </View>
        <View style={styles.officeWinRow}>
          <View style={[styles.officeWin, { backgroundColor: withAlpha(accent, 0.75) }]} />
          <View style={[styles.officeWin, { backgroundColor: accent }]} />
        </View>
        <View style={[styles.officeDoor, { backgroundColor: withAlpha(accent, 0.9) }]} />
      </View>
      <View style={[styles.officeBase, { width: w + 8, backgroundColor: withAlpha(accent, 0.45) }]} />
    </View>
  );
}

/** Assist — Route/Einsatz: zwei Punkte mit Verbindung (Außendienst) */
function RailAssistGlyph({ accent, size }: ModuleRailGlyphProps) {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={[styles.routePath, { backgroundColor: withAlpha(accent, 0.65) }]} />
      <View style={[styles.routeNode, styles.routeNodeStart, { backgroundColor: accent, borderColor: accent }]} />
      <View
        style={[
          styles.routeNode,
          styles.routeNodeEnd,
          { borderColor: accent, backgroundColor: withAlpha(accent, 0.25) },
        ]}
      />
      <View style={[styles.routeCheck, { borderColor: accent }]} />
    </View>
  );
}

/** Pflege — klassisches Medizin-Kreuz im Kreis */
function RailPflegeGlyph({ accent, size }: ModuleRailGlyphProps) {
  const ring = Math.round(size * 0.72);
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={[styles.pflegeRing, { width: ring, height: ring, borderColor: withAlpha(accent, 0.55) }]} />
      <View style={[styles.pflegeCrossV, { height: ring * 0.55, backgroundColor: accent }]} />
      <View style={[styles.pflegeCrossH, { width: ring * 0.55, backgroundColor: withAlpha(accent, 0.9) }]} />
    </View>
  );
}

/** Stationär — Krankenbett mit Kopfteil */
function RailStationaerGlyph({ accent, size }: ModuleRailGlyphProps) {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={[styles.bedHeadboard, { height: size * 0.52, backgroundColor: accent }]} />
      <View style={[styles.bedMattress, { width: size * 0.62, backgroundColor: withAlpha(accent, 0.8) }]} />
      <View style={[styles.bedPillow, { backgroundColor: withAlpha('#FFFFFF', 0.92) }]} />
      <View style={[styles.bedLeg, { backgroundColor: withAlpha(accent, 0.45) }]} />
      <View style={[styles.bedCrossV, { backgroundColor: withAlpha('#FFFFFF', 0.9) }]} />
      <View style={[styles.bedCrossH, { backgroundColor: withAlpha('#FFFFFF', 0.9) }]} />
    </View>
  );
}

/** Beratung — Sprechblase mit Gesprächspunkten */
function RailBeratungGlyph({ accent, size }: ModuleRailGlyphProps) {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={[styles.chatBubble, { backgroundColor: accent }]}>
        <View style={styles.chatDotsRow}>
          <View style={[styles.chatDot, { backgroundColor: withAlpha('#FFFFFF', 0.9) }]} />
          <View style={[styles.chatDot, { backgroundColor: withAlpha('#FFFFFF', 0.7) }]} />
          <View style={[styles.chatDot, { backgroundColor: withAlpha('#FFFFFF', 0.9) }]} />
        </View>
      </View>
      <View style={[styles.chatTail, { borderTopColor: accent }]} />
    </View>
  );
}

/** Akademie — Doktorhut + Buch */
function RailAkademieGlyph({ accent, size }: ModuleRailGlyphProps) {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={[styles.capBoard, { backgroundColor: accent }]} />
      <View style={[styles.capTop, { borderBottomColor: withAlpha(accent, 0.95) }]} />
      <View style={[styles.book, { backgroundColor: withAlpha(accent, 0.65) }]}>
        <View style={[styles.bookSpine, { backgroundColor: accent }]} />
      </View>
      <View style={[styles.capTassel, { backgroundColor: '#FDE68A' }]} />
    </View>
  );
}

/** Admin — Einstellungs-Zahnrad */
function RailAdminGlyph({ accent, size }: ModuleRailGlyphProps) {
  const outer = Math.round(size * 0.68);
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={[styles.gearOuter, { width: outer, height: outer, borderColor: accent }]}>
        <View style={[styles.gearInner, { borderColor: withAlpha(accent, 0.65) }]} />
      </View>
      {[0, 45, 90, 135].map((deg) => (
        <View
          key={deg}
          style={[
            styles.gearTooth,
            { backgroundColor: accent, transform: [{ rotate: `${deg}deg` }] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    borderRadius: 2,
  },
  officeBlock: {
    borderWidth: 2,
    borderRadius: 3,
    alignItems: 'center',
    paddingTop: 4,
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  officeWinRow: {
    flexDirection: 'row',
    gap: 4,
  },
  officeWin: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  officeDoor: {
    width: 8,
    height: 6,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    marginTop: 2,
  },
  officeBase: {
    height: 3,
    borderRadius: 1,
    marginTop: 2,
  },
  routePath: {
    position: 'absolute',
    width: 22,
    height: 3,
    borderRadius: 2,
    transform: [{ rotate: '-28deg' }],
    top: 18,
    left: 6,
  },
  routeNode: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  routeNodeStart: {
    top: 6,
    left: 5,
  },
  routeNodeEnd: {
    bottom: 5,
    right: 5,
  },
  routeCheck: {
    position: 'absolute',
    bottom: 8,
    right: 9,
    width: 7,
    height: 4,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '-45deg' }],
  },
  pflegeRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  pflegeCrossV: {
    width: 5,
    borderRadius: 3,
  },
  pflegeCrossH: {
    position: 'absolute',
    height: 5,
    borderRadius: 3,
  },
  bedHeadboard: {
    position: 'absolute',
    left: 7,
    top: 6,
    width: 4,
    borderRadius: 2,
  },
  bedMattress: {
    position: 'absolute',
    bottom: 10,
    height: 11,
    borderRadius: 3,
  },
  bedPillow: {
    position: 'absolute',
    bottom: 17,
    left: 11,
    width: 11,
    height: 6,
    borderRadius: 2,
  },
  bedLeg: {
    position: 'absolute',
    bottom: 6,
    width: 28,
    height: 3,
    borderRadius: 1,
  },
  bedCrossV: {
    position: 'absolute',
    top: 12,
    right: 10,
    width: 2,
    height: 7,
    borderRadius: 1,
  },
  bedCrossH: {
    position: 'absolute',
    top: 15,
    right: 7,
    width: 7,
    height: 2,
    borderRadius: 1,
  },
  chatBubble: {
    width: 26,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatDotsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  chatDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  chatTail: {
    position: 'absolute',
    bottom: 6,
    left: 10,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  capBoard: {
    position: 'absolute',
    top: 8,
    width: 28,
    height: 4,
    borderRadius: 1,
  },
  capTop: {
    position: 'absolute',
    top: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  book: {
    position: 'absolute',
    bottom: 4,
    width: 18,
    height: 12,
    borderRadius: 2,
  },
  bookSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  capTassel: {
    position: 'absolute',
    top: 12,
    right: 8,
    width: 2,
    height: 9,
    borderRadius: 1,
  },
  gearOuter: {
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  gearTooth: {
    position: 'absolute',
    width: 3,
    height: 8,
    borderRadius: 1,
  },
});
