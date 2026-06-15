import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PlatformHubHero } from '@/components/platform/PlatformHubHero';
import { ScreenShell } from '@/components/layout';
import { ModuleTile } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { spacing } from '@/theme';

const PLATFORM_AREAS = [
  {
    id: 'ocr',
    icon: '📄',
    title: 'OCR-Jobs',
    description: 'Dokumentenerkennung & Textextraktion',
    route: '/business/platform/ocr',
    accentColor: '#62F3FF',
  },
  {
    id: 'ai',
    icon: '🤖',
    title: 'KI-Jobs',
    description: 'Zusammenfassungen & Assistenz',
    route: '/business/platform/ai',
    accentColor: '#A78BFA',
  },
];

export function PlatformHubScreen() {
  const router = useRouter();
  const { roleKey } = usePermissions();

  return (
    <ScreenShell title="Plattform" subtitle="KI & OCR" showBack={false}>
      <PlatformHubHero roleKey={roleKey ?? 'business_admin'} ocrJobCount={3} aiJobCount={2} />
      <View style={styles.grid}>
        {PLATFORM_AREAS.map((area) => (
          <ModuleTile
            key={area.id}
            icon={area.icon}
            title={area.title}
            description={area.description}
            accentColor={area.accentColor}
            isActive
            onPress={() => router.push(area.route as never)}
          />
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.md, marginTop: spacing.md },
});
