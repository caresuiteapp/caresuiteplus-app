import type { ClientDetail } from '@/types/detail';
import type { ClientFormData } from '@/types/forms/clientForm';
import { EMPTY_CLIENT_FORM } from '@/types/forms/clientForm';

export function mapClientDetailToForm(client: ClientDetail): ClientFormData {
  return {
    ...EMPTY_CLIENT_FORM,
    firstName: client.firstName,
    lastName: client.lastName,
    dateOfBirth: client.dateOfBirth ?? '',
    street: client.street ?? '',
    zip: client.zip ?? '',
    city: client.city ?? '',
    phone: client.phone ?? client.primaryContactPhone ?? '',
    email: client.email ?? '',
    careLevel: client.careLevel ?? '',
    status: client.status,
    notes: client.notes ?? '',
    sensitivity: client.sensitivity,
  };
}
