import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumInput } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useAuth } from '@/lib/auth/context';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { sendBroadcast } from '@/lib/office/broadcastservice';
import { spacing, radius } from '@/theme';
import type {
  BroadcastCategoryKey,
  BroadcastPriority,
  CreateBroadcastInput,
} from '@/types/office/broadcast';
import { BROADCAST_CATEGORIES, BROADCAST_PRIORITIES } from '@/types/office/broadcast';

type OfficeBroadcastModalProps = {
  visible: boolean;
  onClose: () => void;
  onSent: (recipientCount: number) => void;
};

export function OfficeBroadcastModal({ visible, onClose, onSent }: OfficeBroadcastModalProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { profile, user } = useAuth();
  const tenantId = useServiceTenantId();
  const tenantName = useTenantDisplayName();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<BroadcastCategoryKey>('general');
  const [priority, setPriority] = useState<BroadcastPriority>('normal');
  const [requireAck, setRequireAck] = useState(false);
  const [allowReplies, setAllowReplies] = useState(true);
  const [showInPortal, setShowInPortal] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { gap: spacing.sm, marginBottom: spacing.md },
        label: { ...typography.caption, color: c.muted, textTransform: 'uppercase' },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        chip: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: c.border,
        },
        chipActive: { backgroundColor: `${c.violet}22`, borderColor: c.violet },
        chipText: { ...typography.caption, color: c.muted },
        chipTextActive: { color: c.violet, fontWeight: '700' },
        option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        optionText: { ...typography.body, color: c.text },
        preview: {
          padding: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: `${c.violet}06`,
          gap: spacing.xs,
        },
        previewTitle: { ...typography.body, fontWeight: '700', color: c.text },
        previewBody: { ...typography.caption, color: c.muted },
        error: { ...typography.caption, color: c.danger },
        recipientNote: { ...typography.caption, color: c.muted },
        layout: { flexDirection: 'row', gap: spacing.md },
        form: { flex: 1, minWidth: 0 },
        previewPane: { width: 220, flexShrink: 0 },
      }),
    [c, typography],
  );

  const reset = useCallback(() => {
    setTitle('');
    setBody('');
    setCategory('general');
    setPriority('normal');
    setRequireAck(false);
    setAllowReplies(true);
    setShowInPortal(true);
    setConfirmOpen(false);
    setError(null);
  }, []);

  const input: CreateBroadcastInput = {
    title,
    body,
    category,
    priority,
    allowReplies,
    requireAcknowledgement: requireAck,
    showInEmployeePortal: showInPortal,
    recipientFilter: { audience: 'employees' },
  };

  const handleSend = async () => {
    if (!tenantId) return;
    setSubmitting(true);
    setError(null);
    const result = await sendBroadcast(
      tenantId,
      input,
      profile?.roleKey,
      user?.id ?? profile?.id ?? null,
    );
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      setConfirmOpen(false);
      return;
    }
    reset();
    onClose();
    onSent(result.data.recipientCount);
  };

  const categoryLabel = BROADCAST_CATEGORIES.find((item) => item.key === category)?.label ?? '';
  const priorityLabel = BROADCAST_PRIORITIES.find((item) => item.key === priority)?.label ?? '';

  if (confirmOpen) {
    return (
      <PlatformModal
        visible={visible}
        title="Broadcast senden?"
        onClose={() => setConfirmOpen(false)}
        footerActions={[
          { title: 'Abbrechen', onPress: () => setConfirmOpen(false), variant: 'secondary' },
          { title: 'Jetzt senden', onPress: () => void handleSend(), loading: submitting },
        ]}
      >
        <Text style={styles.optionText}>
          Diese Nachricht wird an alle aktiven Mitarbeitenden des Mandanten {tenantName} gesendet.
          Möchten Sie fortfahren?
        </Text>
      </PlatformModal>
    );
  }

  return (
    <PlatformModal
      visible={visible}
      title="Broadcast an Mitarbeitende senden"
      onClose={() => {
        reset();
        onClose();
      }}
      footerActions={[
        { title: 'Abbrechen', onPress: () => { reset(); onClose(); }, variant: 'secondary' },
        {
          title: 'Broadcast senden',
          onPress: () => {
            if (!title.trim() || !body.trim()) {
              setError('Betreff und Nachricht sind Pflichtfelder.');
              return;
            }
            setConfirmOpen(true);
          },
          disabled: submitting,
        },
      ]}
      maxWidth={720}
    >
      <ScrollView>
        <View style={styles.layout}>
          <View style={styles.form}>
            <View style={styles.section}>
              <Text style={styles.label}>Empfänger</Text>
              <Text style={styles.recipientNote}>
                Alle aktiven Mitarbeitenden des Mandanten
              </Text>
              <Text style={styles.recipientNote}>
                Filter nach Rolle, Team oder Standort — in Vorbereitung
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Kategorie</Text>
              <View style={styles.chips}>
                {BROADCAST_CATEGORIES.slice(0, 6).map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setCategory(item.key)}
                    style={[styles.chip, category === item.key && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, category === item.key && styles.chipTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Priorität</Text>
              <View style={styles.chips}>
                {BROADCAST_PRIORITIES.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setPriority(item.key)}
                    style={[styles.chip, priority === item.key && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, priority === item.key && styles.chipTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Betreff</Text>
              <PremiumInput value={title} onChangeText={setTitle} placeholder="z. B. Softwareumstellung heute" />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Nachricht</Text>
              <PremiumInput
                value={body}
                onChangeText={setBody}
                placeholder="Mitteilung an alle Mitarbeitenden …"
                multiline
                numberOfLines={6}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Optionen</Text>
              {[
                { key: 'ack', label: 'Lesebestätigung erforderlich', value: requireAck, set: setRequireAck },
                { key: 'replies', label: 'Rückfrage an Verwaltung erlauben', value: allowReplies, set: setAllowReplies },
                { key: 'portal', label: 'Zusätzlich im Mitarbeiter:innenportal anzeigen', value: showInPortal, set: setShowInPortal },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => opt.set(!opt.value)}
                  style={styles.option}
                >
                  <Text style={styles.optionText}>{opt.value ? '☑' : '☐'} {opt.label}</Text>
                </Pressable>
              ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          <View style={styles.previewPane}>
            <Text style={styles.label}>Vorschau</Text>
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>{title.trim() || 'Betreff'}</Text>
              <Text style={styles.previewBody}>{categoryLabel} · {priorityLabel}</Text>
              <Text style={styles.previewBody} numberOfLines={6}>
                {body.trim() || 'Nachrichtentext …'}
              </Text>
              <Text style={styles.previewBody}>🔔 Broadcast · An alle Mitarbeitenden</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </PlatformModal>
  );
}
