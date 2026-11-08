import { Alert, Linking } from 'react-native';
import { ClientRecordLink } from './employee/EmployeePortalClientRecordLayout';

export function dialPhoneNumber(phone: string): void {
  const normalized = phone.replace(/[^\d+]/g, '');
  if (!normalized) return;
  void Linking.openURL(`tel:${normalized}`).catch(() => Alert.alert('Anruf nicht möglich', `Die Telefonanwendung konnte nicht geöffnet werden. Telefonnummer: ${phone}`));
}

export function PhoneActionRow({ label, value, icon = 'call-outline' }: {
  label: string;
  value: string;
  icon?: 'call-outline' | 'phone-portrait-outline';
}) {
  return (
    <ClientRecordLink title={label} detail={value} icon={icon} actionIcon="call-outline"
      accessibilityLabel={`${label} anrufen: ${value}`} onPress={() => dialPhoneNumber(value)} />
  );
}
