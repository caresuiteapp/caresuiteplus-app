import { StyleSheet, Text, View } from 'react-native';
import {
  CareLightKpiCard,
  CareLightListHeroFrame,
  PremiumBadge,
} from '@/components/ui';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { ServiceMode } from '@/lib/services/mode';
import type { RoleKey } from '@/types';
import type { CareSuiteTemplate, TemplateScope } from '@/types/templates';
import { designTokens } from '@/theme';

export type TemplateListScopeHeroVariant = Extract<TemplateScope, 'system' | 'tenant'>;

export type TemplateListModuleHeroKey =
  | 'text-blocks'
  | 'care-templates'
  | 'document-templates'
  | 'message-templates'
  | 'billing-templates'
  | 'counseling-templates'
  | 'academy-templates'
  | 'consent-templates';

export type TemplateListHeroVariant = TemplateListScopeHeroVariant | TemplateListModuleHeroKey;

type VariantConfig = {
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
};

const SCOPE_VARIANT_CONFIG: Record<TemplateListScopeHeroVariant, VariantConfig> = {
  system: {
    title: 'Systemvorlagen',
    subtitle: 'CareSuite+ Standardvorlagen — mandantenübergreifend gepflegt.',
    icon: '🏛️',
    accent: careLightColors.cyan,
  },
  tenant: {
    title: 'Mandantenvorlagen',
    subtitle: 'Eigene Anpassungen und Overrides für Ihren Mandanten.',
    icon: '🏢',
    accent: careLightColors.green,
  },
};

const MODULE_VARIANT_CONFIG: Record<TemplateListModuleHeroKey, VariantConfig> = {
  'text-blocks': {
    title: 'Textbausteine',
    subtitle: 'Dokumentation & Nachrichten — wiederverwendbare Textmodule.',
    icon: '📝',
    accent: careLightColors.cyan,
  },
  'care-templates': {
    title: 'Pflege-Vorlagen',
    subtitle: 'SIS, Pflegeplan, Risiko — fachliche Pflege-Dokumentation.',
    icon: '❤️',
    accent: careLightColors.orange,
  },
  'document-templates': {
    title: 'Dokumentvorlagen',
    subtitle: 'Office & Dokumente — strukturierte Vorlagen für den Schreibtisch.',
    icon: '📄',
    accent: careLightColors.cyan,
  },
  'message-templates': {
    title: 'Nachrichten-Vorlagen',
    subtitle: 'Kommunikation — E-Mail- und Nachrichtentexte.',
    icon: '💬',
    accent: careLightColors.green,
  },
  'billing-templates': {
    title: 'Abrechnungsvorlagen',
    subtitle: 'Rechnung & Mahnung — Textbausteine für die Abrechnung.',
    icon: '💶',
    accent: careLightColors.orange,
  },
  'counseling-templates': {
    title: 'Beratungs-Vorlagen',
    subtitle: 'Protokolle & Checklisten — Beratungsdokumentation.',
    icon: '📋',
    accent: careLightColors.cyan,
  },
  'academy-templates': {
    title: 'Akademie-Vorlagen',
    subtitle: 'Kurse & Zertifikate — Schulungs- und Zertifikatsvorlagen.',
    icon: '🎓',
    accent: careLightColors.green,
  },
  'consent-templates': {
    title: 'Einwilligungen',
    subtitle: 'Consent & Datenschutz — Einwilligungstexte und Formulare.',
    icon: '✅',
    accent: careLightColors.orange,
  },
};

function resolveVariantConfig(variant: TemplateListHeroVariant): VariantConfig {
  if (variant === 'system' || variant === 'tenant') {
    return SCOPE_VARIANT_CONFIG[variant];
  }
  return MODULE_VARIANT_CONFIG[variant];
}

type TemplateListHeroProps = {
  variant: TemplateListHeroVariant;
  templates: CareSuiteTemplate[];
  roleKey: RoleKey;
  serviceMode: ServiceMode;
  hasActiveSearch?: boolean;
};

function buildKpis(templates: CareSuiteTemplate[]) {
  const active = templates.filter((t) => t.status === 'active').length;
  const draft = templates.filter((t) => t.status === 'draft').length;
  const archived = templates.filter((t) => t.status === 'archived').length;
  return [
    { id: 'active', label: 'Aktiv', value: String(active), icon: '✅', accent: careLightColors.green },
    { id: 'draft', label: 'Entwurf', value: String(draft), icon: '📝', accent: careLightColors.orange },
    { id: 'archived', label: 'Archiviert', value: String(archived), icon: '📦', accent: careLightColors.muted },
  ];
}

export function TemplateListHero({
  variant,
  templates,
  roleKey,
  serviceMode,
  hasActiveSearch = false,
}: TemplateListHeroProps) {
  const config = resolveVariantConfig(variant);
  const kpis = buildKpis(templates);
  const countLabel = hasActiveSearch
    ? `${templates.length} Treffer`
    : `${templates.length} Vorlagen`;

  return (
    <CareLightListHeroFrame accentColor={config.accent}>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>VORLAGENZENTRUM · PAKET F</Text>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.meta}>
            {countLabel} · {serviceMode === 'demo' ? 'Demo' : 'Live'}
          </Text>
          <Text style={styles.subtitle}>{config.subtitle}</Text>
        </View>
        <View style={[styles.iconBadge, { borderColor: `${config.accent}55`, backgroundColor: `${config.accent}18` }]}>
          <Text style={styles.iconText}>{config.icon}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        <PremiumBadge label="Paket F" variant="muted" />
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <CareLightKpiCard
            key={kpi.id}
            label={kpi.label}
            value={String(kpi.value)}
            icon={kpi.icon}
            accentColor={kpi.accent}
            style={styles.kpiItem}
          />
        ))}
      </View>
    </CareLightListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: careSpacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...careTypography.caption,
    color: careLightColors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
    fontWeight: '700',
  },
  title: { ...careTypography.h2, color: careLightColors.navy },
  meta: { ...careTypography.caption, color: careLightColors.muted },
  subtitle: { ...careTypography.caption, color: careLightColors.muted },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: careLightColors.border,
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
});
