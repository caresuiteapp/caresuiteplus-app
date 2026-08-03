import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  completeFirstLogin,
  loginBusinessUser,
  loginEmployeePortal,
  registerBusinessTenant,
  useAuth,
} from '@/lib/auth';
import type { BusinessRegistrationInput } from '@/lib/auth/auth.types';
import {
  loginClientPortal,
} from '@/lib/auth/clientPortalAuthService';
import { sanitizePortalUsernameInput } from '@/lib/auth/clientPortalUsernameGenerator';
import { completePortalLogin } from '@/lib/auth/portalLoginFlow';
import { normalizePortalCodeInput } from '@/lib/auth/portalCodeGenerator';
import { requestBusinessPasswordReset } from '@/lib/auth/passwordResetService';
import {
  getSession,
  signOut as supabaseSignOut,
  updatePassword,
} from '@/lib/supabase/authService';
import {
  LiquidBackdrop,
  LiquidButton,
  LiquidField,
  LiquidGlyph,
  LiquidLogo,
  LiquidState,
  LiquidStatus,
  LiquidSurface,
  LiquidText,
} from '../components/LiquidPrimitives';
import { liquidColors, liquidRadius } from '../foundation/tokens';
import { useLiquidLayout } from '../foundation/useLiquidLayout';
import { resolveAccessHeaderLogoWidth } from '@/lib/portal/portalResponsiveLayout';
export { AccessHubScreen } from './AccessHubScreen';

type AccessShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  backRoute?: string;
  side?: ReactNode;
  compact?: boolean;
};

