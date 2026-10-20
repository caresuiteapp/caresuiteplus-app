import type { RoleKey } from '@/types';
import {
  isAdministrationRole,
  isClientPortalRole,
  isEmployeePortalRole,
} from '@/lib/permissions/workspaceRoles';
import type { UiFeatureStatus } from './uiVisibility';

export const ACTION_DISABLED_REASONS = {
  prepared: 'Diese Funktion ist vorbereitet und wird später aktiviert.',
  provider: 'Für diese Funktion ist zuerst eine Anbieter-Konfiguration erforderlich.',
  role: 'Sie haben für diese Aktion keine Berechtigung.',
  validation: 'Bitte fehlende Pflichtdaten ergänzen.',
  comingSoon: 'Diese Funktion ist in Vorbereitung und noch nicht nutzbar.',
} as const;

export type ActionKey =
  | 'voiceFlow.start'
  | 'module.start'
  | 'connect.activate'
  | 'export.data'
  | 'document.finalize'
  | 'signature.sign'
  | 'signature.export_pdf'
  | 'medication.emp_sync'
  | 'medication.prescription'
  | 'medication.interactions'
  | 'vital.correct'
  | 'vital.threshold'
  | 'vital.care_plan_link'
  | 'shift.import'
  | 'sis.save'
  | 'marketplace.select_partner'
  | 'admin.action'
  | 'internal.action';

export type ActionAvailabilityContext = {
  roleKey?: RoleKey | null;
  featureStatus?: UiFeatureStatus;
  hasProvider?: boolean;
  hasRequiredData?: boolean;
  isPreparedOnly?: boolean;
  isComingSoon?: boolean;
  isReadOnly?: boolean;
  canExecute?: boolean;
  requiredRole?: RoleKey;
  isDangerousAction?: boolean;
};

export type ActionAvailability = {
  visible: boolean;
  enabled: boolean;
  disabledReason?: string;
  requiredRole?: RoleKey;
  requiredFeatureStatus?: UiFeatureStatus;
  requiredEntityState?: string;
  isPreparedOnly: boolean;
  isDangerousAction: boolean;
};

function blocked(
  partial: Partial<ActionAvailability> & Pick<ActionAvailability, 'visible' | 'enabled'>,
  context: ActionAvailabilityContext,
): ActionAvailability {
  return {
    isPreparedOnly: partial.isPreparedOnly ?? Boolean(context.isPreparedOnly),
    isDangerousAction: partial.isDangerousAction ?? Boolean(context.isDangerousAction),
    requiredRole: partial.requiredRole ?? context.requiredRole,
    requiredFeatureStatus: partial.requiredFeatureStatus ?? context.featureStatus,
    requiredEntityState: partial.requiredEntityState,
    visible: partial.visible,
    enabled: partial.enabled,
    disabledReason: partial.disabledReason,
  };
}

