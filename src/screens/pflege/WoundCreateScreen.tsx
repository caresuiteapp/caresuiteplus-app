import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
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
import { demoClients } from '@/data/demo/clients';
import { WOUND_LOCATIONS } from '@/data/demo/generators/pflegeDemoGenerators';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createBodyMapMarker } from '@/lib/pflege/bodyMapService';
import { isWoundDocumentationLiveReady } from '@/lib/pflege/pflegeModuleConfig';
import { createWoundDocumentation } from '@/lib/pflege/woundDocumentationService';
import type { BodyMapRegion } from '@/types/modules/bodyMap';
import { colors, spacing, typography } from '@/theme';

const REGION_MAP: Record<string, BodyMapRegion> = {
  'Unterschenkel links': 'bein_links',
  Sakrum: 'sakral',
  'Großzehe rechts': 'fuesse',
  'Ferse links': 'fuesse',
  'Ellenbogen rechts': 'arm_rechts',
  'Oberarm links': 'arm_links',
  'Knie rechts': 'bein_rechts',
  Steißbein: 'sakral',
  'Handrücken links': 'arm_links',
  'Schulter rechts': 'arm_rechts',
  'Wade links': 'bein_links',
  Brustwand: 'rumpf',
};

/** Arbeitsplan — /pflege/wunden/new */
export function WoundCreateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const writeReady = isWoundDocumentationLiveReady();

  const [clientId, setClientId] = useState(demoClients[0]?.id ?? 'client-001');
  const [bodyLocation, setBodyLocation] = useState(WOUND_LOCATIONS[0] ?? '');
  const [woundType, setWoundType] = useState('Ulcus cruris');
  const [woundSize, setWoundSize] = useState('');
  const [description, setDescription] = useState('');
  const [statusKey, setStatusKey] = useState('entwurf');
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function handlePickPhoto() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoName(result.assets[0].name);
    }
  }

  async function handleSave() {
    if (!writeReady || isReadOnly || !tenantId || !description.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createWoundDocumentation(
      tenantId,
      {
        clientId,
        bodyLocation,
        description: description.trim(),
        woundType: woundType.trim(),
        woundSize: woundSize.trim() || undefined,
      },
      profile?.roleKey,
    );
    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return;
    }

    const region = REGION_MAP[bodyLocation] ?? 'rumpf';
    await createBodyMapMarker(
      tenantId,
      {
        clientId,
        gender: 'neutral',
        view: 'vorderseite',
        region,
        markerType: 'wunde',
        xPercent: 50,
        yPercent: 50,
        note: `${woundType} — ${bodyLocation}`,
        woundId: result.data.id,
      },
      profile?.roleKey,
    );

    setSaving(false);
    setCreatedId(result.data.id);
    setTimeout(() => router.replace(`/pflege/wunden/${result.data.id}` as never), 900);
  }

  if (saving) {
    return (
      <ScreenShell title="Wunde dokumentieren" subtitle="Speichern…">
        <LoadingState message="Wunddokumentation wird gespeichert…" />
      </ScreenShell>
    );
  }

  if (createdId) {
    return (
      <ScreenShell title="Wunde angelegt" showBack={false}>
        <SuccessState message="Wunddokumentation gespeichert — Marker in BodyMap hinterlegt." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Wunde dokumentieren"
      subtitle={`BodyMap, Lokalisation, Verlauf · ${roleLabel ?? 'Demo'}`}
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroWrap}>
          <FormScreenHero
            eyebrow="PFLEGE · WUNDE"
            title="Neue Wunddokumentation"
            meta="Lokalisation, Typ, Größe — Demo-Persistenz mit BodyMap-Marker"
            icon="🩹"
            formMode="create"
            accentColor={colors.cyan}
          />
        </View>

        <InfoBanner
          variant="info"
          title="Demo-funktional"
          message="Speichert Wunde, BodyMap-Marker und Verlauf im Demo-Mandanten."
        />

        {!description ? (
          <EmptyState title="Neue Wunde" message="Pflichtfelder unten ausfüllen und speichern." />
        ) : null}

        <PremiumCard>
          <SectionPanel title="Klient:in & Lokalisation" subtitle="Pflichtfelder">
            <Text style={styles.fieldLabel}>Klient:in</Text>
            <FilterChipGroup
              options={demoClients.slice(0, 8).map((c) => ({
                key: c.id,
                label: `${c.firstName} ${c.lastName}`,
              }))}
              value={clientId}
              onChange={setClientId}
            />
            <Text style={styles.fieldLabel}>Körperregion *</Text>
            <View style={styles.chipRow}>
              {WOUND_LOCATIONS.slice(0, 6).map((loc) => (
                <PremiumButton
                  key={loc}
                  title={loc}
                  variant={bodyLocation === loc ? 'primary' : 'secondary'}
                  onPress={() => setBodyLocation(loc)}
                />
              ))}
            </View>
            <PremiumInput
              label="Lokalisation (frei)"
              value={bodyLocation}
              onChangeText={setBodyLocation}
              editable={!isReadOnly && writeReady}
            />
            <PremiumInput
              label="Wundtyp"
              value={woundType}
              onChangeText={setWoundType}
              editable={!isReadOnly && writeReady}
            />
            <PremiumInput
              label="Größe"
              placeholder="z. B. 3,2 × 2,1 cm"
              value={woundSize}
              onChangeText={setWoundSize}
              editable={!isReadOnly && writeReady}
            />
            <PremiumInput
              label="Status"
              value={statusKey}
              onChangeText={setStatusKey}
              editable={!isReadOnly && writeReady}
            />
            <PremiumInput
              label="Beschreibung / Verlauf *"
              value={description}
              onChangeText={setDescription}
              multiline
              editable={!isReadOnly && writeReady}
            />
          </SectionPanel>

          <SectionPanel title="Verlaufsfoto" subtitle="Optional — Demo-Upload">
            <PremiumButton
              title={photoName ? `Foto: ${photoName}` : 'Foto auswählen'}
              variant="secondary"
              onPress={handlePickPhoto}
              disabled={isReadOnly}
            />
            <PremiumButton
              title="BodyMap öffnen"
              variant="secondary"
              onPress={() =>
                router.push(
                  `/pflege/bodymap?clientId=${clientId}` as never,
                )
              }
            />
          </SectionPanel>

          {error ? <ErrorState message={error} /> : null}

          <PremiumButton
            title="Wunddokumentation speichern"
            fullWidth
            disabled={!writeReady || isReadOnly || !description.trim()}
            onPress={handleSave}
          />
          <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
        </PremiumCard>
      </ScrollView>
    </ScreenShell>
  );
}


const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  heroWrap: { marginBottom: spacing.md },
  fieldLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
});
