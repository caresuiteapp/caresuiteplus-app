import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SettingsScreenFrame } from '@/components/settings/settingsscreenframe';
import { ROLE_LABELS } from '@/data/constants/roleLabels';
import { useUserProfileUnsavedChanges } from '@/hooks/useUserProfileUnsavedChanges.web';
import { useAuth, type AuthContextValue } from '@/lib/auth/context';
import { requestBusinessPasswordReset } from '@/lib/auth/passwordResetService.web';
import { resolveProfileAvatarDisplayUrl } from '@/lib/auth/profileAvatarUrl';
import type { UserAvatarPending } from '@/lib/auth/useravatarservice';
import {
  readUserProfileAvatarFile,
  removeUserAccountAvatar,
  saveUserAccountAvatar,
  saveUserProfileAccount,
  validateUserProfileAccountDraft,
  type UserProfileAccountDraft,
} from '@/lib/auth/userProfileAccountService.web';
import type { AuthUser, Profile } from '@/types';
import { UserProfileWorkspace, type ProfileField } from './UserProfileWorkspace.web';
import { USER_PROFILE_CONTROLLER_CSS } from './userProfileWorkspaceCss.web';

type Operation = 'profile' | 'read-avatar' | 'save-avatar' | 'remove-avatar' | 'password' | 'sign-out';
type FormState = { baseline: UserProfileAccountDraft; draft: UserProfileAccountDraft };

function toDraft(profile: Profile): UserProfileAccountDraft {
  return { firstName: profile.firstName ?? '', lastName: profile.lastName ?? '', phone: profile.phone ?? '' };
}

function sameDraft(left: UserProfileAccountDraft, right: UserProfileAccountDraft): boolean {
  return left.firstName === right.firstName && left.lastName === right.lastName && left.phone === right.phone;
}

