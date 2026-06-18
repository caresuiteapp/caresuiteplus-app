import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import {
  CARE_EMOJI_CATEGORIES,
  getCareEmojiA11yLabel,
  type CareEmojiCategory,
} from '@/data/office/careemojipicker';

type CareEmojiPickerProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
};

export function CareEmojiPicker({ visible, onClose, onSelect }: CareEmojiPickerProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const [activeCategory, setActiveCategory] = useState<CareEmojiCategory['id']>('reaktionen');

  const active = CARE_EMOJI_CATEGORIES.find((category) => category.id === activeCategory)
    ?? CARE_EMOJI_CATEGORIES[0]!;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        tabs: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          marginBottom: spacing.sm,
        },
        tab: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
        },
        tabActive: {
          borderColor: c.violet,
          backgroundColor: `${c.violet}14`,
        },
        tabLabel: { ...typography.caption, color: c.muted, fontWeight: '600' },
        tabLabelActive: { color: c.violet },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
        },
        emojiBtn: {
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.sm,
        },
        emojiBtnHover: {
          backgroundColor: `${c.violet}12`,
        },
        emoji: { fontSize: 20, lineHeight: 24 },
      }),
    [c, typography],
  );

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
  };

  return (
    <PlatformModal
      visible={visible}
      title="Emoji auswählen"
      subtitle="Reaktionen, Pflege und Medizin"
      onClose={onClose}
      variant="bottomSheet"
      maxWidth={420}
      footerActions={[{ title: 'Schließen', onPress: onClose, variant: 'secondary' }]}
    >
      <View style={styles.tabs} accessibilityRole="tablist">
        {CARE_EMOJI_CATEGORIES.map((category) => {
          const isActive = category.id === activeCategory;
          return (
            <Pressable
              key={category.id}
              style={[styles.tab, isActive ? styles.tabActive : null]}
              onPress={() => setActiveCategory(category.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Kategorie ${category.label}`}
            >
              <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
                {category.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
        <View style={styles.grid} accessibilityRole="menu">
          {active.emojis.map((emoji) => (
            <Pressable
              key={`${active.id}-${emoji}`}
              style={({ pressed, hovered }) => [
                styles.emojiBtn,
                pressed || hovered ? styles.emojiBtnHover : null,
              ]}
              onPress={() => handleSelect(emoji)}
              accessibilityRole="menuitem"
              accessibilityLabel={getCareEmojiA11yLabel(emoji, active.label)}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </PlatformModal>
  );
}

type CareEmojiPickerButtonProps = {
  onPress: () => void;
  disabled?: boolean;
};

export function CareEmojiPickerButton({ onPress, disabled }: CareEmojiPickerButtonProps) {
  return (
    <PremiumButton
      title="😊"
      size="sm"
      variant="ghost"
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel="Emoji-Auswahl öffnen"
    />
  );
}
