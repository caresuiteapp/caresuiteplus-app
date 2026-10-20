# Systemmail, Verwaltungs-Passwortreset und öffentlicher Support

Eine erfolgreiche öffentliche Firmenregistrierung erzeugt einen dauerhaften Versandauftrag für das neue Administrationskonto. Die Registrierungsfunktion startet den Versand im Hintergrund; der zusätzliche Worker übernimmt fällige Wiederholungen. Die Nachricht enthält das originale CareSuite-Logo, den winkenden Neo aus der bestehenden Landingpage, eine persönliche Begrüßung, Unternehmensname, Benutzername, Anmelde-E-Mail, Login-Button, drei Einstiegsschritte und den bestehenden Supportkontakt `caresuiteapp@gmail.com`.

Das selbst gewählte Passwort, Authentifizierungstokens und temporäre Codes werden weder in die Willkommensmail übernommen noch in der Versandtabelle gespeichert. Die Nachricht bestätigt die Registrierung und behauptet keine Verifikation der E-Mail-Inhaberschaft. Bestehende Android-Bildschirme und der Registrierungsvertrag bleiben erhalten. Das öffentliche Formular verwendet die vorhandene Webroute `app/support/index.web.tsx`; die native Route `app/support/index.tsx` bleibt unverändert.

Alle automatischen Nachrichten verwenden den Anzeigenamen **CareSuite HealthOS System**. Der vorgesehene Absender ist `no-reply@caresuiteplus.app`; er muss im bestehenden Versanddienst freigegeben werden. `Reply-To` zeigt ebenfalls auf die No-Reply-Adresse, niemals auf das persönliche/Supportpostfach. HTML und Klartext enthalten „Bitte antworten Sie nicht auf diese E-Mail“ und verweisen auf das öffentliche Supportformular. Header kennzeichnen die Nachricht als automatisch erzeugt und unterdrücken automatische Antworten, soweit der Empfänger diese Header unterstützt.

## Verhalten

- Registrierung und Versandauftrag werden in derselben Datenbanktransaktion gespeichert. Ein fehlender Mailanbieter verhindert keine erfolgreiche Registrierung; der Auftrag wartet auf die konfigurierte Versandverbindung.
- Nur neu angelegte Firmenkonten erzeugen Aufträge. Wiederholte RPC-Antworten erzeugen keine weiteren Unternehmen oder Nachrichten. Bestehende Konten werden nicht nachträglich angeschrieben.
- Ein unmittelbarer Versandversuch läuft über `EdgeRuntime.waitUntil`. Der minutengenaue Datenbank-Scheduler verarbeitet offene Aufträge auch ohne geöffneten Browser.
- Der Worker prüft vor dem Versand das aktuelle Auth-Konto, den aktiven Eigentümerdatensatz, dessen E-Mail und das aktive Unternehmen. Geänderte, gesperrte oder gelöschte Konten werden nicht an eine alte Adresse angeschrieben.
- Fünf Minuten gültige Bearbeitungssperren verhindern parallele Sendungen. Vorübergehende Fehler erhalten bis zu acht Versuche mit ansteigenden Wartezeiten. Resend verwendet dabei denselben Idempotenzschlüssel; unbestätigte Sendungen werden höchstens innerhalb von 23 Stunden erneut versucht.
- SendGrid hat keinen vergleichbaren Idempotenzschutz. Unbestätigte Transportfehler und abgelaufene laufende SendGrid-Aufträge werden zur Prüfung angehalten, damit ein bereits angenommener Auftrag nicht automatisch doppelt gesendet wird.
- `sent` bezeichnet die Annahme durch den Mailanbieter. Es ist kein Nachweis für den Eingang im Postfach. Bounces/Spamfilter werden über den verwendeten Mailanbieter geprüft.
- Die Versandtabelle und sämtliche Worker-RPCs sind für `anon` und `authenticated` gesperrt. Der Scheduler verwendet einen eigenen zufälligen Token in Vault. Kein Service-Role-Schlüssel steht in einer Frontend-Datei oder im Cron-Auftrag.

## Versandkonfiguration

Die Konfiguration liegt ausschließlich in den serverseitigen Edge-Function-Secrets. Bestehende Resend- oder SendGrid-Zugangsdaten können wiederverwendet werden.

