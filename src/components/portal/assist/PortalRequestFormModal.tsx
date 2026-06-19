import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { ListFilterSelect, PremiumInput } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { resolvePortalRequestTypeLabel } from '@/lib/portal/assist';
import {
  ABSAGEGRUND_OPTIONS,
  buildAppointmentOptions,
  buildLeistungsartOptions,
  CHANGE_TYPE_OPTIONS,
  createDefaultFormState,
  FEEDBACK_BEREICH_OPTIONS,
  RUECKRUF_TIME_OPTIONS,
  RUECKRUF_TOPIC_OPTIONS,
  showsNeueTageszeit,
  showsNeuerWunschtag,
  SONSTIGES_CATEGORY_OPTIONS,
  STAMMDATEN_FIELD_OPTIONS,
  TIME_OF_DAY_OPTIONS,
  URGENCY_OPTIONS,
  validatePortalRequestPayload,
  WEEKDAY_OPTIONS,
  WUNSCHTAG_OPTIONS,
  type PortalFormRequestType,
} from '@/lib/portal/assist/portalRequestFormOptions';
import type { PortalNextAppointment } from '@/types/portal/assist';
import type {
  BeschwerdePayload,
  LobPayload,
  PortalStructuredRequestPayload,
  RueckrufPayload,
  SonstigesPayload,
  StammdatenPayload,
  TerminAendernPayload,
  ZusatzterminPayload,
} from '@/types/portal/requestPayloads';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';

type PortalRequestFormModalProps = {
  visible: boolean;
  requestType: PortalFormRequestType;
  careContexts?: ClientCareContext[];
  upcomingAppointments?: PortalNextAppointment[];
  contactPhone?: string | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: PortalStructuredRequestPayload) => void;
};

