import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { CareSuiteImage } from '@/components/images/CareSuiteImage';
import { COMPANY_TABS, activeCompanyCatalog, companyDate, companyIdentity, companySections, companySuggestions, companyWebsite, filterCompanySections, type CompanySection } from '@/lib/tenant/companyWorkspaceModel';
import { COMPANY_ICON_PATHS } from './companyIconPaths';
import type { CompanyWorkspaceViewProps as Props } from './companyWorkspaceView.types';

const ink = '#15304e', muted = '#59708c', blue = '#1764d4', line = '#d7e3f1';

export function CompanyIcon({ name, size = 20, color = blue }: { name: string; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    <Path d={COMPANY_ICON_PATHS[name] ?? COMPANY_ICON_PATHS.building} />
  </Svg>;
}
function IconTile({ name }: { name: string }) {
  return <View style={s.iconTile}><CompanyIcon name={name} /></View>;
}
function Action({ label, icon, onPress, disabled, primary, text = false }: { label: string; icon?: string; onPress: () => void; disabled?: boolean; primary?: boolean; text?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [text ? s.textAction : s.button, primary && s.primary, pressed && s.pressed, disabled && s.disabled]}>
    {icon ? <CompanyIcon name={icon} size={16} color={primary ? '#fff' : blue} /> : null}
    <Text style={[text ? s.actionLabel : s.buttonLabel, primary && s.primaryLabel]}>{label}</Text>
    {text ? <CompanyIcon name="arrow" size={16} /> : null}
  </Pressable>;
}
function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <LinearGradient colors={['#ffffff', '#f7faff']} style={[s.panel, style]}>{children}</LinearGradient>;
}
function PanelHeading({ icon, title, action }: { icon: string; title: string; action?: ReactNode }) {
  return <View style={s.panelHeading}><IconTile name={icon} /><Text accessibilityRole="header" style={s.h3}>{title}</Text>{action}</View>;
}
function Fact({ label, value, style }: { label: string; value: string; style?: ViewStyle }) {
  return <View style={[s.fact, style]}><Text style={s.factLabel}>{label}</Text><Text selectable style={s.factValue}>{value || 'Nicht hinterlegt'}</Text></View>;
}
function SectionCard({ section, onOpen, canEdit, width, narrow }: { section: CompanySection; onOpen: Props['onOpen']; canEdit: boolean; width: number; narrow: boolean }) {
  return <Panel style={{ width }}>
    <View style={s.sectionHeading}><IconTile name={section.icon} /><View style={s.grow}><Text accessibilityRole="header" style={s.h3}>{section.title}</Text><Text style={s.description}>{section.description}</Text></View></View>
    <View style={s.details}>{section.rows.map(([label, value]) => <View key={label} style={[s.detailRow, narrow && s.detailRowNarrow]}><Text style={[s.detailLabel, narrow && s.detailLabelNarrow]}>{label}</Text><Text selectable style={[s.detailValue, !value && s.muted]}>{value || 'Nicht hinterlegt'}</Text></View>)}</View>
    <View style={s.sectionFooter}><Text style={s.small}>{section.optional ? 'Bei Bedarf einrichten' : 'Unternehmensakte'}</Text><Action text label={section.action} onPress={() => onOpen(section.key)} disabled={!canEdit} /></View>
  </Panel>;
}
function Activity({ snapshot, compact = false }: Pick<Props, 'snapshot'> & { compact?: boolean }) {
  const entries = [...snapshot.auditLogs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, compact ? 3 : undefined);
  return !entries.length ? <View style={s.empty}><CompanyIcon name="clock" size={24} /><Text accessibilityRole="header" style={s.emptyTitle}>Noch keine Aktivitäten protokolliert</Text><Text style={s.emptyText}>Die verfügbaren Aktivitäten Ihres Unternehmens erscheinen hier.</Text></View>
    : <View>{entries.map(entry => <View key={entry.id} style={s.activity}><View style={s.activityDot} /><View style={s.grow}><Text style={s.activityTitle}>{entry.title || 'Aktivität im Unternehmen'}</Text>{entry.description ? <Text style={s.description}>{entry.description}</Text> : null}<Text style={s.small}>{companyDate(entry.createdAt, true)}</Text></View></View>)}</View>;
}

