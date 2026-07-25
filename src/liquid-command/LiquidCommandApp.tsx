import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { liquidModules } from './moduleRegistry';
import { liquidTokens } from './tokens';
import type { LiquidModuleId } from './types';
import { useLiquidFormFactor } from './hooks/useLiquidFormFactor';
import { usePhonePortraitLock } from './hooks/usePhonePortraitLock';
import { LiquidSurface } from './components/LiquidSurface';
import { LiquidButton } from './components/LiquidButton';
import { LiquidModuleCard } from './components/LiquidModuleCard';
import { RotateDeviceScreen } from './screens/RotateDeviceScreen';

export function LiquidCommandApp() {
  usePhonePortraitLock();
  const formFactor = useLiquidFormFactor();
  const [selectedId, setSelectedId] = useState<LiquidModuleId>('assist');
  const selected = useMemo(
    () => liquidModules.find((item) => item.id === selectedId) ?? liquidModules[0],
    [selectedId],
  );

  if (formFactor === 'phone-landscape-blocked') {
    return <RotateDeviceScreen />;
  }

  const compact = formFactor === 'phone-portrait';
  const portraitTablet = formFactor === 'tablet-portrait';
  const columns = compact ? 1 : portraitTablet ? 2 : 4;
  const moduleWidth = columns === 1 ? '100%' : columns === 2 ? '50%' : '25%';

  return (
    <View style={styles.root}>
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />

      <View style={[styles.commandBar, compact && styles.commandBarCompact]}>
        <View>
          <Text style={styles.brand}>
            CareSuite <Text style={styles.brandAccent}>HealthOS</Text>
          </Text>
          <Text style={styles.mode}>LIQUID COMMAND · {formFactor}</Text>
        </View>
        <View style={styles.commandActions}>
          {!compact ? <LiquidButton label="Suchen" onPress={() => undefined} variant="secondary" /> : null}
          <LiquidButton label="Neu" onPress={() => undefined} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          compact && styles.contentCompact,
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={[styles.title, compact && styles.titleCompact]}>
              Versorgung in Bewegung.
            </Text>
            <Text style={styles.subtitle}>
              Kontext, Live-Lage und nächste Handlung in einer gemeinsamen Arbeitsfläche.
            </Text>
          </View>
          <LiquidSurface active style={styles.liveCard}>
            <Text style={styles.liveLabel}>● LIVE</Text>
            <Text style={styles.liveValue}>42 Einsätze aktiv</Text>
            <Text style={styles.liveMeta}>12 Anfahrten · 3 Prüfungen · 1 Warnung</Text>
          </LiquidSurface>
        </View>

        <View style={[styles.workspace, compact && styles.workspaceCompact]}>
          <View style={styles.moduleArea}>
            <Text style={styles.sectionTitle}>Arbeitsbereiche</Text>
            <View style={styles.moduleGrid}>
              {liquidModules.map((module) => (
                <View
                  key={module.id}
                  style={[
                    styles.moduleCell,
                    { width: moduleWidth },
                  ]}
                >
                  <LiquidModuleCard
                    module={module}
                    selected={module.id === selectedId}
                    onPress={() => setSelectedId(module.id)}
                  />
                </View>
              ))}
            </View>
          </View>

          <LiquidSurface style={styles.contextPanel} active>
            <Text style={styles.contextKicker}>AKTIVER KONTEXT</Text>
            <Text style={styles.contextTitle}>{selected.label}</Text>
            <Text style={styles.contextDescription}>{selected.description}</Text>
            <View style={styles.contextMetric}>
              <Text style={styles.metricValue}>{selected.priority}</Text>
              <Text style={styles.metricLabel}>Jetzt relevant</Text>
            </View>
            <View style={styles.timeline}>
              {['Anfahrt', 'Versorgung', 'Dokumentation', 'Abschluss'].map(
                (label, index) => (
                  <View key={label} style={styles.timelineRow}>
                    <View style={[styles.dot, index === 1 && styles.dotActive]} />
                    <Text style={styles.timelineText}>{label}</Text>
                  </View>
                ),
              )}
            </View>
            <LiquidButton label={`${selected.label} öffnen`} onPress={() => undefined} />
          </LiquidSurface>
        </View>
      </ScrollView>

      {compact ? (
        <View style={styles.bottomNav}>
          {['Heute', 'Einsätze', 'Nachrichten', 'Mehr'].map((label, index) => (
            <View key={label} style={styles.bottomItem}>
              <View style={[styles.bottomIcon, index === 0 && styles.bottomIconActive]} />
              <Text style={styles.bottomLabel}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: liquidTokens.color.navy950,
    overflow: 'hidden',
  },
  glowOne: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(20,120,255,0.18)',
    top: -280,
    right: -100,
  },
  glowTwo: {
    position: 'absolute',
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: 'rgba(20,120,255,0.10)',
    bottom: -260,
    left: -180,
  },
  commandBar: {
    minHeight: 82,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: liquidTokens.color.white12,
    backgroundColor: 'rgba(6,21,43,0.86)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    zIndex: 2,
  },
  commandBarCompact: {
    minHeight: 74,
    paddingHorizontal: 16,
  },
  brand: {
    color: liquidTokens.color.white,
    fontSize: 22,
    fontWeight: '800',
  },
  brandAccent: {
    color: liquidTokens.color.blue500,
    fontWeight: '500',
  },
  mode: {
    marginTop: 3,
    color: liquidTokens.color.white64,
    fontSize: 11,
    letterSpacing: 1,
  },
  commandActions: {
    flexDirection: 'row',
    gap: 10,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 28,
    gap: 24,
    width: '100%',
    maxWidth: 1720,
    alignSelf: 'center',
    paddingBottom: 48,
  },
  contentCompact: {
    padding: 16,
    paddingBottom: 112,
  },
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    minWidth: 280,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  title: {
    color: liquidTokens.color.white,
    fontSize: liquidTokens.type.display,
    lineHeight: 42,
    fontWeight: '800',
    maxWidth: 780,
  },
  titleCompact: {
    fontSize: 29,
    lineHeight: 35,
  },
  subtitle: {
    marginTop: 10,
    color: liquidTokens.color.white64,
    fontSize: liquidTokens.type.body,
    lineHeight: 24,
    maxWidth: 740,
  },
  liveCard: {
    minWidth: 280,
    padding: 20,
    justifyContent: 'center',
  },
  liveLabel: {
    color: liquidTokens.color.blue300,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  liveValue: {
    marginTop: 8,
    color: liquidTokens.color.white,
    fontSize: 24,
    fontWeight: '800',
  },
  liveMeta: {
    marginTop: 5,
    color: liquidTokens.color.white64,
    fontSize: 14,
  },
  workspace: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  workspaceCompact: {
    flexDirection: 'column',
  },
  moduleArea: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: 12,
    color: liquidTokens.color.white,
    fontSize: liquidTokens.type.section,
    fontWeight: '800',
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  moduleCell: {
    padding: 6,
  },
  contextPanel: {
    width: 330,
    padding: 22,
    gap: 10,
  },
  contextKicker: {
    color: liquidTokens.color.blue300,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  contextTitle: {
    color: liquidTokens.color.white,
    fontSize: 26,
    fontWeight: '800',
  },
  contextDescription: {
    color: liquidTokens.color.white64,
    fontSize: 15,
    lineHeight: 22,
  },
  contextMetric: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: liquidTokens.color.white08,
  },
  metricValue: {
    color: liquidTokens.color.white,
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    marginTop: 2,
    color: liquidTokens.color.white64,
    fontSize: 13,
  },
  timeline: {
    paddingVertical: 6,
    gap: 10,
  },
  timelineRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: liquidTokens.color.white18,
  },
  dotActive: {
    backgroundColor: liquidTokens.color.blue500,
  },
  timelineText: {
    color: liquidTokens.color.white86,
    fontSize: 15,
  },
  bottomNav: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    minHeight: 72,
    borderWidth: 1,
    borderColor: liquidTokens.color.white18,
    borderRadius: 22,
    backgroundColor: liquidTokens.color.navy800,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  bottomItem: {
    minWidth: 64,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bottomIcon: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: liquidTokens.color.white18,
  },
  bottomIconActive: {
    backgroundColor: liquidTokens.color.blue500,
  },
  bottomLabel: {
    color: liquidTokens.color.white86,
    fontSize: 12,
    fontWeight: '700',
  },
});
