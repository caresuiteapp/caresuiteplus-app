import { WebActionIcon } from '@/components/icons/WebActionIcon.web';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { USER_PROFILE_WORKSPACE_CSS } from './userProfileWorkspaceCss.web';

export type ProfileField = 'firstName' | 'lastName' | 'phone';

export type UserProfileWorkspaceProps = {
  profile: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    roleLabel: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  draft: Record<ProfileField, string>;
  onDraftChange: (field: ProfileField, value: string) => void;
  onSaveProfile: () => void;
  onCancelProfile: () => void;
  profileDirty: boolean;
  profileSaving: boolean;
  profileMessage?: string | null;
  profileError?: string | null;
  fieldErrors?: Partial<Record<ProfileField, string>>;
  avatarPreviewUrl?: string | null;
  avatarBusy: boolean;
  avatarDirty: boolean;
  hasStoredAvatar: boolean;
  avatarMessage?: string | null;
  avatarError?: string | null;
  onPickAvatar: (file: File) => void;
  onSaveAvatar: () => void;
  onCancelAvatar: () => void;
  onRemoveAvatar: () => void;
  onRequestPasswordReset: () => void;
  passwordResetBusy: boolean;
  passwordResetAvailable: boolean;
  passwordResetUnavailableReason?: string;
  passwordResetMessage?: string | null;
  passwordResetError?: string | null;
  onOpenAppearance: () => void;
  onRequestData: () => void;
  onRequestDeletion: () => void;
  onOpenSupport: () => void;
  onSignOut: () => void;
  signOutBusy: boolean;
  disabled: boolean;
};

type IconName = 'person' | 'camera' | 'lock' | 'mail' | 'arrow' | 'palette' | 'document' | 'help' | 'logout' | 'check' | 'alert' | 'close';

const PROFILE_ICON_PATHS: Record<IconName, ReactNode> = {
    person: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    camera: <><path d="M8 6 9.5 3h5L16 6h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="4" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3.3-4-6-9-6Z" /><path d="M7 9h.01M11 6h.01M16 7h.01M6 14h.01" strokeWidth="3" /></>,
    document: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h5" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.2.7-1.7 1.2-1.7 2.7M12 17h.01" /></>,
    logout: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M10 12h11m-4-4 4 4-4 4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
};

function ProfileIcon({ name, className }: { name: IconName; className?: string }) {
  return <WebActionIcon className={className}>{PROFILE_ICON_PATHS[name]}</WebActionIcon>;
}

function Feedback({ message, error, id }: { message?: string | null; error?: string | null; id?: string }) {
  if (error) return <div id={id} className="cs-profile-feedback cs-profile-feedback--error" role="alert"><ProfileIcon name="alert" /><span>{error}</span></div>;
  if (message) return <div id={id} className="cs-profile-feedback cs-profile-feedback--success" role="status"><ProfileIcon name="check" /><span>{message}</span></div>;
  return null;
}