/** Type-specific glass request forms with dropdown selections. */
export function PortalRequestFormModal({
  visible,
  requestType,
  careContexts = [],
  upcomingAppointments = [],
  contactPhone,
  submitting = false,
  onClose,
  onSubmit,
}: PortalRequestFormModalProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  const leistungsartOptions = useMemo(
    () => buildLeistungsartOptions(careContexts),
    [careContexts],
  );
  const appointmentOptions = useMemo(
    () => buildAppointmentOptions(upcomingAppointments),
    [upcomingAppointments],
  );

  const [formState, setFormState] = useState<PortalStructuredRequestPayload>(() =>
    createDefaultFormState(requestType, {
      leistungsartOptions,
      appointmentOptions,
      contactPhone,
    }),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setFormState(
      createDefaultFormState(requestType, {
        leistungsartOptions,
        appointmentOptions,
        contactPhone,
      }),
    );
    setError(null);
  }, [visible, requestType, leistungsartOptions, appointmentOptions, contactPhone]);

  const handleSubmit = () => {
    const validationError = validatePortalRequestPayload(requestType, formState);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSubmit(formState);
  };

  const renderFields = () => {
    switch (requestType) {
      case 'zusatztermin': {
        const data = formState as ZusatzterminPayload;
        return (
          <>
            <ListFilterSelect
              label="Leistungsart"
              value={data.leistungsart}
              options={leistungsartOptions}
              onChange={(key) => setFormState({ ...data, leistungsart: key })}
            />
            <ListFilterSelect
              label="Bevorzugter Wochentag"
              value={data.wochentag}
              options={WEEKDAY_OPTIONS}
              onChange={(key) =>
                setFormState({ ...data, wochentag: key as ZusatzterminPayload['wochentag'] })
              }
            />
            <ListFilterSelect
              label="Bevorzugte Tageszeit"
              value={data.tageszeit}
              options={TIME_OF_DAY_OPTIONS}
              onChange={(key) =>
                setFormState({ ...data, tageszeit: key as ZusatzterminPayload['tageszeit'] })
              }
            />
            <ListFilterSelect
              label="Dringlichkeit"
              value={data.dringlichkeit}
              options={URGENCY_OPTIONS}
              onChange={(key) =>
                setFormState({ ...data, dringlichkeit: key as ZusatzterminPayload['dringlichkeit'] })
              }
            />
            <PremiumInput
              label="Nachricht (optional)"
              value={data.nachricht ?? ''}
              onChangeText={(nachricht) => setFormState({ ...data, nachricht })}
              placeholder="Weitere Hinweise…"
              multiline
              editable={!submitting}
            />
          </>
        );
      }
      case 'termin_aendern': {
        const data = formState as TerminAendernPayload;
        return (
          <>
            <ListFilterSelect
              label="Geplanter Einsatz"
              value={data.appointmentId ?? (data.appointmentLabel.includes('Allgemeine') ? 'allgemein' : 'none')}
              options={appointmentOptions}
              onChange={(key) => {
                const option = appointmentOptions.find((opt) => opt.key === key);
                setFormState({
                  ...data,
                  appointmentId: key === 'none' || key === 'allgemein' ? null : key,
                  appointmentLabel: option?.label ?? key,
                });
              }}
            />
            <ListFilterSelect
              label="Art der Änderung"
              value={data.aenderungsart}
              options={CHANGE_TYPE_OPTIONS}
              onChange={(key) =>
                setFormState({
                  ...data,
                  aenderungsart: key as TerminAendernPayload['aenderungsart'],
                  absagegrund: key === 'absagen' ? data.absagegrund ?? 'sonstiges' : null,
                })
              }
            />
            {showsNeueTageszeit(data.aenderungsart) ? (
              <ListFilterSelect
                label="Neue Tageszeit"
                value={data.tageszeit ?? 'vormittag'}
                options={TIME_OF_DAY_OPTIONS}
                onChange={(key) =>
                  setFormState({
                    ...data,
                    tageszeit: key as TerminAendernPayload['tageszeit'],
                  })
                }
              />
            ) : null}
            {showsNeuerWunschtag(data.aenderungsart) ? (
              <ListFilterSelect
                label="Neuer Wunschtag"
                value={data.wochentag ?? 'mo'}
                options={WUNSCHTAG_OPTIONS}
                onChange={(key) =>
                  setFormState({
                    ...data,
                    wochentag: key as TerminAendernPayload['wochentag'],
                  })
                }
              />
            ) : null}
            {data.aenderungsart === 'absagen' ? (
              <ListFilterSelect
                label="Absagegrund"
                value={data.absagegrund ?? 'sonstiges'}
                options={ABSAGEGRUND_OPTIONS}
                onChange={(key) =>
                  setFormState({
                    ...data,
                    absagegrund: key as TerminAendernPayload['absagegrund'],
                  })
                }
              />
            ) : null}
            <PremiumInput
              label="Nachricht (optional)"
              value={data.nachricht ?? ''}
              onChangeText={(nachricht) => setFormState({ ...data, nachricht })}
              placeholder="Weitere Hinweise…"
              multiline
              editable={!submitting}
            />
          </>
        );
      }
      case 'rueckruf': {
        const data = formState as RueckrufPayload;
        return (
          <>
            <ListFilterSelect
              label="Thema"
              value={data.thema}
              options={RUECKRUF_TOPIC_OPTIONS}
              onChange={(key) =>
                setFormState({ ...data, thema: key as RueckrufPayload['thema'] })
              }
            />
            <ListFilterSelect
              label="Bevorzugte Rückrufzeit"
              value={data.rueckrufzeit}
              options={RUECKRUF_TIME_OPTIONS}
              onChange={(key) =>
                setFormState({ ...data, rueckrufzeit: key as RueckrufPayload['rueckrufzeit'] })
              }
            />
            <PremiumInput
              label="Telefonnummer"
              value={data.telefonnummer ?? ''}
              onChangeText={(telefonnummer) => setFormState({ ...data, telefonnummer })}
              placeholder="Für den Rückruf"
              keyboardType="phone-pad"
              editable={!submitting}
            />
            <PremiumInput
              label="Nachricht (optional)"
              value={data.nachricht ?? ''}
              onChangeText={(nachricht) => setFormState({ ...data, nachricht })}
              placeholder="Worum geht es?"
              multiline
              editable={!submitting}
            />
          </>
        );
      }
      case 'stammdaten': {
        const data = formState as StammdatenPayload;
        return (
          <>
            <ListFilterSelect
              label="Was möchten Sie ändern?"
              value={data.feld}
              options={STAMMDATEN_FIELD_OPTIONS}
              onChange={(key) =>
                setFormState({ ...data, feld: key as StammdatenPayload['feld'] })
              }
            />
            <PremiumInput
              label="Nachricht (optional)"
              value={data.nachricht ?? ''}
              onChangeText={(nachricht) => setFormState({ ...data, nachricht })}
              placeholder="Neue Angaben oder Hinweise…"
              multiline
              editable={!submitting}
            />
          </>
        );
      }
      case 'beschwerde': {
        const data = formState as BeschwerdePayload;
        return (
          <>
            <ListFilterSelect
              label="Bereich"
              value={data.bereich}
              options={FEEDBACK_BEREICH_OPTIONS}
              onChange={(key) =>
                setFormState({ ...data, bereich: key as BeschwerdePayload['bereich'] })
              }
            />
            <ListFilterSelect
              label="Dringlichkeit"
              value={data.dringlichkeit}
              options={URGENCY_OPTIONS}
              onChange={(key) =>
                setFormState({ ...data, dringlichkeit: key as BeschwerdePayload['dringlichkeit'] })
              }
            />
            <PremiumInput
              label="Nachricht (optional)"
              value={data.nachricht ?? ''}
              onChangeText={(nachricht) => setFormState({ ...data, nachricht })}
              placeholder="Was ist passiert?"
              multiline
              editable={!submitting}
            />
          </>
        );
      }
      case 'lob': {
        const data = formState as LobPayload;
        return (
          <>
            <ListFilterSelect
              label="Bereich"
              value={data.bereich}
              options={FEEDBACK_BEREICH_OPTIONS}
              onChange={(key) => setFormState({ ...data, bereich: key as LobPayload['bereich'] })}
            />
            <PremiumInput
              label="Nachricht (optional)"
              value={data.nachricht ?? ''}
              onChangeText={(nachricht) => setFormState({ ...data, nachricht })}
              placeholder="Was hat Ihnen besonders gefallen?"
              multiline
              editable={!submitting}
            />
          </>
        );
      }
      case 'sonstiges': {
        const data = formState as SonstigesPayload;
        return (
          <>
            <ListFilterSelect
              label="Kategorie"
              value={data.kategorie}
              options={SONSTIGES_CATEGORY_OPTIONS}
              onChange={(key) => setFormState({ ...data, kategorie: key })}
            />
            <PremiumInput
              label="Nachricht (optional)"
              value={data.nachricht ?? ''}
              onChangeText={(nachricht) => setFormState({ ...data, nachricht })}
              placeholder="Was möchten Sie mitteilen?"
              multiline
              editable={!submitting}
            />
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <PortalGlassModal
      visible={visible}
      title={resolvePortalRequestTypeLabel(requestType)}
      onClose={onClose}
      primaryLabel="Anfrage senden"
      primaryLoading={submitting}
      onPrimary={handleSubmit}
    >
      <View style={styles.fields}>{renderFields()}</View>
      {error ? (
        <Text style={[type.caption, styles.error, { color: text.secondary }]}>{error}</Text>
      ) : null}
    </PortalGlassModal>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: careSpacing.sm,
  },
  error: {
    color: '#c0392b',
  },
});
