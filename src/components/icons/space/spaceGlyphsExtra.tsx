import { View, StyleSheet, Text } from 'react-native';
import { withAlpha } from '@/design/tokens/motion';

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

export function AddClientGlyph({ accent }: { accent: string }) {
  return (
    <View style={[s.center, { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: accent }]}>
      <View style={{ width: 12, height: 2, backgroundColor: accent, borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: 2, height: 12, backgroundColor: accent, borderRadius: 1 }} />
    </View>
  );
}

export function UploadFolderGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 22, height: 14, borderRadius: 3, backgroundColor: withAlpha(accent, 0.55), marginTop: 6 }} />
      <View style={{ position: 'absolute', top: 4, width: 10, height: 6, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: withAlpha(accent, 0.85) }} />
      <View style={{ position: 'absolute', top: 0, width: 2, height: 8, backgroundColor: accent }} />
      <View style={{ position: 'absolute', top: 0, width: 8, height: 2, backgroundColor: accent, borderRadius: 1 }} />
    </View>
  );
}

export function TeamGroupGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ width: 30, height: 24, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ position: 'absolute', top: 0, left: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: withAlpha(accent, 0.65) }} />
      <View style={{ position: 'absolute', top: 0, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: withAlpha(accent, 0.65) }} />
      <View style={{ position: 'absolute', top: 2, alignSelf: 'center', width: 9, height: 9, borderRadius: 5, backgroundColor: accent }} />
      <View style={{ width: 24, height: 9, borderRadius: 4, backgroundColor: withAlpha(accent, 0.5) }} />
    </View>
  );
}

export function PersonSingleGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent, marginBottom: 2 }} />
      <View style={{ width: 16, height: 10, borderRadius: 5, backgroundColor: withAlpha(accent, 0.65) }} />
    </View>
  );
}

export function KpiChartGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22 }}>
      <View style={{ width: 5, height: 10, borderRadius: 2, backgroundColor: withAlpha(accent, 0.45) }} />
      <View style={{ width: 5, height: 16, borderRadius: 2, backgroundColor: withAlpha(accent, 0.75) }} />
      <View style={{ width: 5, height: 22, borderRadius: 2, backgroundColor: accent }} />
    </View>
  );
}

export function TrendChartGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ width: 26, height: 20, justifyContent: 'flex-end' }}>
      <View style={{ position: 'absolute', left: 2, bottom: 4, width: 18, height: 2, backgroundColor: withAlpha(accent, 0.35), transform: [{ rotate: '-28deg' }] }} />
      <View style={{ position: 'absolute', right: 2, top: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
      <View style={{ width: '100%', height: 1, backgroundColor: withAlpha(accent, 0.35) }} />
    </View>
  );
}

export function TaskCheckGlyph({ accent }: { accent: string }) {
  return (
    <View style={[s.center, { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: accent }]}>
      <View style={{ width: 8, height: 4, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: accent, transform: [{ rotate: '-45deg' }], marginTop: -2 }} />
    </View>
  );
}

export function QmShieldGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 20, height: 22, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 2, borderColor: accent, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 8, height: 4, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: accent, transform: [{ rotate: '-45deg' }], marginTop: -2 }} />
      </View>
    </View>
  );
}

export function ConnectPlugGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <View style={{ width: 10, height: 14, borderRadius: 3, backgroundColor: withAlpha(accent, 0.75) }} />
      <View style={{ width: 4, height: 8, borderRadius: 1, backgroundColor: accent }} />
      <View style={{ width: 4, height: 8, borderRadius: 1, backgroundColor: accent, marginTop: 6 }} />
    </View>
  );
}

export function SubscriptionCardGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ width: 24, height: 16, borderRadius: 3, backgroundColor: withAlpha(accent, 0.75), overflow: 'hidden' }}>
      <View style={{ height: 5, backgroundColor: accent }} />
      <View style={{ width: 10, height: 3, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)', marginTop: 4, marginLeft: 4 }} />
    </View>
  );
}

export function AuditTrailGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ width: 18, height: 24, borderRadius: 3, borderWidth: 1, borderColor: withAlpha(accent, 0.65), padding: 3, gap: 3 }}>
      <View style={{ width: '100%', height: 2, backgroundColor: withAlpha(accent, 0.85), borderRadius: 1 }} />
      <View style={{ width: '80%', height: 2, backgroundColor: withAlpha(accent, 0.55), borderRadius: 1 }} />
      <View style={{ width: '90%', height: 2, backgroundColor: withAlpha(accent, 0.55), borderRadius: 1 }} />
    </View>
  );
}

