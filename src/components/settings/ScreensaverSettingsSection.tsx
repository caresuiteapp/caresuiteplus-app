import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AuroraSegmentedControl } from '@/components/aurora';
import { useScreensaverSettings } from '@/components/screensaver';
import { ErrorState, PremiumButton, SectionPanel, SuccessState } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { spacing } from '@/theme';
import {
  SCREENSAVER_MODE_LABELS,
  SCREENSAVER_TIMEOUT_OPTIONS,
  type ScreensaverBounceSpeed,
  type ScreensaverLogoSize,
  type ScreensaverMode,
  type ScreensaverSettings,
  type ScreensaverTimeoutMinutes,
} from '@/lib/screensaver/screensaverTypes';

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const text = useAuroraAdaptiveText();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: text.primary }]}>{label}</Text>
      <View style={styles.control}>{children}</View>
    </View>
  );
}

export function ScreensaverSettingsSection() {
  const text = useAuroraAdaptiveText();
  const { isPhone } = useDeviceClass();
  const { settings, isLoaded, saveSettings, requestPreview } = useScreensaverSettings();
  const [draft, setDraft] = useState<ScreensaverSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded) setDraft(settings);
  }, [isLoaded, settings]);

  const patch = (next: Partial<ScreensaverSettings>) => {
    setDraft((prev) => ({ ...prev, ...next }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const payload: Partial<ScreensaverSettings> = {
      ...draft,
      enabled: draft.mode === 'off' ? false : draft.enabled,
    };
    const ok = await saveSettings(payload);
    setSaving(false);
    if (!ok) {
      setError('Einstellungen konnten nicht gespeichert werden.');
      return;
    }
    setSaved(true);
  };

  const modeOptions = (Object.keys(SCREENSAVER_MODE_LABELS) as ScreensaverMode[]).map((key) => ({
    key,
    label: SCREENSAVER_MODE_LABELS[key],
  }));

  const timeoutOptions = SCREENSAVER_TIMEOUT_OPTIONS.map((m) => ({
    key: String(m),
    label: `${m} Min.`,
  }));

  const logoSizeOptions: Array<{ key: ScreensaverLogoSize; label: string }> = [
    { key: 'small', label: 'Klein' },
    { key: 'medium', label: 'Mittel' },
    { key: 'large', label: 'Groß' },
  ];

  const bounceOptions: Array<{ key: ScreensaverBounceSpeed; label: string }> = [
    { key: 'slow', label: 'Langsam' },
    { key: 'normal', label: 'Normal' },
    { key: 'fast', label: 'Schnell' },
  ];

  const isLogoMode = draft.mode === 'logo_static' || draft.mode === 'logo_bounce';
  const isClockMode = draft.mode === 'clock' || draft.mode === 'clock_date';

  return (
    <SectionPanel
      title="Bildschirmschoner"
      subtitle="Der Bildschirmschoner startet automatisch nach einer festgelegten Zeit ohne Aktivität auf Desktop und Tablet."
    >
      {isPhone ? (
        <Text style={[styles.hint, { color: text.secondary }]}>
          Auf Mobilgeräten ist der Bildschirmschoner deaktiviert.
        </Text>
      ) : null}

      <SettingRow label="Aktivieren">
        <Switch
          value={draft.enabled && draft.mode !== 'off'}
          onValueChange={(enabled) => {
            if (!enabled) {
              patch({ enabled: false, mode: 'off' });
            } else {
              patch({
                enabled: true,
                mode: draft.mode === 'off' ? 'logo_bounce' : draft.mode,
              });
            }
          }}
        />
      </SettingRow>

      <SettingRow label="Start nach Inaktivität">
        <AuroraSegmentedControl
          options={timeoutOptions}
          value={String(draft.timeoutMinutes)}
          onChange={(key) => patch({ timeoutMinutes: Number(key) as ScreensaverTimeoutMinutes })}
        />
      </SettingRow>

      <SettingRow label="Anzeige">
        <AuroraSegmentedControl
          options={modeOptions}
          value={draft.mode}
          onChange={(key) => {
            const mode = key as ScreensaverMode;
            patch({
              mode,
              enabled: mode !== 'off',
            });
          }}
        />
      </SettingRow>

      {isLogoMode ? (
        <>
          <SettingRow label="Logo-Größe">
            <AuroraSegmentedControl
              options={logoSizeOptions}
              value={draft.logoSize}
              onChange={(key) => patch({ logoSize: key as ScreensaverLogoSize })}
            />
          </SettingRow>
          {draft.mode === 'logo_bounce' ? (
            <SettingRow label="Bewegung">
              <AuroraSegmentedControl
                options={bounceOptions}
                value={draft.bounceSpeed}
                onChange={(key) => patch({ bounceSpeed: key as ScreensaverBounceSpeed })}
              />
            </SettingRow>
          ) : null}
        </>
      ) : null}

      {isClockMode ? (
        <>
          <SettingRow label="Sekunden anzeigen">
            <Switch
              value={draft.showSeconds}
              onValueChange={(showSeconds) => patch({ showSeconds })}
            />
          </SettingRow>
          <SettingRow label="24-Stunden-Format">
            <Switch value={draft.use24h} onValueChange={(use24h) => patch({ use24h })} />
          </SettingRow>
          {draft.mode === 'clock_date' ? (
            <>
              <SettingRow label="Datum anzeigen">
                <Switch value={draft.showDate} onValueChange={(showDate) => patch({ showDate })} />
              </SettingRow>
              <SettingRow label="Wochentag anzeigen">
                <Switch
                  value={draft.showWeekday}
                  onValueChange={(showWeekday) => patch({ showWeekday })}
                />
              </SettingRow>
            </>
          ) : null}
        </>
      ) : null}

      {error ? <ErrorState message={error} /> : null}
      {saved ? <SuccessState message="Einstellungen gespeichert." /> : null}

      <View style={styles.actions}>
        <PremiumButton
          title="Bildschirmschoner testen"
          variant="secondary"
          onPress={() => requestPreview(draft)}
          disabled={isPhone || draft.mode === 'off' || !draft.enabled}
        />
        <PremiumButton
          title={saving ? 'Speichern…' : 'Speichern'}
          onPress={() => void handleSave()}
          disabled={saving}
        />
      </View>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  control: {
    marginTop: 4,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
