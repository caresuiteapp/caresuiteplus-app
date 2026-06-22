import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DeveloperHubHero } from '@/components/admin';
import { ScreenShell } from '@/components/layout';
import { ModuleTile, SectionPanel } from '@/components/ui';
import { DEV_TOOL_ENTRIES } from '@/data/navigation/moduleNavConfig';

export function DeveloperHubScreen() {
  const router = useRouter();

  return (
    <ScreenShell
      title="Entwicklerwerkzeuge"
      subtitle="Intern — nicht für öffentliche Startseite"
      scroll
    >
      <DeveloperHubHero />
      <SectionPanel title="Interne Bereiche" subtitle="Nur für Admins und Entwicklung">
        <View style={styles.grid}>
          {DEV_TOOL_ENTRIES.map((entry) => (
            <ModuleTile
              key={entry.path}
              icon={entry.icon}
              title={entry.label}
              description={entry.description}
              accentColor={entry.accentColor}
              preparedOnly
              onPress={() => router.push(entry.path as never)}
            />
          ))}
        </View>
      </SectionPanel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 12,
  },
});
