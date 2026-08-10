import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ClientListItem } from '@/types/modules/office';
import { liquidClassicColors as liquidColors, liquidRadius } from '../foundation/tokens';

export type ClientNetworkMapProps = {
  clients: ClientListItem[];
  tenantId?: string | null;
  height?: number;
  onClientSelect?: (clientId: string) => void;
};

function stablePercent(value: string, salt: number): number {
  let hash = salt;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return 8 + (Math.abs(hash) % 84);
}

function positionPercent(value: string, salt: number): `${number}%` {
  return `${stablePercent(value, salt)}%`;
}

/**
 * Native/offline view of the complete tenant client network. Positions are
 * intentionally stylized and stable; every client remains permanently visible.
 */
export function ClientNetworkMap({
  clients,
  height = 320,
  onClientSelect,
}: ClientNetworkMapProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const nodes = useMemo(
    () =>
      clients.map((client) => ({
        client,
        left: positionPercent(client.id, 17),
        top: positionPercent(client.id, 83),
      })),
    [clients],
  );
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.35],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.68, 0],
  });

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2150,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View
      accessible
      accessibilityLabel={`Versorgungsnetz mit ${clients.length} Klientinnen und Klienten`}
      style={[styles.stage, { minHeight: height }]}
    >
      {nodes.map(({ client, left, top }) => (
        <Pressable
          key={client.id}
          accessibilityRole="button"
          accessibilityLabel={`${client.firstName} ${client.lastName}, ${client.zip ?? ''} ${client.city ?? ''}`}
          onPress={() => onClientSelect?.(client.id)}
          style={({ pressed }) => [
            styles.node,
            { left, top },
            pressed && styles.nodePressed,
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.nodePulse,
              {
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
          <View style={styles.nodeCore} />
        </Pressable>
      ))}
      {!clients.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Keine Klient:innen im aktuellen Mandantenkontext</Text>
          <Text style={styles.emptyDetail}>Neue oder importierte Stammdaten erscheinen hier automatisch.</Text>
        </View>
      ) : (
        <View pointerEvents="none" style={styles.badge}>
          <Text style={styles.badgeCount}>{clients.length}</Text>
          <Text style={styles.badgeLabel}>Klient:innen dauerhaft im Versorgungsnetz</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: '#EEF6FF',
  },
  node: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: liquidColors.blue400,
    backgroundColor: 'rgba(20,120,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: liquidColors.blue500,
    shadowOpacity: 0.75,
    shadowRadius: 7,
  },
  nodePressed: {
    transform: [{ scale: 1.15 }],
  },
  nodePulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: liquidColors.blue400,
  },
  nodeCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: liquidColors.blue200,
  },
  badge: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    maxWidth: 260,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: liquidRadius.control,
    borderWidth: 1,
    borderColor: liquidColors.white18,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  badgeCount: {
    color: '#0B1220',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  badgeLabel: {
    color: '#475569',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  empty: {
    ...StyleSheet.absoluteFillObject,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: liquidColors.white88,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDetail: {
    color: liquidColors.white56,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
