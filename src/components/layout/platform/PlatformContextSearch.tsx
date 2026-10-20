import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInput as TextInputType,
  type TextInputKeyPressEventData,
  type TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useAuroraAdaptiveText, useShellGlassSurfaceStyle } from '@/design/tokens/auroraGlass';
import { withAlpha } from '@/design/tokens/motion';
import { radius, spacing, typography } from '@/theme';
import type { MainModuleKey } from '@/types/navigation/platform';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useTenantModuleSettings } from '@/hooks/useTenantModuleSettings';
import { supportsNativeSearchHistoryLongPress } from '@/lib/search/platformSearchHistoryTrigger';
import { appendTenantSearchHistory, loadTenantSearchHistory } from '@/lib/search/tenantSearchHistory';
import { searchTenant } from '@/lib/search/tenantSearchService';
import type { TenantSearchHistoryEntry, TenantSearchResultItem } from '@/lib/search/tenantSearchTypes';
import { PlatformTenantSearchModal } from './PlatformTenantSearchModal';

export const PLATFORM_SEARCH_PLACEHOLDERS: Record<MainModuleKey, string> = {
  zentrale: 'Suchen in Zentrale …',
  office: 'Suchen in Office …',
  assist: 'Suchen in Assist …',
  pflege: 'Suchen in Pflege …',
  stationaer: 'Suchen in Stationär …',
  beratung: 'Suchen in Beratung …',
  akademie: 'Suchen in Akademie …',
  admin: 'Suchen in Admin …',
};

type PlatformContextSearchProps = {
  mainModule: MainModuleKey;
  fullWidth?: boolean;
  accentColor?: string;
};

const TOPBAR_CONTROL_HEIGHT = 48;
const TOPBAR_SEARCH_WIDTH = 260;
const TOPBAR_ICON_SIZE = 32;

const webNoOutline =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

function isModK(event: Pick<NativeSyntheticEvent<TextInputKeyPressEventData>, 'nativeEvent'>): boolean {
  const key = event.nativeEvent.key?.toLowerCase?.() ?? '';
  const native = event.nativeEvent as TextInputKeyPressEventData & { metaKey?: boolean };
  return key === 'k' && Boolean(native.metaKey);
}

