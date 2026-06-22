import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { PreparedTemplateBanner } from '@/components/templates';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { DOCUMENT_LAYOUT_AREA_LABELS, DOCUMENT_LAYOUT_AREAS } from '@/features/documents/templateEngine';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchTenantDocumentSettings, saveTenantDocumentSettings } from '@/lib/documents';
import type { LogoPosition, TenantDocumentSettingsForm } from '@/types/documents/tenantDocumentSettings';
import { colors, spacing, typography } from '@/theme';

const LOGO_POSITIONS: { key: LogoPosition; label: string }[] = [
  { key: 'left', label: 'Links' },
  { key: 'center', label: 'Zentriert' },
  { key: 'right', label: 'Rechts' },
];

export function DocumentCiLayoutSettingsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<TenantDocumentSettingsForm | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTenantDocumentSettings(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  useEffect(() => {
    if (!query.data) return;
    const { id: _id, tenantId: _tid, updatedAt: _ua, ...rest } = query.data;
    setForm(rest);
  }, [query.data?.updatedAt]);

  if (!can('office.catalogs.view')) {
    return (
      <ScreenShell title="CI & Layout" subtitle={roleLabel ?? ''}>
        <LockedActionBanner
          message={check('office.catalogs.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="CI & Layout" subtitle="Wird geladen…">
        <LoadingState message="Mandanten-CI wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="CI & Layout" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  if (!form) return null;

  const patch = <K extends keyof TenantDocumentSettingsForm>(key: K, value: TenantDocumentSettingsForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!tenantId || !form) return;
    setSaveError(null);
    const result = await saveTenantDocumentSettings(tenantId, form, profile?.roleKey);
    if (result.ok) {
      setSaved(true);
      await query.refresh();
    } else {
      setSaveError(result.error);
    }
  };

  return (
    <ScreenShell title="CI- & Layout-Einstellungen" subtitle="Vorlagen & Dokumente">
      <ScrollView contentContainerStyle={styles.content}>
        <PreparedTemplateBanner />
        <InfoBanner
          variant="info"
          message="Konfiguration für Briefpapier und Geschäftsdokumente. Keine Garantie für rechtliche Vollständigkeit — Pflichtangaben bitte fachlich prüfen."
        />

        <SectionPanel title="Mandanten-CI">
          <PremiumInput
            label="Logo-URL (PNG/JPG/SVG)"
            value={form.logoUrl ?? ''}
            onChangeText={(v) => patch('logoUrl', v || null)}
            editable={can('office.catalogs.edit')}
            hint="35–55 mm Breite, Seitenverhältnis bleibt erhalten"
          />
          <PremiumInput
            label="Primärfarbe"
            value={form.primaryColor}
            onChangeText={(v) => patch('primaryColor', v)}
            editable={can('office.catalogs.edit')}
          />
          <PremiumInput
            label="Sekundärfarbe"
            value={form.secondaryColor}
            onChangeText={(v) => patch('secondaryColor', v)}
            editable={can('office.catalogs.edit')}
          />
          <PremiumInput
            label="Akzentfarbe"
            value={form.accentColor}
            onChangeText={(v) => patch('accentColor', v)}
            editable={can('office.catalogs.edit')}
          />
          <PremiumInput
            label="Schriftart"
            value={form.fontFamily}
            onChangeText={(v) => patch('fontFamily', v)}
            editable={can('office.catalogs.edit')}
          />
          <View style={styles.row}>
            <Text style={styles.label}>CI-Pflicht bei Finalisierung</Text>
            <Switch
              value={form.ciEnforcementEnabled}
              onValueChange={(v) => patch('ciEnforcementEnabled', v)}
              disabled={!can('office.catalogs.edit')}
            />
          </View>
        </SectionPanel>

        <SectionPanel title="Header-Layout">
          <FilterChipGroup
            options={LOGO_POSITIONS}
            value={form.headerLayout.logoPosition}
            onChange={(v) => patch('headerLayout', { ...form.headerLayout, logoPosition: v })}
          />
          <PremiumInput
            label="Ansprechpartner"
            value={form.headerLayout.contactPersonName ?? ''}
            onChangeText={(v) => patch('headerLayout', { ...form.headerLayout, contactPersonName: v })}
            editable={can('office.catalogs.edit')}
          />
          <PremiumInput
            label="Ansprechpartner E-Mail"
            value={form.headerLayout.contactPersonEmail ?? ''}
            onChangeText={(v) => patch('headerLayout', { ...form.headerLayout, contactPersonEmail: v })}
            editable={can('office.catalogs.edit')}
          />
        </SectionPanel>

        <SectionPanel title="Bankverbindung & Standardtexte">
          <PremiumInput label="Bank" value={form.bankName} onChangeText={(v) => patch('bankName', v)} editable={can('office.catalogs.edit')} />
          <PremiumInput label="IBAN" value={form.iban} onChangeText={(v) => patch('iban', v)} editable={can('office.catalogs.edit')} />
          <PremiumInput label="BIC" value={form.bic} onChangeText={(v) => patch('bic', v)} editable={can('office.catalogs.edit')} />
          <PremiumInput
            label="Standard-Zahlungsziel (Tage)"
            value={String(form.defaultPaymentTermsDays)}
            onChangeText={(v) => patch('defaultPaymentTermsDays', Number(v) || 0)}
            editable={can('office.catalogs.edit')}
            keyboardType="numeric"
          />
          <PremiumInput
            label="Standard-Steuerhinweis"
            value={form.defaultTaxNotice}
            onChangeText={(v) => patch('defaultTaxNotice', v)}
            multiline
            editable={can('office.catalogs.edit')}
          />
          <PremiumInput
            label="Standard-Vertragsklauseln"
            value={form.defaultContractClauses}
            onChangeText={(v) => patch('defaultContractClauses', v)}
            multiline
            editable={can('office.catalogs.edit')}
          />
          <PremiumInput
            label="Standard-Mahnfristen"
            value={form.defaultDunningTerms}
            onChangeText={(v) => patch('defaultDunningTerms', v)}
            multiline
            editable={can('office.catalogs.edit')}
          />
          <PremiumInput
            label="Dokumentensprache"
            value={form.defaultDocumentLanguage}
            onChangeText={(v) => patch('defaultDocumentLanguage', v)}
            editable={can('office.catalogs.edit')}
          />
        </SectionPanel>

        <SectionPanel title="A4-Layout & Bereiche">
          <Text style={styles.meta}>
            {form.pageLayout.widthMm}×{form.pageLayout.heightMm} mm · Ränder L{form.pageLayout.marginLeftMm}/R
            {form.pageLayout.marginRightMm}/O{form.pageLayout.marginTopMm}/U{form.pageLayout.marginBottomMm} mm ·{' '}
            {form.pageLayout.baseFontSizePt} pt
          </Text>
          <View style={styles.areas}>
            {DOCUMENT_LAYOUT_AREAS.map((area) => (
              <Text key={area} style={styles.areaChip}>
                {DOCUMENT_LAYOUT_AREA_LABELS[area]}
              </Text>
            ))}
          </View>
        </SectionPanel>

        {saveError ? <ErrorState message={saveError} /> : null}
        {saved ? <SuccessState message="CI-Einstellungen gespeichert." /> : null}

        {can('office.catalogs.edit') ? (
          <PremiumButton title="Speichern" onPress={handleSave} />
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  label: { ...typography.body, flex: 1 },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  areaChip: {
    ...typography.caption,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    color: colors.textMuted,
  },
});
