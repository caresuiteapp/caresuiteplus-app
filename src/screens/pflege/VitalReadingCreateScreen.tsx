import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { VitalReadingCreateHero } from '@/components/pflege/VitalReadingCreateHero';
import { FilterChipGroup, InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import {
  VITAL_CATEGORY_LABELS,
  VITAL_SIGN_CATALOG,
  getVitalDefinition,
  type VitalCategoryKey,
} from '@/lib/pflege/vitalCatalog';
import {
  createVitalReading,
  fetchClientVitalConfiguration,
  setClientVitalConfiguration,
} from '@/lib/pflege/vitalService';
import {
  vitalSignSupabaseRepository,
  type VitalClientConfiguration,
  type VitalClientOption,
} from '@/lib/services/repositories/vitalSignRepository.supabase';
import type { VitalReadingType } from '@/types/modules/pflege';
import { colors, radius, spacing, typography } from '@/theme';

const CATEGORY_ORDER: VitalCategoryKey[] = ['basis', 'koerper', 'pflege', 'haemodynamik', 'beatmung', 'blutgas'];

function parseGermanNumber(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function VitalReadingCreateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { isReadOnly, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const tenantId = profile?.tenantId ?? '';
  const employeeName = profile?.displayName?.trim()
    || `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim()
    || profile?.email
    || 'Angemeldete Mitarbeiter:in';

  const [clients, setClients] = useState<VitalClientOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [configuration, setConfiguration] = useState<VitalClientConfiguration[]>([]);
  const [typeKey, setTypeKey] = useState<VitalReadingType>('blood_pressure');
  const [values, setValues] = useState<Record<string, string>>({});
  const [context, setContext] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configurationLoading, setConfigurationLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<VitalReadingType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    async function loadClients() {
      if (!tenantId) {
        setError('Der angemeldeten Sitzung ist kein Mandant zugeordnet.');
        setLoading(false);
        return;
      }
      const result = await vitalSignSupabaseRepository.listActiveClients(tenantId);
      if (!mounted) return;
      setLoading(false);
      if (!result.ok) { setError(result.error); return; }
      setClients(result.data);
      setClientId((current) => current || result.data[0]?.id || '');
    }
    void loadClients();
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) entrance.setValue(1);
      else Animated.spring(entrance, { toValue: 1, friction: 8, tension: 55, useNativeDriver: true }).start();
    });
    return () => { mounted = false; };
  }, [entrance, tenantId]);

  const loadConfiguration = useCallback(async (selectedClientId: string) => {
    if (!selectedClientId || !tenantId) return;
    setConfigurationLoading(true);
    setError(null);
    const result = await fetchClientVitalConfiguration(tenantId, selectedClientId, roleKey);
    setConfigurationLoading(false);
    if (!result.ok) { setError(result.error); return; }
    setConfiguration(result.data);
    const enabled = result.data.filter((item) => item.enabled);
    setTypeKey((current) => enabled.some((item) => item.key === current) ? current : (enabled[0]?.key ?? 'blood_pressure'));
  }, [roleKey, tenantId]);

  useEffect(() => { void loadConfiguration(clientId); }, [clientId, loadConfiguration]);

  const configByKey = useMemo(() => new Map(configuration.map((item) => [item.key, item])), [configuration]);
  const enabledDefinitions = useMemo(
    () => VITAL_SIGN_CATALOG.filter((item) => configByKey.get(item.key)?.enabled ?? item.defaultEnabled),
    [configByKey],
  );
  const definition = getVitalDefinition(typeKey) ?? enabledDefinitions[0] ?? VITAL_SIGN_CATALOG[0];

  useEffect(() => { setValues({}); setContext({}); setNote(''); setSuccess(null); }, [clientId, typeKey]);

  async function toggleVital(key: VitalReadingType, enabled: boolean) {
    if (!clientId || isReadOnly || updatingKey) return;
    setUpdatingKey(key);
    setError(null);
    const result = await setClientVitalConfiguration(tenantId, clientId, key, enabled, roleKey);
    setUpdatingKey(null);
    if (!result.ok) { setError(result.error); return; }
    setConfiguration((current) => {
      const without = current.filter((item) => item.key !== key);
      return [...without, result.data];
    });
    if (!enabled && typeKey === key) {
      const next = enabledDefinitions.find((item) => item.key !== key)?.key;
      if (next) setTypeKey(next);
    }
  }

  function buildNumericValues(): Record<string, number> | null {
    const parsed: Record<string, number> = {};
    for (const component of definition.components) {
      const value = parseGermanNumber(values[component.key] ?? '');
      if (value != null) parsed[component.key] = value;
    }
    if (definition.key === 'gcs' && parsed.eyes != null && parsed.verbal != null && parsed.motor != null) {
      parsed.total = parsed.eyes + parsed.verbal + parsed.motor;
    }
    if (definition.key === 'fluid_balance' && parsed.intake != null && parsed.output != null) {
      parsed.balance = parsed.intake - parsed.output;
    }
    const requiredKeys = definition.key === 'blood_pressure' || definition.key === 'arterial_pressure'
      ? ['systolic', 'diastolic']
      : definition.key === 'gcs'
        ? ['eyes', 'verbal', 'motor']
        : definition.key === 'fluid_balance'
          ? ['intake', 'output']
          : definition.key === 'pupils'
            ? ['leftSize', 'rightSize']
            : [definition.components[0]?.key];
    if (requiredKeys.some((key) => !key || parsed[key] == null)) return null;
    return parsed;
  }

  async function handleSave() {
    if (isReadOnly || saving || !clientId) return;
    const numericValues = buildNumericValues();
    if (!numericValues) {
      setError('Bitte alle erforderlichen Messwerte als gültige Zahlen eingeben.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const cleanContext = Object.fromEntries(Object.entries(context).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]));
    const result = await createVitalReading(tenantId, {
      clientId,
      type: definition.key,
      values: numericValues,
      context: cleanContext,
      note,
      source: 'manual',
    }, roleKey);
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setSuccess(`Messung gespeichert · ${new Date(result.data.measuredAt).toLocaleString('de-DE')} · ${result.data.recordedByName ?? employeeName}`);
    setValues({}); setContext({}); setNote('');
    setTimeout(() => router.replace(`/pflege/vitalwerte/${result.data.id}` as never), 850);
  }

  const selectedClientName = clients.find((client) => client.id === clientId)?.name ?? '—';

  return (
    <ScreenShell title="Vitalwerte erfassen" subtitle={`Live · ${roleLabel ?? employeeName}`} scroll={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
          <VitalReadingCreateHero roleKey={roleKey} isReadOnly={isReadOnly} />
        </Animated.View>

        {error ? <InfoBanner presentation="inline" variant="danger" title="Aktion nicht möglich" message={error} /> : null}
        {success ? <InfoBanner presentation="inline" variant="success" title="Sicher gespeichert" message={success} /> : null}

        <SectionPanel title="1 · Klient:in" subtitle="Ausschließlich aktive Live-Klient:innen">
          {loading ? <ActivityIndicator color={colors.primary} /> : clients.length ? (
            <FilterChipGroup
              options={clients.map((client) => ({ key: client.id, label: client.name }))}
              value={clientId}
              onChange={setClientId}
            />
          ) : <InfoBanner presentation="inline" variant="warning" message="Keine aktive Klient:in vorhanden." />}
          <View style={styles.auditStrip}>
            <Text style={styles.auditIcon}>🔐</Text>
            <View style={styles.auditText}><Text style={styles.auditTitle}>Automatische Protokollierung</Text>
              <Text style={styles.auditMeta}>{employeeName} · Datum und Uhrzeit werden beim Speichern vom Server gesetzt.</Text></View>
          </View>
        </SectionPanel>

        <SectionPanel title="2 · Messart" subtitle={`${enabledDefinitions.length} von ${VITAL_SIGN_CATALOG.length} für ${selectedClientName} aktiviert`}>
          <PremiumButton
            title={showConfiguration ? 'Konfiguration schließen' : 'Vitalwerte für Klient:in aktivieren / deaktivieren'}
            variant="secondary" fullWidth onPress={() => setShowConfiguration((value) => !value)}
          />
          {showConfiguration ? (
            <View style={styles.configArea}>
              {CATEGORY_ORDER.map((category) => (
                <View key={category} style={styles.configGroup}>
                  <Text style={styles.categoryTitle}>{VITAL_CATEGORY_LABELS[category]}</Text>
                  <View style={styles.configGrid}>
                    {VITAL_SIGN_CATALOG.filter((item) => item.category === category).map((item) => {
                      const enabled = configByKey.get(item.key)?.enabled ?? item.defaultEnabled;
                      return (
                        <View key={item.key} style={[styles.configCard, enabled && { borderColor: item.color, backgroundColor: `${item.color}0D` }]}>
                          <Text style={styles.configIcon}>{item.icon}</Text>
                          <View style={styles.configText}><Text style={styles.configLabel}>{item.label}</Text>
                            <Text style={styles.configStatus}>{enabled ? 'Aktiviert' : 'Deaktiviert'}</Text></View>
                          {updatingKey === item.key ? <ActivityIndicator size="small" color={item.color} /> : (
                            <Switch value={enabled} disabled={isReadOnly} onValueChange={(value) => void toggleVital(item.key, value)}
                              trackColor={{ false: '#CBD5E1', true: `${item.color}88` }} thumbColor={enabled ? item.color : '#F8FAFC'} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : configurationLoading ? <ActivityIndicator color={colors.primary} /> : (
            <View style={styles.typeGrid}>
              {enabledDefinitions.map((item) => (
                <Pressable key={item.key} onPress={() => setTypeKey(item.key)} accessibilityRole="button"
                  accessibilityState={{ selected: item.key === typeKey }}
                  style={({ pressed }) => [styles.typeCard, item.key === typeKey && { borderColor: item.color, backgroundColor: `${item.color}12`, transform: [{ scale: 1.015 }] }, pressed && styles.pressed]}>
                  <View style={[styles.typeIconWrap, { backgroundColor: `${item.color}18` }]}><Text style={styles.typeIcon}>{item.icon}</Text></View>
                  <Text style={[styles.typeLabel, item.key === typeKey && { color: item.color }]}>{item.shortLabel}</Text>
                  {item.key === typeKey ? <View style={[styles.activeDot, { backgroundColor: item.color }]} /> : null}
                </Pressable>
              ))}
            </View>
          )}
        </SectionPanel>

        {!showConfiguration && definition ? (
          <SectionPanel title={`3 · ${definition.label}`} subtitle="Strukturierte Messung · Pflichtangaben sind gekennzeichnet" accentColor={definition.color}>
            <View style={styles.valueGrid}>
              {definition.components.map((component, index) => (
                <View key={component.key} style={styles.valueField}>
                  <PremiumInput
                    label={`${component.label}${index === 0 || ['blood_pressure', 'arterial_pressure', 'gcs', 'fluid_balance', 'pupils'].includes(definition.key) ? ' *' : ''} ${component.unit ? `(${component.unit})` : ''}`}
                    placeholder={component.placeholder}
                    value={values[component.key] ?? ''}
                    onChangeText={(value) => setValues((current) => ({ ...current, [component.key]: value }))}
                    keyboardType="decimal-pad" editable={!isReadOnly && !saving} onLightSurface
                  />
                </View>
              ))}
            </View>
            {definition.contextFields?.length ? (
              <View style={styles.valueGrid}>
                {definition.contextFields.map((field) => (
                  <View key={field.key} style={styles.valueField}><PremiumInput label={field.label} placeholder={field.placeholder}
                    value={context[field.key] ?? ''} onChangeText={(value) => setContext((current) => ({ ...current, [field.key]: value }))}
                    editable={!isReadOnly && !saving} onLightSurface /></View>
                ))}
              </View>
            ) : null}
            <PremiumInput label="Bemerkung" placeholder="Optionaler pflegefachlicher Kontext" value={note}
              onChangeText={setNote} multiline numberOfLines={3} editable={!isReadOnly && !saving} onLightSurface />
            <InfoBanner presentation="inline" variant="info" title="Dokumentationsfunktion"
              message="Konfigurierbare Grenzbereiche erzeugen einen Prüfhinweis. Die Software stellt keine Diagnose und gibt keine Therapie vor." />
            <PremiumButton title={saving ? 'Messung wird sicher gespeichert…' : 'Messung jetzt speichern'}
              loading={saving} fullWidth disabled={isReadOnly || !clientId || configurationLoading} onPress={() => void handleSave()} />
            <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
          </SectionPanel>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl },
  auditStrip: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(8,111,223,0.20)', backgroundColor: 'rgba(8,111,223,0.06)' },
  auditIcon: { fontSize: 22 }, auditText: { flex: 1, gap: 2 }, auditTitle: { ...typography.label, color: '#0F172A' },
  auditMeta: { ...typography.caption, color: '#475569' }, configArea: { gap: spacing.lg }, configGroup: { gap: spacing.sm },
  categoryTitle: { ...typography.h3, color: '#111827' }, configGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  configCard: { flexGrow: 1, flexBasis: 280, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderWidth: 1, borderColor: '#D8E2EF', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  configIcon: { fontSize: 21 }, configText: { flex: 1, gap: 2 }, configLabel: { ...typography.label, color: '#111827' },
  configStatus: { ...typography.caption, color: '#64748B' }, typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: { minWidth: 120, flexGrow: 1, flexBasis: 138, maxWidth: 220, minHeight: 96, padding: spacing.md,
    alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.lg, borderWidth: 1,
    borderColor: '#D8E2EF', backgroundColor: '#FFFFFF' }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  typeIconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  typeIcon: { fontSize: 21 }, typeLabel: { ...typography.label, color: '#25364D', textAlign: 'center' },
  activeDot: { width: 7, height: 7, borderRadius: 4, position: 'absolute', top: 9, right: 9 },
  valueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, valueField: { flexGrow: 1, flexBasis: 230, minWidth: 210 },
});
