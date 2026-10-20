// @vitest-environment happy-dom
import React, { act, type ComponentType, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { AuthSession, AuthUser, Profile, ServiceResult } from '@/types';
import type { UserProfileAccountDraft } from '@/lib/auth/userProfileAccountService.web';
import type { UserAvatarPending } from '@/lib/auth/useravatarservice';
import { canLeaveWebPage } from '@/lib/navigation/webPageLeaveGuard.web';

const makeProfile = (patch: Partial<Profile> = {}): Profile => ({
  id: 'profile-a', tenantId: 'tenant-a', roleId: 'admin-role', roleKey: 'business_admin',
  firstName: 'Mara', lastName: 'Muster', displayName: 'Mara Muster', email: 'profile@example.test',
  phone: '+49 123 456', avatarUrl: null, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-19T10:00:00Z',
  ...patch,
});
type Removal = { data: { action: { type: string } } };
const api = {
  profile: makeProfile() as Profile | null,
  user: { id: 'auth-a', email: 'account@example.test', displayName: 'Mara Muster', roleKey: 'business_admin' } as AuthUser | null,
  isLoading: false, isInitialized: true, authReady: true, isAuthenticated: true,
  authMode: 'supabase', session: null as AuthSession | null, portalSession: null,
  profileBootstrapError: null as string | null, signOutError: null as string | null,
  push: vi.fn(), dispatch: vi.fn(), preventRemoval: false,
  onRemove: null as ((event: Removal) => void) | null,
  updateProfile: vi.fn<(profile: Profile) => void>(), retryProfileBootstrap: vi.fn<() => Promise<void>>(),
  signOut: vi.fn<() => Promise<void>>(),
};
const services = {
  validateUserProfileAccountDraft: vi.fn<(draft: UserProfileAccountDraft) => ServiceResult<UserProfileAccountDraft>>(),
  saveUserProfileAccount: vi.fn<(profile: Profile, authUserId: string, draft: UserProfileAccountDraft) => Promise<ServiceResult<Profile>>>(),
  readUserProfileAvatarFile: vi.fn<(file: File) => Promise<ServiceResult<UserAvatarPending>>>(),
  saveUserAccountAvatar: vi.fn<(profile: Profile, authUserId: string, pending: UserAvatarPending) => Promise<ServiceResult<Profile>>>(),
  removeUserAccountAvatar: vi.fn<(profile: Profile, authUserId: string) => Promise<ServiceResult<Profile>>>(),
};
const requestPasswordReset = vi.fn<(email: string) => Promise<ServiceResult<{ message: string }>>>();
const resolveAvatar = vi.fn<(url?: string | null, version?: string | null) => Promise<string | undefined>>();
const pendingImage: UserAvatarPending = {
  localUri: 'data:image/png;base64,iVBORw0KGgo=', fileName: 'portrait.png',
  mimeType: 'image/png', sizeBytes: 8, contentBase64: 'iVBORw0KGgo=',
};

// Keep the actual controller, workspace, confirmations and navigation guard.
// The shell and external I/O are boundaries; these are DOM behavior checks, not geometry QA.
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'),
  'react-native': { Platform: { OS: 'web' }, Alert: { alert: vi.fn() } },
  'expo-router': { useRouter: () => ({ push: api.push }), useNavigation: () => ({ dispatch: api.dispatch }), usePathname: () => '/settings/profile' },
  'expo-router/react-navigation': { usePreventRemove: (prevent: boolean, callback: (event: Removal) => void) => { api.preventRemoval = prevent; api.onRemove = callback; } },
  '@/lib/auth/context': { useAuth: () => api },
  '@/lib/auth/userProfileAccountService.web': services,
  '@/lib/auth/profileAvatarUrl': { resolveProfileAvatarDisplayUrl: resolveAvatar },
  '@/lib/auth/passwordResetService.web': { requestBusinessPasswordReset: requestPasswordReset },
  '@/components/settings/settingsscreenframe': {
    SettingsScreenFrame: ({ title, children }: { title: string; children: ReactNode }) => <main aria-label={title}>{children}</main>,
  },
};
const bundle = buildSync({
  entryPoints: ['src/screens/settings/userprofilescreen.web.tsx'], bundle: true, write: false,
  platform: 'node', format: 'cjs', jsx: 'automatic', external: Object.keys(dependencies),
  loader: { '.png': 'empty', '.jpg': 'empty' },
}).outputFiles[0].text;
const loaded = { exports: {} as { UserProfileScreen: ComponentType<{ embeddedInModal?: boolean }> } };
new Function('require', 'module', 'exports', bundle)((id: string) => {
  if (!(id in dependencies)) throw new Error(`Unexpected profile dependency: ${id}`);
  return dependencies[id];
}, loaded, loaded.exports);
const ProfileScreen = loaded.exports.UserProfileScreen;