/** Native rendering of the Web company record, using its sections, icons and hierarchy. */
export function CompanyWorkspaceView({ snapshot, tab, onTab, activeAreas, canEdit, canDocuments, canInventory = false, inventoryContent, settingsContent, refreshing, refreshError, notice, noticeTone = 'success', onRefresh, onOpen, onCustomField, onCopy, onDocuments }: Props) {
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const [search, setSearch] = useState('');
  const [logoFailed, setLogoFailed] = useState<string | null>(null);
  const [linkError, setLinkError] = useState('');
  const padding = windowWidth <= 440 ? 12 : windowWidth <= 780 ? 16 : 28;
  const contentWidth = Math.max(1, width - padding * 2);
  const phone = contentWidth <= 600 || fontScale > 1.3 && contentWidth < 840;
  const stacked = contentWidth <= 840 || fontScale > 1.3;
  const cardWidth = phone ? contentWidth : (contentWidth - 17) / 2;
  const identity = companyIdentity(snapshot);
  const sections = companySections(snapshot, activeAreas);
  const suggestions = companySuggestions(snapshot);
  const results = search.trim() ? filterCompanySections(sections, search) : sections.filter(section => section.tab === tab);
  const primaryBank = snapshot.bankAccounts.find(account => account.isPrimary) ?? snapshot.bankAccounts[0];
  const website = companyWebsite(snapshot.company.website);
  const logo = companyWebsite(snapshot.branding.logoUrl);
  const navigate = (next: Props['tab']) => { setSearch(''); onTab(next); };
  const copyIdentity = [identity.name, identity.legalName, identity.address, identity.email, identity.phone, snapshot.company.website].filter(Boolean).join('\n');
  const link = async (url: string) => { try { await Linking.openURL(url); setLinkError(''); } catch { setLinkError('Der Kontakt konnte nicht geöffnet werden. Sie können die Angabe markieren und kopieren.'); } };
  const brand = <View style={[s.brandStage, phone && s.brandStagePhone]}><View style={[s.brandCard, { width: phone ? 260 : contentWidth <= 840 ? 222 : 256, height: phone ? 166 : contentWidth <= 840 ? 150 : 164 }]}>
    {logo && logoFailed !== logo ? <CareSuiteImage source={{ uri: logo }} resizeMode="contain" accessibilityLabel={`Logo ${identity.name}`} style={s.brandLogo} onError={() => setLogoFailed(logo)} /> : <View style={s.brandFallback}><CompanyIcon name="building" size={48} /><Text style={s.brandInitials}>{identity.initials}</Text></View>}
  </View></View>;
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[s.workspace, { padding }]} testID="office-company-workspace">
    <View style={s.topline}><Text style={s.breadcrumb}>Office　/　Unternehmen</Text>{tab !== 'inventory' ? <Action text icon="refresh" label={refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'} disabled={refreshing} onPress={onRefresh} /> : null}</View>
    <LinearGradient colors={['#ffffff', '#eaf3ff']} style={[s.hero, phone && s.heroPhone]}>
      {phone ? brand : null}
      <View style={[s.heroCopy, phone && s.stackedColumn]}><View style={s.eyebrowRow}><View style={s.dot} /><Text style={s.eyebrow}>UNTERNEHMENSAKTE</Text></View><Text accessibilityRole="header" style={[s.h1, phone && s.h1Phone]}>{identity.name}</Text>
        {identity.legalName ? <Text style={s.legalName}>{identity.legalName}</Text> : null}{identity.representative ? <Text style={s.description}>Vertreten durch {identity.representative}</Text> : null}
        <View style={s.heroMeta}>{snapshot.company.city ? <View style={s.inline}><CompanyIcon name="pin" size={16} /><Text style={s.metaText}>{snapshot.company.city}</Text></View> : null}{snapshot.company.legalForm ? <Text style={s.metaText}>{snapshot.company.legalForm}</Text> : null}{snapshot.register.ikNumber ? <Text style={s.metaText}>IK {snapshot.register.ikNumber}</Text> : null}</View>
        <View style={[s.heroActions, phone && s.heroActionsPhone]}>{canEdit ? <Action primary label="Stammdaten bearbeiten" icon="edit" onPress={() => onOpen('company')} /> : null}<Action label="Kontaktdaten kopieren" icon="copy" onPress={() => onCopy(copyIdentity, 'Kontaktdaten kopiert.')} /></View>
      </View>{!phone ? brand : null}
    </LinearGradient>
    <View style={s.contactStrip}>{identity.email ? <Pressable accessibilityRole="link" accessibilityLabel={`E-Mail ${identity.email}`} onPress={() => void link(`mailto:${encodeURIComponent(identity.email)}`)} style={s.contact}><CompanyIcon name="mail" size={16} /><Text selectable style={s.contactText}>{identity.email}</Text></Pressable> : <Text style={s.contactText}>E-Mail nicht hinterlegt</Text>}
      {identity.phone ? <Pressable accessibilityRole="link" accessibilityLabel={`Telefon ${identity.phone}`} onPress={() => void link(`tel:${identity.phone.replace(/[^\d+*#,;]/g, '')}`)} style={s.contact}><CompanyIcon name="phone" size={16} /><Text selectable style={s.contactText}>{identity.phone}</Text></Pressable> : null}
      {website ? <Pressable accessibilityRole="link" accessibilityLabel="Unternehmenswebsite öffnen" onPress={() => void link(website)} style={s.contact}><CompanyIcon name="globe" size={16} /><Text selectable style={s.contactText}>{new URL(website).hostname}</Text></Pressable> : null}<Text style={s.activeAreas}>● {activeAreas.join(' · ')}</Text>
    </View>
    {notice || linkError ? <Text accessibilityLiveRegion="polite" style={[s.notice, (noticeTone === 'error' || !!linkError) && s.error]}>{linkError || notice}</Text> : null}
    {refreshError ? <View style={[s.notice, s.error]} accessibilityRole="alert"><Text style={s.errorText}>Aktualisierung fehlgeschlagen</Text><Text style={s.errorText}>{refreshError} Die zuletzt geladenen Angaben bleiben sichtbar.</Text><Action label="Erneut versuchen" onPress={onRefresh} disabled={refreshing} /></View> : null}
    <View style={s.navigation}><View accessibilityLabel="Bereiche der Unternehmensakte" style={s.tabs}>{COMPANY_TABS.filter(item => item.id !== 'inventory' || canInventory).map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: !search.trim() && tab === item.id }} onPress={() => navigate(item.id)} style={({ pressed }) => [s.tab, phone && s.tabPhone, !search.trim() && tab === item.id && s.tabSelected, pressed && s.pressed]}><Text style={[s.tabLabel, !search.trim() && tab === item.id && s.tabLabelSelected]}>{item.label}</Text>{item.id === 'overview' && suggestions.length ? <Text style={s.count}>{suggestions.length}</Text> : null}</Pressable>)}</View>
      {tab !== 'inventory' ? <View style={s.search}><CompanyIcon name="search" /><TextInput accessibilityLabel="Unternehmensbereiche durchsuchen" placeholder="Bereich oder Angabe suchen …" placeholderTextColor={muted} value={search} onChangeText={setSearch} autoCorrect={false} style={s.searchInput} /></View> : null}
    </View>
    {tab === 'inventory' ? inventoryContent : search.trim() ? <><View style={s.contentHeading}><Text accessibilityRole="header" style={s.h2}>Suchergebnisse</Text><Text style={s.description}>{results.length} {results.length === 1 ? 'Bereich passt' : 'Bereiche passen'} zu „{search.trim()}“.</Text><Action text label="Suche zurücksetzen" onPress={() => setSearch('')} /></View>{results.length ? <View style={s.grid}>{results.map(section => <SectionCard key={section.key} section={section} canEdit={canEdit} onOpen={onOpen} width={cardWidth} narrow={windowWidth <= 440 || contentWidth > 600 && contentWidth <= 840} />)}</View> : <View style={s.empty}><CompanyIcon name="search" size={32} /><Text style={s.emptyTitle}>Kein passender Bereich gefunden</Text><Text style={s.emptyText}>Suchen Sie zum Beispiel nach „Bank“, „Telefon“ oder „Rechnung“.</Text></View>}</>
      : tab === 'overview' ? <>
        <View style={s.contentHeading}><Text accessibilityRole="header" style={s.h2}>Ihr Unternehmen im Überblick</Text><Text style={s.description}>Die wichtigsten Angaben und die nächsten Schritte an einem Ort.</Text></View>
        <View style={[s.overview, stacked && s.overviewStacked]}><View style={[s.overviewMain, stacked && s.stackedColumn]}>
          <Panel><PanelHeading icon="building" title="Unternehmensprofil" action={<Action text label="Profil öffnen" onPress={() => navigate('identity')} />} /><View style={s.profileGrid}>{[['Hauptsitz', identity.address || 'Anschrift noch nicht hinterlegt'], ['Geschäftsführung / Vertretung', identity.representative || 'Noch nicht hinterlegt'], ['E-Mail für Rechnungen', snapshot.contact.billingEmail || 'Noch nicht hinterlegt'], ['Rechtsform', snapshot.company.legalForm || 'Noch nicht hinterlegt']].map(([label, value]) => <Fact key={label} label={label} value={value} style={phone ? s.full : s.half} />)}</View></Panel>
          <View style={[s.pair, phone && s.pairStacked]}><Panel style={phone ? s.stackedColumn : s.grow}><IconTile name="bank" /><Text style={s.h3}>Abrechnung</Text><Text style={s.description}>{primaryBank ? primaryBank.bankName || primaryBank.label || 'Bankverbindung hinterlegt' : 'Bankverbindungen und Rechnungsangaben einrichten.'}</Text><View style={s.inlineFact}><Text style={s.factNumber}>{snapshot.payment.paymentTermsDays || '—'}</Text><Text style={s.small}>Tage Zahlungsziel</Text></View><Action text label="Abrechnung öffnen" onPress={() => navigate('finance')} /></Panel>
            <Panel style={phone ? s.stackedColumn : s.grow}><IconTile name="catalog" /><Text style={s.h3}>Leistungen & Preise</Text><Text style={s.description}>Leistungen, Fahrtkosten und Zuschläge Ihres Unternehmens.</Text><View style={s.inlineFact}><Text style={s.factNumber}>{activeCompanyCatalog(snapshot).length}</Text><Text style={s.small}>aktive Positionen</Text></View><Action text label="Katalog öffnen" disabled={!canEdit} onPress={() => onOpen('catalog')} /></Panel></View>
          {canDocuments ? <Pressable accessibilityRole="button" accessibilityLabel="Unternehmensdaten für Ihre Dokumente" onPress={onDocuments} style={s.documents}><IconTile name="receipt" /><View style={s.grow}><Text style={s.h3}>Unternehmensdaten für Ihre Dokumente</Text><Text style={s.description}>Im Dokumentenkatalog stehen die hinterlegten Angaben für passende Vorlagen bereit.</Text></View><CompanyIcon name="arrow" /></Pressable> : null}
        </View><View style={[s.overviewSide, stacked && s.stackedColumn]}><Panel style={s.attention}><PanelHeading icon={suggestions.length ? 'info' : 'check'} title={suggestions.length ? 'Angaben ergänzen' : 'Basisangaben hinterlegt'} />
          <Text style={s.description}>{suggestions.length ? 'Diese Angaben können Sie als Nächstes ergänzen.' : 'Name, Anschrift und Erreichbarkeit sind vorhanden. Weitere Angaben ergänzen Sie nach Bedarf in den Aktenbereichen.'}</Text>{suggestions.map(item => <Pressable key={item.id} accessibilityRole="button" disabled={!canEdit} onPress={() => onOpen(item.section)} style={s.suggestion}><View style={s.grow}><Text style={s.activityTitle}>{item.title}</Text><Text style={s.description}>{item.description}</Text></View><CompanyIcon name="arrow" size={16} /></Pressable>)}</Panel>
          <Panel><PanelHeading icon="clock" title="Letzte Aktivitäten" /><Activity snapshot={snapshot} compact /><Action text label="Verlauf ansehen" onPress={() => navigate('history')} /></Panel></View></View>
      </> : tab === 'history' ? <Panel><View style={s.contentHeading}><Text accessibilityRole="header" style={s.h2}>Aktivitäten im Unternehmen</Text><Text style={s.description}>Die zuletzt verfügbaren Ereignisse Ihres Unternehmens, bereichsübergreifend.</Text><Text style={s.small}>{snapshot.auditLogs.length} Einträge</Text></View><Activity snapshot={snapshot} /></Panel>
        : <><View style={s.contentHeading}><Text accessibilityRole="header" style={s.h2}>{COMPANY_TABS.find(item => item.id === tab)?.label}</Text><Text style={s.description}>{tab === 'identity' ? 'Stammdaten, Kontakt und die Menschen, die Ihr Unternehmen vertreten.' : tab === 'compliance' ? 'Hinterlegen Sie die für Ihr Unternehmen zutreffenden Angaben.' : tab === 'finance' ? 'Bankverbindungen, Zahlungsbedingungen und Leistungsvorgaben.' : 'Leistungsbereiche, eigene Angaben und Datenverwaltung.'}</Text></View>
          <View style={s.grid}>{results.map(section => <SectionCard key={section.key} section={section} canEdit={canEdit} onOpen={onOpen} width={cardWidth} narrow={windowWidth <= 440 || contentWidth > 600 && contentWidth <= 840} />)}</View>
          {tab === 'organization' && snapshot.customFields.length ? <Panel style={{ marginTop: 20 }}><PanelHeading icon="sliders" title="Ihre Felddefinitionen" />{snapshot.customFields.map(field => <View key={field.id ?? field.fieldKey} style={s.customRow}><View style={s.grow}><Text style={s.h3}>{field.label || field.fieldKey}</Text><Text style={s.description}>{({ text: 'Text', multiline: 'Mehrzeiliger Text', number: 'Zahl', date: 'Datum', boolean: 'Ja / Nein', select: 'Auswahl' })[field.dataType]} · {field.isActive ? 'Aktiv' : 'Inaktiv'}</Text></View><Action text label="Bearbeiten" disabled={!canEdit} onPress={() => onCustomField(field)} /></View>)}</Panel> : null}{tab === 'organization' ? settingsContent : null}</>}
  </View>;
}

