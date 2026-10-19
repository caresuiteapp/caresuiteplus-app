import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, PremiumCard, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { assertClientTimelineCapture } from '@/lib/clients/clientTimelineNoteAction.web';
import { isCapturedClientContactEntries, type ClientContactReadCapture, type ClientContactMetadata, type ClientContactTextEvidence, type ClientContactBooleanEvidence } from '@/lib/clients/clientContactEvidence.web';
import { medicationTimeDisplay } from '@/lib/pflege/medicationTimeDisplay.web';
import { CLIENT_CONTACT_TYPE_LABELS, CONTACT_RELATION_LABELS } from '@/types/modules/client/clientContact';
import { spacing, typography } from '@/theme';

type Props = { captureRead: () => ClientContactReadCapture | null };
function captureContactRead(factory: Props['captureRead']): ClientContactReadCapture | null {
  try {
    const supplied = factory(), keys = ['tenantId', 'clientId', 'owner', 'key', 'assertCurrentRead', 'entries'];
    if (!supplied || Object.getPrototypeOf(supplied) !== Object.prototype || Reflect.ownKeys(supplied).length !== keys.length
      || Reflect.ownKeys(supplied).some(key => typeof key !== 'string' || !keys.includes(key)
        || !Object.getOwnPropertyDescriptor(supplied, key)?.enumerable || !('value' in Object.getOwnPropertyDescriptor(supplied, key)!))) return null;
    const value = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(supplied, key)!.value])) as ClientContactReadCapture;
    if (!value.owner || Object.getPrototypeOf(value.owner) !== Object.prototype || !Object.isFrozen(value.owner)
      || Reflect.ownKeys(value.owner).length || !isCapturedClientContactEntries(value.entries)) return null;
    const { entries, ...base } = value;
    assertClientTimelineCapture(base);
    return Object.freeze({ ...base, entries });
  } catch { return null; }
}
function contactText(field: ClientContactTextEvidence): string {
  return field.state === 'present' ? field.value! : field.state === 'missing' ? 'Nicht geliefert' : field.state === 'null' ? 'Null im Original'
    : field.state === 'empty' ? `Leer im Original · ${JSON.stringify(field.value)}` : 'Ungeklärtes Originalformat';
}
function contactFlag(field: ClientContactBooleanEvidence): string {
  return field.state === 'known' ? field.value ? 'Ja, gespeichert' : 'Nein, gespeichert' : field.state === 'missing' ? 'Nicht geliefert'
    : field.state === 'null' ? 'Null im Original' : 'Ungeklärtes Originalformat';
}
function contactCategory(field: ClientContactTextEvidence): string {
  const labels = CLIENT_CONTACT_TYPE_LABELS as Record<string, string>;
  return field.state === 'present' && Object.hasOwn(labels, field.value!) ? `${labels[field.value!]} · Original: ${field.value}` : contactText(field);
}
function contactRelationship(field: ClientContactTextEvidence): string {
  const labels = CONTACT_RELATION_LABELS as Record<string, string>;
  return field.state === 'present' && Object.hasOwn(labels, field.value!) ? `${labels[field.value!]} · Original: ${field.value}` : contactText(field);
}
function contactMetadataTime(field: ClientContactTextEvidence): string {
  return field.state === 'present' || field.state === 'empty' ? medicationTimeDisplay(field.value).display : contactText(field);
}
const moduleLabels: Record<string, string> = { canViewAppointments: 'Termine', canViewDocuments: 'Dokumente', canViewCarePlan: 'Pflegeplan', canSendMessages: 'Nachrichten', canViewBilling: 'Abrechnung' };
function ClientContactEntry({ entry, mayRead }: { entry: ClientContactMetadata; mayRead: (entry?: ClientContactMetadata) => boolean }) {
  const colors = useAuroraAdaptiveText();
  if (!mayRead(entry)) return null;
  return <PremiumCard style={styles.card}>
    <Text selectable style={[styles.primary, { color: colors.primary }]}>{contactText(entry.firstName)} · {contactText(entry.lastName)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Vollständiger Originalname: {contactText(entry.fullName)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Historisches Name-Feld: {contactText(entry.legacyName)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Kontaktkennung: {entry.nativeId}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Kategorie: {contactCategory(entry.category)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Beziehung im Original: {contactRelationship(entry.relationship)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Telefon: {contactText(entry.phone)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>E-Mail: {contactText(entry.email)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Erreichbarkeit / Kontaktvermerk: {contactText(entry.notes)}</Text>
    <Text style={[styles.secondary, { color: colors.secondary }]}>Gespeicherte Notfallkontakt-Markierung: {contactFlag(entry.emergencyMark)}</Text>
    <Text style={[styles.secondary, { color: colors.secondary }]}>Gespeicherter Portalvermerk: {contactFlag(entry.portalMark)}</Text>
    <Text style={[styles.secondary, { color: colors.secondary }]}>Modulkonfiguration im Kontaktoriginal: {entry.moduleConfiguration === 'object' ? entry.configuredModules.map(module => `${moduleLabels[module.key]}: ${contactFlag(module.configured)}`).join(' · ')
      : entry.moduleConfiguration === 'missing' ? 'Nicht geliefert' : entry.moduleConfiguration === 'null' ? 'Null im Original' : 'Ungeklärtes Originalformat'}</Text>
    <Text style={[styles.secondary, { color: colors.secondary }]}>Aktueller Angehörigen- oder Klient:innen-Portalzugang, Vertretungsumfang und Einwilligung sind durch diesen Kontaktvermerk nicht bestätigt.</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Erfasst – Metadatum: {contactMetadataTime(entry.createdAt)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Geändert – Metadatum: {contactMetadataTime(entry.updatedAt)}</Text>
  </PremiumCard>;
}
export function ClientRecordContactEvidencePanel({ captureRead }: Props) {
  const colors = useAuroraAdaptiveText();
  const alive = useRef(true), latest = useRef(captureRead);
  latest.current = captureRead;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const read = captureContactRead(captureRead);
  const mayRead = (entry?: ClientContactMetadata): boolean => {
    if (!alive.current || !read || entry && !read.entries.includes(entry)) return false;
    try { const { entries, ...base } = read; assertClientTimelineCapture(base); } catch { return false; }
    const current = captureContactRead(latest.current);
    return !!current && current.owner === read.owner && current.key === read.key && current.tenantId === read.tenantId
      && current.clientId === read.clientId && current.entries === read.entries;
  };
  if (!mayRead()) return <SectionPanel title="Angehörige & Kontakte"><Text style={[styles.secondary, { color: colors.secondary }]}>Der aktuelle eigene Kontaktbestand ist nicht bestätigt.</Text></SectionPanel>;
  return <SectionPanel title="Angehörige & Kontakte" subtitle="Gespeicherte Kontaktangaben; keine Zugangs- oder Vertretungsfreigabe">
    <View style={styles.list}>{read!.entries.length === 0 ? <EmptyState title="Keine Kontakte im gelieferten Bestand" message="Dieser aktuelle Aktenabruf hat keine Kontaktoriginale geliefert." />
      : read!.entries.map(entry => <ClientContactEntry key={entry.nativeId} entry={entry} mayRead={mayRead} />)}</View>
  </SectionPanel>;
}
const styles = StyleSheet.create({
  list: { gap: spacing.md, minWidth: 0 }, card: { gap: spacing.xs, minWidth: 0, maxWidth: '100%' },
  primary: { ...typography.bodyStrong, flexShrink: 1 }, secondary: { ...typography.body, flexShrink: 1 },
});
