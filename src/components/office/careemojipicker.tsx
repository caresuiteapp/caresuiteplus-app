import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { auroraGlass, useAuroraGlassChipStyles } from '@/design/tokens/auroraGlass';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
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
  const chipStyles = useAuroraGlassChipStyles({ viewContext: 'form' });
  const [activeCategory, setActiveCategory] = useState<CareEmojiCategory['key']>('alltagsbegleitung');

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
    [c],
  );

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
  };

  return (
    <PlatformModal
      visible={visible}
      title="Emoji auswählen"
      subtitle="Alltagsbegleitung, Pflege, Stationär, Akademie, Verwaltung, Menschen, Essen & Trinken, Transport"
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
  onDarkSurface?: boolean;
};

export function CareEmojiPickerButton({
  onPress,
  disabled,
  onDarkSurface = false,
}: CareEmojiPickerButtonProps) {
  const { c } = useCareLightPalette();
  return (
    <Pressable
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: onDarkSurface ? auroraGlass.border : c.border,
        backgroundColor: onDarkSurface ? auroraGlass.chip : c.surface,
        opacity: disabled ? 0.45 : 1,
      }}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Emoji-Auswahl öffnen"
    >
      <Text style={{ fontSize: 17 }}>😊</Text>
    </Pressable>
  );
}
