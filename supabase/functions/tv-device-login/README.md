# TV-/Web-Anmeldung mit Handyfreigabe

Diese Funktion implementiert eine kurzlebige Gerätefreigabe für `administration`, `employee` und `client`. Der QR-Code enthält ausschließlich den zufälligen `userCode`. Das separate `deviceSecret` verbleibt im ursprünglichen Browser. Sitzungstoken, Passwörter und Geräteschlüssel gehören niemals in URLs, QR-Codes, Logs oder Analytics.

## Produktiver Bereitstellungsstand

Am 1. Oktober 2026 auf `euagyyztvmemuaiumvxm` eingerichtet: Migration `20261001002430_tv_device_login_pairing`, Edge Function `tv-device-login` Version 2, Status `ACTIVE`. Version 2 korrigiert die Auswertung bestehender Verwaltungszugänge und des Mandantenstatus `trial`. Tabellen-/RPC-Rechte wurden per Metadatenabfrage geprüft. Der ursprüngliche Web-Ablauf ist veröffentlicht; das ergänzende Layout-Update und ein erfolgreicher echter Zwei-Geräte-Anmeldedurchlauf stehen noch aus.

## Bereitstellung auf weiteren Umgebungen und Voraussetzungen

1. `supabase/sql/tv_device_login.sql` auf der vorgesehenen Supabase-Umgebung prüfen und anwenden; anschließend nach dem vorhandenen Projektverfahren in die Migrationshistorie übernehmen. Auf Produktion ist dieser Schritt bereits erfolgt; dort nicht erneut ausführen. Die vom Server erzeugte Migrationsversion ist im Repository enthalten.
2. Die Edge Function `tv-device-login` mit ihren lokalen Dateien und den vorhandenen Abhängigkeiten `_shared/crypto.ts`, `_shared/http.ts` und `_shared/portalAuth.ts` bereitstellen. In `supabase/config.toml` steht `verify_jwt = false`, weil die Anforderung eines neuen QR-Codes und dessen Statusabfrage ohne bereits angemeldeten Benutzer funktionieren müssen. Freigeben/Ablehnen prüft die Benutzersitzung innerhalb der Funktion mit `auth.getUser()` und der aktuellen Auth-Sitzung in der Datenbank.
3. Die bestehenden serverseitigen Variablen `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` müssen wie bei den Portal-Login-Funktionen verfügbar sein. Sie gehören ausschließlich in die Funktionsumgebung. `TV_DEVICE_LOGIN_ALLOWED_ORIGINS` ist optional; Standard sind `https://www.caresuiteplus.app` und `https://caresuiteplus.app`. Weitere Test-Ursprünge bei Bedarf explizit konfigurieren, keine Wildcard.
4. Web-Frontend erst zusammen mit dem eingerichteten Backend veröffentlichen und danach einen echten Ablauf mit dafür freigegebenen Testkonten je Rolle prüfen. Ein Web-Deploy allein richtet die Tabelle und Funktion nicht ein.

Benötigte bestehende Datenstruktur: `profiles` einschließlich `is_active`, `status`, `tenant_id`, `role_id`, `mfa_enabled`; `roles`; `tenant_users`; `tenants.status`; `platform_tenants`; `employee_portal_accounts`; `client_portal_access` einschließlich `two_factor_enabled`; `portal_sessions`; `auth.sessions` einschließlich `not_after`; sowie die bestehenden Portal-Auth-Verknüpfungen. Fehlende Tabellen, Spalten oder Berechtigungen führen zu einer verweigerten Freigabe, nicht zu einem reduzierten Sicherheitscheck.

## HTTP-Vertrag

Alle Aktionen sind `POST` mit JSON an `/functions/v1/tv-device-login`. Antworten tragen `Cache-Control: no-store`. Fehler: `{ok:false, code, error}` mit passendem HTTP-Status.

| Aktion | Eingabe zusätzlich zu `action` | Erfolgsantwort zusätzlich zu `ok:true` |
| --- | --- | --- |
| `create` | `role` | `id`, `deviceSecret`, `userCode`, `verificationCode`, `expiresAt` |
| `inspect` | `userCode` | `role`, `status`, `verificationCode`, `expiresAt` |
| `approve` / `deny` | `userCode`, `verificationCode`, `confirmed:true`, bei Portalen zusätzlich `portalSessionToken`; gültiger Benutzer-Bearer-Token im Header | `role`, `status`, `expiresAt` |
| `poll` | `id`, `deviceSecret` | `role`, `status`, `expiresAt` |
| `consume` | `id`, `deviceSecret` | `role`, `status:'consumed'`, `supabaseAccessToken`, `supabaseRefreshToken`, bei Portalen zusätzlich `portalSession` |
| `cancel` | `id`, `deviceSecret` | `role`, `status`, `expiresAt` |