let host: HTMLDivElement;
let root: Root;
let confirmation: MockInstance<(message?: string) => boolean>;
const render = async () => { await act(async () => root.render(<ProfileScreen />)); };
const input = (name: string) => {
  const labelled = host.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`);
  if (labelled) return labelled;
  const fieldLabel = [...host.querySelectorAll<HTMLLabelElement>('label')].find(element => element.textContent === name);
  return fieldLabel ? document.getElementById(fieldLabel.htmlFor) as HTMLInputElement : null!;
};
const button = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('button')]
  .find(element => (element.getAttribute('aria-label') ?? element.querySelector('strong')?.textContent ?? element.textContent?.trim()) === name)!;
const click = async (element: HTMLElement | null | undefined) => {
  expect(element).toBeTruthy(); await act(async () => element!.click());
};
const clickButton = async (name: string) => { await click(button(name)); };
const type = async (name: string, value: string) => {
  const element = input(name); expect(element).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
};
const chooseImage = async () => {
  const element = input('Profilbild auswählen'); expect(element).toBeTruthy();
  const file = new File(['image'], 'portrait.png', { type: 'image/png' });
  await act(async () => {
    Object.defineProperty(element, 'files', { configurable: true, value: [file] });
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return file;
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  api.profile = makeProfile();
  api.user = { id: 'auth-a', email: 'account@example.test', displayName: 'Mara Muster', roleKey: 'business_admin' };
  api.authMode = 'supabase'; api.session = { user: api.user, accessToken: 'test-session', refreshToken: 'test-refresh', expiresAt: null };
  api.isLoading = false; api.isInitialized = true; api.authReady = true; api.isAuthenticated = true;
  api.profileBootstrapError = null; api.signOutError = null; api.preventRemoval = false; api.onRemove = null;
  api.updateProfile.mockImplementation(profile => { api.profile = profile; root.render(<ProfileScreen />); });
  api.retryProfileBootstrap.mockResolvedValue(undefined); api.signOut.mockResolvedValue(undefined);
  // Validation rules themselves have service unit coverage. Here their returned result
  // verifies the form respects normalization and validation before issuing a write.
  services.validateUserProfileAccountDraft.mockImplementation(draft => ({ ok: true, data: {
    firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), phone: draft.phone.trim(),
  } }));
  services.saveUserProfileAccount.mockImplementation(async (profile, _authId, draft) => ({
    ok: true, data: { ...profile, ...draft, displayName: `${draft.firstName} ${draft.lastName}`.trim(), updatedAt: '2026-10-19T12:00:00Z' },
  }));
  services.readUserProfileAvatarFile.mockResolvedValue({ ok: true, data: pendingImage });
  services.saveUserAccountAvatar.mockImplementation(async profile => ({ ok: true, data: { ...profile, avatarUrl: 'https://example.test/saved-avatar.png' } }));
  services.removeUserAccountAvatar.mockImplementation(async profile => ({ ok: true, data: { ...profile, avatarUrl: null } }));
  resolveAvatar.mockImplementation(async url => url ?? undefined);
  requestPasswordReset.mockResolvedValue({ ok: true, data: { message: 'Die Anfrage wurde angenommen.' } });
  confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); confirmation.mockRestore();
});

describe('Profile and account in the actual Web workspace', () => {
  it('shows loading until the profile arrives and initializes the fields from that profile', async () => {
    api.profile = null; api.isLoading = true; api.authReady = false;
    await render();
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Ihr Profil wird geladen…');
    expect(input('Vorname')).toBeNull();
    expect(button('Profil erneut laden')).toBeUndefined();
    api.profile = makeProfile(); api.isLoading = false; api.authReady = true;
    await render();
    expect(input('Vorname').value).toBe('Mara');
    expect(input('Nachname').value).toBe('Muster');
    expect(input('Telefonnummer').value).toBe('+49 123 456');
    expect(services.saveUserProfileAccount).not.toHaveBeenCalled();
  });

  it('offers a retry for a missing profile, prevents duplicate requests and recovers from a failed retry', async () => {
    api.profile = null; api.profileBootstrapError = 'Test: Profil nicht erreichbar.';
    const retry = deferred<void>();
    api.retryProfileBootstrap.mockReturnValueOnce(retry.promise);
    await render();
    expect(host.textContent).toContain('Test: Profil nicht erreichbar.');
    const reload = button('Profil erneut laden');
    await act(async () => { reload.click(); reload.click(); });
    expect(api.retryProfileBootstrap).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Ihr Profil wird geladen…');
    await act(async () => retry.reject(new Error('offline')));
    expect(host.querySelector('[role="alert"]')).toBeTruthy();
    expect(button('Profil erneut laden').disabled).toBe(false);
    api.retryProfileBootstrap.mockImplementationOnce(async () => { api.profile = makeProfile(); });
    await clickButton('Profil erneut laden'); await render();
    expect(api.retryProfileBootstrap).toHaveBeenCalledTimes(2);
    expect(input('Vorname').value).toBe('Mara');
    expect(host.textContent).not.toContain('Test: Profil nicht erreichbar.');
  });

  it('preserves edited names and phone during a same-account background refresh', async () => {
    await render();
    await type('Vorname', 'Maria'); await type('Telefonnummer', '+49 555 123');
    api.profile = makeProfile({ firstName: 'Serverwert', lastName: 'Servernachname', phone: '+49 999', updatedAt: '2026-10-19T11:00:00Z' });
    await render();
    expect(input('Vorname').value).toBe('Maria');
    expect(input('Nachname').value).toBe('Servernachname');
    expect(input('Telefonnummer').value).toBe('+49 555 123');
    expect(services.saveUserProfileAccount).not.toHaveBeenCalled();
    await clickButton('Änderungen speichern');
    expect(services.saveUserProfileAccount).toHaveBeenCalledWith(expect.objectContaining({ id: 'profile-a' }), 'auth-a', {
      firstName: 'Maria', lastName: 'Servernachname', phone: '+49 555 123',
    });
  });

  it('normalizes a draft before saving and clears the saved notice when editing again', async () => {
    await render();
    await type('Vorname', '  Maria  '); await type('Nachname', '  Beispiel  '); await type('Telefonnummer', '  +49 555  ');
    await clickButton('Änderungen speichern');
    expect(services.saveUserProfileAccount).toHaveBeenCalledWith(expect.any(Object), 'auth-a', {
      firstName: 'Maria', lastName: 'Beispiel', phone: '+49 555',
    });
    expect(api.updateProfile).toHaveBeenCalledOnce();
    expect(input('Vorname').value).toBe('Maria');
    expect(host.textContent).toContain('Ihre persönlichen Angaben wurden gespeichert.');
    await type('Vorname', 'Marie');
    expect(host.textContent).not.toContain('Ihre persönlichen Angaben wurden gespeichert.');
    expect(button('Änderungen speichern').disabled).toBe(false);
  });

  it('shows a validation error and never writes an invalid draft', async () => {
    services.validateUserProfileAccountDraft.mockReturnValue({ ok: false, error: 'Bitte geben Sie mindestens einen Vor- oder Nachnamen an.' });
    await render(); await type('Vorname', ' '); await type('Nachname', ' ');
    await clickButton('Änderungen speichern');
    expect(host.textContent).toContain('Bitte geben Sie mindestens einen Vor- oder Nachnamen an.');
    expect(services.saveUserProfileAccount).not.toHaveBeenCalled();
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('submits only once, disables edits while saving and retains the draft after a failed save for retry', async () => {
    const save = deferred<ServiceResult<Profile>>();
    services.saveUserProfileAccount.mockReturnValueOnce(save.promise);
    await render(); await type('Vorname', 'Maria');
    const submit = button('Änderungen speichern');
    await act(async () => { submit.click(); submit.click(); });
    expect(services.saveUserProfileAccount).toHaveBeenCalledOnce();
    expect(input('Vorname').disabled).toBe(true);
    expect(input('Nachname').disabled).toBe(true);
    expect(input('Telefonnummer').disabled).toBe(true);
    expect(input('Profilbild auswählen').disabled).toBe(true);
    expect(button('Abmelden').disabled).toBe(true);
    await act(async () => api.onRemove?.({ data: { action: { type: 'GO_BACK' } } }));
    expect(api.dispatch).not.toHaveBeenCalled();
    expect(confirmation).not.toHaveBeenCalled();
    await act(async () => save.resolve({ ok: false, error: 'Test: Verbindung unterbrochen.' }));
    expect(input('Vorname').value).toBe('Maria');
    expect(input('Vorname').disabled).toBe(false);
    expect(host.textContent).toContain('Test: Verbindung unterbrochen.');
    expect(host.textContent).not.toContain('Ihre persönlichen Angaben wurden gespeichert.');
    expect(api.updateProfile).not.toHaveBeenCalled();
    await clickButton('Änderungen speichern');
    expect(services.saveUserProfileAccount).toHaveBeenCalledTimes(2);
    expect(api.profile?.firstName).toBe('Maria');
    expect(host.textContent).not.toContain('Test: Verbindung unterbrochen.');
  });

  it('discards the previous account draft and ignores its late save result after identity changes', async () => {
    const oldProfile = makeProfile();
    const save = deferred<ServiceResult<Profile>>();
    services.saveUserProfileAccount.mockReturnValueOnce(save.promise);
    await render(); await type('Vorname', 'Alter Entwurf'); await clickButton('Änderungen speichern');
    api.profile = makeProfile({ id: 'profile-b', tenantId: 'tenant-b', firstName: 'Ben', lastName: 'Beispiel', displayName: 'Ben Beispiel' });
    api.user = { id: 'auth-b', email: 'ben@example.test', displayName: 'Ben Beispiel', roleKey: 'business_admin' };
    api.session = { user: api.user, accessToken: 'other-session', refreshToken: 'other-refresh', expiresAt: null };
    await render();
    expect(input('Vorname').value).toBe('Ben');
    await act(async () => save.resolve({ ok: true, data: { ...oldProfile, firstName: 'Alter Entwurf' } }));
    expect(input('Vorname').value).toBe('Ben');
    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Ihre persönlichen Angaben wurden gespeichert.');
  });

  it('shows a chosen image as a preview, persists only on explicit save and preserves edited names', async () => {
    await render(); await type('Vorname', 'Maria');
    const file = await chooseImage();
    expect(services.readUserProfileAvatarFile).toHaveBeenCalledWith(file);
    expect(host.querySelector('img[alt="Vorschau des neuen Profilbilds"]')?.getAttribute('src')).toBe(pendingImage.localUri);
    expect(services.saveUserAccountAvatar).not.toHaveBeenCalled();
    await clickButton('Profilbild speichern');
    expect(services.saveUserAccountAvatar).toHaveBeenCalledWith(expect.objectContaining({ id: 'profile-a' }), 'auth-a', pendingImage);
    expect(host.querySelector('img[alt="Vorschau des neuen Profilbilds"]')).toBeNull();
    expect(input('Vorname').value).toBe('Maria');
    expect(api.profile?.avatarUrl).toBe('https://example.test/saved-avatar.png');
    expect(services.saveUserProfileAccount).not.toHaveBeenCalled();
  });

  it('keeps a failed image upload available for retry and allows cancelling the image selection without a write', async () => {
    services.saveUserAccountAvatar.mockResolvedValueOnce({ ok: false, error: 'Test: Bild konnte nicht gespeichert werden.' });
    await render(); await chooseImage(); await clickButton('Profilbild speichern');
    expect(host.textContent).toContain('Test: Bild konnte nicht gespeichert werden.');
    expect(host.querySelector('img[alt="Vorschau des neuen Profilbilds"]')).toBeTruthy();
    expect(api.updateProfile).not.toHaveBeenCalled();
    await clickButton('Bildauswahl verwerfen');
    expect(host.querySelector('img[alt="Vorschau des neuen Profilbilds"]')).toBeNull();
    expect(services.saveUserAccountAvatar).toHaveBeenCalledOnce();
    expect(api.profile?.avatarUrl).toBeNull();
    await chooseImage(); await clickButton('Profilbild speichern');
    expect(services.saveUserAccountAvatar).toHaveBeenCalledTimes(2);
    expect(api.profile?.avatarUrl).toBe('https://example.test/saved-avatar.png');
  });

  it('rejects an unreadable image without creating a preview and permits choosing another file', async () => {
    services.readUserProfileAvatarFile.mockResolvedValueOnce({ ok: false, error: 'Test: Bilddatei konnte nicht gelesen werden.' });
    await render(); await chooseImage();
    expect(host.textContent).toContain('Test: Bilddatei konnte nicht gelesen werden.');
    expect(host.querySelector('img[alt="Vorschau des neuen Profilbilds"]')).toBeNull();
    expect(services.saveUserAccountAvatar).not.toHaveBeenCalled();
    expect(input('Profilbild auswählen').disabled).toBe(false);
    await chooseImage();
    expect(host.textContent).not.toContain('Test: Bilddatei konnte nicht gelesen werden.');
    expect(host.querySelector('img[alt="Vorschau des neuen Profilbilds"]')).toBeTruthy();
  });

  it('requires confirmation before removing an existing profile image', async () => {
    api.profile = makeProfile({ avatarUrl: 'https://example.test/existing.png' });
    await render(); confirmation.mockReturnValueOnce(false);
    await clickButton('Profilbild entfernen');
    expect(services.removeUserAccountAvatar).not.toHaveBeenCalled();
    expect(api.profile?.avatarUrl).toBe('https://example.test/existing.png');
    await clickButton('Profilbild entfernen');
    expect(services.removeUserAccountAvatar).toHaveBeenCalledWith(expect.objectContaining({ id: 'profile-a' }), 'auth-a');
    expect(api.profile?.avatarUrl).toBeNull();
    expect(host.querySelector('img[alt^="Profilbild von"]')).toBeNull();
  });

  it('falls back to readable initials when a profile image fails to load', async () => {
    api.profile = makeProfile({ avatarUrl: 'https://example.test/missing.png' });
    await render();
    const avatar = host.querySelector<HTMLImageElement>('img[alt="Profilbild von Mara Muster"]');
    expect(avatar).toBeTruthy();
    await act(async () => avatar!.dispatchEvent(new Event('error')));
    expect(host.querySelector('img[alt="Profilbild von Mara Muster"]')).toBeNull();
    expect(host.querySelector('[aria-label="Initialen von Mara Muster"]')?.textContent).toBe('MM');
    expect(button('Bild ändern').disabled).toBe(false);
    expect(services.removeUserAccountAvatar).not.toHaveBeenCalled();
  });

  it('protects actual route removal and browser reload while dirty, then releases navigation on confirmation', async () => {
    await render();
    expect(api.preventRemoval).toBe(false);
    await type('Vorname', 'Maria');
    expect(api.preventRemoval).toBe(true);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    const action = { type: 'GO_BACK' };
    confirmation.mockReturnValueOnce(false);
    await act(async () => api.onRemove?.({ data: { action } }));
    expect(api.dispatch).not.toHaveBeenCalled();
    expect(input('Vorname').value).toBe('Maria');
    await act(async () => api.onRemove?.({ data: { action } }));
    expect(api.dispatch).toHaveBeenCalledOnce();
    expect(api.dispatch).toHaveBeenCalledWith(action);
  });

  it('does not navigate to appearance settings when unsaved changes are retained', async () => {
    await render(); await type('Vorname', 'Maria');
    confirmation.mockReturnValueOnce(false);
    await clickButton('Darstellung & Oberfläche');
    expect(api.push).not.toHaveBeenCalled();
    expect(input('Vorname').value).toBe('Maria');
    await clickButton('Darstellung & Oberfläche');
    expect(api.push).toHaveBeenCalledOnce();
    expect(api.push).toHaveBeenCalledWith('/settings/appearance');
    const action = { type: 'PUSH' };
    await act(async () => api.onRemove?.({ data: { action } }));
    expect(api.dispatch).toHaveBeenCalledWith(action);
    expect(confirmation).toHaveBeenCalledTimes(2);
  });

  it('lets the shared workspace Close and Back guard retain edits or release an approved departure', async () => {
    await render(); await chooseImage();
    confirmation.mockReturnValueOnce(false);
    expect(canLeaveWebPage()).toBe(false);
    expect(host.querySelector('img[alt="Vorschau des neuen Profilbilds"]')).toBeTruthy();
    expect(services.saveUserAccountAvatar).not.toHaveBeenCalled();
    expect(canLeaveWebPage()).toBe(true);
    const action = { type: 'CLOSE_WORKSPACE' };
    await act(async () => api.onRemove?.({ data: { action } }));
    expect(api.dispatch).toHaveBeenCalledWith(action);
    expect(confirmation).toHaveBeenCalledTimes(2);
    expect(services.saveUserAccountAvatar).not.toHaveBeenCalled();
  });

  it('requests a password link for the authenticated email and shows success only after a confirmed result', async () => {
    const request = deferred<ServiceResult<{ message: string }>>();
    requestPasswordReset.mockReturnValueOnce(request.promise);
    await render(); await clickButton('Link zum Passwortwechsel anfordern');
    expect(requestPasswordReset).toHaveBeenCalledWith('account@example.test');
    expect(requestPasswordReset).not.toHaveBeenCalledWith('profile@example.test');
    expect(host.textContent).not.toContain('Die Anfrage wurde angenommen.');
    await act(async () => request.resolve({ ok: false, error: 'Test: Anfrage nicht bestätigt.' }));
    expect(host.textContent).toContain('Test: Anfrage nicht bestätigt.');
    expect(host.textContent).not.toContain('Die Anfrage wurde angenommen.');
    await clickButton('Link zum Passwortwechsel anfordern');
    expect(requestPasswordReset).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Die Anfrage wurde angenommen.');
    expect(host.textContent).not.toContain('Test: Anfrage nicht bestätigt.');
    expect(button('Link zum Passwortwechsel anfordern').disabled).toBe(true);
  });

  it('does not offer email password recovery without a matching authenticated business session', async () => {
    api.session = null;
    await render();
    expect(button('Link zum Passwortwechsel anfordern').disabled).toBe(true);
    await clickButton('Link zum Passwortwechsel anfordern');
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(confirmation).not.toHaveBeenCalled();
  });

  it('retains the current form when logout fails and allows a later retry', async () => {
    api.signOut.mockRejectedValueOnce(new Error('Test: Abmelden fehlgeschlagen.'));
    await render(); await type('Vorname', 'Maria');
    await clickButton('Abmelden');
    expect(api.signOut).toHaveBeenCalledOnce();
    expect(input('Vorname').value).toBe('Maria');
    expect(api.push).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')).toBeTruthy();
    expect(button('Abmelden').disabled).toBe(false);
    confirmation.mockReturnValueOnce(false);
    expect(canLeaveWebPage()).toBe(false);
    await clickButton('Abmelden');
    expect(api.signOut).toHaveBeenCalledTimes(2);
  });
});
