import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumButton } from '@/components/ui';
import { useAuroraGlassChipStyles } from '@/design/tokens/auroraGlass';
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
  const chipStyles = useAuroraGlassChipStyles({ viewContext: 'form' });
  const [activeCategory, setActiveCategory] = useState<CareEmojiCategory['key']>('reaktionen');

  const active = CARE_EMOJI_CATEGORIES.find((category) => category.key === activeCategory)
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
        emojiBtnPressed: {
          backgroundColor: `${c.violet}12`,
        },
        emoji: { fontSize: 20, lineHeight: 24 },
      }),
    [c, typography, chipStyles],
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
          const isActive = category.key === activeCategory;
          return (
            <Pressable
              key={category.key}
              style={[chipStyles.chip, isActive ? chipStyles.chipSelected : null]}
              onPress={() => setActiveCategory(category.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Kategorie ${category.label}`}
            >
              <Text style={[chipStyles.label, isActive ? chipStyles.labelSelected : null]}>
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
              key={`${active.key}-${emoji}`}
              style={({ pressed }) => [
                styles.emojiBtn,
                pressed ? styles.emojiBtnPressed : null,
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
