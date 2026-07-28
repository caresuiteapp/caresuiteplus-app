import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ClientListItem } from '@/types/modules/office';
import { liquidColors, liquidRadius } from '../foundation/tokens';

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
 * Native/offline fallback. It represents the complete tenant client network
 * without pretending that synthetic positions are geographic coordinates.
 * Web resolves real addresses through the configured Maps provider.
 */
export function ClientNetworkMap({
  clients,
  height = 320,
  onClientSelect,
}: ClientNetworkMapProps) {
  const nodes = useMemo(
    () =>
      clients.map((client) => ({
        client,
        left: positionPercent(client.id, 17),
        top: positionPercent(client.id, 83),
      })),
    [clients],
  );

  return (
    <View
      accessible
      accessibilityLabel={`Versorgungsnetz mit ${clients.length} Klientinnen und Klienten`}
      style={[styles.stage, { minHeight: height }]}
    >
      <View style={[styles.gridLine, styles.gridLineOne]} />
      <View style={[styles.gridLine, styles.gridLineTwo]} />
      <View style={[styles.gridLine, styles.gridLineThree]} />
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
    backgroundColor: 'rgba(2,14,32,0.88)',
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(61,145,255,0.3)',
    shadowColor: liquidColors.blue500,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  gridLineOne: {
    width: '90%',
    left: '5%',
    top: '36%',
    transform: [{ rotate: '-9deg' }],
  },
  gridLineTwo: {
    width: '80%',
    left: '10%',
    top: '60%',
    transform: [{ rotate: '13deg' }],
  },
  gridLineThree: {
    width: '58%',
    left: '32%',
    top: '48%',
    transform: [{ rotate: '-31deg' }],
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
    backgroundColor: 'rgba(6,21,43,0.88)',
  },
  badgeCount: {
    color: liquidColors.white,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  badgeLabel: {
    color: liquidColors.white64,
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
