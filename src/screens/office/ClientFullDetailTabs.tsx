import { StyleSheet, Text, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import { PremiumBadge, PremiumCard, SectionPanel, Timeline } from '@/components/ui';
import type { ClientFullDetail } from '@/types/modules/client';
import {
  BILLING_TYPE_LABELS,
  BUDGET_TYPE_LABELS,
  CARE_LEVEL_LABELS,
  CLIENT_DOCUMENT_CATEGORY_LABELS,
  CLIENT_LIFECYCLE_STATUS_LABELS,
  CONSENT_TYPE_LABELS,
  CONTACT_RELATION_LABELS,
  PORTAL_ACCESS_STATUS_LABELS,
  RISK_CATEGORY_LABELS,
  RISK_LEVEL_LABELS,
  SERVICE_TYPE_LABELS,
  TASK_CATEGORY_LABELS,
  TASK_FREQUENCY_LABELS,
} from '@/types/modules/client';
import { VISIBILITY_LABELS } from '@/types/portal/visibility';
import { colors, spacing, typography } from '@/theme';

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function mask(value: string | null | undefined, allowed: boolean): string | null {
  if (!value) return null;
  return allowed ? value : '••• Geschützt';
}

export function StammdatenTab({ client, canViewSensitive }: { client: ClientFullDetail; canViewSensitive: boolean }) {
  return (
    <View style={styles.tab}>
      <SectionPanel title="Stammdaten">
        <DetailInfoRow label="Anrede" value={client.core.salutation} />
        <DetailInfoRow label="Geschlecht" value={client.core.gender} />
        <DetailInfoRow label="Geburtsdatum" value={client.core.dateOfBirth ? new Date(client.core.dateOfBirth).toLocaleDateString('de-DE') : null} />
        <DetailInfoRow label="Status" value={CLIENT_LIFECYCLE_STATUS_LABELS[client.lifecycleStatus]} />
        <DetailInfoRow label="Versichertennummer" value={mask(client.core.insuranceNumber, canViewSensitive)} />
        <DetailInfoRow label="Schlüsseltresor" value={mask(client.core.keySafeCode, canViewSensitive)} />
        {client.core.diagnoses.length > 0 ? (
          <DetailInfoRow
            label="Diagnosen"
            value={canViewSensitive ? client.core.diagnoses.join(', ') : '••• Geschützt'}
          />
        ) : null}
      </SectionPanel>
    </View>
  );
}

export function KontaktAdresseTab({ client }: { client: ClientFullDetail }) {
  return (
    <View style={styles.tab}>
      <SectionPanel title="Kontakt">
        <DetailInfoRow label="Telefon" value={client.phone} />
        <DetailInfoRow label="E-Mail" value={client.email} />
      </SectionPanel>
      <SectionPanel title="Adressen">
        {client.addresses.length === 0 ? (
          <Text style={styles.empty}>Keine Adressen hinterlegt.</Text>
        ) : (
          client.addresses.map((a) => (
            <PremiumCard key={a.id} style={styles.card}>
              <Text style={styles.cardTitle}>{a.street}, {a.zip} {a.city}</Text>
              {a.isPrimary ? <PremiumBadge label="Hauptadresse" variant="green" dot /> : null}
              {a.accessNotes ? <Text style={styles.meta}>{a.accessNotes}</Text> : null}
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

export function AngehoerigeTab({ client }: { client: ClientFullDetail }) {
  return (
    <View style={styles.tab}>
      <SectionPanel title="Angehörige & Kontakte">
        {client.contacts.length === 0 ? (
          <Text style={styles.empty}>Keine Kontakte hinterlegt.</Text>
        ) : (
          client.contacts.map((c) => (
            <PremiumCard key={c.id} style={styles.card}>
              <Text style={styles.cardTitle}>{c.firstName} {c.lastName}</Text>
              <Text style={styles.meta}>{CONTACT_RELATION_LABELS[c.relationship]}{c.relationshipLabel ? ` (${c.relationshipLabel})` : ''}</Text>
              <DetailInfoRow label="Telefon" value={c.phone} />
              <DetailInfoRow label="E-Mail" value={c.email} />
              <View style={styles.badgeRow}>
                {c.isEmergency ? <PremiumBadge label="Notfallkontakt" variant="red" dot /> : null}
                {c.isPortalUser ? <PremiumBadge label="Portal-Zugang" variant="cyan" /> : null}
              </View>
              {c.isPortalUser ? (
                <Text style={styles.meta}>
                  Portal: {[
                    c.portalPermissions.canViewAppointments && 'Termine',
                    c.portalPermissions.canViewDocuments && 'Dokumente',
                    c.portalPermissions.canViewCarePlan && 'Pflegeplan',
                    c.portalPermissions.canSendMessages && 'Nachrichten',
                  ].filter(Boolean).join(', ') || 'Keine Module'}
                </Text>
              ) : null}
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

export function PflegegradBudgetTab({ client }: { client: ClientFullDetail }) {
  return (
    <View style={styles.tab}>
      <SectionPanel title="Pflegegrad & Kassen">
        {client.careLevels.map((cl) => (
          <PremiumCard key={cl.id} accentColor={colors.cyan} style={styles.card}>
            <Text style={styles.cardTitle}>{CARE_LEVEL_LABELS[cl.grade]}</Text>
            <DetailInfoRow label="Pflegekasse" value={cl.careFundName} />
            <DetailInfoRow label="Gültig ab" value={new Date(cl.validFrom).toLocaleDateString('de-DE')} />
          </PremiumCard>
        ))}
      </SectionPanel>
      <SectionPanel title="Budgets">
        {client.budgets.length === 0 ? (
          <Text style={styles.empty}>Keine Budgets hinterlegt.</Text>
        ) : (
          client.budgets.map((b) => {
            const remaining = b.totalAmountCents - b.usedAmountCents - b.reservedAmountCents;
            return (
              <PremiumCard key={b.id} accentColor={colors.amber} style={styles.card}>
                <Text style={styles.cardTitle}>{BUDGET_TYPE_LABELS[b.budgetType]} ({b.year})</Text>
                <DetailInfoRow label="Gesamt" value={formatEuro(b.totalAmountCents)} />
                <DetailInfoRow label="Verbraucht" value={formatEuro(b.usedAmountCents)} />
                <DetailInfoRow label="Verfügbar" value={formatEuro(remaining)} />
              </PremiumCard>
            );
          })
        )}
      </SectionPanel>
    </View>
  );
}

export function VertragAbrechnungTab({ client }: { client: ClientFullDetail }) {
  return (
    <View style={styles.tab}>
      {client.billingProfile ? (
        <SectionPanel title="Abrechnungsprofil">
          <DetailInfoRow label="Abrechnungsart" value={BILLING_TYPE_LABELS[client.billingProfile.billingType]} />
          <DetailInfoRow label="Leistungsart" value={SERVICE_TYPE_LABELS[client.billingProfile.serviceType]} />
          <DetailInfoRow label="Stundensatz" value={formatEuro(client.billingProfile.hourlyRateCents)} />
          <DetailInfoRow label="Kostenträger" value={client.billingProfile.costBearerName} />
        </SectionPanel>
      ) : null}
      <SectionPanel title="Verträge">
        {client.contracts.length === 0 ? (
          <Text style={styles.empty}>Keine Verträge hinterlegt.</Text>
        ) : (
          client.contracts.map((c) => (
            <PremiumCard key={c.id} style={styles.card}>
              <Text style={styles.cardTitle}>{c.contractNumber}</Text>
              <DetailInfoRow label="Beginn" value={new Date(c.contractStart).toLocaleDateString('de-DE')} />
              <DetailInfoRow label="Stundensatz" value={formatEuro(c.hourlyRateCents)} />
              <DetailInfoRow label="Wochenstunden" value={c.weeklyHours?.toString() ?? null} />
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

export function EinsatzAufgabenTab({ client }: { client: ClientFullDetail }) {
  return (
    <View style={styles.tab}>
      {client.preferences ? (
        <SectionPanel title="Einsatzpräferenzen">
          <DetailInfoRow label="Bevorzugte Zeiten" value={client.preferences.preferredShifts.join(', ') || null} />
          <DetailInfoRow label="Mobilität" value={client.preferences.mobilityNotes} />
          <DetailInfoRow label="Zugang" value={client.preferences.accessInstructions} />
        </SectionPanel>
      ) : null}
      <SectionPanel title="Aufgaben">
        {client.tasks.length === 0 ? (
          <Text style={styles.empty}>Keine Aufgaben definiert.</Text>
        ) : (
          client.tasks.map((t) => (
            <PremiumCard key={t.id} style={styles.card}>
              <Text style={styles.cardTitle}>{t.title}</Text>
              <View style={styles.badgeRow}>
                <PremiumBadge label={TASK_CATEGORY_LABELS[t.category]} variant="cyan" />
                <PremiumBadge label={TASK_FREQUENCY_LABELS[t.frequency]} variant="muted" />
                {t.isActive ? <PremiumBadge label="Aktiv" variant="green" dot /> : <PremiumBadge label="Inaktiv" variant="muted" />}
              </View>
              {t.durationMinutes ? <Text style={styles.meta}>{t.durationMinutes} Min.</Text> : null}
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

export function RisikenNotfallTab({ client, canViewSensitive }: { client: ClientFullDetail; canViewSensitive: boolean }) {
  return (
    <View style={styles.tab}>
      <SectionPanel title="Risiken">
        {client.risks.length === 0 ? (
          <Text style={styles.empty}>Keine Risiken erfasst.</Text>
        ) : (
          client.risks.map((r) => (
            <PremiumCard key={r.id} accentColor={r.level === 'hoch' || r.level === 'kritisch' ? colors.error : colors.orange} style={styles.card}>
              <Text style={styles.cardTitle}>{RISK_CATEGORY_LABELS[r.category]}</Text>
              <PremiumBadge label={RISK_LEVEL_LABELS[r.level]} variant={r.level === 'hoch' || r.level === 'kritisch' ? 'red' : 'orange'} dot />
              <Text style={styles.meta}>{canViewSensitive ? r.description : 'Geschützte Gesundheitsdaten'}</Text>
              {r.mitigation ? <Text style={styles.meta}>Maßnahme: {r.mitigation}</Text> : null}
            </PremiumCard>
          ))
        )}
      </SectionPanel>
      {client.emergencyPlan ? (
        <SectionPanel title="Notfallplan">
          <DetailInfoRow label="Notfallkontakt" value={`${client.emergencyPlan.emergencyContactName} (${client.emergencyPlan.emergencyContactPhone})`} />
          <DetailInfoRow label="Hausarzt" value={client.emergencyPlan.doctorName} />
          <DetailInfoRow label="Krankenhaus" value={client.emergencyPlan.hospitalPreference} />
          {client.emergencyPlan.allergies.length > 0 ? (
            <DetailInfoRow label="Allergien" value={canViewSensitive ? client.emergencyPlan.allergies.join(', ') : 'Geschützt'} />
          ) : null}
        </SectionPanel>
      ) : null}
    </View>
  );
}

export function DokumenteTab({ client }: { client: ClientFullDetail }) {
  return (
    <View style={styles.tab}>
      <SectionPanel title="Dokumente">
        {client.documents.length === 0 ? (
          <Text style={styles.empty}>Keine Dokumente hinterlegt.</Text>
        ) : (
          client.documents.map((d) => (
            <PremiumCard key={d.id} style={styles.card}>
              <Text style={styles.cardTitle}>{d.title}</Text>
              <PremiumBadge label={CLIENT_DOCUMENT_CATEGORY_LABELS[d.category]} variant="cyan" />
              <Text style={styles.meta}>{d.fileName}</Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

export function EinwilligungenTab({ client }: { client: ClientFullDetail }) {
  return (
    <View style={styles.tab}>
      {client.consents.map((c) => (
        <PremiumCard key={c.id} style={styles.card}>
          <Text style={styles.cardTitle}>{c.title}</Text>
          <Text style={styles.meta}>{CONSENT_TYPE_LABELS[c.consentType]}</Text>
          <View style={styles.badgeRow}>
            <PremiumBadge label={c.granted ? 'Erteilt' : 'Offen'} variant={c.granted ? 'green' : 'muted'} dot />
            <PremiumBadge label={VISIBILITY_LABELS[c.scope]} variant="cyan" />
          </View>
          {c.grantedAt ? <Text style={styles.meta}>Erteilt: {new Date(c.grantedAt).toLocaleDateString('de-DE')}</Text> : null}
        </PremiumCard>
      ))}
    </View>
  );
}

export function PortalTab({ client }: { client: ClientFullDetail }) {
  return (
    <View style={styles.tab}>
      <SectionPanel title="Portal-Zugänge">
        {client.portalAccess.length === 0 ? (
          <Text style={styles.empty}>Keine Portal-Zugänge eingerichtet.</Text>
        ) : (
          client.portalAccess.map((p) => (
            <PremiumCard key={p.id} style={styles.card}>
              <Text style={styles.cardTitle}>{p.email}</Text>
              <PremiumBadge label={PORTAL_ACCESS_STATUS_LABELS[p.status]} variant={p.status === 'aktiv' ? 'green' : 'muted'} dot />
              <Text style={styles.meta}>Module: {p.modulesEnabled.join(', ') || '—'}</Text>
              {p.lastLoginAt ? <Text style={styles.meta}>Letzter Login: {new Date(p.lastLoginAt).toLocaleDateString('de-DE')}</Text> : null}
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

export function VerlaufTab({ client }: { client: ClientFullDetail }) {
  const items = client.timeline
    .filter((e) => !e.isInternal)
    .map((e) => ({
      id: e.id,
      icon: e.icon,
      title: e.title,
      subtitle: e.subtitle ?? e.actorName ?? undefined,
      timestamp: e.timestamp,
      status: e.status,
      type: 'care' as const,
    }));

  return (
    <View style={styles.tab}>
      <SectionPanel title="Verlauf / Timeline">
        {items.length === 0 ? (
          <Text style={styles.empty}>Keine Einträge.</Text>
        ) : (
          <Timeline items={items} />
        )}
      </SectionPanel>
      {client.internalNotes.length > 0 ? (
        <SectionPanel title="Interne Notizen" subtitle="Nur Office — nicht im Portal">
          {client.internalNotes.map((n) => (
            <PremiumCard key={n.id} accentColor={colors.violet} style={styles.card}>
              <Text style={styles.meta}>{n.category} · {n.createdBy}</Text>
              <Text style={styles.body}>{n.content}</Text>
            </PremiumCard>
          ))}
        </SectionPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: spacing.md },
  card: { marginBottom: spacing.sm },
  cardTitle: { ...typography.bodyStrong, marginBottom: spacing.xs },
  meta: { ...typography.caption, marginTop: 4 },
  body: { ...typography.body, marginTop: spacing.xs },
  empty: { ...typography.body },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
});
