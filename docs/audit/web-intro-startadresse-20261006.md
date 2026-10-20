# Web-Intro ausschließlich an der Startadresse – 06.10.2026

Die neue Vorgabe ersetzt den bisherigen Web-Ablauf: Beim direkten Öffnen oder
vollständigen Neuladen von `https://www.caresuiteplus.app/` startet das vorhandene
Intro automatisch. Alle anderen effektiven Browseradressen überspringen es,
einschließlich Unterseiten, anderen Domains, Query- und Hash-Links. Wenn eine
andere Adresse serverseitig auf die exakte Startadresse umleitet, entscheidet
die dort geladene Startadresse.

Die Adresse wird im ersten Render vor Layout-Effekten der Kindrouten erfasst;
die Freigabe wird vor dem ersten Client-Paint entschieden. Ein
direkter Unterseitenaufruf gilt für das gesamte Dokument als erledigter Intro-
Ablauf: Auch eine interne Navigation zur Startseite oder ein Root-Remount
startet dann kein Video. Ein während des Startvideos erfolgender Router-
Redirect unterbricht das ursprünglich an der Startadresse begonnene Intro
nicht. Nach vollständigem Neuladen beginnt ein neues Dokument ohne gespeicherten
Abschluss; Cookies, Local Storage und Session Storage sind nicht beteiligt.

Die Schaltfläche und Abfrage „Intro mit Musik starten“ entfallen. Der erste
Wiedergabeversuch erfolgt mit Ton. Sperrt der Browser ihn, wird automatisch
stumm abgespielt. Eine echte Maus-, Touch- oder Tastatureingabe versucht Musik
erneut, ohne das laufende Video zurückzusetzen. Wenn der Browser weiter sperrt,
läuft es automatisch stumm weiter. Ton-Autoplay ohne Benutzerinteraktion kann
eine Website nicht für jeden Browser erzwingen:
[Chrome-Autoplay-Regeln](https://developer.chrome.com/blog/autoplay/) und
[WebKit-Videoregeln](https://webkit.org/blog/6784/new-video-policies-for-ios/).

Der Router bleibt unter dem Intro gemountet; bis zum Ende ist sein Inhalt
verborgen und inert. Videoende, ein Medienfehler oder ein fehlgeschlagener
stummer Start geben die Anwendung frei. Wenn Laden oder Abschluss ausbleiben,
greift die bestehende Wartezeit von 20 Sekunden; ein tatsächlicher Wiedergabe-
beginn erhält ein eigenes Zeitfenster für den vollständigen Clip. Verspätete
Wiedergabeantworten können den bereits freigegebenen Ablauf nicht erneut öffnen.

Die sechs Originalvideos, die Formatauswahl und die Native-/Android-Dateien
werden nicht geändert. Auch Supabase, E-Mail-Versand und Abhängigkeiten sind
nicht Teil dieser Änderung.

## Nachweise

- 61 Tests erfolgreich: 43 Web-Intro-Tests und die vorhandenen 18 Native-Tests.
  Befehl: `node node_modules/vitest/vitest.mjs run src/__tests__/platform/appStartIntroWeb.test.tsx src/__tests__/platform/appStartIntro.test.tsx --maxWorkers 2`.
- Web-Fälle: exakte Startadresse, Root-Reload, direkte Unterseiten und Reloads,
  andere Origins, Query/Hash, interne Navigation, Remount, Router-Redirect,
  statische SSR-Hydration, automatischer Tonversuch, stummer Fallback,
  echte/geskriptete Aktivierung, Fehler, Timeouts und verspätete Antworten.
- Gezielte TypeScript-Prüfung der Web-Komponente, ihres Tests und importierter
  Helfer mit dem vorhandenen TypeScript-Compiler: erfolgreich. Kein vollständiger
  Projekt-Typecheck behauptet.
- Isoliertes Browser-Bundle der Produktionskomponente mit den Originalvideos
  und der vorhandenen Schrift mit dem installierten esbuild gebaut.
- `ffprobe` bestätigt für das vorhandene Portraitvideo acht Sekunden H.264
  mit AAC-Ton. Dies belegt die vorhandene Audiospur, nicht hörbare Wiedergabe.
- `git diff --check`: erfolgreich.

## Offene Prüfung und Veröffentlichung

Die Sichtprüfung in breiter und schmaler Browserdarstellung und echte Video-/
Tonwiedergabe bleiben offen. Der verfügbare Cloud-Browser sperrt den Zugriff
auf die lokale Vorschau. Die Tests laufen in happy-dom mit simulierten Medien-
und Aktivierungsereignissen; sie belegen Ablauf und Freigabe, keine gerenderte
Geometrie oder tatsächliche Browser-Autoplay-Freigabe.

Der Änderungsbranch basiert auf dem GitHub-main-Commit
`5cb10318315da96b2d2419c906b6b840e1430bba`. Ein Upload des Branches aktualisiert
die Live-Seite noch nicht; dazu sind Integration in main und der reguläre
Web-Deployment-Ablauf erforderlich. Kein direkter main-Push und keine produktive
Veröffentlichung wurden durch diesen Vorbereitungsschritt ausgeführt.