| Secret | Zweck |
| --- | --- |
| `RESEND_API_KEY` | Resend-Versand; bevorzugt, falls vorhanden |
| `SENDGRID_API_KEY` | Alternativer SendGrid-Versand |
| `REGISTRATION_EMAIL_FROM` | Ausschließlich verifizierter No-Reply-Absender; vorgesehen: `no-reply@caresuiteplus.app`. Anzeigename wird vom System gesetzt. |
| `REGISTRATION_SUPPORT_EMAIL` | Separater Kontakt im Inhalt, niemals Reply-To; Standard: `caresuiteapp@gmail.com` |
| `REGISTRATION_APP_URL` | Optionaler HTTPS-Ursprung für die Links; Standard: `https://www.caresuiteplus.app` |

Es gibt bewusst keinen Fallback auf Dokumenten- oder persönliche Absender. Ohne expliziten No-Reply-Absender bleibt die Willkommensmail in der Warteschlange. Eine bereits vorhandene Resend-/SendGrid-Verbindung kann verwendet werden; es wird keine neue Mitgliedschaft eingerichtet. Die No-Reply-Empfangsadresse muss beim Mailserver abgelehnt werden, ohne Catch-all-Weiterleitung an ein persönliches oder Supportpostfach. Ein E-Mail-Client kann den Antwort-Button trotzdem anzeigen: Die tatsächliche Ablehnung erfolgt beim empfangenden Mailserver, nicht durch HTML oder `Reply-To`. Diese Empfangskonfiguration und die Absender-Freigabe sind noch nicht bestätigt.

## Passwort vergessen – ausschließlich Verwaltung

`/auth/forgot-password` fordert einen Rücksetz-Link über `business-password-recovery` an. Die neue Web-Service-Datei verwendet den alten allgemeinen Auth-Reset und den lokalen Recovery-Bridge-Workaround nicht. Die Route bleibt auch bei einer vorhandenen Sitzung zugänglich. Fehler erhalten die eingegebene E-Mail-Adresse; die Rückmeldung verrät nicht, ob eine Adresse registriert ist.

Der serverseitige Lookup akzeptiert nur aktive Profile in aktiven/Trial-Unternehmen mit einer Verwaltungsrolle (`owner`, `admin` oder den definierten internen Verwaltungsrollen). `employee_portal`, `client_portal`, `family_portal`, gesperrte Konten und nicht zugewiesene Alt-Eigentümer sind ausgeschlossen. Die aktuelle Auth-ID, E-Mail, Löschung und Sperre werden separat geprüft. Der Service-Role-Schlüssel und Benutzer-Metadaten gelangen nicht in den Browser und steuern keine Rollenentscheidung.

Supabase Auth erzeugt einen einmaligen Recovery-Token; die Systemmail enthält den Link `/auth/reset-password#token_hash=…&type=recovery`. Der Browser hält den Wert nur im Speicher und entfernt das Fragment aus der Adresszeile. Erst beim Speichern prüft ein separater serverseitiger Auth-Client den Token mit `type: recovery`. Anschließend werden Konto und Verwaltungsrolle erneut geprüft. Nur die durch den Token bestätigte Auth-ID erhält das neue Passwort; eine im Body eingesandte Ziel-ID wird ignoriert. Passwörter müssen übereinstimmen und 10 bis 128 Zeichen lang sein.

Vor der Änderung werden vorhandene Refresh-Sitzungen global widerrufen; bereits ausgegebene Access-JWTs können bis zu ihrer normalen Ablaufzeit gültig bleiben. Die Auth-Verifikation verwendet ausdrücklich einen anderen Client als der Service-Client. Im Formular werden die Passwortfelder nur nach bestätigtem Erfolg geleert. Abgelaufene oder bereits verwendete Links benötigen eine neue Anforderung. Die Gültigkeitsdauer kommt aus der bestehenden Supabase-Auth-Konfiguration. Ein Mail-Scanner kann den Link besuchen, ohne den Token zu verbrauchen, da die Prüfung erst mit dem neuen Passwort erfolgt.

## Öffentlicher Support ohne Login

`/support` ist eine vollständige öffentliche Web-Seite und keine Verwaltungs-Popup-Route. Name, Kontakt-E-Mail, optionales Unternehmen, Thema, Betreff und Nachricht werden über `public-support-ticket` eingereicht. Datenschutzhinweise werden bestätigt; das Formular enthält Eingabegrenzen, einen versteckten Bot-Köder und serverseitige Limits. Es gibt hier keine Datei-Uploads und keinen Zugriff auf bestehende Unternehmen oder Klientendaten.

Die Edge Function speichert einen eigenen `public_support_tickets`-Datensatz und gibt erst nach bestätigter Speicherung eine Referenz `PUB-…` zurück. Bei Fehlern bleiben die Eingaben erhalten. Dieselbe Client-Nonce und derselbe Inhalt ergeben nach einem verlorenen Rückkanal dieselbe Referenz; eine wiederverwendete Nonce mit geändertem Inhalt ist gesperrt.