Statuswerte: `pending`, `approved`, `consumed`, `denied`, `expired`, `cancelled`, `failed`. `inspect` legt keine Konto-/Personeninformationen offen. Die sechsstellige `verificationCode` dient dem sichtbaren Abgleich mit dem eigenen Bildschirm; der Zugriff auf eine Freigabe verwendet den separaten kryptografisch zufälligen `userCode`.

## Sicherheitsverhalten

- Fünf Minuten Gültigkeit. Rolle bei Erstellung unveränderlich. Einmalige Freigabe und einmaliger Bezug werden über bedingte Datenbank-Updates atomar erzwungen.
- Datenbank speichert nur gehashte Benutzer-/Gerätecodes und die genehmigende Identität/Sitzungs-ID. Neue Zugangstoken werden erst nach erfolgreichem Claim erstellt und nur in der Antwort zurückgegeben.
- Bei Mitarbeiter- und Klientenportal werden sowohl die aktuelle Auth-Sitzung als auch die aktive Portalsitzung, Kontoverknüpfung, Rolle und Mandant geprüft. Das TV-Gerät erhält eine neue eigene Portalsitzung und eine neue Supabase-Sitzung. Die Sitzung des Handys wird nicht kopiert.
- Vor und nach der Ausstellung werden Kontosperren, Mandantensperren, Rollen-/Verknüpfungsänderungen und die Herkunftssitzung erneut geprüft. Fehler nach Ausstellung führen zur bestmöglichen Rücknahme der neu erzeugten Sitzung.
- Mandanten mit Status `active` oder `trial` können die Gerätefreigabe verwenden. `paused`, `cancelled` und `locked` bleiben gesperrt; zusätzliche Plattform-Sperren gelten weiterhin. Ein altes Profil mit Status `invited` wird nur akzeptiert, wenn es aktiv ist, die serverseitig geprüfte Auth-E-Mail bestätigt wurde und ein aktives verwaltetes Konto desselben Mandanten mit ausdrücklich abgeschlossener Passwortpflicht vorliegt. Profilstatus `inactive` und `locked` sowie gesperrte verwaltete Konten werden dadurch nicht überstimmt.
- Unvollständige Mitarbeiter-Erstanmeldung wird abgewiesen. Bei vorhandener verifizierter MFA, AAL2, unbekanntem Assurance-Level oder aktiven App-MFA-Schaltern (`profiles.mfa_enabled`, `client_portal_access.two_factor_enabled`) gibt es keinen QR-Transfer; die direkte Anmeldung mit der vorgesehenen Sicherheitsprüfung bleibt notwendig. Ein Magic-Link-Grant darf keine MFA-Anforderung auf AAL1 herabsetzen.
- Wenn die Antwort nach erfolgreicher Erstellung verloren geht, kann derselbe QR-Code keine zweite Sitzung erzeugen. Der Benutzer muss einen neuen QR-Code anfordern.
- Aktuelle Quoten: 20 Neuanforderungen je IP/5 Minuten, 60 Handyaktionen je IP/5 Minuten, 2400 Bildschirmaktionen je IP/5 Minuten und 150 Status-/Bezugsaktionen pro Gerät/5 Minuten. Der Client muss Statusabfragen begrenzen (beispielsweise alle 2,5 Sekunden).
- RLS ist für beide neuen Tabellen aktiv; `anon` und `authenticated` erhalten keine Tabellen- oder RPC-Berechtigungen. Nur der Service-Role-Zugang der Edge Function kann diese bedienen. Der enge Auth-Sitzungsprüfer gibt ausschließlich einen booleschen Wert zurück.
- Aufrufe räumen ausschließlich Datensätze dieses Features auf, deren Gültigkeit seit mehr als einem Tag abgelaufen ist. Bei vollständig ausbleibenden Aufrufen erfolgt keine zeitgesteuerte Bereinigung; für eine streng zeitgebundene Retention ist ein vorhandener Scheduler zusätzlich zu konfigurieren.

## Nachweise und verbleibende Prüfung

`node --test supabase/tests/tv_device_login.test.mjs` führt mit Node 24 die Handler-/Policy-Tests ohne zusätzliche Testpakete aus. Die Tests decken die drei Rollen, explizite Freigabe, falsche Geräteschlüssel, Rollenwechsel, parallelen Bezug, Ablauf, Ablehnung, Abbruch, Quellenwiderruf, Fehler bei der Ausstellung, Kontosperren, Mandantensperren, MFA und Erstanmeldung ab.

Diese Tests verwenden einen injizierten Speicher/Issuer. Sie belegen nicht die tatsächlichen Supabase-Tabellenrechte, die GoTrue-Konfiguration oder einen Ablauf zwischen zwei echten Browsergeräten. Die SQL-Datei und Funktion wurden inzwischen produktiv bereitgestellt und die Tabellen-/RPC-Rechte geprüft; eine echte Sitzungsausstellung wurde noch nicht durchgeführt. Nach Bereitstellung sind die tatsächlichen Rechte sowie ein freigegebener Ende-zu-Ende-Test einschließlich Abbruch/Ablauf, zweimaligem Bezug und MFA-Ablehnung nachzuweisen.
