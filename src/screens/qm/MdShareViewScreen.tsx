import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumCard } from '@/components/ui';
import { MdShareViewHero } from '@/components/qm';
import { validateMdShareToken } from '@/lib/qm';
import type { MdShareViewResult } from '@/lib/qm/mdAuditPackageService';
import { colors, spacing, typography } from '@/theme';

/** Öffentliche MD-Freigabe-Ansicht (Token-Validierung) */
export function MdShareViewScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [data, setData] = useState<MdShareViewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Kein Token angegeben.');
      setLoading(false);
      return;
    }
    validateMdShareToken(token, { userAgent: 'MdShareView' }).then((result) => {
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error);
        setData(null);
      }
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <ScreenShell title="MD-Freigabe" subtitle="Token wird geprüft…" showBack={false}>
        <LoadingState message="Freigabe wird validiert…" />
      </ScreenShell>
    );
  }

  if (error || !data) {
    return (
      <ScreenShell title="MD-Freigabe" showBack={false}>
        <ErrorState title="Zugriff verweigert" message={error ?? 'Ungültiger Link.'} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={data.package.title} subtitle="MD-Prüfungsmappe (Freigabe)" showBack={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <MdShareViewHero
          packageTitle={data.package.title}
          documentCount={data.items.length}
          inspectionYear={data.package.inspectionYear}
        />
        <Text style={styles.count}>{data.items.length} Dokumente in dieser Mappe</Text>
        {data.items.map((item) => (
          <PremiumCard key={item.id} accentColor={colors.cyan}>
            <Text style={styles.docId}>Dokument {item.documentId}</Text>
            <Text style={styles.version}>Version: {item.includedVersionId ?? '—'}</Text>
          </PremiumCard>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  meta: { ...typography.caption, color: colors.textMuted },
  count: { ...typography.bodyStrong, marginBottom: spacing.sm },
  docId: { ...typography.bodyStrong },
  version: { ...typography.caption, color: colors.textMuted },
});
