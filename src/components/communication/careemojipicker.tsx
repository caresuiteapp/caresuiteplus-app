import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { CARE_EMOJI_CATEGORIES } from '@/data/office/careemojipicker';
import { spacing, radius } from '@/theme';

type CareEmojiPickerProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  disabled?: boolean;
};

export function CareEmojiPicker({ visible, onClose, onSelect, disabled }: CareEmojiPickerProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const [activeCategory, setActiveCategory] = useState(CARE_EMOJI_CATEGORIES[0]?.key ?? 'reaktionen');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.lg,
          backgroundColor: c.surfaceAlt,
          overflow: 'hidden',
          maxHeight: 280,
        },
        tabs: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          padding: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },
        tab: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: `${c.violet}08`,
        },
        tabActive: {
          borderColor: c.violet,
          backgroundColor: `${c.violet}18`,
        },
        tabLabel: { ...typography.caption, color: c.text, fontWeight: '600' },
        gridWrap: { maxHeight: 200 },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          padding: spacing.sm,
        },
        emojiBtn: {
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.sm,
        },
        emoji: { fontSize: 22, lineHeight: 26 },
        footer: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          padding: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: c.border,
        },
      }),
    [c, typography],
  );

  if (!visible) return null;

  const category =
    CARE_EMOJI_CATEGORIES.find((item) => item.key === activeCategory) ?? CARE_EMOJI_CATEGORIES[0];

  return (
    <View style={styles.panel} accessibilityRole="menu" accessibilityLabel="Emoji-Auswahl">
      <View style={styles.tabs}>
        {CARE_EMOJI_CATEGORIES.map((item) => {
          const isActive = item.key === activeCategory;
          return (
            <Pressable
              key={item.key}
              style={[styles.tab, isActive ? styles.tabActive : null]}
              onPress={() => setActiveCategory(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={item.accessibilityLabel}
            >
              <Text style={styles.tabLabel}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView style={styles.gridWrap} nestedScrollEnabled>
        <View style={styles.grid}>
          {category.emojis.map((emoji, index) => (
            <Pressable
              key={`${category.key}-${emoji}-${index}`}
              style={styles.emojiBtn}
              disabled={disabled}
              onPress={() => {
                onSelect(emoji);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Emoji ${emoji} einfügen`}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PremiumButton title="Schließen" size="sm" variant="ghost" onPress={onClose} />
      </View>
    </View>
  );
}