export function RadarPingGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ position: 'absolute', width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: withAlpha(accent, 0.35) }} />
      <View style={{ position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: withAlpha(accent, 0.55) }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
    </View>
  );
}

export function InsightScopeGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: accent }} />
      <View style={{ position: 'absolute', right: 4, bottom: 4, width: 10, height: 3, backgroundColor: withAlpha(accent, 0.75), transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

export function BellGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 16, height: 12, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: accent }} />
      <View style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: withAlpha(accent, 0.65), marginTop: 1 }} />
      <View style={{ width: 6, height: 4, borderRadius: 3, backgroundColor: withAlpha('#FFFFFF', 0.85), marginTop: 2 }} />
    </View>
  );
}

export function MandantGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 4, height: 6, backgroundColor: accent, marginBottom: 1 }} />
      <View style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
        <View style={{ width: 7, height: 16, borderRadius: 1, backgroundColor: withAlpha(accent, 0.55) }} />
        <View style={{ width: 9, height: 20, borderRadius: 1, backgroundColor: withAlpha(accent, 0.85) }} />
        <View style={{ width: 7, height: 14, borderRadius: 1, backgroundColor: withAlpha(accent, 0.65) }} />
      </View>
      <View style={{ width: 26, height: 3, borderRadius: 1, backgroundColor: withAlpha(accent, 0.45), marginTop: 1 }} />
    </View>
  );
}

export function HelpOrbGlyph({ accent }: { accent: string }) {
  return (
    <View style={[s.center, { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: accent }]}>
      <Text style={{ color: accent, fontSize: 14, fontWeight: '800', marginTop: -1 }}>?</Text>
    </View>
  );
}

export function LockShieldGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 14, height: 10, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 2, borderColor: accent, marginBottom: -1 }} />
      <View style={{ width: 18, height: 12, borderRadius: 3, backgroundColor: withAlpha(accent, 0.75) }} />
    </View>
  );
}

export function DataRightsGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
        <View style={{ width: 10, height: 8, borderRadius: 3, backgroundColor: withAlpha(accent, 0.55), marginTop: 1 }} />
      </View>
      <View style={{ width: 10, height: 14, borderRadius: 2, borderWidth: 1, borderColor: withAlpha(accent, 0.65) }} />
    </View>
  );
}

export function InfoBeaconGlyph({ accent }: { accent: string }) {
  return (
    <View style={[s.center, { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: accent }]}>
      <Text style={{ color: accent, fontSize: 13, fontWeight: '800' }}>i</Text>
    </View>
  );
}

export function EmployeeBadgeGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent }} />
      <View style={{ width: 18, height: 10, borderRadius: 4, backgroundColor: withAlpha(accent, 0.6), marginTop: 2 }} />
      <View style={{ position: 'absolute', right: 2, top: 8, width: 8, height: 8, borderRadius: 2, backgroundColor: withAlpha('#FFFFFF', 0.85) }} />
    </View>
  );
}

export function AssignmentRouteGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
      <View style={{ width: 2, height: 10, backgroundColor: withAlpha(accent, 0.55), marginTop: -2 }} />
      <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: accent, marginTop: -2 }} />
    </View>
  );
}

export function TaskTickGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ width: 14, height: 8, borderLeftWidth: 3, borderBottomWidth: 3, borderColor: accent, transform: [{ rotate: '-45deg' }] }} />
  );
}

export function ModulesActiveGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 16, height: 9, backgroundColor: withAlpha(accent, 0.55), transform: [{ skewX: '-25deg' }] }} />
      <View style={{ width: 16, height: 9, backgroundColor: accent, marginTop: -4, transform: [{ skewX: '-25deg' }] }} />
    </View>
  );
}

export function PortalGlobeGlyph({ accent }: { accent: string }) {
  return (
    <View style={[s.center, { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: accent }]}>
      <View style={{ position: 'absolute', width: 18, height: 1, backgroundColor: withAlpha(accent, 0.55) }} />
      <View style={{ position: 'absolute', width: 1, height: 18, backgroundColor: withAlpha(accent, 0.55) }} />
      <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: withAlpha(accent, 0.75) }} />
    </View>
  );
}

export function DocsReviewGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 14, height: 18, borderRadius: 2, backgroundColor: withAlpha(accent, 0.75) }} />
      <View style={{ position: 'absolute', right: 2, bottom: 2, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: accent }} />
    </View>
  );
}

export function PortalInboxGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 22, height: 6, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: withAlpha(accent, 0.55) }} />
      <View style={{ width: 24, height: 12, borderRadius: 3, backgroundColor: withAlpha(accent, 0.85), marginTop: -2 }} />
    </View>
  );
}

