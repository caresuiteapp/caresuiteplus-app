import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

export type CollapsibleSidebarSectionProps<T> = {
  title: string;
  items: T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  initialVisibleCount?: number;
  expandLabel?: string;
  collapseLabel?: string;
  titleStyle?: TextStyle;
  containerStyle?: ViewStyle;
  itemsContainerStyle?: ViewStyle;
  toggleStyle?: TextStyle;
};

/** Sidebar section showing `initialVisibleCount` items with (mehr...)/(weniger...) expand. */
export function CollapsibleSidebarSection<T>({
  title,
  items,
  getItemKey,
  renderItem,
  initialVisibleCount = 2,
  expandLabel = '(mehr...)',
  collapseLabel = '(weniger...)',
  titleStyle,
  containerStyle,
  itemsContainerStyle,
  toggleStyle,
}: CollapsibleSidebarSectionProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const canCollapse = items.length > initialVisibleCount;

  const visibleItems = useMemo(() => {
    if (!canCollapse || expanded) {
      return items;
    }
    return items.slice(0, initialVisibleCount);
  }, [canCollapse, expanded, initialVisibleCount, items]);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>{title}</Text>
      <View style={[styles.items, itemsContainerStyle]}>
        {visibleItems.map((item) => (
          <View key={getItemKey(item)}>{renderItem(item)}</View>
        ))}
      </View>
      {canCollapse ? (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={8}
        >
          <Text style={[styles.toggle, toggleStyle]}>{expanded ? collapseLabel : expandLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  items: {
    gap: 4,
  },
  toggle: {
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 2,
  },
});