export function UserProfileWorkspace(props: UserProfileWorkspaceProps) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const { profile, draft, disabled, fieldErrors = {} } = props;
  const imageUrl = props.avatarPreviewUrl || profile.avatarUrl;
  const displayName = profile.displayName.trim() || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Mein Profil';
  const initials = (profile.firstName.trim().slice(0, 1) + profile.lastName.trim().slice(0, 1)) || displayName.split(/\s+/).slice(0, 2).map((part) => part.slice(0, 1)).join('');
  useEffect(() => { setImageFailed(false); }, [imageUrl]);

  return (
    <div className="cs-profile-workspace" data-testid="user-profile-workspace">
      <style>{USER_PROFILE_WORKSPACE_CSS}</style>
      <section className="cs-profile-hero" aria-label="Ihr Profil">
        <div className="cs-profile-avatar" aria-busy={props.avatarBusy}>
          {imageUrl && !imageFailed
            ? <img src={imageUrl} alt={props.avatarDirty ? 'Vorschau des neuen Profilbilds' : `Profilbild von ${displayName}`} onError={() => setImageFailed(true)} />
            : <span className="cs-profile-initials" aria-label={`Initialen von ${displayName}`}>{initials.toLocaleUpperCase('de-DE')}</span>}
          {props.avatarDirty ? <span className="cs-profile-avatar-badge">Vorschau</span> : null}
        </div>
        <div className="cs-profile-intro">
          <p className="cs-profile-eyebrow">Persönlicher Bereich</p>
          <h2>{displayName}</h2>
          {profile.roleLabel ? <span className="cs-profile-role"><ProfileIcon name="person" />{profile.roleLabel}</span> : null}
          <p className="cs-profile-description">Ihre Angaben und Einstellungen an einem Ort.</p>
        </div>
        <div className="cs-profile-photo-actions">
          <input
            ref={fileInput}
            className="cs-profile-file-input"
            type="file"
            tabIndex={-1}
            accept="image/jpeg,image/png,image/webp"
            aria-label="Profilbild auswählen"
            disabled={disabled || props.avatarBusy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) props.onPickAvatar(file);
            }}
          />
          <button type="button" className="cs-profile-button cs-profile-button--secondary" disabled={disabled || props.avatarBusy} onClick={() => fileInput.current?.click()}>
            <ProfileIcon name="camera" />{imageUrl ? 'Bild ändern' : 'Bild auswählen'}
          </button>
          <span className="cs-profile-help">JPG, PNG oder WebP · bis 5 MB</span>
          {props.avatarDirty ? <div className="cs-profile-photo-pending">
            <button type="button" className="cs-profile-button cs-profile-button--primary" disabled={disabled || props.avatarBusy} onClick={props.onSaveAvatar}>{props.avatarBusy ? 'Wird gespeichert…' : 'Profilbild speichern'}</button>
            <button type="button" className="cs-profile-text-button" disabled={disabled || props.avatarBusy} onClick={props.onCancelAvatar}>Bildauswahl verwerfen</button>
          </div> : props.hasStoredAvatar ? <button type="button" className="cs-profile-text-button" disabled={disabled || props.avatarBusy} onClick={props.onRemoveAvatar}>Profilbild entfernen</button> : null}
          <Feedback message={props.avatarMessage} error={props.avatarError} />
        </div>
      </section>

      <div className="cs-profile-columns">
        <div className="cs-profile-column">
          <section className="cs-profile-card" aria-labelledby={`${id}-details-title`}>
            <div className="cs-profile-card-heading"><span className="cs-profile-icon-tile"><ProfileIcon name="person" /></span><div><h3 id={`${id}-details-title`}>Persönliche Angaben</h3><p>So werden Sie in CareSuite angezeigt.</p></div></div>
            <form noValidate onSubmit={(event) => { event.preventDefault(); if (!disabled && props.profileDirty && !props.profileSaving) props.onSaveProfile(); }} aria-busy={props.profileSaving}>
              <div className="cs-profile-fields">
                <div className="cs-profile-field"><label htmlFor={`${id}-first-name`}>Vorname</label><input id={`${id}-first-name`} name="givenName" autoComplete="given-name" maxLength={120} value={draft.firstName} disabled={disabled || props.profileSaving} onChange={(event) => props.onDraftChange('firstName', event.currentTarget.value)} aria-invalid={Boolean(fieldErrors.firstName)} aria-describedby={fieldErrors.firstName ? `${id}-first-name-error` : undefined} />{fieldErrors.firstName ? <span id={`${id}-first-name-error`} className="cs-profile-field-error">{fieldErrors.firstName}</span> : null}</div>
                <div className="cs-profile-field"><label htmlFor={`${id}-last-name`}>Nachname</label><input id={`${id}-last-name`} name="familyName" autoComplete="family-name" maxLength={120} value={draft.lastName} disabled={disabled || props.profileSaving} onChange={(event) => props.onDraftChange('lastName', event.currentTarget.value)} aria-invalid={Boolean(fieldErrors.lastName)} aria-describedby={fieldErrors.lastName ? `${id}-last-name-error` : undefined} />{fieldErrors.lastName ? <span id={`${id}-last-name-error`} className="cs-profile-field-error">{fieldErrors.lastName}</span> : null}</div>
                <div className="cs-profile-field cs-profile-field--full"><div className="cs-profile-field-label"><label htmlFor={`${id}-phone`}>Telefonnummer</label><span>Optional</span></div><input id={`${id}-phone`} name="phone" type="tel" autoComplete="tel" maxLength={50} value={draft.phone} placeholder="z. B. +49 170 1234567" disabled={disabled || props.profileSaving} onChange={(event) => props.onDraftChange('phone', event.currentTarget.value)} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? `${id}-phone-error` : undefined} />{fieldErrors.phone ? <span id={`${id}-phone-error`} className="cs-profile-field-error">{fieldErrors.phone}</span> : null}</div>
              </div>
              <Feedback message={props.profileMessage} error={props.profileError} />
              <div className="cs-profile-form-footer">
                {props.profileDirty ? <span className="cs-profile-dirty" role="status"><span aria-hidden="true" />Ungespeicherte Änderungen</span> : <span className="cs-profile-help">Änderungen gelten für Ihr persönliches Profil.</span>}
                <div className="cs-profile-form-actions">
                  {props.profileDirty ? <button type="button" className="cs-profile-button cs-profile-button--quiet" disabled={disabled || props.profileSaving} onClick={props.onCancelProfile}>Änderungen verwerfen</button> : null}
                  <button type="submit" className="cs-profile-button cs-profile-button--primary" disabled={disabled || props.profileSaving || !props.profileDirty}><ProfileIcon name="check" />{props.profileSaving ? 'Wird gespeichert…' : 'Änderungen speichern'}</button>
                </div>
              </div>
            </form>
          </section>

          <section className="cs-profile-card cs-profile-card--appearance" aria-labelledby={`${id}-appearance-title`}>
            <div className="cs-profile-card-heading"><span className="cs-profile-icon-tile cs-profile-icon-tile--violet"><ProfileIcon name="palette" /></span><div><h3 id={`${id}-appearance-title`}>Ihr Arbeitsbereich</h3><p>Gestalten Sie CareSuite passend zu Ihrem Alltag.</p></div></div>
            <button type="button" className="cs-profile-link-row" aria-label="Darstellung & Oberfläche" onClick={props.onOpenAppearance} disabled={disabled}><span><strong>Darstellung &amp; Oberfläche</strong><span>Schriftgröße, Hintergrund und Anzeige anpassen</span></span><ProfileIcon name="arrow" /></button>
          </section>
        </div>

        <div className="cs-profile-column">
          <section className="cs-profile-card" aria-labelledby={`${id}-access-title`}>
            <div className="cs-profile-card-heading"><span className="cs-profile-icon-tile cs-profile-icon-tile--teal"><ProfileIcon name="lock" /></span><div><h3 id={`${id}-access-title`}>Zugang &amp; Sicherheit</h3><p>Ihre Anmeldung und Ihr Passwort.</p></div></div>
            <dl className="cs-profile-account-info"><div><dt><ProfileIcon name="mail" />E-Mail-Adresse</dt><dd>{profile.email || 'Keine E-Mail-Adresse hinterlegt'}</dd></div></dl>
            <div className="cs-profile-password">
              <h4>Passwort ändern</h4>
              <p>Fordern Sie einen Link an, um ein neues Passwort festzulegen. Er wird an Ihre E-Mail-Adresse gesendet.</p>
              <button type="button" className="cs-profile-button cs-profile-button--secondary cs-profile-button--wide" onClick={props.onRequestPasswordReset} disabled={disabled || props.passwordResetBusy || !props.passwordResetAvailable} aria-describedby={!props.passwordResetAvailable ? `${id}-password-reason` : undefined}>
                {props.passwordResetBusy ? 'Link wird angefordert…' : 'Link zum Passwortwechsel anfordern'}
              </button>
              {!props.passwordResetAvailable ? <p id={`${id}-password-reason`} className="cs-profile-help">{props.passwordResetUnavailableReason || 'Für dieses Konto ist der Passwortwechsel hier nicht verfügbar.'}</p> : null}
              <Feedback message={props.passwordResetMessage} error={props.passwordResetError} />
            </div>
          </section>

          <section className="cs-profile-card" aria-labelledby={`${id}-data-title`}>
            <div className="cs-profile-card-heading"><span className="cs-profile-icon-tile"><ProfileIcon name="document" /></span><div><h3 id={`${id}-data-title`}>Daten &amp; Unterstützung</h3><p>Anfragen rund um Ihr Konto.</p></div></div>
            <div className="cs-profile-link-list">
              <button type="button" className="cs-profile-link-row" aria-label="Datenauskunft anfragen" onClick={props.onRequestData} disabled={disabled}><span><strong>Datenauskunft anfragen</strong><span>Auskunft zu Ihren persönlichen Daten erhalten</span></span><ProfileIcon name="arrow" /></button>
              <button type="button" className="cs-profile-link-row" aria-label="Hilfe & Kontakt" onClick={props.onOpenSupport} disabled={disabled}><span><strong>Hilfe &amp; Kontakt</strong><span>Unterstützung bei Fragen zu Ihrem Konto</span></span><ProfileIcon name="arrow" /></button>
              <button type="button" className="cs-profile-link-row cs-profile-link-row--danger" aria-label="Kontolöschung anfragen" onClick={props.onRequestDeletion} disabled={disabled}><span><strong>Kontolöschung anfragen</strong><span>Anfrage stellen und weitere Schritte klären</span></span><ProfileIcon name="arrow" /></button>
            </div>
          </section>
        </div>
      </div>

      <div className="cs-profile-session">
        <div><span className="cs-profile-session-icon"><ProfileIcon name="logout" /></span><p><strong>Von CareSuite abmelden</strong><span>Ihre gespeicherten Angaben bleiben erhalten.</span></p></div>
        <button type="button" className="cs-profile-button cs-profile-button--secondary" disabled={disabled || props.signOutBusy} onClick={props.onSignOut}>{props.signOutBusy ? 'Wird abgemeldet…' : 'Abmelden'}</button>
      </div>
    </div>
  );
}
