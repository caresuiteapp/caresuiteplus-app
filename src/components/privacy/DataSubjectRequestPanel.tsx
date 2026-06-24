import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DATA_SUBJECT_REQUEST_PREPARED_MESSAGE,
  isDataSubjectRequestBackendReady,
} from '@/lib/privacy/dataRequestConfig';
import { submitDataSubjectRequest } from '@/lib/privacy/dataSubjectRequestService';
import type { DataRequestType } from '@/lib/privacy/dataSubjectRequest.types';
import { useAuth } from '@/lib/auth/context';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import {
  InfoBanner,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type DataSubjectRequestPanelProps = {
  title: string;
  subtitle: string;
  requestLabel: string;
  requestType: DataRequestType;
  description: string;
  notesPlaceholder: string;
  notesHint: string;
  alternateRoute?: '/settings/data-request' | '/settings/account-deletion';
  alternateLabel?: string;
  showDeletionWarning?: boolean;
};

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

function openSupportEmail(subject: string) {
  const url = `mailto:${SUPPORT_LINKS.supportEmail}?subject=${encodeURIComponent(subject)}`;
  void Linking.openURL(url).catch(() => undefined);
}

export function DataSubjectRequestPanel({
  title,
  subtitle,
  requestLabel,
  requestType,
  description,
  notesPlaceholder,
  notesHint,
  alternateRoute,
  alternateLabel,
  showDeletionWarning = false,
}: DataSubjectRequestPanelProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const backendReady = isDataSubjectRequestBackendReady();
  const preparedOnly = !backendReady;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (preparedOnly || submitting || submitted) return;
    const tenantId = profile?.tenantId;
    if (!tenantId) {
      setSubmitError('Mandant nicht ermittelbar — bitte erneut anmelden oder Support kontaktieren.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const result = await submitDataSubjectRequest(tenantId, profile?.id ?? null, {
      requestType,
      requesterName: name,
      requesterEmail: email,
      verificationNotes: notes,
    });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setSubmitted(true);
  };

  return (
    <View style={styles.root}>
      <PremiumCard accentColor={showDeletionWarning ? colors.danger : colors.cyan}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {preparedOnly ? <PremiumBadge label="In Vorbereitung" variant="orange" dot /> : null}
        </View>
        <Text style={styles.description}>{description}</Text>
      </PremiumCard>

      {showDeletionWarning ? (
        <InfoBanner
          variant="danger"
          title="Unwiderrufliche Löschung"
          message="Kontolöschung betrifft Zugänge und personenbezogene Daten gemäß Aufbewahrungsfristen. Prüfen Sie Mandanten-Richtlinien vor der Anfrage."
        />
      ) : null}

      {preparedOnly ? (
        <InfoBanner
          variant="warning"
          title="Online-Einreichung noch nicht aktiv"
          message={DATA_SUBJECT_REQUEST_PREPARED_MESSAGE}
        />
      ) : null}

      {backendReady && submitted ? (
        <SuccessState message="Ihre Anfrage wurde eingereicht. Sie erhalten eine Bestätigung nach Bearbeitung." />
      ) : null}

      {submitError ? (
        <InfoBanner variant="danger" title="Einreichung fehlgeschlagen" message={submitError} />
      ) : null}

      <SectionPanel title="Anfrage">
        <PremiumInput
          label="Art der Anfrage"
          value={requestLabel}
          editable={false}
          hint="Wird bei Live-Backend automatisch gesetzt."
        />
        <PremiumInput
          label="Name"
          placeholder="Vor- und Nachname"
          value={name}
          onChangeText={setName}
          editable={backendReady && !submitted}
          hint={preparedOnly ? 'Formular-Vorschau — Einreichung deaktiviert.' : undefined}
        />
        <PremiumInput
          label="E-Mail"
          placeholder="ihre@email.de"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={backendReady && !submitted}
        />
        <PremiumInput
          label="Ergänzende Angaben"
          placeholder={notesPlaceholder}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          editable={backendReady && !submitted}
          hint={notesHint}
        />
        <PremiumButton
          title={
            preparedOnly
              ? 'Einreichung in Vorbereitung'
              : submitting
                ? 'Wird gesendet…'
                : submitted
                  ? 'Anfrage eingereicht'
                  : 'Anfrage absenden'
          }
          fullWidth
          disabled={preparedOnly || submitting || submitted}
          onPress={handleSubmit}
        />
      </SectionPanel>

      <SectionPanel title="Alternative Kontaktwege">
        <Text style={styles.supportText}>
          Bis zur Live-Anbindung können Sie Ihre Anfrage per E-Mail stellen. Bitte geben Sie Mandant,
          Rolle und betroffene Person an.
        </Text>
        <PremiumButton
          title={`Support: ${SUPPORT_LINKS.supportEmail}`}
          variant="secondary"
          fullWidth
          onPress={() => openSupportEmail(`${requestLabel} — CareSuite+`)}
        />
        <Pressable
          onPress={() => openExternal(SUPPORT_LINKS.privacy)}
          accessibilityRole="link"
          style={styles.linkRow}
        >
          <Text style={styles.link}>Datenschutzerklärung öffnen</Text>
        </Pressable>
        <Pressable
          onPress={() => openExternal(SUPPORT_LINKS.help)}
          accessibilityRole="link"
          style={styles.linkRow}
        >
          <Text style={styles.link}>Hilfe & Support</Text>
        </Pressable>
        {alternateRoute && alternateLabel ? (
          <Pressable
            onPress={() => router.push(alternateRoute as never)}
            accessibilityRole="button"
            style={styles.linkRow}
          >
            <Text style={styles.link}>{alternateLabel}</Text>
          </Pressable>
        ) : null}
      </SectionPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: 1,
  },
  title: {
    ...typography.h2,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  supportText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  linkRow: {
    paddingVertical: spacing.xs,
  },
  link: {
    ...typography.body,
    color: colors.cyan,
  },
});