/** Module-scoped search field with tenant-wide cross-module search on Enter. */
export function PlatformContextSearch({
  mainModule,
  fullWidth = false,
  accentColor,
}: PlatformContextSearchProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { modules: tenantModules } = useTenantModuleSettings();
  const { colors, isDark } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const inputGlass = useShellGlassSurfaceStyle('input');
  const inputRef = useRef<TextInputType>(null);

  const [query, setQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'results' | 'history'>('results');
  const [results, setResults] = useState<TenantSearchResultItem[]>([]);
  const [history, setHistory] = useState<TenantSearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accent = accentColor ?? colors.violet;
  const nativeHistoryLongPress = supportsNativeSearchHistoryLongPress(Platform.OS);
  const styles = useMemo(
    () => createStyles(isDark, colors, text, fullWidth, accent),
    [accent, colors, fullWidth, isDark, text],
  );

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setError(null);
    setLoading(false);
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!tenantId) {
      setHistory([]);
      return;
    }
    const entries = await loadTenantSearchHistory(tenantId);
    setHistory(entries);
  }, [tenantId]);

  const runSearch = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setError('Bitte einen Suchbegriff eingeben.');
        setModalMode('results');
        setModalVisible(true);
        return;
      }
      if (!tenantId) {
        setError('Kein Mandant ausgewählt.');
        setModalMode('results');
        setModalVisible(true);
        return;
      }

      setModalMode('results');
      setModalVisible(true);
      setLoading(true);
      setError(null);
      setResults([]);

      const result = await searchTenant(tenantId, trimmed, {
        tenantId,
        roleKey: profile?.roleKey,
        tenantModules,
        actorRoleKey: profile?.roleKey,
        profileId: profile?.id,
      });

      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setResults(result.data.results);
      const nextHistory = await appendTenantSearchHistory(tenantId, trimmed);
      setHistory(nextHistory);
    },
    [profile?.id, profile?.roleKey, tenantId, tenantModules],
  );

  const openHistory = useCallback(async () => {
    await refreshHistory();
    setModalMode('history');
    setModalVisible(true);
    setError(null);
    setLoading(false);
  }, [refreshHistory]);

  const handleSubmit = useCallback(() => {
    void runSearch(query);
  }, [query, runSearch]);

  const handleSelectResult = useCallback(
    (item: TenantSearchResultItem) => {
      closeModal();
      setQuery('');
      router.push(item.href as never);
    },
    [closeModal, router],
  );

  const handleSelectHistoryEntry = useCallback(
    (entry: TenantSearchHistoryEntry) => {
      closeModal();
      setQuery(entry.query);
      void runSearch(entry.query);
    },
    [closeModal, runSearch],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isCmdK) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape' && modalVisible) {
        event.preventDefault();
        closeModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeModal, modalVisible]);

  return (
    <>
      <View style={styles.host}>
        <View
          style={[styles.searchWrap, inputGlass]}
          {...(Platform.OS === 'web'
            ? {
                onContextMenu: (event: { preventDefault: () => void }) => {
                  event.preventDefault();
                  void openHistory();
                },
              }
            : {})}
        >
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={PLATFORM_SEARCH_PLACEHOLDERS[mainModule]}
            placeholderTextColor={text.muted}
            style={[styles.searchInput, webNoOutline]}
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            onKeyPress={(event) => {
              if (isModK(event)) {
                event.preventDefault?.();
              }
            }}
            {...(nativeHistoryLongPress
              ? {
                  onLongPress: () => {
                    inputRef.current?.blur();
                    void openHistory();
                  },
                  accessibilityHint: 'Gedrückt halten für Suchverlauf',
                }
              : {})}
            accessibilityLabel="Mandantenweite Suche"
          />
          <Pressable
            style={styles.searchKbd}
            onPress={() => inputRef.current?.focus()}
            accessibilityRole="button"
            accessibilityLabel="Suche fokussieren (⌘K)"
          >
            <Text style={styles.searchKbdText}>⌘K</Text>
          </Pressable>
        </View>
      </View>

      <PlatformTenantSearchModal
        visible={modalVisible}
        mode={modalMode}
        query={query}
        results={results}
        history={history}
        loading={loading}
        error={error}
        accentColor={accent}
        onClose={closeModal}
        onSelectResult={handleSelectResult}
        onSelectHistoryEntry={handleSelectHistoryEntry}
      />
    </>
  );
}

function createStyles(
  isDark: boolean,
  colors: ReturnType<typeof useLegacyTheme>['colors'],
  text: ReturnType<typeof useAuroraAdaptiveText>,
  fullWidth: boolean,
  accentColor?: string,
) {
  const accent = accentColor ?? colors.violet;

  return StyleSheet.create({
    host: {
      position: 'relative',
      width: fullWidth ? '100%' : TOPBAR_SEARCH_WIDTH,
      maxWidth: fullWidth ? undefined : TOPBAR_SEARCH_WIDTH,
      alignSelf: fullWidth ? 'stretch' : 'flex-start',
    },
    searchWrap: {
      minHeight: TOPBAR_CONTROL_HEIGHT,
      maxHeight: TOPBAR_CONTROL_HEIGHT,
      height: TOPBAR_CONTROL_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      width: '100%',
      gap: spacing.sm,
      borderRadius: radius.capsule,
      borderColor: withAlpha(accent, 0.32),
    },
    searchIcon: {
      fontSize: 26,
      lineHeight: 28,
      color: withAlpha(accent, 0.85),
      alignSelf: 'center',
      marginTop: -1,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      ...typography.body,
      color: text.primary,
      paddingVertical: 0,
      height: TOPBAR_ICON_SIZE,
    },
    searchKbd: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(120,160,255,0.22)',
      backgroundColor: 'rgba(255,255,255,0.35)',
    },
    searchKbdText: { fontSize: 11, color: text.primary, fontWeight: '600' },
  });
}
