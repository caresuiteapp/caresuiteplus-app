import { useEffect, useMemo, useState } from 'react';

import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { PortalNewChatModal } from '@/components/portal/portalnewchatmodal';

import { PortalOfficeInbox } from '@/components/portal/portalofficeinbox';

import { PortalOfficeThread } from '@/components/portal/portalofficethread';

import { PremiumButton } from '@/components/ui';

import { useMessagingGlassSurface } from '@/design/tokens/auroraGlass';

import { useCareLightPalette } from '@/design/tokens/carelightadaptive';

import { useLegacyTheme } from '@/design/tokens/themeBridge';

import { careSpacing } from '@/design/tokens/spacing';

import { spacing, radius } from '@/theme';

import type { PortalOfficeAudience, PortalOfficeInboxFilter } from '@/lib/office/portalofficemessageservice';



type PortalOfficeMessengerProps = {

  audience: PortalOfficeAudience;

  title?: string;

  variant?: 'default' | 'glass';

  composeLabel?: string;

  /** Open compose modal on mount (e.g. from overview KPI deep link). */

  initialComposeOpen?: boolean;

};



export function PortalOfficeMessenger({

  audience,

  title = 'Nachrichten an die Verwaltung',

  variant = 'default',

  composeLabel = 'Verwaltung anschreiben',

  initialComposeOpen = false,

}: PortalOfficeMessengerProps) {

  const { width } = useWindowDimensions();

  const { c } = useCareLightPalette();

  const { colors } = useLegacyTheme();

  const [filter, setFilter] = useState<PortalOfficeInboxFilter>('open');

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [showNewChat, setShowNewChat] = useState(initialComposeOpen);

  const isGlass = variant === 'glass';

  const isCompact = width < 768;

  const { surfaces } = useMessagingGlassSurface(isGlass);



  useEffect(() => {

    if (initialComposeOpen) setShowNewChat(true);

  }, [initialComposeOpen]);



  const styles = useMemo(

    () =>

      StyleSheet.create({

        root: {
          flex: 1,
          gap: isGlass ? careSpacing.md : spacing.md,
          width: '100%',
          maxWidth: isCompact ? 720 : undefined,
          alignSelf: 'center',
        },

        header: {
          gap: spacing.sm,
          width: '100%',
        },

        messenger: {

          flex: 1,

          minHeight: isCompact ? 260 : 420,

          flexDirection: 'row',

          borderRadius: radius.lg,

          borderWidth: 1,

          borderColor: isGlass ? surfaces.borderStrong : c.border,

          backgroundColor: isGlass ? surfaces.panel : c.surface,

          overflow: 'hidden',

          width: '100%',

        },

        inboxPane: {

          width: isCompact ? '100%' : 300,

          maxWidth: isCompact ? '100%' : 340,

          minWidth: isCompact ? 0 : 260,

          borderRightWidth: isCompact ? 0 : 1,

          borderRightColor: isGlass ? surfaces.border : c.border,

          display: selectedThreadId && isCompact ? 'none' : 'flex',

        },

        threadPane: {

          flex: 1,

          minWidth: 0,

          display: !selectedThreadId && isCompact ? 'none' : 'flex',

          backgroundColor: isGlass ? surfaces.card : colors.bgBase,

        },

      }),

    [c, colors.bgBase, isCompact, isGlass, selectedThreadId, surfaces.border, surfaces.borderStrong, surfaces.card, surfaces.panel],

  );



  useEffect(() => {

    if (isCompact && !selectedThreadId) return;

  }, [isCompact, selectedThreadId]);



  return (

    <View style={styles.root}>

      <View style={styles.header}>

        <PremiumButton title={composeLabel} onPress={() => setShowNewChat(true)} />

      </View>



      <View style={styles.messenger}>

        <View style={styles.inboxPane}>

          <PortalOfficeInbox

            filter={filter}

            onFilterChange={setFilter}

            selectedThreadId={selectedThreadId}

            onThreadSelect={setSelectedThreadId}

            search={search}

            onSearchChange={setSearch}

            variant={variant}

            onCompose={() => setShowNewChat(true)}

            composeLabel={composeLabel}

          />

        </View>

        <View style={styles.threadPane}>

          <PortalOfficeThread

            threadId={selectedThreadId}

            variant={variant}

            onNewThreadStarted={(newThreadId) => {

              setSelectedThreadId(newThreadId);

              setFilter('open');

            }}

          />

        </View>

      </View>



      {showNewChat ? (

        <PortalNewChatModal

          visible

          audience={audience}

          variant={variant}

          onClose={() => setShowNewChat(false)}

          onCreated={(threadId) => {

            setSelectedThreadId(threadId);

            setFilter('open');

            setShowNewChat(false);

          }}

        />

      ) : null}

    </View>

  );

}