function UserProfileAccountEditor({ auth, profile, user }: {
  auth: AuthContextValue; profile: Profile; user: AuthUser;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({ baseline: toDraft(profile), draft: toDraft(profile) }));
  const [operation, setOperation] = useState<Operation | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<UserAvatarPending | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [displayAvatar, setDisplayAvatar] = useState<{ source: string | null; version: string; url?: string; error?: string }>({ source: null, version: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordRequested, setPasswordRequested] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const alive = useRef(true);
  const latest = useRef({ profile, user, auth, form, pendingAvatar });
  latest.current = { profile, user, auth, form, pendingAvatar };
  const operationRef = useRef<{ kind: Operation } | null>(null);
  const profileDirty = !sameDraft(form.draft, form.baseline);
  const busy = operation !== null || auth.isLoading || !auth.authReady;
  const { confirmLeave, releaseAfterConfirmation, restoreProtection } = useUserProfileUnsavedChanges(
    profileDirty || pendingAvatar !== null, busy,
  );

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; operationRef.current = null; };
  }, []);

  // Refresh untouched fields while keeping each in-progress edit intact.
  useEffect(() => {
    const incoming = toDraft(profile);
    setForm((previous) => ({
      baseline: incoming,
      draft: {
        firstName: previous.draft.firstName === previous.baseline.firstName ? incoming.firstName : previous.draft.firstName,
        lastName: previous.draft.lastName === previous.baseline.lastName ? incoming.lastName : previous.draft.lastName,
        phone: previous.draft.phone === previous.baseline.phone ? incoming.phone : previous.draft.phone,
      },
    }));
  }, [profile.firstName, profile.lastName, profile.phone]);

  useEffect(() => {
    let current = true;
    const source = profile.avatarUrl;
    const version = profile.updatedAt;
    void resolveProfileAvatarDisplayUrl(source, version).then((url) => {
      if (current) setDisplayAvatar({ source, version, url });
    }).catch(() => {
      if (current) setDisplayAvatar({ source, version, error: 'Ihr Profilbild konnte nicht geladen werden. Sie können ein neues Bild auswählen.' });
    });
    return () => { current = false; };
  }, [profile.avatarUrl, profile.updatedAt]);

  function begin(kind: Operation) {
    if (operationRef.current || !alive.current || latest.current.auth.isLoading || !latest.current.auth.authReady) return null;
    const token = { kind };
    operationRef.current = token;
    setOperation(kind);
    return token;
  }

  function isCurrent(token: { kind: Operation }) {
    return alive.current && operationRef.current === token;
  }

  function finish(token: { kind: Operation }) {
    if (!isCurrent(token)) return;
    operationRef.current = null;
    setOperation(null);
  }

  function applySavedProfile(saved: Profile, fields: 'personal' | 'avatar') {
    const current = latest.current.profile;
    const patch = fields === 'personal'
      ? { firstName: saved.firstName, lastName: saved.lastName, displayName: saved.displayName, phone: saved.phone }
      : { avatarUrl: saved.avatarUrl };
    const merged: Profile = { ...current, ...patch,
      updatedAt: Date.parse(current.updatedAt) > Date.parse(saved.updatedAt) ? current.updatedAt : saved.updatedAt,
    };
    latest.current.profile = merged;
    latest.current.auth.updateProfile(merged);
    return merged;
  }

  async function saveProfile() {
    if (sameDraft(latest.current.form.draft, latest.current.form.baseline)) return;
    const validated = validateUserProfileAccountDraft(latest.current.form.draft);
    if (!validated.ok) { setProfileError(validated.error); setProfileMessage(null); return; }
    const token = begin('profile');
    if (!token) return;
    setProfileError(null); setProfileMessage(null);
    try {
      const current = latest.current;
      const result = await saveUserProfileAccount(current.profile, current.user.id, validated.data);
      if (!isCurrent(token)) return;
      if (!result.ok) { setProfileError(result.error); return; }
      const saved = applySavedProfile(result.data, 'personal');
      setForm({ baseline: toDraft(saved), draft: toDraft(saved) });
      setProfileMessage('Ihre persönlichen Angaben wurden gespeichert.');
    } catch {
      if (isCurrent(token)) setProfileError('Ihre Angaben konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.');
    } finally { finish(token); }
  }

  function changeDraft(field: ProfileField, value: string) {
    if (operationRef.current || latest.current.auth.isLoading || !latest.current.auth.authReady) return;
    setForm((previous) => ({ ...previous, draft: { ...previous.draft, [field]: value } }));
    setProfileError(null); setProfileMessage(null);
  }

  function resetDraft() {
    if (operationRef.current) return;
    const draft = toDraft(latest.current.profile);
    setForm({ baseline: draft, draft });
    setProfileError(null); setProfileMessage(null);
  }

  async function pickAvatar(file: File) {
    const token = begin('read-avatar');
    if (!token) return;
    setAvatarError(null); setAvatarMessage(null);
    try {
      const result = await readUserProfileAvatarFile(file);
      if (!isCurrent(token)) return;
      if (!result.ok) { setAvatarError(result.error); return; }
      setPendingAvatar(result.data);
    } catch {
      if (isCurrent(token)) setAvatarError('Das Bild konnte nicht gelesen werden. Bitte wählen Sie es erneut aus.');
    } finally { finish(token); }
  }

  function cancelAvatar() {
    if (operationRef.current) return;
    setPendingAvatar(null); setAvatarError(null); setAvatarMessage(null);
  }

  async function saveAvatar() {
    const pending = latest.current.pendingAvatar;
    if (!pending) return;
    const token = begin('save-avatar');
    if (!token) return;
    setAvatarError(null); setAvatarMessage(null);
    try {
      const current = latest.current;
      const result = await saveUserAccountAvatar(current.profile, current.user.id, pending);
      if (!isCurrent(token)) return;
      if (!result.ok) { setAvatarError(result.error); return; }
      const saved = applySavedProfile(result.data, 'avatar');
      // Keep the confirmed image visible while its signed storage URL is resolved.
      setDisplayAvatar({ source: saved.avatarUrl, version: saved.updatedAt, url: pending.localUri });
      setPendingAvatar(null); setAvatarMessage('Ihr Profilbild wurde gespeichert.');
    } catch {
      if (isCurrent(token)) setAvatarError('Das Profilbild konnte nicht gespeichert werden. Ihre Auswahl bleibt erhalten.');
    } finally { finish(token); }
  }

  async function removeAvatar() {
    if (operationRef.current || !latest.current.profile.avatarUrl) return;
    if (!window.confirm('Möchten Sie Ihr gespeichertes Profilbild entfernen? Stattdessen werden Ihre Initialen angezeigt.')) return;
    const token = begin('remove-avatar');
    if (!token) return;
    setAvatarError(null); setAvatarMessage(null);
    try {
      const current = latest.current;
      const result = await removeUserAccountAvatar(current.profile, current.user.id);
      if (!isCurrent(token)) return;
      if (!result.ok) { setAvatarError(result.error); return; }
      applySavedProfile(result.data, 'avatar');
      setPendingAvatar(null); setAvatarMessage('Ihr Profilbild wurde entfernt.');
    } catch {
      if (isCurrent(token)) setAvatarError('Das Profilbild konnte nicht entfernt werden. Bitte versuchen Sie es erneut.');
    } finally { finish(token); }
  }

  const role = profile.roleKey ?? user.roleKey;
  const isPortal = Boolean(auth.portalSession) || [profile.roleKey, user.roleKey].some((value) =>
    value === 'employee_portal' || value === 'client_portal' || value === 'family_portal');
  const ownEmail = user.email.trim();
  const hasOwnBusinessSession = auth.authMode === 'supabase' && Boolean(role) && !isPortal &&
    auth.session?.user.id === user.id && Boolean(auth.session.accessToken) &&
    /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(ownEmail) && !ownEmail.toLowerCase().endsWith('@caresuite-portal.local');

  async function requestPasswordReset() {
    if (operationRef.current || !hasOwnBusinessSession || passwordRequested) return;
    if (!window.confirm(`Link zum Passwortwechsel anfordern?\n\nWir senden den Link an Ihre Anmeldeadresse ${ownEmail}. Ihr Passwort bleibt bis zur Änderung unverändert.`)) return;
    const token = begin('password');
    if (!token) return;
    setPasswordError(null); setPasswordMessage(null);
    try {
      const result = await requestBusinessPasswordReset(ownEmail);
      if (!isCurrent(token)) return;
      if (!result.ok) { setPasswordError(result.error); return; }
      setPasswordRequested(true); setPasswordMessage(result.data.message);
    } catch {
      if (isCurrent(token)) setPasswordError('Der Link konnte nicht angefordert werden. Bitte versuchen Sie es erneut.');
    } finally { finish(token); }
  }

  async function signOut() {
    if (operationRef.current) return;
    const dirty = !sameDraft(latest.current.form.draft, latest.current.form.baseline) || latest.current.pendingAvatar !== null;
    if (!window.confirm(dirty
      ? 'Möchten Sie sich abmelden? Ihre ungespeicherten Änderungen am Profil und Profilbild werden dabei verworfen.'
      : 'Möchten Sie sich von CareSuite abmelden?')) return;
    const token = begin('sign-out');
    if (!token) return;
    setSignOutError(null);
    releaseAfterConfirmation();
    try {
      await latest.current.auth.signOut();
    } catch {
      if (isCurrent(token)) {
        restoreProtection();
        setSignOutError('Die Abmeldung ist fehlgeschlagen. Sie sind weiterhin angemeldet. Bitte versuchen Sie es erneut.');
      }
    } finally { finish(token); }
  }

  function navigate(path: string) {
    if (operationRef.current || !confirmLeave()) return;
    router.push(path as never);
  }

  const storedAvatar = displayAvatar.source === profile.avatarUrl ? displayAvatar : null;
  const safeEmail = (ownEmail || profile.email || '').toLowerCase().endsWith('@caresuite-portal.local') ? '' : ownEmail || profile.email || '';
  return <>
    {signOutError ? <div className="cs-profile-controller-error" role="alert">{signOutError}</div> : null}
    <UserProfileWorkspace
      profile={{ ...toDraft(profile), email: safeEmail, roleLabel: role ? ROLE_LABELS[role] : 'Noch nicht zugeordnet',
        displayName: [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || profile.displayName || 'Ihr Profil',
        avatarUrl: storedAvatar?.url }}
      draft={form.draft} onDraftChange={changeDraft} onSaveProfile={saveProfile} onCancelProfile={resetDraft}
      profileDirty={profileDirty} profileSaving={operation === 'profile'} profileError={profileError} profileMessage={profileMessage}
      disabled={busy} hasStoredAvatar={Boolean(profile.avatarUrl)} avatarPreviewUrl={pendingAvatar?.localUri} avatarDirty={pendingAvatar !== null}
      avatarBusy={operation === 'read-avatar' || operation === 'save-avatar' || operation === 'remove-avatar'}
      avatarError={avatarError ?? (pendingAvatar ? null : storedAvatar?.error)} avatarMessage={avatarMessage}
      onPickAvatar={pickAvatar} onSaveAvatar={saveAvatar} onCancelAvatar={cancelAvatar} onRemoveAvatar={removeAvatar}
      onRequestPasswordReset={requestPasswordReset} passwordResetBusy={operation === 'password'}
      passwordResetAvailable={hasOwnBusinessSession && !passwordRequested}
      passwordResetUnavailableReason={passwordRequested ? 'Ein Link wurde bereits angefordert. Bitte prüfen Sie Ihr E-Mail-Postfach.' : !hasOwnBusinessSession ? 'Der Passwortwechsel per E-Mail steht für ein bestätigtes Verwaltungskonto zur Verfügung.' : undefined}
      passwordResetMessage={passwordMessage} passwordResetError={passwordError}
      onOpenAppearance={() => navigate('/settings/appearance')} onRequestData={() => navigate('/settings/data-request')}
      onRequestDeletion={() => navigate('/settings/account-deletion')} onOpenSupport={() => navigate('/support')}
      onSignOut={signOut} signOutBusy={operation === 'sign-out'}
    />
  </>;
}

