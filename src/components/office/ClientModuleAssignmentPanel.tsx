import { StyleSheet, Text, View } from 'react-native';
import { FilterChip, SectionPanel } from '@/components/ui';
import {
  PORTAL_MODULE_KEYS,
  PORTAL_MODULE_LABELS,
} from '@/lib/portal/engine/portalModuleKeys';
import type { PortalModuleKey } from '@/lib/portal/types';
import { spacing, typography } from '@/theme';

type ClientModuleAssignmentPanelProps = {
  selected: PortalModuleKey[];
  onChange: (modules: PortalModuleKey[]) => void;
  disabled?: boolean;
};

export function ClientModuleAssignmentPanel({
  selected,
  onChange,
  disabled = false,
}: ClientModuleAssignmentPanelProps) {
  const toggle = (moduleKey: PortalModuleKey) => {
    if (disabled) return;
    if (selected.includes(moduleKey)) {
      onChange(selected.filter((key) => key !== moduleKey));
      return;
    }
    onChange([...selected, moduleKey]);
  };

  return (
    <SectionPanel
      title="Portal-Module"
      subtitle="Legt fest, welche Bereiche im Klient:innenportal sichtbar sind"
    >
      <Text style={styles.hint}>
        Wählen Sie ein oder mehrere Module. Bei mehreren Modulen erscheinen im Portal zusätzliche
        Modul-Tabs neben Übersicht, Dokumente, Nachrichten und Profil.
      </Text>
      <View style={styles.chips}>
        {PORTAL_MODULE_KEYS.map((moduleKey) => (
          <FilterChip
            key={moduleKey}
            label={PORTAL_MODULE_LABELS[moduleKey]}
            selected={selected.includes(moduleKey)}
            onPress={() => toggle(moduleKey)}
          />
        ))}
      </View>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
