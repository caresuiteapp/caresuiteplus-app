import { useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { PortalTextSizeControls } from '@/components/portal/accessibility/PortalTextSizeControls';
import {
  LiquidBackdrop,
  LiquidButton,
  LiquidDivider,
  LiquidIconButton,
  LiquidGlyph,
  LiquidLogo,
  LiquidState,
  LiquidStatus,
  LiquidSurface,
  LiquidText,
  LiquidField,
} from '../components/LiquidPrimitives';
import {
  liquidColors,
  liquidLayers,
  liquidRadius,
  liquidSpace,
} from '../foundation/tokens';
import { useLiquidLayout } from '../foundation/useLiquidLayout';
import {
  getLiquidModule,
  liquidGlobalShortcuts,
  liquidModules,
  liquidWorkAreas,
} from '../navigation/moduleCatalog';
import type { LiquidModuleKey } from '../types';

type LiquidCommandShellProps = {
  activeModule: LiquidModuleKey;
  activeArea?: string | null;
  title: string;
  subtitle: string;
  contextLabel?: string;
  contextDetail?: string;
  children: ReactNode;
  aside?: ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  allowPhoneLandscape?: boolean;
  contentMode?: 'scroll' | 'fill';
  showPageHeader?: boolean;
  showContextBar?: boolean;
};

function RotateDeviceScreen() {
  return (
    <LiquidBackdrop>
      <View style={styles.rotate}>
        <LiquidSurface active contentStyle={styles.rotateCard}>
          <LiquidGlyph glyph="↻" size={34} />
          <LiquidText variant="title" accessibilityRole="header">Smartphone drehen</LiquidText>
          <LiquidText variant="body" style={styles.centerText}>
            CareSuite HealthOS wird auf Smartphones im Hochformat bedient. Für Unterschrift,
            Kamera, Dokumentenscan, Medien und BodyMap kann Querformat gezielt freigegeben werden.
          </LiquidText>
        </LiquidSurface>
      </View>
    </LiquidBackdrop>
  );
}

function ModuleDock({ activeModule }: { activeModule: LiquidModuleKey }) {
  const router = useRouter();
  const auth = useAuth();

  const signOut = async () => {
    await auth.signOut();
    router.replace('/auth' as never);
  };

  return (
    <View style={styles.dock}>
      <View style={styles.dockBrand}>
        <LiquidLogo compact />
        <View style={styles.dockBrandCopy}>
          <Text style={styles.dockKicker}>HEALTHOS DESKTOP</Text>
          <Text style={styles.dockTitle}>Arbeitsbereiche</Text>
        </View>
      </View>
      <ScrollView
        accessibilityRole="tablist"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.dockItems}
      >
        {liquidModules.map((module) => {
          const selected = activeModule === module.key;
          return (
            <Pressable
              key={module.key}
              accessibilityRole="tab"
              accessibilityLabel={`${module.label}. ${module.description}`}
              accessibilityState={{ selected }}
              onPress={() => router.push(module.route as never)}
              style={({ pressed }) => [
                styles.dockItem,
                selected && styles.dockItemActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.dockGlyph, selected && styles.dockGlyphActive]}>
                <LiquidGlyph active={selected} glyph={module.glyph} size={19} />
              </View>
              <View style={styles.dockItemCopy}>
                <Text numberOfLines={1} style={[styles.dockLabel, selected && styles.dockLabelActive]}>
                  {module.label}
                </Text>
                {selected ? (
                  <Text numberOfLines={1} style={styles.dockItemDetail}>Aktiver Bereich</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sicher abmelden"
        onPress={() => void signOut()}
        style={({ pressed }) => [styles.dockLogout, pressed && styles.pressed]}
      >
        <LiquidGlyph glyph="↪" size={19} />
        <Text style={styles.dockLogoutLabel}>Abmelden</Text>
      </Pressable>
    </View>
  );
}

function WorkAreaNavigation({
  moduleKey,
  activeArea,
  horizontal,
}: {
  moduleKey: LiquidModuleKey;
  activeArea?: string | null;
  horizontal?: boolean;
}) {
  const router = useRouter();
  const areas = liquidWorkAreas[moduleKey];
  if (!areas.length) return null;

  return (
    <ScrollView
      horizontal={horizontal}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={horizontal ? styles.areaHorizontal : styles.areaVertical}
      contentContainerStyle={horizontal ? styles.areaHorizontalContent : styles.areaVerticalContent}
    >
      {areas.map((area, index) => {
        const selected = activeArea ? activeArea === area.id : index === 0;
        return (
          <Pressable
            key={area.id}
            accessibilityRole="tab"
            accessibilityLabel={`${area.label}. ${area.description}`}
            accessibilityState={{ selected }}
            onPress={() => router.push(area.route as never)}
            style={({ pressed }) => [
              horizontal ? styles.areaChip : styles.areaRow,
              selected && styles.areaSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.areaMarker, selected && styles.areaMarkerActive]} />
            <View style={styles.areaCopy}>
              <Text style={[styles.areaLabel, selected && styles.areaLabelActive]}>{area.label}</Text>
              {!horizontal ? <Text style={styles.areaDescription}>{area.description}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function CommandPalette({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const moduleResults = [
      ...liquidGlobalShortcuts.map((shortcut) => ({
        id: `shortcut-${shortcut.id}`,
        label: shortcut.label,
        description: shortcut.description,
        route: shortcut.route,
        glyph: shortcut.glyph,
        keywords: shortcut.keywords,
      })),
      ...liquidModules.flatMap((module) => [
      {
        id: `module-${module.key}`,
        label: module.label,
        description: module.description,
        route: module.route,
        glyph: module.glyph,
        keywords: `${module.label} ${module.description}`,
      },
      ...liquidWorkAreas[module.key].map((area) => ({
        id: `${module.key}-${area.id}`,
        label: `${module.label} · ${area.label}`,
        description: area.description,
        route: area.route,
        glyph: module.glyph,
        keywords: `${module.label} ${area.label} ${area.description}`,
      })),
    ]),
    ];
    if (!normalized) return moduleResults.slice(0, 18);
    return moduleResults
      .filter((item) =>
        `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(normalized),
      )
      .slice(0, 24);
  }, [query]);

  const open = (route: string) => {
    onClose();
    setQuery('');
    router.push(route as never);
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable accessibilityLabel="Befehlspalette schließen" onPress={onClose} style={styles.modalBackdrop}>
        <Pressable
          accessibilityRole="none"
          onPress={(event) => event.stopPropagation()}
          style={styles.paletteWrap}
        >
          <LiquidSurface active contentStyle={styles.palette}>
            <View style={styles.paletteHeader}>
              <View style={styles.paletteTitle}>
                <LiquidText variant="kicker">COMMAND PALETTE</LiquidText>
                <LiquidText variant="section" accessibilityRole="header">Suchen und öffnen</LiquidText>
              </View>
              <LiquidIconButton label="Schließen" glyph="×" onPress={onClose} />
            </View>
            <LiquidField
              label="Suche"
              value={query}
              onChangeText={setQuery}
              placeholder="Modul, Datensatz oder Aktion suchen"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ScrollView style={styles.paletteResults} keyboardShouldPersistTaps="handled">
              {results.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => open(item.route)}
                  style={({ pressed }) => [
                    styles.paletteResult,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.paletteGlyph}>
                    <LiquidGlyph glyph={item.glyph} size={20} />
                  </View>
                  <View style={styles.paletteResultCopy}>
                    <Text style={styles.paletteResultLabel}>{item.label}</Text>
                    <Text style={styles.paletteResultDescription}>{item.description}</Text>
                  </View>
                  <LiquidGlyph glyph="›" size={18} />
                </Pressable>
              ))}
              {!results.length ? (
                <View style={styles.noResults}>
                  <LiquidText variant="section">Keine Treffer</LiquidText>
                  <LiquidText variant="meta">
                    Prüfen Sie die Schreibweise oder öffnen Sie ein Modul über das Dock.
                  </LiquidText>
                </View>
              ) : null}
            </ScrollView>
          </LiquidSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NotificationCenter({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        accessibilityLabel="Benachrichtigungen schließen"
        onPress={onClose}
        style={styles.modalBackdrop}
      >
        <Pressable
          accessibilityRole="none"
          onPress={(event) => event.stopPropagation()}
          style={styles.noticeWrap}
        >
          <LiquidSurface active contentStyle={styles.noticePanel}>
            <View style={styles.paletteHeader}>
              <View style={styles.paletteTitle}>
                <LiquidText variant="kicker">BENACHRICHTIGUNGEN</LiquidText>
                <LiquidText variant="section" accessibilityRole="header">
                  Aktueller Arbeitskontext
                </LiquidText>
              </View>
              <LiquidIconButton label="Schließen" glyph="×" onPress={onClose} />
            </View>
            <LiquidState
              kind="empty"
              title="Keine neuen Meldungen"
              message="Es liegen keine systembestätigten Benachrichtigungen für diesen Kontext vor."
            />
          </LiquidSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ProfileMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const auth = useAuth();
  const displayName =
    auth.profile?.displayName || auth.user?.displayName || 'CareSuite Profil';
  const role = auth.profile?.roleKey ?? 'CareSuite';

  const open = (route: string) => {
    onClose();
    router.push(route as never);
  };

  const signOut = async () => {
    onClose();
    await auth.signOut();
    router.replace('/auth' as never);
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable accessibilityLabel="Profilmenü schließen" onPress={onClose} style={styles.modalBackdrop}>
        <Pressable
          accessibilityRole="none"
          onPress={(event) => event.stopPropagation()}
          style={styles.profileMenuWrap}
        >
          <LiquidSurface active contentStyle={styles.profileMenu}>
            <View style={styles.profileMenuHeader}>
              <View style={styles.profileMenuAvatar}>
                <Text style={styles.profileMenuAvatarLabel}>
                  {displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.profileMenuIdentity}>
                <Text numberOfLines={1} style={styles.profileMenuName}>{displayName}</Text>
                <Text numberOfLines={1} style={styles.profileMenuRole}>{role}</Text>
              </View>
              <LiquidIconButton label="Schließen" glyph="×" onPress={onClose} />
            </View>
            <LiquidDivider />
            <Pressable
              accessibilityRole="button"
              onPress={() => open('/settings/profile')}
              style={({ pressed }) => [styles.profileMenuRow, pressed && styles.pressed]}
            >
              <View style={styles.profileMenuGlyph}><LiquidGlyph glyph="♙" size={21} /></View>
              <View style={styles.profileMenuCopy}>
                <Text style={styles.profileMenuLabel}>Profil & Sicherheit</Text>
                <Text style={styles.profileMenuDetail}>Persönliche Angaben und Zugang</Text>
              </View>
              <LiquidGlyph glyph="›" size={18} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => open('/office/messages')}
              style={({ pressed }) => [styles.profileMenuRow, pressed && styles.pressed]}
            >
              <View style={styles.profileMenuGlyph}><LiquidGlyph glyph="▱" size={21} /></View>
              <View style={styles.profileMenuCopy}>
                <Text style={styles.profileMenuLabel}>Nachrichten</Text>
                <Text style={styles.profileMenuDetail}>Unterhaltungen und Aufgaben</Text>
              </View>
              <LiquidGlyph glyph="›" size={18} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => open('/business/office/payroll')}
              style={({ pressed }) => [styles.profileMenuRow, pressed && styles.pressed]}
            >
              <View style={styles.profileMenuGlyph}><LiquidGlyph glyph="€" size={21} /></View>
              <View style={styles.profileMenuCopy}>
                <Text style={styles.profileMenuLabel}>Gehaltsstatistik</Text>
                <Text style={styles.profileMenuDetail}>Monatsübersicht und Zeitkonto</Text>
              </View>
              <LiquidGlyph glyph="›" size={18} />
            </Pressable>
            <LiquidDivider />
            <LiquidButton
              fullWidth
              icon="↪"
              label="Sicher abmelden"
              variant="danger"
              onPress={() => void signOut()}
            />
          </LiquidSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CommandBar({
  activeModule,
  onOpenSearch,
  onOpenNotifications,
  onOpenProfile,
}: {
  activeModule: LiquidModuleKey;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}) {
  const { isPhone } = useLiquidLayout();
  const { profile, user } = useAuth();
  const router = useRouter();
  const displayName = profile?.displayName || user?.displayName || 'Profil';
  const role = profile?.roleKey ?? 'CareSuite';
  const module = getLiquidModule(activeModule);
  const commandShortcuts = liquidGlobalShortcuts.slice(0, 6);

  return (
    <View style={[styles.commandBar, isPhone && styles.commandBarPhone]}>
      {isPhone ? <LiquidLogo compact /> : (
        <View style={styles.commandContext}>
          <Text style={styles.commandEyebrow}>{module.label.toUpperCase()}</Text>
          <Text numberOfLines={1} style={styles.commandTitle}>{module.description}</Text>
        </View>
      )}
      {!isPhone ? (
        <View accessibilityRole="tablist" style={styles.commandShortcutBar}>
          {commandShortcuts.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={`${item.label}. ${item.description}`}
              accessibilityState={{ selected: item.id === 'today' && activeModule === 'home' }}
              onPress={() => router.push(item.route as never)}
              style={({ pressed }) => [
                styles.commandShortcut,
                item.id === 'today' && activeModule === 'home' && styles.commandShortcutActive,
                pressed && styles.pressed,
              ]}
            >
              <LiquidGlyph glyph={item.glyph} size={18} />
              {item.id === 'today' && activeModule === 'home' ? (
                <Text style={styles.commandShortcutLabel}>{item.label}</Text>
              ) : null}
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Suchen"
            onPress={onOpenSearch}
            style={({ pressed }) => [styles.commandShortcut, pressed && styles.pressed]}
          >
            <LiquidGlyph glyph="⌕" size={18} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.commandActions}>
        {!isPhone ? <PortalTextSizeControls /> : null}
        {!isPhone ? (
          <LiquidStatus label="Live" tone="live" />
        ) : null}
        <LiquidIconButton
          label="Benachrichtigungen"
          glyph="☷"
          onPress={onOpenNotifications}
        />
        {!isPhone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Profil ${displayName} öffnen`}
            onPress={onOpenProfile}
            style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
          >
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={styles.profileName}>{displayName}</Text>
              <Text numberOfLines={1} style={styles.profileRole}>{role}</Text>
            </View>
            <View style={styles.avatar}>
              <LiquidGlyph glyph="♙" size={20} />
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function BottomNavigation({
  activeModule,
  onPrimaryAction,
}: {
  activeModule: LiquidModuleKey;
  onPrimaryAction: () => void;
}) {
  const router = useRouter();
  const items = [
    { key: 'home', label: 'Heute', glyph: '⌂', route: '/' },
    { key: 'assist', label: 'Einsätze', glyph: '◇', route: '/assist/einsaetze' },
    { key: 'action', label: 'Neu', glyph: '+', route: null },
    { key: 'messages', label: 'Nachrichten', glyph: '▱', route: '/business/messages' },
    { key: 'settings', label: 'Profil', glyph: '♙', route: '/settings/profile' },
  ] as const;

  return (
    <View accessibilityRole="tablist" style={styles.bottomNav}>
      {items.map((item) => {
        const selected = item.key === activeModule;
        const central = item.key === 'action';
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => item.route ? router.push(item.route as never) : onPrimaryAction()}
            style={({ pressed }) => [
              styles.bottomItem,
              pressed && styles.pressed,
            ]}
          >
            <View style={[
              styles.bottomGlyph,
              selected && styles.bottomGlyphActive,
              central && styles.bottomGlyphCentral,
            ]}>
              <LiquidGlyph active={selected || central} glyph={item.glyph} size={22} />
            </View>
            <Text style={[styles.bottomLabel, selected && styles.bottomLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LiquidCommandShell({
  activeModule,
  activeArea,
  title,
  subtitle,
  contextLabel = 'Aktiver Arbeitskontext',
  contextDetail = 'Heute · alle Standorte',
  children,
  aside,
  primaryActionLabel,
  onPrimaryAction,
  allowPhoneLandscape = false,
  contentMode = 'scroll',
  showPageHeader = true,
  showContextBar = true,
}: LiquidCommandShellProps) {
  const layout = useLiquidLayout();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const module = getLiquidModule(activeModule);
  const actionLabel = primaryActionLabel ?? module.primaryAction;
  const action = onPrimaryAction ?? (() => setPaletteOpen(true));

  if (layout.formFactor === 'phone-landscape-blocked' && !allowPhoneLandscape) {
    return <RotateDeviceScreen />;
  }

  const showAreaRail =
    activeModule !== 'home' &&
    !layout.isPhone &&
    layout.formFactor !== 'tablet-portrait' &&
    liquidWorkAreas[activeModule].length > 0;

  const workspaceContent = (
    <View style={styles.workspace}>
      {showAreaRail ? (
        <LiquidSurface style={styles.areaRail} solid contentStyle={styles.areaRailContent}>
          <LiquidText variant="kicker">ARBEITSBEREICHE</LiquidText>
          <WorkAreaNavigation moduleKey={activeModule} activeArea={activeArea} />
        </LiquidSurface>
      ) : null}
      {contentMode === 'fill' ? (
        <View
          style={[
            styles.contentFill,
            { padding: layout.contentPadding },
            !layout.isDesktop && styles.contentFillCompact,
          ]}
        >
          {showPageHeader ? (
            <View style={styles.pageHeader}>
              <View style={styles.pageHeading}>
                <LiquidText variant="kicker">{module.label.toUpperCase()}</LiquidText>
                <LiquidText variant={layout.isPhone ? 'title' : 'display'} accessibilityRole="header">
                  {title}
                </LiquidText>
                <LiquidText variant="body" style={styles.pageSubtitle}>{subtitle}</LiquidText>
              </View>
            </View>
          ) : null}
          <View style={styles.contentPrimaryFill}>{children}</View>
        </View>
      ) : (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[
            styles.content,
            { padding: layout.contentPadding },
            !showPageHeader && styles.contentWithoutHeader,
            layout.isPhone && styles.contentPhone,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {showPageHeader ? (
            <View style={styles.pageHeader}>
              <View style={styles.pageHeading}>
                <LiquidText variant="kicker">{module.label.toUpperCase()}</LiquidText>
                <LiquidText
                  variant={layout.isPhone ? 'title' : 'display'}
                  accessibilityRole="header"
                >
                  {title}
                </LiquidText>
                <LiquidText variant="body" style={styles.pageSubtitle}>{subtitle}</LiquidText>
              </View>
              {!layout.isPhone ? (
                <LiquidButton label={actionLabel} icon="+" onPress={action} />
              ) : null}
            </View>
          ) : null}
          <View
            style={[
              styles.contentColumns,
              aside && layout.isDesktop ? styles.contentColumnsWithAside : null,
            ]}
          >
            <View style={styles.contentPrimary}>{children}</View>
            {aside && layout.isDesktop ? <View style={styles.contentAside}>{aside}</View> : null}
          </View>
        </ScrollView>
      )}
    </View>
  );

  return (
    <LiquidBackdrop>
      <View style={styles.shell}>
        {layout.showDock ? <ModuleDock activeModule={activeModule} /> : null}
        <View style={styles.shellMain}>
          <CommandBar
            activeModule={activeModule}
            onOpenSearch={() => setPaletteOpen(true)}
            onOpenNotifications={() => setNotificationsOpen(true)}
            onOpenProfile={() => setProfileOpen(true)}
          />
          {showContextBar ? (
            <View style={styles.contextBar}>
              <View style={styles.contextCopy}>
                <Text style={styles.contextLabel}>{contextLabel}</Text>
                <Text numberOfLines={1} style={styles.contextDetail}>{contextDetail}</Text>
              </View>
              <LiquidStatus label="Aktuell" tone="live" detail="mandantenweit synchronisiert" />
            </View>
          ) : null}
          {layout.isPhone || layout.formFactor === 'tablet-portrait' ? (
            <WorkAreaNavigation
              moduleKey={activeModule}
              activeArea={activeArea}
              horizontal
            />
          ) : null}
          {layout.isDesktop ? (
            <LiquidSurface solid style={styles.workspaceFrame} contentStyle={styles.workspaceFrameContent}>
              {workspaceContent}
            </LiquidSurface>
          ) : workspaceContent}
        </View>
      </View>
      {!layout.isDesktop ? (
        <BottomNavigation activeModule={activeModule} onPrimaryAction={action} />
      ) : null}
      <CommandPalette visible={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <NotificationCenter
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
      <ProfileMenu visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </LiquidBackdrop>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
  },
  noticeWrap: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'flex-end',
    margin: 24,
  },
  noticePanel: {
    padding: 20,
    gap: 16,
  },
  profileMenuWrap: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'flex-end',
    margin: 24,
  },
  profileMenu: {
    padding: 18,
    gap: 12,
  },
  profileMenuHeader: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileMenuAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: liquidColors.blue400,
    backgroundColor: 'rgba(20,120,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMenuAvatarLabel: {
    color: liquidColors.white,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  profileMenuIdentity: {
    minWidth: 0,
    flex: 1,
  },
  profileMenuName: {
    color: liquidColors.white,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  profileMenuRole: {
    color: liquidColors.white56,
    fontSize: 12,
    lineHeight: 17,
  },
  profileMenuRow: {
    minHeight: 64,
    paddingHorizontal: 10,
    borderRadius: liquidRadius.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileMenuGlyph: {
    width: 32,
    color: liquidColors.blue200,
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
  },
  profileMenuCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  profileMenuLabel: {
    color: liquidColors.white,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  profileMenuDetail: {
    color: liquidColors.white56,
    fontSize: 11,
    lineHeight: 15,
  },
  shellMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  contentWithoutHeader: {
    paddingTop: 0,
  },
  dock: {
    width: 252,
    paddingHorizontal: 14,
    paddingVertical: 20,
    borderRightWidth: 1,
    borderRightColor: liquidColors.white12,
    backgroundColor: 'rgba(6,21,43,0.9)',
    alignItems: 'stretch',
    gap: 18,
    zIndex: liquidLayers.dock,
  },
  dockBrand: {
    gap: 14,
  },
  dockBrandCopy: {
    gap: 3,
    paddingHorizontal: 4,
  },
  dockKicker: {
    color: liquidColors.blue200,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dockTitle: {
    color: liquidColors.white,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  dockItems: {
    gap: 6,
    paddingBottom: 20,
    paddingTop: 2,
  },
  dockItem: {
    width: '100%',
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: liquidRadius.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  dockItemActive: {
    borderColor: liquidColors.blue400,
    backgroundColor: 'rgba(20,120,255,0.2)',
  },
  dockGlyph: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: liquidColors.white08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockGlyphActive: {
    backgroundColor: 'rgba(22,131,255,0.24)',
  },
  dockItemCopy: {
    minWidth: 0,
    flex: 1,
    gap: 1,
  },
  dockLabel: {
    color: liquidColors.white72,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  dockLabelActive: {
    color: liquidColors.white,
  },
  dockItemDetail: {
    color: liquidColors.blue200,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  dockLogout: {
    width: '100%',
    minHeight: 50,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: liquidColors.white12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  dockLogoutLabel: {
    color: liquidColors.white72,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  commandBar: {
    minHeight: 74,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: liquidColors.white12,
    backgroundColor: 'rgba(6,21,43,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    zIndex: liquidLayers.dock,
  },
  commandBarPhone: {
    minHeight: 68,
    paddingHorizontal: 16,
  },
  commandContext: {
    width: 270,
    minWidth: 0,
    gap: 4,
  },
  commandEyebrow: {
    color: liquidColors.blue200,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  commandTitle: {
    color: liquidColors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  commandActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  commandShortcutBar: {
    minWidth: 0,
    flex: 1,
    maxWidth: 590,
    height: 48,
    padding: 4,
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: 'rgba(4,20,42,0.52)',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  commandShortcut: {
    minWidth: 46,
    flex: 1,
    paddingHorizontal: 8,
    borderRadius: liquidRadius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  commandShortcutActive: {
    borderWidth: 1,
    borderColor: liquidColors.blue400,
    backgroundColor: 'rgba(22,131,255,0.28)',
  },
  commandShortcutGlyph: {
    color: liquidColors.blue200,
    fontSize: 17,
    lineHeight: 20,
  },
  commandShortcutLabel: {
    color: liquidColors.white88,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  profile: {
    minHeight: 48,
    maxWidth: 210,
    paddingLeft: 9,
    paddingRight: 5,
    borderRadius: liquidRadius.small,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  profileCopy: {
    minWidth: 0,
    alignItems: 'flex-end',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: liquidColors.blue400,
    backgroundColor: 'rgba(20,120,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    maxWidth: 130,
    color: liquidColors.white,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  profileRole: {
    color: liquidColors.white56,
    fontSize: 11,
    lineHeight: 14,
  },
  contextBar: {
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: liquidColors.white08,
    backgroundColor: 'rgba(4,20,42,0.64)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: liquidSpace[3],
  },
  contextCopy: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
  },
  contextLabel: {
    color: liquidColors.white88,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  contextDetail: {
    minWidth: 0,
    flex: 1,
    color: liquidColors.white56,
    fontSize: 13,
    lineHeight: 18,
  },
  workspace: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    flexDirection: 'row',
  },
  workspaceFrame: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    margin: 14,
    overflow: 'hidden',
  },
  workspaceFrameContent: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'rgba(7,27,53,0.78)',
  },
  areaRail: {
    width: 226,
    margin: 12,
    marginRight: 0,
    alignSelf: 'stretch',
  },
  areaRailContent: {
    paddingTop: 18,
  },
  areaVertical: {
    marginTop: 12,
  },
  areaVerticalContent: {
    paddingBottom: 18,
  },
  areaRow: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  areaSelected: {
    borderLeftColor: liquidColors.blue500,
    backgroundColor: 'rgba(20,120,255,0.12)',
  },
  areaMarker: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: liquidColors.white32,
  },
  areaMarkerActive: {
    backgroundColor: liquidColors.blue400,
  },
  areaCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  areaLabel: {
    color: liquidColors.white72,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  areaLabelActive: {
    color: liquidColors.white,
  },
  areaDescription: {
    color: liquidColors.white56,
    fontSize: 11,
    lineHeight: 15,
  },
  areaHorizontal: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: liquidColors.white08,
  },
  areaHorizontalContent: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  areaChip: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: liquidRadius.pill,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contentScroll: {
    flex: 1,
    minWidth: 0,
  },
  contentFill: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    gap: 14,
  },
  contentFillCompact: {
    paddingBottom: 104,
  },
  contentPrimaryFill: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  content: {
    width: '100%',
    maxWidth: 1920,
    alignSelf: 'center',
    paddingBottom: 48,
    gap: 16,
  },
  contentPhone: {
    paddingBottom: 112,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  pageHeading: {
    minWidth: 0,
    flex: 1,
    gap: 6,
  },
  pageSubtitle: {
    maxWidth: 760,
    color: liquidColors.white72,
  },
  contentColumns: {
    width: '100%',
  },
  contentColumnsWithAside: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  contentPrimary: {
    minWidth: 0,
    flex: 1,
    gap: 14,
  },
  contentAside: {
    width: 336,
    gap: 14,
  },
  bottomNav: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: Platform.OS === 'web' ? 10 : 14,
    minHeight: 74,
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: liquidColors.white18,
    backgroundColor: 'rgba(6,21,43,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: liquidLayers.dock,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 20,
  },
  bottomItem: {
    minWidth: 56,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bottomGlyph: {
    minWidth: 34,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomGlyphActive: {
    backgroundColor: 'rgba(20,120,255,0.2)',
  },
  bottomGlyphCentral: {
    width: 46,
    height: 46,
    marginTop: -18,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: liquidColors.blue200,
    backgroundColor: liquidColors.blue600,
  },
  bottomGlyphText: {
    color: liquidColors.white72,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  bottomGlyphTextActive: {
    color: liquidColors.white,
  },
  bottomLabel: {
    color: liquidColors.white56,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  bottomLabelActive: {
    color: liquidColors.blue200,
  },
  modalBackdrop: {
    flex: 1,
    padding: 18,
    backgroundColor: 'rgba(0,5,16,0.76)',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  paletteWrap: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '88%',
    marginTop: Platform.OS === 'web' ? 50 : 28,
  },
  palette: {
    padding: 18,
    gap: 16,
  },
  paletteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  paletteTitle: {
    gap: 3,
  },
  paletteResults: {
    maxHeight: 520,
  },
  paletteResult: {
    minHeight: 66,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paletteGlyph: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(20,120,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteGlyphText: {
    color: liquidColors.blue200,
    fontSize: 20,
    lineHeight: 24,
  },
  paletteResultCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  paletteResultLabel: {
    color: liquidColors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  paletteResultDescription: {
    color: liquidColors.white56,
    fontSize: 13,
    lineHeight: 18,
  },
  noResults: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 5,
  },
  pressed: {
    opacity: 0.78,
  },
  focused: {
    borderWidth: 2,
    borderColor: liquidColors.blue200,
  },
  rotate: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotateCard: {
    maxWidth: 660,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  centerText: {
    textAlign: 'center',
  },
});
