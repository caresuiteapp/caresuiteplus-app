# Mobiles Webportal: bleibende Bedienungssperre und Scrollinhalt

Stand: 12. Oktober 2026. Basis ist der aktuelle `main`-Commit `152b1b97c515e64a3144f7593e0eee2d3d7c0a1a`. Dieser Hotfix übernimmt keine alten Layouts oder Dateien aus PR #49.

Das angehängte Video zeigt den mobilen Webbrowser. Der Nutzer bestätigt ausdrücklich, dass die Seite eingefroren ist, nicht scrollt und Bereiche zusammengedrängt erscheinen. Die Abmeldung bei etwa 24 Sekunden erfolgt über das sichtbare Menü; sie ist kein belegter unerwarteter Sitzungsabbruch. Die langen Ladezustände sind ein zusätzlicher Befund, keine Erklärung für die gesamte Bedienstörung.

## Konkrete Fehler und Korrekturen

1. `WorkflowFeedbackOverlay` speichert für jede Ladeebene unabhängig den vorherigen `inert`-Zustand der Hintergrundelemente. Bei zwei überlappenden Vorgängen speichert der zweite bereits `true`. Schließt zuerst der erste und anschließend der zweite, stellt der zweite `true` wieder her. Das App-Root bleibt dann gesperrt, obwohl keine Ladeebene sichtbar ist. Der lokale Test reproduziert diesen Zustand mit der bisherigen Logik.
2. Die tatsächlich für Web ausgewählte `EmployeePortalVisitExecutionScreen.web.tsx` rendert während des ersten Einsatzladens einen direkten Loader und gleichzeitig `LoadingState`. Letzterer öffnet über `GlobalWorkflowFeedback` einen weiteren Loader. Der Webpfad verwendet nun einen einzigen Ladezustand. Das Default-/Native-Gegenstück wird nicht ersetzt.
3. Die Hintergrundsperre wird nun gemeinsam nach ihren noch laufenden Besitzern verwaltet. Erst der letzte Abschluss stellt den ursprünglichen Zustand wieder her. Wiederholtes Cleanup kann keine fremde Sperre lösen; vorhandenes `inert` bleibt erhalten. Nur die oberste noch verbundene Ladeebene fängt Tastatureingaben ab. Ladehosts werden nicht gegenseitig inert gesetzt.
4. Eine scrollende Mitarbeitenden-Seite verwendet ihre natürliche Inhaltshöhe statt mehrerer ineinanderliegender `flex:1`-Füllflächen. `EmployeePortalPageFrame` erhält den tatsächlichen Scrollmodus; Surface und Inhaltszone füllen nur dort die Höhe, wo der Inhalt einen begrenzten eigenen Viewport besitzt. Die Abstände und das aktuelle Design bleiben erhalten. Diese natürliche Höhe wird nur für Web ausgewählt; sonstige Zonen behalten den bisherigen Standard `fill=true`.

Die Korrektur lässt geschützte Schreibvorgänge weiterhin blockieren, solange sie tatsächlich laufen. Sie setzt keine Unterschrift, keinen Einsatzstatus und keine Serverquittung künstlich auf Erfolg.

## Nachweise und Grenzen

- 13/13 gezielte Node-Prüfungen des tatsächlichen Produktionshelpers bestanden. Geprüft werden überlappende Abschlüsse einschließlich aller sechs Reihenfolgen bei drei Ladefenstern, bestehende Sperren, wiederholtes Cleanup, entfernte Hosts und getrennte Dokumente.
- `git diff --check` ist sauber. Die React-Änderungen wurden auf stabile Komponenten, Effekt-Cleanup, Rollen-/Fokusverhalten und die Web-/Native-Auswahl geprüft.
- Die Videoauswertung zeigt rund 13 Sekunden blockierendes Portal-Laden nach der Anmeldung und rund 11 Sekunden bei der Rückkehr. Die Dauer der Datenabfragen selbst wird durch diesen Fix nicht als behoben behauptet.
- Das frühere Ergebnis mit 5.509 Tests wird nicht für diesen neuen Hotfix wiederverwendet. Der wiederhergestellte Checkout enthält keine installierten Projektabhängigkeiten; ein lokaler vollständiger Vitest-/TypeScript-/Expo-Lauf wurde deshalb nicht durchgeführt. Keine zusätzliche Software oder Testinfrastruktur wurde installiert.
- Die zusätzliche isolierte Browserprobe wurde von der Cloud-Browser-URLrichtlinie beim lokalen `file://`-Aufruf abgewiesen. Es wurde kein Umweg verwendet. Die erstellte Fixture ist kein Browsernachweis.
- Angemeldeter aktueller Portalablauf und echte Safari-Touchbedienung bleiben gesondert zu prüfen. Die DOM-Doubles belegen die Sperrlogik, keine optische oder Geräteabnahme.

Der aktuelle Produktivstand wurde laut Vercel um 15:30 Uhr deutscher Zeit bereitgestellt. Das Video zeigt die Gerätezeit 15:01–15:02. Der konkrete geladene Commit ist im Video nicht ausgewiesen; er wird nicht aus der Uhrzeit als sicher abgeleitet. Die hier geprüfte Fehlerstelle besteht im aktuellen Quellstand.

Keine Produktion geändert, keine Migration, keine Konten-/Geschäftsdatenmutation und kein Play-Store-Update. Maschinenlesbare Prüfdaten: `mobile-web-scroll-lock-verification-20261012.json`.

## Speicherung und Freigabe

Beim ersten Versuch wurde der GitHub-Push von der automatischen Freigabeprüfung wegen fehlender ausdrücklicher Veröffentlichungsfreigabe abgelehnt. Bis dahin blieb der Hotfix lokal.

Der Nutzer hat am 12. Oktober 2026 mit „alles push und deploy“ die Veröffentlichung der fertigen Änderungen einschließlich Prüfbericht ausdrücklich beauftragt. Das bestätigte Ziel ist das öffentliche Repository `caresuiteapp/caresuiteplus-app`, Produktionsbranch `main`, und das bestehende Vercel-Projekt `caresuiteplus-app` (`prj_SYwNxpMWgG80kenkOJQIjuBJldp8`) mit `www.caresuiteplus.app`.

Der Veröffentlichungsstand umfasst ausschließlich die neun Dateien dieses aktuellen Web-Hotfixes. PR #49 auf der älteren Android-Releasebasis bleibt ein gesonderter Entwurf mit dokumentierten offenen Serververträgen. Migrationen und Play-Store-Veröffentlichung sind nicht Teil dieses Hotfixes. Beim Erstellen dieses Prüfberichts stehen Push, Vercel-Build und Produktionsprüfung noch bevor; ihre Ergebnisse werden über den zugehörigen PR und die Deployment-Prüfungen des veröffentlichten Commits belegt.