In der Plattform-Konsole unter Support gibt es die Eingänge **Unternehmenstickets** und **Öffentliche Anfragen**. Berechtigte Support-Mitarbeitende lesen Kontaktangaben und Beschreibung, antworten separat an die Kontaktadresse und setzen Offen/In Bearbeitung/Gelöst/Geschlossen. Es wurde kein automatischer Antwortversand im Namen eines Mitarbeitenden eingerichtet. Reguläre Unternehmensbenutzer und anonyme Besucher können diese Anfragen weder lesen noch ändern. Schreibrechte betreffen ausschließlich Status und Änderungszeit; RLS und Capability-Prüfungen sichern diese Trennung ab.

Eine private Limittabelle speichert nur gehashte Schlüssel und Zeitfenster, keine Roh-IP-Adressen, Passwörter oder Reset-Token. Pro 15-Minuten-Zeitfenster gelten für den öffentlichen Support drei neue Tickets je E-Mail/zehn je IP, für Reset-Anforderungen fünf je E-Mail/zwanzig je IP. Empfangsbestätigungen bereits gespeicherter Tickets bleiben auch nach Erreichen des Limits abrufbar, wenn die nicht erratbare Client-Nonce und derselbe Anfrageinhalt vorliegen. Die IP wird ausschließlich aus den vom Hosting-Proxy bereitgestellten Headern gelesen, nicht aus Formularfeldern. Die Proxy-Konfiguration muss bei der Live-Prüfung bestätigt werden.

## Aktivierungsreihenfolge

1. Die drei neuen SQL-Dateien prüfen und gezielt in dieser Reihenfolge anwenden: `20261006063320_registration_welcome_outbox.sql`, danach `20261006063341_registration_welcome_scheduler.sql`, danach `20261006063422_public_access_support_and_business_recovery.sql`. Keine ungeprüfte Sammelanwendung anderer ausstehender Migrationen.
2. Server-Secrets für den bestehenden Mailanbieter und den verifizierten Absender prüfen/setzen. API-Schlüssel gehören nicht in Chatnachrichten, öffentliche Quelltexte oder Shell-Beispiele mit Klartextwerten.
3. Die vier betroffenen Edge Functions einschließlich aller referenzierten Shared-Dateien aus demselben Commit deployen: `registration-welcome-dispatch`, `register-business-tenant`, `business-password-recovery`, `public-support-ticket`. `verify_jwt=false` erhält den öffentlichen Formulareingang; der Worker akzeptiert ausschließlich seinen eigenen Scheduler-Token. Die Recovery-Verifikation verwendet die integrierten serverseitigen `SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY`.
4. Nach Deployment und Konfiguration einmal im SQL-Editor als Datenbankadministrator ausführen, mit der zum Zielprojekt gehörenden URL:

   ```sql
   SELECT registration_mail_private.configure_registration_welcome_scheduler('https://<projekt-ref>.supabase.co');
   ```

   Die Funktion legt den Token intern an und aktiviert genau einen Cron-Auftrag. Bei erneutem Aufruf wird der Token rotiert. Die Migration allein aktiviert keinen Job.
5. Die Webänderung einschließlich `/support`, beider Passwortseiten und der Konsolen-Erweiterung veröffentlichen. Die Erfolgsmeldung der Registrierung zeigt die angekündigte Willkommensmail nur bei bestätigtem Versandauftrag. Der Export-Audit prüft zusätzlich, dass die drei öffentlichen Zielrouten mit dem Anwendungsstart konsistent erzeugt werden.
6. No-Reply-Empfang beim Mailserver prüfen: keine Inbox, keine Catch-all-Weiterleitung, keine automatische Konversationsantwort. Die Sperre der Empfangsadresse ist durch dieses Code-Paket allein nicht gesetzt.
7. Einen vollständig autorisierten Registrierungs-, Passwort- und Tickettest in der vorgesehenen Testumgebung durchführen. Für den Produktionstest keine erfundenen Unternehmen, Konten oder Klientendaten anlegen.

Der Worker ist nicht als öffentliches „Mail an beliebige Adresse senden“-API verwendbar. Er verarbeitet ausschließlich bereits gespeicherte Registrierungsaufträge; der HTTP-Body kann Empfänger und Zugangsdaten nicht überschreiben.

## Vorschau und Prüfung

Vorschau mit dem vorhandenen Projektwerkzeug erzeugen:

```bash
node scripts/preview-registration-welcome-email.mjs --output /gewünschter/ausgabeordner
```