export function UserProfileScreen({ embeddedInModal = false }: { embeddedInModal?: boolean } = {}) {
  const auth = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const identity = `${auth.authMode}:${auth.user?.id ?? ''}:${auth.profile?.tenantId ?? ''}:${auth.profile?.id ?? ''}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const retryRef = useRef<object | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { retryRef.current = null; setRetrying(false); setRetryError(null); }, [identity]);
  async function retry() {
    if (retryRef.current) return;
    const token = {};
    const attemptedIdentity = identityRef.current;
    const current = () => alive.current && retryRef.current === token && identityRef.current === attemptedIdentity;
    retryRef.current = token; setRetrying(true); setRetryError(null);
    try { await auth.retryProfileBootstrap(); }
    catch { if (current()) setRetryError('Ihr Profil konnte nicht geladen werden. Bitte versuchen Sie es erneut.'); }
    finally { if (current()) { retryRef.current = null; setRetrying(false); } }
  }
  const readyProfile = auth.profile && auth.user;
  const loading = auth.isLoading || !auth.authReady || retrying;
  return <SettingsScreenFrame title="Profil & Konto" subtitle="Ihre Angaben, Ihr Profilbild und Ihr Zugang" embeddedInModal={embeddedInModal} showSideNavigation>
    <style>{USER_PROFILE_CONTROLLER_CSS}</style>
    {readyProfile && auth.profile && auth.user ? <UserProfileAccountEditor
      key={identity}
      auth={auth} profile={auth.profile} user={auth.user}
    /> : <div className="cs-profile-controller-state">
      {loading ? <p role="status">Ihr Profil wird geladen…</p> : <>
        <p role="alert">{retryError ?? auth.profileBootstrapError ?? 'Ihr Profil konnte nicht geladen werden.'}</p>
        <button type="button" onClick={() => { void retry(); }} disabled={retrying}>Profil erneut laden</button>
      </>}
    </div>}
  </SettingsScreenFrame>;
}