function AccessShell({
  eyebrow,
  title,
  subtitle,
  children,
  backRoute,
  side,
  compact = false,
}: AccessShellProps) {
  const router = useRouter();
  const layout = useLiquidLayout();
  const insets = useSafeAreaInsets();
  const stacked = layout.isPhone || (layout.isTablet && layout.isPortrait);
  return (
    <LiquidBackdrop>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.accessRoot}
      >
        {!compact ? (
          <View style={[styles.accessTopBar, { paddingTop: Math.max(insets.top, 14) }]}>
            <LiquidLogo width={resolveAccessHeaderLogoWidth(layout.width)} />
            {backRoute ? (
              <LiquidButton
                compact
                label="Zurück"
                icon="‹"
                variant="ghost"
                onPress={() => router.replace(backRoute as never)}
              />
            ) : null}
          </View>
        ) : null}
        <ScrollView
          style={styles.accessScrollViewport}
          contentContainerStyle={[
            styles.accessScroll,
            layout.isPhone && styles.accessScrollPhone,
            { paddingBottom: Math.max(insets.bottom, layout.isPhone ? 24 : 40) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[
            styles.accessGrid,
            stacked && styles.accessGridPhone,
            compact && styles.accessGridCompact,
          ]}>
            <View
              testID="liquid-access-main"
              style={[styles.accessMain, compact && styles.accessMainCompact]}
            >
              {compact ? (
                <View style={styles.compactBrand}>
                  <LiquidLogo />
                </View>
              ) : null}
              <View style={styles.accessHeading}>
                <LiquidText variant="kicker">{eyebrow}</LiquidText>
                <LiquidText
                  variant={layout.isPhone ? 'title' : 'display'}
                  accessibilityRole="header"
                >
                  {title}
                </LiquidText>
                <LiquidText variant="body" style={styles.accessSubtitle}>{subtitle}</LiquidText>
              </View>
              {children}
            </View>
            {!compact && !stacked && side ? <View style={styles.accessSide}>{side}</View> : null}
          </View>
          {!compact && stacked && side ? <View style={styles.accessMobileSide}>{side}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </LiquidBackdrop>
  );
}

function SecuritySide() {
  return (
    <LiquidSurface active contentStyle={styles.securityCard}>
      <LiquidText variant="kicker">SICHERER ZUGANG</LiquidText>
      <LiquidText variant="section">Ihre Sitzung bleibt geschützt.</LiquidText>
      {[
        ['⌑', 'Mandantengetrennte Daten'],
        ['✓', 'DSGVO-konforme Zugriffslogik'],
        ['◉', 'Rollen und Audit nachvollziehbar'],
        ['⌁', 'Sitzungswiederherstellung'],
      ].map(([glyph, label]) => (
        <View key={label} style={styles.securityRow}>
          <View style={styles.securityGlyph}><LiquidGlyph glyph={glyph} size={20} /></View>
          <Text style={styles.securityLabel}>{label}</Text>
        </View>
      ))}
    </LiquidSurface>
  );
}

export function BusinessAccessScreen() {
  const router = useRouter();
  const { signInWithSupabaseSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('E-Mail und Passwort sind erforderlich.');
      return;
    }
    setLoading(true);
    try {
      const result = await loginBusinessUser(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!result.data.supabaseSession) {
        setError('Die Anmeldung lieferte keine sichere Sitzung. Bitte den Zugang prüfen.');
        return;
      }
      await signInWithSupabaseSession(result.data.supabaseSession);
      router.replace('/' as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccessShell
      eyebrow="VERWALTUNG"
      title="Verwaltung sicher öffnen."
      subtitle="Anmeldung für Geschäftsführung, Administration und interne Fachbereiche."
      backRoute="/auth"
      side={<SecuritySide />}
    >
      <LiquidSurface active contentStyle={styles.formCard}>
        {error ? (
          <LiquidState
            kind="error"
            title="Anmeldung nicht möglich"
            message={error}
            actionLabel="Eingabe prüfen"
            onAction={() => setError(null)}
          />
        ) : null}
        <LiquidField
          label="E-Mail"
          value={email}
          onChangeText={setEmail}
          placeholder="name@einrichtung.de"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          required
        />
        <LiquidField
          label="Passwort"
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          secureTextEntry
          required
        />
        <LiquidButton fullWidth label="Anmelden" loading={loading} onPress={() => void submit()} />
        <View style={styles.formSecondaryActions}>
          <LiquidButton
            label="Passwort vergessen"
            variant="ghost"
            onPress={() => router.push('/auth/forgot-password' as never)}
          />
        </View>
      </LiquidSurface>
    </AccessShell>
  );
}

export function EmployeeAccessScreen() {
  const router = useRouter();
  const { signInPortalSession } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!username.trim() || !password) {
      setError('Benutzername und Passwort sind erforderlich.');
      return;
    }
    setLoading(true);
    try {
      const result = await loginEmployeePortal(username, password);
      if (!result.ok || !result.data.portalSession) {
        setError(result.ok ? 'Die sichere Portal-Sitzung fehlt.' : result.error);
        return;
      }
      const completed = await completePortalLogin(result.data.portalSession, {
        supabaseAccessToken: result.data.supabaseAccessToken,
        supabaseRefreshToken: result.data.supabaseRefreshToken,
      });
      if (!completed.ok) {
        setError(completed.error);
        return;
      }
      await signInPortalSession(completed.data.portalSession);
      router.replace(
        result.data.mustChangePassword
          ? '/auth/employee-first-login'
          : '/portal/employee' as never,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccessShell
      eyebrow="MITARBEITENDEN-APP"
      title="Ihr Arbeitstag beginnt hier."
      subtitle="Persönlicher Zugang für Einsätze, Zeiten, Dokumente und Gehaltsinformationen."
      backRoute="/auth"
      side={<SecuritySide />}
    >
      <LiquidSurface active contentStyle={styles.formCard}>
        {error ? <LiquidState kind="error" title="Anmeldung fehlgeschlagen" message={error} /> : null}
        <LiquidField
          label="Benutzername"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          required
        />
        <LiquidField
          label="Passwort oder Einmalpasswort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          required
        />
        <LiquidButton fullWidth label="Mitarbeitenden-App öffnen" loading={loading} onPress={() => void submit()} />
        <LiquidStatus label="Kein öffentliches Mitarbeitendenkonto" detail="Zugang durch Verwaltung" />
      </LiquidSurface>
    </AccessShell>
  );
}

export function PortalAccessScreen({ portal: _portal }: { portal: 'client' }) {
  const router = useRouter();
  const { signInPortalSession } = useAuth();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError(null);
    if (!username.trim()) {
      setError('Benutzername ist erforderlich.');
      return;
    }
    if (!code.trim()) {
      setError('Der sechsstellige Portal-Code ist erforderlich.');
      return;
    }
    setLoading(true);
    try {
      const result = await loginClientPortal(username, code);
      if (!result.ok || !result.data.portalSession) {
        setError(result.ok ? 'Die sichere Portal-Sitzung fehlt.' : result.error);
        return;
      }
      const completed = await completePortalLogin(result.data.portalSession, {
        supabaseAccessToken: result.data.supabaseAccessToken,
        supabaseRefreshToken: result.data.supabaseRefreshToken,
      });
      if (!completed.ok) {
        setError(completed.error);
        return;
      }
      await signInPortalSession(completed.data.portalSession);
      router.replace('/portal/client' as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Portal-Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccessShell
      eyebrow="KLIENT:INNENPORTAL"
      title="Ihre Versorgung. Klar im Blick."
      subtitle="Termine, Live-Anfahrt, Dokumente und Nachrichten in einfacher Sprache."
      backRoute="/auth"
      side={<SecuritySide />}
    >
      <LiquidSurface active contentStyle={styles.formCard}>
        {error ? <LiquidState kind="error" title="Zugang nicht möglich" message={error} /> : null}
        <LiquidField
          label="Benutzername"
          value={username}
          onChangeText={(value) => setUsername(sanitizePortalUsernameInput(value))}
          autoCapitalize="none"
          autoCorrect={false}
          required
        />
        <LiquidField
          label="Portal-Code"
          value={code}
          onChangeText={(value) => setCode(normalizePortalCodeInput(value))}
          autoCapitalize="characters"
          maxLength={6}
          required
          hint="Sechs Zeichen ohne I, O, 0 oder 1."
        />
        <LiquidButton fullWidth label="Portal sicher öffnen" loading={loading} onPress={() => void submit()} />
        <LiquidButton
          fullWidth
          label="Hilfe anfordern"
          variant="secondary"
          onPress={() => setError('Bitte wenden Sie sich an Ihre zuständige Verwaltung.')}
        />
      </LiquidSurface>
    </AccessShell>
  );
}

const registrationModules = [
  ['office', 'Office'],
  ['assist', 'Assist'],
  ['pflege', 'Pflege'],
  ['stationaer', 'Stationär'],
  ['beratung', 'Beratung'],
  ['akademie', 'Akademie'],
] as const;

const REGISTRATION_DRAFT_KEY = 'caresuite.liquid.registration.v1';

const EMPTY_REGISTRATION: BusinessRegistrationInput = {
  companyName: '',
  legalForm: '',
  industry: '',
  street: '',
  zip: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  ikNumber: '',
  taxNumber: '',
  vatId: '',
  contactFirstName: '',
  contactLastName: '',
  contactRole: 'Geschäftsführung',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPhone: '',
  adminPassword: '',
  selectedModules: ['office', 'assist'],
};

const registrationSteps = [
  ['Organisation', 'Stammdaten und Leistungsbereich'],
  ['Anschrift', 'Adresse und Erreichbarkeit'],
  ['Verantwortung', 'Kontakt und Administrationskonto'],
  ['Module', 'Versorgungsbereiche aktivieren'],
  ['Sicherheit', 'Passwort und Datenschutz'],
  ['Prüfung', 'Angaben kontrollieren und starten'],
] as const;

export function RegisterOrganizationScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<BusinessRegistrationInput>(EMPTY_REGISTRATION);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ username?: string } | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(REGISTRATION_DRAFT_KEY).then((value) => {
      if (!value) return;
      try {
        const parsed = JSON.parse(value) as Partial<BusinessRegistrationInput>;
        setForm((current) => ({ ...current, ...parsed, adminPassword: '' }));
      } catch {
        // A damaged local draft is ignored; the user can continue with clean fields.
      }
    });
  }, []);

  useEffect(() => {
    const safeDraft = { ...form, adminPassword: '' };
    void AsyncStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify(safeDraft));
  }, [form]);

  const update = <K extends keyof BusinessRegistrationInput>(
    key: K,
    value: BusinessRegistrationInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const toggleModule = (module: BusinessRegistrationInput['selectedModules'][number]) => {
    if (module === 'office') return;
    setForm((current) => ({
      ...current,
      selectedModules: current.selectedModules.includes(module)
        ? current.selectedModules.filter((entry) => entry !== module)
        : [...current.selectedModules, module],
    }));
  };

  const stepError = useMemo(() => {
    if (step === 0 && (!form.companyName.trim() || !form.legalForm.trim() || !form.industry.trim())) {
      return 'Firmenname, Rechtsform und Einrichtungstyp sind erforderlich.';
    }
    if (step === 1 && (!form.street.trim() || !form.zip.trim() || !form.city.trim() || !form.phone.trim() || !form.email.trim())) {
      return 'Anschrift, Telefon und Organisations-E-Mail sind erforderlich.';
    }
    if (step === 2 && (!form.adminFirstName.trim() || !form.adminLastName.trim() || !form.adminEmail.trim())) {
      return 'Vorname, Nachname und E-Mail der Administration sind erforderlich.';
    }
    if (step === 4) {
      if (form.adminPassword.length < 10) return 'Das Admin-Passwort muss mindestens 10 Zeichen haben.';
      if (form.adminPassword !== confirmPassword) return 'Die Passwörter stimmen nicht überein.';
      if (!accepted) return 'Datenschutz- und Nutzungsbedingungen müssen bestätigt werden.';
    }
    return null;
  }, [accepted, confirmPassword, form, step]);

  const next = () => {
    setError(null);
    if (stepError) {
      setError(stepError);
      return;
    }
    setStep((current) => Math.min(current + 1, registrationSteps.length - 1));
  };

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await registerBusinessTenant(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await AsyncStorage.removeItem(REGISTRATION_DRAFT_KEY);
      setSuccess({ username: result.data.credentials?.username || result.data.owner.username });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Registrierung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AccessShell
        eyebrow="ORGANISATION AKTIV"
        title="Ihre Organisation ist bereit."
        subtitle="Das Administrationskonto wurde angelegt. Melden Sie sich an und führen Sie das Onboarding fort."
        side={<SecuritySide />}
      >
        <LiquidState
          kind="success"
          title="Registrierung erfolgreich"
          message={success.username ? `Administrations-Benutzername: ${success.username}` : 'Administrationskonto erstellt.'}
        />
        <LiquidButton fullWidth label="Zur Anmeldung" onPress={() => router.replace('/auth/business-login' as never)} />
      </AccessShell>
    );
  }

  return (
    <AccessShell
      eyebrow={`REGISTRIERUNG · SCHRITT ${step + 1} VON ${registrationSteps.length}`}
      title={registrationSteps[step][0]}
      subtitle={registrationSteps[step][1]}
      backRoute="/auth"
      side={
        <LiquidSurface active contentStyle={styles.stepCard}>
          <LiquidText variant="kicker">FORTSCHRITT</LiquidText>
          {registrationSteps.map(([label, detail], index) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityState={{ selected: step === index, disabled: index > step }}
              disabled={index > step}
              onPress={() => setStep(index)}
              style={[styles.stepRow, step === index && styles.stepRowActive]}
            >
              <View style={[styles.stepNumber, index <= step && styles.stepNumberActive]}>
                {index < step ? (
                  <LiquidGlyph active glyph="✓" size={17} />
                ) : (
                  <Text style={styles.stepNumberLabel}>{index + 1}</Text>
                )}
              </View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepLabel}>{label}</Text>
                <Text style={styles.stepDetail}>{detail}</Text>
              </View>
            </Pressable>
          ))}
          <LiquidStatus label="Automatisch gespeichert" tone="success" />
        </LiquidSurface>
      }
    >
      <LiquidSurface active contentStyle={styles.formCard}>
        {error ? <LiquidState kind="error" title="Angaben prüfen" message={error} /> : null}
        {step === 0 ? (
          <>
            <LiquidField label="Firmenname" value={form.companyName} onChangeText={(value) => update('companyName', value)} required />
            <LiquidField label="Rechtsform" value={form.legalForm} onChangeText={(value) => update('legalForm', value)} required />
            <LiquidField label="Einrichtungstyp / Branche" value={form.industry} onChangeText={(value) => update('industry', value)} required />
            <LiquidField label="IK-Nummer" value={form.ikNumber ?? ''} onChangeText={(value) => update('ikNumber', value)} />
          </>
        ) : null}
        {step === 1 ? (
          <>
            <LiquidField label="Straße und Hausnummer" value={form.street} onChangeText={(value) => update('street', value)} required />
            <View style={styles.inlineFields}>
              <View style={styles.zipField}><LiquidField label="PLZ" value={form.zip} onChangeText={(value) => update('zip', value)} required /></View>
              <View style={styles.cityField}><LiquidField label="Ort" value={form.city} onChangeText={(value) => update('city', value)} required /></View>
            </View>
            <LiquidField label="Telefon" value={form.phone} onChangeText={(value) => update('phone', value)} keyboardType="phone-pad" required />
            <LiquidField label="Organisations-E-Mail" value={form.email} onChangeText={(value) => update('email', value)} keyboardType="email-address" autoCapitalize="none" required />
            <LiquidField label="Website" value={form.website ?? ''} onChangeText={(value) => update('website', value)} autoCapitalize="none" />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <View style={styles.inlineFields}>
              <View style={styles.cityField}><LiquidField label="Admin Vorname" value={form.adminFirstName} onChangeText={(value) => update('adminFirstName', value)} required /></View>
              <View style={styles.cityField}><LiquidField label="Admin Nachname" value={form.adminLastName} onChangeText={(value) => update('adminLastName', value)} required /></View>
            </View>
            <LiquidField label="Admin E-Mail" value={form.adminEmail} onChangeText={(value) => update('adminEmail', value)} keyboardType="email-address" autoCapitalize="none" required />
            <LiquidField label="Admin Telefon" value={form.adminPhone ?? ''} onChangeText={(value) => update('adminPhone', value)} keyboardType="phone-pad" />
            <LiquidField label="Ansprechperson Vorname" value={form.contactFirstName} onChangeText={(value) => update('contactFirstName', value)} />
            <LiquidField label="Ansprechperson Nachname" value={form.contactLastName} onChangeText={(value) => update('contactLastName', value)} />
            <LiquidField label="Funktion" value={form.contactRole} onChangeText={(value) => update('contactRole', value)} />
          </>
        ) : null}
        {step === 3 ? (
          <View style={styles.moduleGrid}>
            {registrationModules.map(([key, label]) => {
              const selected = form.selectedModules.includes(key);
              return (
                <Pressable
                  key={key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled: key === 'office' }}
                  onPress={() => toggleModule(key)}
                  style={[styles.moduleOption, selected && styles.moduleOptionSelected]}
                >
                  <LiquidGlyph active={selected} glyph={selected ? '✓' : '○'} size={20} />
                  <View style={styles.moduleCopy}>
                    <Text style={styles.moduleLabel}>{label}</Text>
                    <Text style={styles.moduleDetail}>{key === 'office' ? 'Immer aktiv' : 'Kostenlos aktivieren'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {step === 4 ? (
          <>
            <LiquidField
              label="Admin-Passwort"
              value={form.adminPassword}
              onChangeText={(value) => update('adminPassword', value)}
              secureTextEntry
              required
              hint="Mindestens 10 Zeichen; keine Wiederverwendung eines Einmalpassworts."
            />
            <LiquidField label="Passwort bestätigen" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry required />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              onPress={() => setAccepted((current) => !current)}
              style={[styles.acceptRow, accepted && styles.acceptRowSelected]}
            >
              <LiquidGlyph active={accepted} glyph={accepted ? '✓' : '○'} size={20} />
              <Text style={styles.acceptLabel}>
                Ich bestätige Datenschutz, Nutzungsbedingungen und meine Berechtigung zur Registrierung.
              </Text>
            </Pressable>
          </>
        ) : null}
        {step === 5 ? (
          <View style={styles.reviewFacts}>
            {[
              ['Organisation', `${form.companyName} · ${form.legalForm}`],
              ['Standort', `${form.street}, ${form.zip} ${form.city}`],
              ['Administration', `${form.adminFirstName} ${form.adminLastName} · ${form.adminEmail}`],
              ['Module', form.selectedModules.join(', ')],
              ['Sicherheit', 'Passwort gesetzt · Bedingungen bestätigt'],
            ].map(([label, value]) => (
              <View key={label} style={styles.reviewFact}>
                <Text style={styles.reviewFactLabel}>{label}</Text>
                <Text style={styles.reviewFactValue}>{value}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.registrationActions}>
          {step > 0 ? (
            <LiquidButton label="Zurück" variant="secondary" onPress={() => setStep((current) => current - 1)} />
          ) : null}
          {step < registrationSteps.length - 1 ? (
            <LiquidButton label="Weiter" onPress={next} />
          ) : (
            <LiquidButton label="Organisation registrieren" loading={loading} onPress={() => void submit()} />
          )}
        </View>
      </LiquidSurface>
    </AccessShell>
  );
}

export function PasswordRecoveryScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    const result = await requestBusinessPasswordReset(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(result.data.message);
  };

  return (
    <AccessShell
      eyebrow="PASSWORT-WIEDERHERSTELLUNG"
      title="Zugang sicher wiederherstellen."
      subtitle="Ein Rücksetz-Link wird ausschließlich an das verknüpfte Administrationskonto gesendet."
      backRoute="/auth/business-login"
      side={<SecuritySide />}
    >
      <LiquidSurface active contentStyle={styles.formCard}>
        {error ? <LiquidState kind="error" title="Versand nicht möglich" message={error} /> : null}
        {success ? <LiquidState kind="success" title="E-Mail geprüft" message={success} /> : null}
        <LiquidField
          label="E-Mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          required
        />
        <LiquidButton fullWidth label="Rücksetz-Link anfordern" loading={loading} onPress={() => void submit()} />
        <LiquidButton fullWidth label="Zur Anmeldung" variant="secondary" onPress={() => router.replace('/auth/business-login' as never)} />
      </LiquidSurface>
    </AccessShell>
  );
}

export function PasswordResetScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void getSession().then((result) => {
      setHasSession(result.ok && Boolean(result.data));
      setReady(true);
    });
  }, []);

  const submit = async () => {
    setError(null);
    if (password.length < 10) {
      setError('Das neue Passwort muss mindestens 10 Zeichen haben.');
      return;
    }
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    const result = await updatePassword(password);
    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }
    await supabaseSignOut();
    setLoading(false);
    router.replace('/auth/business-login' as never);
  };

  return (
    <AccessShell
      eyebrow="NEUES PASSWORT"
      title="Sitzung schützen."
      subtitle="Vergeben Sie ein neues Passwort für das bestätigte Konto."
      backRoute="/auth/business-login"
      side={<SecuritySide />}
    >
      {!ready ? (
        <LiquidState kind="loading" title="Rücksetz-Link wird geprüft" message="Die sichere Sitzung wird wiederhergestellt." />
      ) : !hasSession ? (
        <LiquidState
          kind="locked"
          title="Link ungültig oder abgelaufen"
          message="Fordern Sie einen neuen Rücksetz-Link an."
          actionLabel="Neuen Link anfordern"
          onAction={() => router.replace('/auth/forgot-password' as never)}
        />
      ) : (
        <LiquidSurface active contentStyle={styles.formCard}>
          {error ? <LiquidState kind="error" title="Passwort nicht gespeichert" message={error} /> : null}
          <LiquidField label="Neues Passwort" value={password} onChangeText={setPassword} secureTextEntry required />
          <LiquidField label="Passwort bestätigen" value={confirm} onChangeText={setConfirm} secureTextEntry required />
          <LiquidButton fullWidth label="Passwort speichern" loading={loading} onPress={() => void submit()} />
        </LiquidSurface>
      )}
    </AccessShell>
  );
}

export function EmployeeFirstLoginScreen() {
  const router = useRouter();
  const { portalSession, updatePortalSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!portalSession || portalSession.loginType !== 'employee_portal') {
      setError('Die Mitarbeitenden-Sitzung ist abgelaufen. Bitte erneut anmelden.');
      return;
    }
    setError(null);
    setLoading(true);
    const result = await completeFirstLogin({
      accountId: portalSession.accountId,
      sessionToken: portalSession.sessionToken,
      currentPassword,
      newPassword: password,
      confirmPassword: confirm,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await updatePortalSession({ mustChangePassword: false });
    router.replace('/portal/employee' as never);
  };

  return (
    <AccessShell
      eyebrow="ERSTE ANMELDUNG"
      title="Persönliches Passwort festlegen."
      subtitle="Das Einmalpasswort wird nach erfolgreichem Abschluss ungültig."
      backRoute="/auth/employee-login"
      side={<SecuritySide />}
    >
      <LiquidSurface active contentStyle={styles.formCard}>
        {error ? <LiquidState kind="error" title="Passwort nicht gespeichert" message={error} /> : null}
        <LiquidField label="Aktuelles Einmalpasswort" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry required />
        <LiquidField label="Neues Passwort" value={password} onChangeText={setPassword} secureTextEntry required />
        <LiquidField label="Passwort bestätigen" value={confirm} onChangeText={setConfirm} secureTextEntry required />
        <LiquidButton fullWidth label="Passwort speichern und fortfahren" loading={loading} onPress={() => void submit()} />
      </LiquidSurface>
    </AccessShell>
  );
}

const styles = StyleSheet.create({
  accessRoot: {
    flex: 1,
    minHeight: 0,
  },
  accessTopBar: {
    minHeight: 82,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: liquidColors.white12,
    backgroundColor: 'rgba(6,21,43,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  accessScrollViewport: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  accessScroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
    padding: 32,
    paddingVertical: 40,
  },
  accessScrollPhone: {
    padding: 16,
    paddingVertical: 24,
  },
  accessGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 28,
  },
  accessGridPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  accessGridCompact: {
    width: '100%',
    minHeight: 780,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessMain: {
    minWidth: 0,
    flex: 1,
    gap: 22,
  },
  accessMainCompact: {
    width: '100%',
    maxWidth: 500,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'center',
  },
  compactBrand: {
    alignItems: 'center',
    marginBottom: 12,
  },
  accessSide: {
    width: 370,
  },
  accessMobileSide: {
    marginTop: 18,
  },
  accessHeading: {
    gap: 7,
  },
  accessSubtitle: {
    maxWidth: 760,
    color: liquidColors.white72,
  },
  accessOptions: {
    gap: 10,
  },
  accessOption: {
    minHeight: 92,
    padding: 16,
    borderRadius: liquidRadius.card,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: 'rgba(10,35,66,0.68)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  accessOptionGlyph: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: liquidColors.blue500,
    backgroundColor: 'rgba(20,120,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessOptionGlyphText: {
    color: liquidColors.blue200,
    fontSize: 26,
    lineHeight: 30,
  },
  accessOptionCopy: {
    minWidth: 0,
    flex: 1,
    gap: 4,
  },
  accessOptionTitle: {
    color: liquidColors.white,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  accessOptionDetail: {
    color: liquidColors.white72,
    fontSize: 14,
    lineHeight: 20,
  },
  accessArrow: {
    color: liquidColors.blue200,
    fontSize: 32,
    lineHeight: 36,
  },
  accessFooterActions: {
    gap: 10,
  },
  accessFootnote: {
    color: liquidColors.white56,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  securityCard: {
    padding: 22,
    gap: 16,
  },
  securityRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  securityGlyph: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: liquidColors.white08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityGlyphText: {
    color: liquidColors.blue200,
    fontSize: 18,
    lineHeight: 22,
  },
  securityLabel: {
    minWidth: 0,
    flex: 1,
    color: liquidColors.white88,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  formCard: {
    padding: 22,
    gap: 16,
    width: '100%',
  },
  loginTabs: {
    height: 52,
    padding: 3,
    borderRadius: liquidRadius.control,
    borderWidth: 1,
    borderColor: liquidColors.white22,
    backgroundColor: 'rgba(2,13,30,0.62)',
    flexDirection: 'row',
  },
  loginTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginTabActive: {
    flex: 1,
    borderRadius: 7,
    backgroundColor: liquidColors.blue600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginTabLabel: {
    color: liquidColors.white88,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  loginTabActiveLabel: {
    color: liquidColors.white,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  portalAccess: {
    gap: 7,
  },
  portalAccessRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: liquidRadius.control,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(5,24,49,0.76)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  portalAccessGlyph: {
    width: 24,
    color: liquidColors.blue200,
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  portalAccessLabel: {
    flex: 1,
    color: liquidColors.white88,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  portalAccessArrow: {
    color: liquidColors.blue200,
    fontSize: 22,
    lineHeight: 24,
  },
  securityBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  securityBadge: {
    flex: 1,
    color: liquidColors.blue200,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  formSecondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  ssoCard: {
    padding: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  ssoCopy: {
    minWidth: 230,
    flex: 1,
    gap: 4,
  },
  stepCard: {
    padding: 18,
    gap: 10,
  },
  stepRow: {
    minHeight: 58,
    padding: 8,
    borderRadius: liquidRadius.small,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepRowActive: {
    backgroundColor: 'rgba(20,120,255,0.14)',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: liquidColors.white22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberActive: {
    borderColor: liquidColors.blue500,
    backgroundColor: 'rgba(20,120,255,0.16)',
  },
  stepNumberLabel: {
    color: liquidColors.white88,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  stepCopy: {
    minWidth: 0,
    flex: 1,
  },
  stepLabel: {
    color: liquidColors.white,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  stepDetail: {
    color: liquidColors.white56,
    fontSize: 11,
    lineHeight: 15,
  },
  inlineFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  zipField: {
    minWidth: 120,
    flex: 1,
  },
  cityField: {
    minWidth: 200,
    flex: 2,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleOption: {
    minWidth: 190,
    flex: 1,
    minHeight: 76,
    padding: 14,
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moduleOptionSelected: {
    borderColor: liquidColors.blue500,
    backgroundColor: 'rgba(20,120,255,0.14)',
  },
  moduleCheck: {
    color: liquidColors.blue200,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  moduleCopy: {
    minWidth: 0,
    flex: 1,
  },
  moduleLabel: {
    color: liquidColors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  moduleDetail: {
    color: liquidColors.white56,
    fontSize: 12,
    lineHeight: 17,
  },
  acceptRow: {
    minHeight: 70,
    padding: 14,
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  acceptRowSelected: {
    borderColor: liquidColors.blue500,
  },
  acceptLabel: {
    minWidth: 0,
    flex: 1,
    color: liquidColors.white88,
    fontSize: 14,
    lineHeight: 21,
  },
  reviewFacts: {
    gap: 9,
  },
  reviewFact: {
    padding: 13,
    borderRadius: liquidRadius.control,
    backgroundColor: liquidColors.white08,
    gap: 3,
  },
  reviewFactLabel: {
    color: liquidColors.white56,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  reviewFactValue: {
    color: liquidColors.white,
    fontSize: 15,
    lineHeight: 21,
  },
  registrationActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  focused: {
    borderWidth: 2,
    borderColor: liquidColors.blue200,
  },
});