export function ServiceRecordGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 14, height: 18, borderRadius: 2, backgroundColor: withAlpha(accent, 0.65) }} />
      <View style={{ position: 'absolute', right: 4, top: 6, width: 2, height: 12, backgroundColor: accent, transform: [{ rotate: '25deg' }] }} />
    </View>
  );
}

export function BudgetWarnGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 18, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: accent }} />
      <Text style={{ position: 'absolute', top: 8, color: '#0B1022', fontSize: 10, fontWeight: '900' }}>!</Text>
    </View>
  );
}

export function WeekPlannerGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ width: 22, height: 16, borderRadius: 3, borderWidth: 1, borderColor: withAlpha(accent, 0.65), padding: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={{ width: 4, height: 4, borderRadius: 1, backgroundColor: i === 2 ? accent : withAlpha(accent, 0.45) }} />
      ))}
    </View>
  );
}

export function SparkleNewGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 2, height: 16, backgroundColor: accent, borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: 16, height: 2, backgroundColor: accent, borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: 10, height: 2, backgroundColor: withAlpha(accent, 0.65), transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: 10, height: 2, backgroundColor: withAlpha(accent, 0.65), transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

export function ClientsRosterGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ width: 20, height: 22, borderRadius: 3, borderWidth: 1, borderColor: withAlpha(accent, 0.65), paddingTop: 4, paddingHorizontal: 3, gap: 3 }}>
      <View style={{ width: '100%', height: 2, backgroundColor: withAlpha(accent, 0.85), borderRadius: 1 }} />
      <View style={{ width: '70%', height: 2, backgroundColor: withAlpha(accent, 0.55), borderRadius: 1 }} />
      <View style={{ width: '85%', height: 2, backgroundColor: withAlpha(accent, 0.55), borderRadius: 1 }} />
    </View>
  );
}

export function MessageWaveGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      <View style={{ width: 12, height: 10, borderRadius: 6, backgroundColor: withAlpha(accent, 0.55) }} />
      <View style={{ width: 14, height: 12, borderRadius: 6, backgroundColor: accent, marginBottom: 4 }} />
    </View>
  );
}

export function HomeOrbitGlyph({ accent, size }: { accent: string; size: number }) {
  return (
    <View style={s.center}>
      <View style={{ width: 12, height: 10, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: accent, marginBottom: -2 }} />
      <View style={{ width: 16, height: 8, backgroundColor: withAlpha(accent, 0.65) }} />
      <View style={{ position: 'absolute', width: size * 0.75, height: size * 0.24, borderRadius: 999, borderWidth: 1, borderColor: withAlpha(accent, 0.45), transform: [{ rotate: '-18deg' }] }} />
    </View>
  );
}

export function LivePulseGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 20, height: 2, backgroundColor: withAlpha(accent, 0.45), borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: 4, height: 10, backgroundColor: accent, borderRadius: 1, left: 4 }} />
      <View style={{ position: 'absolute', width: 4, height: 14, backgroundColor: accent, borderRadius: 1, left: 10 }} />
      <View style={{ position: 'absolute', width: 4, height: 8, backgroundColor: accent, borderRadius: 1, right: 4 }} />
    </View>
  );
}

export function OpsConsoleGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ width: 24, height: 16, borderRadius: 3, borderWidth: 1, borderColor: withAlpha(accent, 0.65), padding: 2, gap: 2 }}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        <View style={{ width: 4, height: 4, borderRadius: 1, backgroundColor: accent }} />
        <View style={{ width: 12, height: 4, borderRadius: 1, backgroundColor: withAlpha(accent, 0.45) }} />
      </View>
      <View style={{ width: '100%', height: 4, borderRadius: 1, backgroundColor: withAlpha(accent, 0.55) }} />
    </View>
  );
}

export function TeamRolesGlyph({ accent }: { accent: string }) {
  return (
    <View style={s.center}>
      <View style={{ width: 18, height: 20, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderWidth: 2, borderColor: accent, alignItems: 'center', paddingTop: 4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 2, marginTop: -2 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: withAlpha(accent, 0.65) }} />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: withAlpha(accent, 0.65) }} />
      </View>
    </View>
  );
}

export function PluginCrystalGlyph({ accent }: { accent: string }) {
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 14, height: 14, borderRadius: 2, backgroundColor: withAlpha(accent, 0.75), transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: 8, height: 8, borderRadius: 1, backgroundColor: accent, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}
