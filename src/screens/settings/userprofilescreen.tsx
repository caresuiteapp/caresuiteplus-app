import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SettingsScreenFrame } from '@/components/settings/settingsscreenframe';
import { ErrorState, PremiumButton, PremiumInput, SuccessState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { saveUserProfile } from '@/lib/auth/userprofileservice';
import { APPEARANCE_SETTINGS_ROUTE } from '@/lib/screensaver/appearanceSettingsRoute';

export function UserProfileScreen({ embeddedInModal = false }: { embeddedInModal?: boolean } = {}) {
  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) {
    return (
      <SettingsScreenFrame title="Profil" embeddedInModal={embeddedInModal} showSideNavigation>
        <ErrorState message="Kein Benutzerprofil geladen." />
      </SettingsScreenFrame>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await saveUserProfile(profile, { firstName, lastName });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    updateProfile(result.data);
    setSaved(true);
  };

  return (
    <SettingsScreenFrame
      title="Profil & Konto"
      subtitle="Persönliche Daten"
      embeddedInModal={embeddedInModal}
      showSideNavigation
    >
      <PremiumInput label="Vorname" value={firstName} onChangeText={setFirstName} />
      <PremiumInput label="Nachname" value={lastName} onChangeText={setLastName} />
      <PremiumButton
        title="Darstellung & Oberfläche"
        variant="secondary"
        onPress={() => router.push(APPEARANCE_SETTINGS_ROUTE as never)}
      />
      {error ? <ErrorState message={error} /> : null}
      {saved ? <SuccessState message="Profil gespeichert." /> : null}
      <PremiumButton title={saving ? 'Speichern…' : 'Speichern'} onPress={handleSave} disabled={saving} />
    </SettingsScreenFrame>
  );
}