Die HTML-Datei enthält erkennbare Beispieldaten; produktive Nachrichten verwenden die tatsächlichen Kontodaten. Die zweite Datei mit langen Angaben dient der Layoutprüfung, die zusätzliche Passwortmail-Vorschau verwendet ausdrücklich einen ungültigen Beispiellink. Die E-Mail verwendet Tabellen, überwiegend Inline-Stile, Bildschirmbreiten-Regeln, Alt-Texte und eine vollständige Klartextalternative. Logo und Neo werden bytegenau aus den vorhandenen offiziellen PNG-Dateien eingebunden. Die Vorschau enthält eigenständige Data-URLs; echte Mails enthalten die PNG-Daten als CID-Inline-Anhänge. Keine dieser Bildflächen hängt mehr vom Nachladen externer URLs ab.

130 relevante Prüfungen in 16 Testdateien sind bestanden. Funktionsnachweis: PostgreSQL/PGlite-Tests für Registrierung, atomare Speicherung, Wiederholungen, Sperrzeiten, Abbruchbedingungen, Verwaltungsrollen, Gast-/Supportrechte, Ticket-Nonce und Limits; Worker-, Recovery- und Transporttests mit simulierten Antworten; Interaktionstests für die neuen Formulare und den Konsoleneingang; bestehende Registrierungs- und Webabläufe; gezielte strenge TypeScript-Prüfung der geänderten Edge-Dateien. SHA-256-Prüfungen belegen die unveränderten originalen Bilddaten. Die React-Oberflächen wurden auf Fehlerzustände, Eingabesicherung, Request-Reihenfolge, Zugänglichkeit und Abhängigkeiten durchgesehen. DOM-Tests belegen keine optische Fehlerfreiheit. Der Scheduler-Test führt die echte Anwendungs-SQL mit expliziten Vault-/Cron-/HTTP-Adaptern aus; er belegt keinen tatsächlich laufenden gehosteten Cron-Dienst.

Der Routenfix entfernt die versehentlich angelegten flachen Dateien `app/support.tsx` und `app/support.web.tsx`. Die vorhandene Webroute exportiert das öffentliche Formular ohne Authentifizierungskontext. `scripts/audit-public-access-routes.mjs` verwendet die installierte Expo-Routenauflösung und HTML-Exportberechnung für `/support`, `/auth/forgot-password` und `/auth/reset-password`; die Prüfung läuft im bestehenden Vercel-Preflight. Die Tests reproduzieren den gemeldeten Routenkonflikt und bestätigen die korrigierte Web-/Android-Zuordnung sowie `support/index.html` als Exportdatei. Der vollständige gehostete Web-Build muss nach dem Fix-Commit erneut erfolgreich durchlaufen.

Offene Nachweise: tatsächlicher Mailanbieter-Absender/Secret-Konfiguration, No-Reply-Empfangssperre, gehosteter Cron-Betrieb, echte Mail-Eingänge, produktiver Recovery-Token-Lebenszyklus, Proxy-Limits und Darstellung in Gmail/Outlook bzw. öffentliche Formulare auf Desktop/Smartphone. Die Browserprüfung lokaler HTML-Dateien war in dieser Arbeitsumgebung durch die Browser-URL-Richtlinie gesperrt; eine visuelle Freigabe wird deshalb nicht behauptet. Die vollständige bestehende Projekt-TypeScript-Prüfung überschritt das verfügbare Node-Heap-Limit; die gezielte Prüfung der betroffenen Edge-Dateien war erfolgreich. Die Änderungen sind vor einer ausdrücklich freigegebenen Aktivierung nicht als live zu bezeichnen. Der GitHub-Connector verweigerte bereits das Anlegen eines Branches mit HTTP 403; das Download-Skript bereitet deshalb das vollständige Paket in einer getrennten lokalen Arbeitskopie vor und veröffentlicht es nicht automatisch.

Technische Referenzen: [Supabase – E-Mail aus Edge Functions](https://supabase.com/docs/guides/functions/examples/send-emails), [Supabase – Hintergrundaufgaben](https://supabase.com/docs/guides/functions/background-tasks), [Supabase – geplante Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [Supabase – Recovery-Link generieren](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [Supabase – Token prüfen](https://supabase.com/docs/reference/javascript/auth-verifyotp), [Resend – Idempotenzschlüssel](https://resend.com/docs/dashboard/emails/idempotency-keys), [Resend – offizielles CID-Beispiel](https://github.com/resend/resend-examples/blob/main/astro-resend-examples/typescript/src/pages/api/send-cid.ts), [SendGrid – Mail Send](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send), [RFC 3834 – automatische E-Mails](https://www.rfc-editor.org/rfc/rfc3834.html).
