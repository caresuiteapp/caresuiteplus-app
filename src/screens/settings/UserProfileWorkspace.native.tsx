// Generated native presentation from src/screens/settings/UserProfileWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgCircle,NativeSvgPath,NativeSvgRect} from '@/components/layout/NativeSvgPresentation.native';
import {NativeDiv,NativeSpan,NativeStyle,NativeSection,NativeImg,NativeP,NativeH2,NativeInput,NativeButton,NativeH3,NativeForm,NativeLabel,NativeStrong,NativeDl,NativeDt,NativeDd,NativeH4,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../../components/icons/WebActionIcon.native.tsx";
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { USER_PROFILE_WORKSPACE_CSS } from "./userProfileWorkspaceCss.native.ts";
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
    person: <><NativeSvgCircle cx="12" cy="8" r="3.5"/><NativeSvgPath d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
    camera: <><NativeSvgPath d="M8 6 9.5 3h5L16 6h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><NativeSvgCircle cx="12" cy="13" r="4"/></>,
    lock: <><NativeSvgRect x="5" y="10" width="14" height="11" rx="3"/><NativeSvgPath d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    mail: <><NativeSvgRect x="3" y="5" width="18" height="14" rx="3"/><NativeSvgPath d="m4 7 8 6 8-6"/></>,
    arrow: <NativeSvgPath d="M5 12h14m-6-6 6 6-6 6"/>,
    palette: <><NativeSvgPath d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3.3-4-6-9-6Z"/><NativeSvgPath d="M7 9h.01M11 6h.01M16 7h.01M6 14h.01" strokeWidth="3"/></>,
    document: <><NativeSvgPath d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h5"/></>,
    help: <><NativeSvgCircle cx="12" cy="12" r="9"/><NativeSvgPath d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.2.7-1.7 1.2-1.7 2.7M12 17h.01"/></>,
    logout: <><NativeSvgPath d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M10 12h11m-4-4 4 4-4 4"/></>,
    check: <NativeSvgPath d="m5 12 4 4L19 6"/>,
    alert: <><NativeSvgCircle cx="12" cy="12" r="9"/><NativeSvgPath d="M12 7v6M12 17h.01"/></>,
    close: <NativeSvgPath d="m6 6 12 12M6 18 18 6"/>,
};
function ProfileIcon({ name, className }: {
    name: IconName;
    className?: string;
}) {
    return <NativeWorkspaceStyleScope css={[USER_PROFILE_WORKSPACE_CSS]}>{<WebActionIcon className={className}>{PROFILE_ICON_PATHS[name]}</WebActionIcon>}</NativeWorkspaceStyleScope>;
}
function Feedback({ message, error, id }: {
    message?: string | null;
    error?: string | null;
    id?: string;
}) {
    if (error)
        return <NativeWorkspaceStyleScope css={[USER_PROFILE_WORKSPACE_CSS]}>{<NativeDiv id={id} className="cs-profile-feedback cs-profile-feedback--error" role="alert"><ProfileIcon name="alert"/><NativeSpan>{error}</NativeSpan></NativeDiv>}</NativeWorkspaceStyleScope>;
    if (message)
        return <NativeWorkspaceStyleScope css={[USER_PROFILE_WORKSPACE_CSS]}>{<NativeDiv id={id} className="cs-profile-feedback cs-profile-feedback--success" role="status"><ProfileIcon name="check"/><NativeSpan>{message}</NativeSpan></NativeDiv>}</NativeWorkspaceStyleScope>;
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
    return (<NativeDiv className="cs-profile-workspace" data-testid="user-profile-workspace">
      <NativeStyle>{USER_PROFILE_WORKSPACE_CSS}</NativeStyle>
      <NativeSection className="cs-profile-hero" aria-label="Ihr Profil">
        <NativeDiv className="cs-profile-avatar" aria-busy={props.avatarBusy}>
          {imageUrl && !imageFailed
            ? <NativeImg src={imageUrl} alt={props.avatarDirty ? 'Vorschau des neuen Profilbilds' : `Profilbild von ${displayName}`} onError={() => setImageFailed(true)}/>
            : <NativeSpan className="cs-profile-initials" aria-label={`Initialen von ${displayName}`}>{initials.toLocaleUpperCase('de-DE')}</NativeSpan>}
          {props.avatarDirty ? <NativeSpan className="cs-profile-avatar-badge">Vorschau</NativeSpan> : null}
        </NativeDiv>
        <NativeDiv className="cs-profile-intro">
          <NativeP className="cs-profile-eyebrow">Persönlicher Bereich</NativeP>
          <NativeH2>{displayName}</NativeH2>
          {profile.roleLabel ? <NativeSpan className="cs-profile-role"><ProfileIcon name="person"/>{profile.roleLabel}</NativeSpan> : null}
          <NativeP className="cs-profile-description">Ihre Angaben und Einstellungen an einem Ort.</NativeP>
        </NativeDiv>
        <NativeDiv className="cs-profile-photo-actions">
          <NativeInput ref={fileInput} className="cs-profile-file-input" type="file" tabIndex={-1} accept="image/jpeg,image/png,image/webp" aria-label="Profilbild auswählen" disabled={disabled || props.avatarBusy} onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file)
                props.onPickAvatar(file);
        }}/>
          <NativeButton type="button" className="cs-profile-button cs-profile-button--secondary" disabled={disabled || props.avatarBusy} onClick={() => fileInput.current?.click()}>
            <ProfileIcon name="camera"/>{imageUrl ? 'Bild ändern' : 'Bild auswählen'}
          </NativeButton>
          <NativeSpan className="cs-profile-help">JPG, PNG oder WebP · bis 5 MB</NativeSpan>
          {props.avatarDirty ? <NativeDiv className="cs-profile-photo-pending">
            <NativeButton type="button" className="cs-profile-button cs-profile-button--primary" disabled={disabled || props.avatarBusy} onClick={props.onSaveAvatar}>{props.avatarBusy ? 'Wird gespeichert…' : 'Profilbild speichern'}</NativeButton>
            <NativeButton type="button" className="cs-profile-text-button" disabled={disabled || props.avatarBusy} onClick={props.onCancelAvatar}>Bildauswahl verwerfen</NativeButton>
          </NativeDiv> : props.hasStoredAvatar ? <NativeButton type="button" className="cs-profile-text-button" disabled={disabled || props.avatarBusy} onClick={props.onRemoveAvatar}>Profilbild entfernen</NativeButton> : null}
          <Feedback message={props.avatarMessage} error={props.avatarError}/>
        </NativeDiv>
      </NativeSection>

      <NativeDiv className="cs-profile-columns">
        <NativeDiv className="cs-profile-column">
          <NativeSection className="cs-profile-card" aria-labelledby={`${id}-details-title`}>
            <NativeDiv className="cs-profile-card-heading"><NativeSpan className="cs-profile-icon-tile"><ProfileIcon name="person"/></NativeSpan><NativeDiv><NativeH3 id={`${id}-details-title`}>Persönliche Angaben</NativeH3><NativeP>So werden Sie in CareSuite angezeigt.</NativeP></NativeDiv></NativeDiv>
            <NativeForm noValidate onSubmit={(event) => { event.preventDefault(); if (!disabled && props.profileDirty && !props.profileSaving)
        props.onSaveProfile(); }} aria-busy={props.profileSaving}>
              <NativeDiv className="cs-profile-fields">
                <NativeDiv className="cs-profile-field"><NativeLabel htmlFor={`${id}-first-name`}>Vorname</NativeLabel><NativeInput id={`${id}-first-name`} name="givenName" autoComplete="given-name" maxLength={120} value={draft.firstName} disabled={disabled || props.profileSaving} onChange={(event) => props.onDraftChange('firstName', event.currentTarget.value)} aria-invalid={Boolean(fieldErrors.firstName)} aria-describedby={fieldErrors.firstName ? `${id}-first-name-error` : undefined}/>{fieldErrors.firstName ? <NativeSpan id={`${id}-first-name-error`} className="cs-profile-field-error">{fieldErrors.firstName}</NativeSpan> : null}</NativeDiv>
                <NativeDiv className="cs-profile-field"><NativeLabel htmlFor={`${id}-last-name`}>Nachname</NativeLabel><NativeInput id={`${id}-last-name`} name="familyName" autoComplete="family-name" maxLength={120} value={draft.lastName} disabled={disabled || props.profileSaving} onChange={(event) => props.onDraftChange('lastName', event.currentTarget.value)} aria-invalid={Boolean(fieldErrors.lastName)} aria-describedby={fieldErrors.lastName ? `${id}-last-name-error` : undefined}/>{fieldErrors.lastName ? <NativeSpan id={`${id}-last-name-error`} className="cs-profile-field-error">{fieldErrors.lastName}</NativeSpan> : null}</NativeDiv>
                <NativeDiv className="cs-profile-field cs-profile-field--full"><NativeDiv className="cs-profile-field-label"><NativeLabel htmlFor={`${id}-phone`}>Telefonnummer</NativeLabel><NativeSpan>Optional</NativeSpan></NativeDiv><NativeInput id={`${id}-phone`} name="phone" type="tel" autoComplete="tel" maxLength={50} value={draft.phone} placeholder="z. B. +49 170 1234567" disabled={disabled || props.profileSaving} onChange={(event) => props.onDraftChange('phone', event.currentTarget.value)} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? `${id}-phone-error` : undefined}/>{fieldErrors.phone ? <NativeSpan id={`${id}-phone-error`} className="cs-profile-field-error">{fieldErrors.phone}</NativeSpan> : null}</NativeDiv>
              </NativeDiv>
              <Feedback message={props.profileMessage} error={props.profileError}/>
              <NativeDiv className="cs-profile-form-footer">
                {props.profileDirty ? <NativeSpan className="cs-profile-dirty" role="status"><NativeSpan aria-hidden="true"/>Ungespeicherte Änderungen</NativeSpan> : <NativeSpan className="cs-profile-help">Änderungen gelten für Ihr persönliches Profil.</NativeSpan>}
                <NativeDiv className="cs-profile-form-actions">
                  {props.profileDirty ? <NativeButton type="button" className="cs-profile-button cs-profile-button--quiet" disabled={disabled || props.profileSaving} onClick={props.onCancelProfile}>Änderungen verwerfen</NativeButton> : null}
                  <NativeButton type="submit" className="cs-profile-button cs-profile-button--primary" disabled={disabled || props.profileSaving || !props.profileDirty}><ProfileIcon name="check"/>{props.profileSaving ? 'Wird gespeichert…' : 'Änderungen speichern'}</NativeButton>
                </NativeDiv>
              </NativeDiv>
            </NativeForm>
          </NativeSection>

          <NativeSection className="cs-profile-card cs-profile-card--appearance" aria-labelledby={`${id}-appearance-title`}>
            <NativeDiv className="cs-profile-card-heading"><NativeSpan className="cs-profile-icon-tile cs-profile-icon-tile--violet"><ProfileIcon name="palette"/></NativeSpan><NativeDiv><NativeH3 id={`${id}-appearance-title`}>Ihr Arbeitsbereich</NativeH3><NativeP>Gestalten Sie CareSuite passend zu Ihrem Alltag.</NativeP></NativeDiv></NativeDiv>
            <NativeButton type="button" className="cs-profile-link-row" aria-label="Darstellung & Oberfläche" onClick={props.onOpenAppearance} disabled={disabled}><NativeSpan><NativeStrong>Darstellung &amp; Oberfläche</NativeStrong><NativeSpan>Schriftgröße, Hintergrund und Anzeige anpassen</NativeSpan></NativeSpan><ProfileIcon name="arrow"/></NativeButton>
          </NativeSection>
        </NativeDiv>

        <NativeDiv className="cs-profile-column">
          <NativeSection className="cs-profile-card" aria-labelledby={`${id}-access-title`}>
            <NativeDiv className="cs-profile-card-heading"><NativeSpan className="cs-profile-icon-tile cs-profile-icon-tile--teal"><ProfileIcon name="lock"/></NativeSpan><NativeDiv><NativeH3 id={`${id}-access-title`}>Zugang &amp; Sicherheit</NativeH3><NativeP>Ihre Anmeldung und Ihr Passwort.</NativeP></NativeDiv></NativeDiv>
            <NativeDl className="cs-profile-account-info"><NativeDiv><NativeDt><ProfileIcon name="mail"/>E-Mail-Adresse</NativeDt><NativeDd>{profile.email || 'Keine E-Mail-Adresse hinterlegt'}</NativeDd></NativeDiv></NativeDl>
            <NativeDiv className="cs-profile-password">
              <NativeH4>Passwort ändern</NativeH4>
              <NativeP>Fordern Sie einen Link an, um ein neues Passwort festzulegen. Er wird an Ihre E-Mail-Adresse gesendet.</NativeP>
              <NativeButton type="button" className="cs-profile-button cs-profile-button--secondary cs-profile-button--wide" onClick={props.onRequestPasswordReset} disabled={disabled || props.passwordResetBusy || !props.passwordResetAvailable} aria-describedby={!props.passwordResetAvailable ? `${id}-password-reason` : undefined}>
                {props.passwordResetBusy ? 'Link wird angefordert…' : 'Link zum Passwortwechsel anfordern'}
              </NativeButton>
              {!props.passwordResetAvailable ? <NativeP id={`${id}-password-reason`} className="cs-profile-help">{props.passwordResetUnavailableReason || 'Für dieses Konto ist der Passwortwechsel hier nicht verfügbar.'}</NativeP> : null}
              <Feedback message={props.passwordResetMessage} error={props.passwordResetError}/>
            </NativeDiv>
          </NativeSection>

          <NativeSection className="cs-profile-card" aria-labelledby={`${id}-data-title`}>
            <NativeDiv className="cs-profile-card-heading"><NativeSpan className="cs-profile-icon-tile"><ProfileIcon name="document"/></NativeSpan><NativeDiv><NativeH3 id={`${id}-data-title`}>Daten &amp; Unterstützung</NativeH3><NativeP>Anfragen rund um Ihr Konto.</NativeP></NativeDiv></NativeDiv>
            <NativeDiv className="cs-profile-link-list">
              <NativeButton type="button" className="cs-profile-link-row" aria-label="Datenauskunft anfragen" onClick={props.onRequestData} disabled={disabled}><NativeSpan><NativeStrong>Datenauskunft anfragen</NativeStrong><NativeSpan>Auskunft zu Ihren persönlichen Daten erhalten</NativeSpan></NativeSpan><ProfileIcon name="arrow"/></NativeButton>
              <NativeButton type="button" className="cs-profile-link-row" aria-label="Hilfe & Kontakt" onClick={props.onOpenSupport} disabled={disabled}><NativeSpan><NativeStrong>Hilfe &amp; Kontakt</NativeStrong><NativeSpan>Unterstützung bei Fragen zu Ihrem Konto</NativeSpan></NativeSpan><ProfileIcon name="arrow"/></NativeButton>
              <NativeButton type="button" className="cs-profile-link-row cs-profile-link-row--danger" aria-label="Kontolöschung anfragen" onClick={props.onRequestDeletion} disabled={disabled}><NativeSpan><NativeStrong>Kontolöschung anfragen</NativeStrong><NativeSpan>Anfrage stellen und weitere Schritte klären</NativeSpan></NativeSpan><ProfileIcon name="arrow"/></NativeButton>
            </NativeDiv>
          </NativeSection>
        </NativeDiv>
      </NativeDiv>

      <NativeDiv className="cs-profile-session">
        <NativeDiv><NativeSpan className="cs-profile-session-icon"><ProfileIcon name="logout"/></NativeSpan><NativeP><NativeStrong>Von CareSuite abmelden</NativeStrong><NativeSpan>Ihre gespeicherten Angaben bleiben erhalten.</NativeSpan></NativeP></NativeDiv>
        <NativeButton type="button" className="cs-profile-button cs-profile-button--secondary" disabled={disabled || props.signOutBusy} onClick={props.onSignOut}>{props.signOutBusy ? 'Wird abgemeldet…' : 'Abmelden'}</NativeButton>
      </NativeDiv>
    </NativeDiv>);
}
