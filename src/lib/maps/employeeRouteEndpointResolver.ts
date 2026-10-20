import type {
  EmployeeMobilitySettings,
  EmployeeRouteEndType,
  EmployeeRouteStartType,
} from '@/types/modules/employeeMobility';

export type AddressParts = {
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
};

export function formatGermanAddress(parts: AddressParts): string | null {
  const streetLine = [parts.street?.trim(), parts.houseNumber?.trim()].filter(Boolean).join(' ');
  const cityLine = [parts.postalCode?.trim(), parts.city?.trim()].filter(Boolean).join(' ');
  const line = [streetLine, cityLine].filter(Boolean).join(', ');
  return line.trim() || null;
}

export function resolveRouteStartAddress(input: {
  settings: Pick<
    EmployeeMobilitySettings,
    'routeStartType' | 'routeStartAddress'
  >;
  employeeHome?: AddressParts | null;
  tenantOffice?: AddressParts | null;
  lastAssignmentAddress?: string | null;
}): string | null {
  return resolveRoutePointAddress(input.settings.routeStartType, {
    customAddress: input.settings.routeStartAddress,
    employeeHome: input.employeeHome,
    tenantOffice: input.tenantOffice,
    lastAssignmentAddress: input.lastAssignmentAddress,
  });
}

export function resolveRouteEndAddress(input: {
  settings: Pick<EmployeeMobilitySettings, 'routeEndType' | 'routeEndAddress'>;
  employeeHome?: AddressParts | null;
  tenantOffice?: AddressParts | null;
}): string | null {
  return resolveRoutePointAddress(input.settings.routeEndType, {
    customAddress: input.settings.routeEndAddress,
    employeeHome: input.employeeHome,
    tenantOffice: input.tenantOffice,
    lastAssignmentAddress: null,
  });
}

function resolveRoutePointAddress(
  type: EmployeeRouteStartType | EmployeeRouteEndType,
  input: {
    customAddress: string | null;
    employeeHome?: AddressParts | null;
    tenantOffice?: AddressParts | null;
    lastAssignmentAddress?: string | null;
  },
): string | null {
  switch (type) {
    case 'home':
      return formatGermanAddress(input.employeeHome ?? {}) ?? null;
    case 'office':
      return formatGermanAddress(input.tenantOffice ?? {}) ?? null;
    case 'last_assignment':
      return input.lastAssignmentAddress?.trim() || null;
    case 'custom':
      return input.customAddress?.trim() || null;
    default:
      return null;
  }
}