export function getActionAvailability(
  actionKey: ActionKey,
  context: ActionAvailabilityContext = {},
): ActionAvailability {
  const {
    roleKey,
    featureStatus,
    hasProvider = true,
    hasRequiredData = true,
    isPreparedOnly = false,
    isComingSoon = false,
    isReadOnly = false,
    canExecute = true,
    requiredRole,
    isDangerousAction = false,
  } = context;
  const role: RoleKey | null = roleKey ?? null;

  if (actionKey === 'voiceFlow.start') {
    const isPublic = !roleKey;
    const prepared =
      isPreparedOnly || featureStatus === 'preparedOnly' || featureStatus === 'coming_soon';
    return blocked(
      {
        visible: !isPublic && !isClientPortalRole(roleKey ?? null),
        enabled: !prepared && canExecute && isEmployeePortalRole(roleKey ?? null),
        disabledReason: prepared ? ACTION_DISABLED_REASONS.prepared : ACTION_DISABLED_REASONS.role,
        isPreparedOnly: prepared,
      },
      context,
    );
  }

  if (actionKey === 'admin.action') {
    if (isEmployeePortalRole(role) || isClientPortalRole(role)) {
      return blocked(
        {
          visible: false,
          enabled: false,
          disabledReason: ACTION_DISABLED_REASONS.role,
          requiredRole: 'business_admin',
        },
        context,
      );
    }
  }

  if (actionKey === 'internal.action') {
    if (isClientPortalRole(role)) {
      return blocked(
        {
          visible: false,
          enabled: false,
          disabledReason: ACTION_DISABLED_REASONS.role,
        },
        context,
      );
    }
  }

  if (actionKey === 'module.start') {
    if (isComingSoon || featureStatus === 'coming_soon') {
      return blocked(
        {
          visible: true,
          enabled: false,
          disabledReason: ACTION_DISABLED_REASONS.comingSoon,
          isPreparedOnly: true,
          requiredFeatureStatus: 'coming_soon',
        },
        context,
      );
    }
    if (isPreparedOnly || featureStatus === 'preparedOnly') {
      return blocked(
        {
          visible: true,
          enabled: false,
          disabledReason: ACTION_DISABLED_REASONS.prepared,
          isPreparedOnly: true,
          requiredFeatureStatus: 'preparedOnly',
        },
        context,
      );
    }
  }

  if (isComingSoon || featureStatus === 'coming_soon') {
    return blocked(
      {
        visible: true,
        enabled: false,
        disabledReason: ACTION_DISABLED_REASONS.comingSoon,
        isPreparedOnly: true,
        requiredFeatureStatus: 'coming_soon',
      },
      context,
    );
  }

  if (isPreparedOnly || featureStatus === 'preparedOnly') {
    return blocked(
      {
        visible: true,
        enabled: false,
        disabledReason: ACTION_DISABLED_REASONS.prepared,
        isPreparedOnly: true,
        requiredFeatureStatus: 'preparedOnly',
      },
      context,
    );
  }

  if (!canExecute) {
    return blocked(
      {
        visible: true,
        enabled: false,
        disabledReason: ACTION_DISABLED_REASONS.prepared,
        isPreparedOnly: true,
      },
      context,
    );
  }

  if (actionKey === 'export.data' && !hasProvider) {
    return blocked(
      {
        visible: true,
        enabled: false,
        disabledReason: ACTION_DISABLED_REASONS.provider,
      },
      context,
    );
  }

  if (actionKey === 'document.finalize' && !hasRequiredData) {
    return blocked(
      {
        visible: true,
        enabled: false,
        disabledReason: ACTION_DISABLED_REASONS.validation,
        requiredEntityState: 'preview_valid',
      },
      context,
    );
  }

  if (actionKey === 'connect.activate') {
    if (!hasProvider || !canExecute) {
      return blocked(
        {
          visible: true,
          enabled: false,
          disabledReason: !hasProvider
            ? ACTION_DISABLED_REASONS.provider
            : ACTION_DISABLED_REASONS.prepared,
          isPreparedOnly: true,
        },
        context,
      );
    }
  }

  if (isReadOnly) {
    return blocked(
      {
        visible: true,
        enabled: false,
        disabledReason: ACTION_DISABLED_REASONS.role,
      },
      context,
    );
  }

  if (requiredRole && role !== requiredRole && !isAdministrationRole(role)) {
    return blocked(
      {
        visible: false,
        enabled: false,
        disabledReason: ACTION_DISABLED_REASONS.role,
        requiredRole,
      },
      context,
    );
  }

  return blocked(
    {
      visible: true,
      enabled: true,
      isDangerousAction,
    },
    context,
  );
}

/** Only wire onPress when the action is enabled — prevents dead handlers in UI. */
export function bindActionPress(
  availability: ActionAvailability,
  handler?: () => void,
): (() => void) | undefined {
  if (!availability.enabled || !handler) return undefined;
  return handler;
}