const s = StyleSheet.create(withCareSuiteTypography({
  workspace: { width: '100%', minWidth: 0, backgroundColor: '#f4f8fd', borderRadius: 24 },
  grow: { flex: 1, minWidth: 0 }, stackedColumn: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' }, full: { width: '100%' }, half: { width: '46%', flexGrow: 1 }, muted: { color: muted },
  topline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }, breadcrumb: { color: muted, fontSize: 12 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 24, padding: 27, borderRadius: 25, borderWidth: 1, borderColor: line, overflow: 'hidden' }, heroPhone: { flexDirection: 'column', alignItems: 'stretch', gap: 18, padding: 20 },
  heroCopy: { flex: 1, minWidth: 0 }, h1: { fontSize: 29, lineHeight: 36, fontWeight: '600', letterSpacing: -0.8, color: ink, marginTop: 12, marginBottom: 10 }, h1Phone: { fontSize: 26, lineHeight: 32 },
  h2: { color: ink, fontSize: 19, lineHeight: 27, fontWeight: '600' }, h3: { color: ink, fontSize: 15, lineHeight: 23, fontWeight: '600', flexShrink: 1 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3684ed' }, eyebrow: { color: blue, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  legalName: { color: ink, fontSize: 14, lineHeight: 21, marginBottom: 8 }, description: { color: muted, fontSize: 12, lineHeight: 20, marginTop: 5 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 13 }, inline: { flexDirection: 'row', alignItems: 'center', gap: 6 }, metaText: { color: blue, fontSize: 12, lineHeight: 18 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 23 }, heroActionsPhone: { flexDirection: 'column', alignItems: 'stretch' },
  brandStage: { width: 256, minHeight: 200, alignItems: 'center', justifyContent: 'center' }, brandStagePhone: { width: '100%', minHeight: 194 }, brandCard: { maxWidth: '100%', padding: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d2e0ee', borderRadius: 20, shadowColor: '#244d7c', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  brandLogo: { width: '100%', height: '100%' }, brandFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }, brandInitials: { color: blue, fontSize: 30, lineHeight: 38, fontWeight: '600', letterSpacing: 3 },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: '#c5d6e9', borderRadius: 12, backgroundColor: '#fff' }, primary: { backgroundColor: blue, borderColor: '#2269cd' }, buttonLabel: { color: ink, fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1 }, primaryLabel: { color: '#fff' },
  textAction: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 6 }, actionLabel: { color: blue, fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1 }, pressed: { opacity: 0.75 }, disabled: { opacity: 0.55 },
  contactStrip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, minHeight: 63, paddingVertical: 16, paddingHorizontal: 2, borderBottomWidth: 1, borderColor: line }, contact: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%', minHeight: 32 }, contactText: { color: blue, fontSize: 12, lineHeight: 19, flexShrink: 1 }, activeAreas: { color: '#176c50', fontSize: 12, lineHeight: 19 },
  notice: { backgroundColor: '#edf8f3', borderWidth: 1, borderColor: '#b7ddcc', borderRadius: 12, color: '#176c50', fontSize: 13, lineHeight: 21, padding: 14, marginTop: 16, gap: 8 }, error: { backgroundColor: '#fff4f3', borderColor: '#e7c2c0', color: '#a33b35' }, errorText: { color: '#a33b35', fontSize: 13, lineHeight: 21 },
  navigation: { gap: 16, marginTop: 21, marginBottom: 25 }, tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4, borderWidth: 1, borderColor: line, borderRadius: 13 }, tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: 'transparent', borderRadius: 9, minHeight: 42, paddingVertical: 9, paddingHorizontal: 12 }, tabPhone: { flexGrow: 1, flexBasis: '43%', paddingHorizontal: 8 }, tabSelected: { backgroundColor: '#e6f0ff', borderColor: '#8cb4e7' }, tabLabel: { color: muted, fontSize: 12, lineHeight: 18, fontWeight: '500', flexShrink: 1, textAlign: 'center' }, tabLabelSelected: { color: '#1859b3' }, count: { borderRadius: 6, fontSize: 10, backgroundColor: '#fff8ea', color: '#86570f', paddingVertical: 2, paddingHorizontal: 5 },
  search: { minHeight: 43, borderWidth: 1, borderColor: '#c5d6e9', backgroundColor: '#fff', borderRadius: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }, searchInput: { flex: 1, minWidth: 0, color: ink, fontSize: 12, paddingVertical: 11 },
  contentHeading: { gap: 4, marginBottom: 20 }, panel: { minWidth: 0, borderWidth: 1, borderColor: line, borderRadius: 19, padding: 19, gap: 8 }, panelHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 12 }, iconTile: { width: 39, height: 39, borderWidth: 1, borderColor: line, borderRadius: 12, backgroundColor: '#eaf2ff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 17 }, sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }, details: { gap: 13 }, detailRow: { flexDirection: 'row', gap: 12 }, detailRowNarrow: { flexDirection: 'column', gap: 3 }, detailLabel: { color: muted, width: '32%', fontSize: 11, lineHeight: 18 }, detailLabelNarrow: { width: '100%' }, detailValue: { color: ink, fontSize: 12, lineHeight: 20, flex: 1, minWidth: 0 }, sectionFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: line, paddingTop: 15, marginTop: 14 },
  overview: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 }, overviewStacked: { flexDirection: 'column', alignItems: 'stretch' }, overviewMain: { flex: 1.65, minWidth: 0, gap: 18 }, overviewSide: { flex: 1, minWidth: 0, gap: 18 }, profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 22 }, fact: { minWidth: 0, gap: 7 }, factLabel: { color: muted, fontSize: 11, lineHeight: 18 }, factValue: { color: ink, fontSize: 13, lineHeight: 22 }, pair: { flexDirection: 'row', gap: 17 }, pairStacked: { flexDirection: 'column' }, inlineFact: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginVertical: 14 }, factNumber: { color: ink, fontSize: 27, lineHeight: 33, fontWeight: '500' }, small: { color: muted, fontSize: 11, lineHeight: 18 },
  documents: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: line, backgroundColor: '#fff', borderRadius: 17, padding: 17 }, attention: { backgroundColor: '#fff8ea', borderColor: '#ead4a6' }, suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderColor: line }, activity: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, paddingBottom: 21 }, activityDot: { width: 9, height: 9, borderWidth: 2, borderColor: line, backgroundColor: '#3684ed', borderRadius: 5, marginTop: 6 }, activityTitle: { color: ink, fontSize: 12, lineHeight: 20, fontWeight: '600' }, empty: { paddingVertical: 16, alignItems: 'center', gap: 12 }, emptyTitle: { color: ink, fontSize: 13, lineHeight: 21, fontWeight: '600', textAlign: 'center' }, emptyText: { color: muted, fontSize: 12, lineHeight: 20, textAlign: 'center' }, customRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, borderTopWidth: 1, borderColor: line },
}));
