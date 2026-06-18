import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import {
  useCareLightPalette,
  type CareLightResolved,
} from '@/design/tokens/carelightadaptive';

type CareLightSectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  style?: ViewStyle;
};

export function CareLightSection({ title, subtitle, children, style }: CareLightSectionProps) {
  const { c } = useCareLightPalette();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.root, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function makeStyles(c: CareLightResolved) {
  return StyleSheet.create({
    root: {
      gap: careSpacing.sm,
    },
    header: {
      gap: 2,
    },
    title: {
      ...careTypography.bodyStrong,
      color: c.text,
      fontSize: 17,
    },
    subtitle: {
      ...careTypography.caption,
      color: c.muted,
    },
  });
}
