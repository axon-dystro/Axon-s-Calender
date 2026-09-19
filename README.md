# Axon´s Calender

Ein eigenständiges, vollständig in Foundry VTT 14 konfigurierbares Fantasy-Kalender-Modul. Jeder GM kann einen persönlichen Weltkalender bauen, ohne JavaScript, CSS oder JSON bearbeiten zu müssen. Der ursprüngliche Illidor-Kalender ist als fertiges Preset enthalten.

Neue Welten beginnen mit einem neutralen, technisch funktionsfähigen Rohbau: keine Illidor-Namen, kein Illidor-Mond und nur eine allgemeine Jahreszeit mit einem Monat. Illidor wird ausschließlich geladen, wenn der GM das Preset bewusst auswählt. Bestehende Welten behalten ihre gespeicherte Struktur.

> **Technischer Hinweis:** Die interne Modul-ID bleibt `illidor-calendar`. Dadurch werden beim Update von Version 0.1 bestehender Kalenderstand, Ereignisse, Spielernotizen und die private GM-Planung weitergefunden.

## Das ist enthalten

- visueller GM-Kalender-Designer direkt in den Moduleinstellungen
- frei wählbare Primär- und Sekundärfarbe für Glasflächen, Leuchten, Schalter und Auswahlzustände
- frei viele Wochentage, Jahreszeiten, Monate und individuelle Monatslängen
- optionale Sondertage nach jeder Jahreszeit, auch „zwischen den Jahren“
- Wochenrhythmus pro Jahreszeit, pro Jahr oder endlos fortlaufend
- eigene Stunden- und Minutenlänge für Fantasy-Welten
- frei definierbare Tagesphasen mit Symbol, Farbe, Startzeit und Szenendunkelheit
- beliebig viele Monde mit Zyklus, Versatz, Farbe und eigenen Sondertag-Regeln
- gläserne, frei positionierbare und einklappbare Kristall-Uhr
- Monats-, Jahres- und Agendaansicht
- öffentliche GM-Ereignisse und geheime GM-Planung
- private Spielernotizen sowie von Spielern mit der Gruppe geteilte Notizen
- JSON-Export und -Import der Kalenderstruktur
- feste Links zu Feedback, Support und Unterstützung über `axon.dnd-tools.de`
- optionale Synchronisierung mit Foundrys offizieller Weltzeit
- optionale Anpassung der aktiven Szenenhelligkeit
- einzelne Welt- und Client-Schalter für Performance und Barrierefreiheit

## Illidor-Preset

- 8 Wochentage: Osda, Desda, Troda, Alda, Miéda, Silda, Tokda, Suda
- 6 Jahreszeiten mit je 3 Monaten à 28 Tagen
- ein Sondertag nach jeder Jahreszeit
- der sechste Sondertag liegt zwischen den Jahren
- der Wochenrhythmus beginnt mit jeder Jahreszeit erneut bei Osda
- Mondwende an Tag 14 des zweiten Monats
- Startzustand: Jahr 278 e.e., Jahreszeit 5, Monat 2, Tag 10, später Abend

## Bedienung

1. Aktiviere **Axon´s Calender** in der Welt.
2. Öffne **Spieleinstellungen → Moduleinstellungen → Axon´s Calender konfigurieren**.
3. Passe Struktur, Monde, Tagesphasen und Modulschalter an.
4. Speichere. Verbundene Spieler erhalten den neuen Kalender sofort.

Die beiden globalen Designfarben liegen im Designer unter **Grundlagen → Designfarben**. Änderungen werden während der Auswahl direkt als Vorschau angezeigt und erst mit **Kalender speichern** dauerhaft für die Welt übernommen.

Der Kalender öffnet standardmäßig mit **K**. Die Tastenkombination kann in Foundrys Tastenbelegung geändert werden. Die ausgeklappte Uhr wird am Griff, die kompakte Kristallansicht direkt am Kristall frei über den Bildschirm gezogen. Ihre Bildschirmmitte bleibt beim Ein- und Ausklappen erhalten. Ein Rechtsklick setzt die Position zurück.

Beim Erstellen einer Spielernotiz kann unter **Sichtbarkeit** zwischen **Privat · nur für mich** und **Geteilt · für alle Spieler** gewählt werden. Der Ersteller kann seine geteilte Notiz weiter bearbeiten oder löschen; der GM darf sie moderieren. Andere Spieler können sie lesen, aber nicht verändern.

## Datenspeicherung und Privatsphäre

- vollständige Kalenderdefinition: geschütztes GM-Journal; Spielerprojektion, aktueller Zeitpunkt und öffentliche Ereignisse: Foundry World Settings
- private und geteilte Spielernotizen: Flag des jeweiligen Foundry-Benutzers; private Einträge werden nur dem Besitzer angezeigt
- geheime GM-Planung: versteckter JournalEntry mit GM-only-Berechtigung
- Exportdateien enthalten Struktur, aktuellen Zeitpunkt und Modulschalter, aber **keine** Ereignisse oder privaten Notizen
- keine Cloud, kein Tracking und kein externer Account

## Zeit und Szenen

Mit **Foundry-Weltzeit mitführen** bewegt die Kristall-Uhr Foundrys `game.time` mit. Änderungen anderer Zeitmodule überschreiben Axon´s Calender absichtlich nicht automatisch. So entstehen keine Rückkopplungsschleifen zwischen mehreren Zeitmodulen.

Die Szenenhelligkeit ist standardmäßig ausgeschaltet. Wenn sie aktiviert wird, verwendet jede Tagesphase ihren konfigurierten Dunkelheitswert zwischen 0 und 1 für die aktive Szene.

## Migration von 0.1

Beim ersten Start als GM werden alte Illidor-Namen und der bisherige Kalenderstand automatisch in das neue Datenformat übertragen. Die alte technische Modul-ID bleibt deshalb erhalten.

## API

```js
const api = game.modules.get("illidor-calendar").api;

api.openCalendar();
api.openDesigner();              // GM
api.getConfig();
api.getState();
api.setTime(12 * 60);            // GM, 12:00 bei 60 Minuten/Stunde
api.advanceMinutes(30);          // GM
api.nextDay();                   // GM
api.previousDay();               // GM
api.setPhase("night");          // GM
api.resetHudPosition();
```

## Noch nicht Teil von 1.0

Klima, Wetterzonen und automatische Wettereffekte sind bewusst nicht halb-fertig eingebaut. Das Datenformat enthält bereits einen reservierten Erweiterungsbereich, sodass dieses System später ergänzt werden kann, ohne bestehende Kalender neu anzulegen.

## Entwicklung

```bash
npm test
npm run check
```

Entwicklung: Axon. Technische Umsetzung mit Unterstützung von ChatGPT.

## Erweiterung 1.3 – Weltregeln (Beta)

Im Kalender oben **Weltregeln** öffnen. Der bisherige Designer bleibt für Monatsgruppen,
Monatslängen, Wochentage und tägliche Tagesphasen zuständig; der neue Dialog ergänzt:

- **Sondertage**: eigene Datumskennungen, Platzierung vor einem Monat oder nach einem
  beliebigen regulären Tag. Damit sind auch Wochen-, Monats- und Jahreszeitgrenzen möglich.
  Mehrere Einfügungen am selben Punkt werden in Listenreihenfolge angezeigt. Im Monatsraster
  stehen sie als volle Zeile außerhalb der Wochentagsspalten.
- **Freie Jahreszeiten**: zusätzliche, von Monatsgruppen unabhängige Zeiträume vom ersten
  bis zum letzten Jahrestag (Sondertage mitgezählt). Ein Ende vor dem Beginn überschreitet
  den Jahreswechsel. Überlappende Jahreszeiten sind möglich.
- **Sonne**: vorhandene tägliche Phasen, Tagesregeln oder ein fortlaufender mehrtägiger
  Phasenzyklus. Bei Tagesregeln gewinnt Datum vor Wochentag vor Monat vor Jahreszeit;
  innerhalb derselben Regelart gewinnt die letzte passende Regel. Gleiche Auf- und
  Untergangszeiten bedeuten durchgehende Nacht; ganztägiges Licht ist als individuelle
  Zyklusphase mit Dunkelheit 0 möglich.
- **Timer**: Start-/Endminute, Geschwindigkeit, Spielpause und optionaler Stopp am Ende.
  Rate 1 bedeutet eine Ingame-Minute pro echter Sekunde. Ende ≤ Beginn liegt am Folgetag.
  Start setzt die Uhr auf die Startminute. Nur ein verbundener Haupt-GM führt den Timer
  aus. Beim Neuladen/GM-Wechsel wird er gestoppt; keine Offline-Nachholzeit. Erlaubte
  Spieler können Start/Stopp an diesen GM übergeben.
- **Farben**: Tage, einzelne Wochentage, Wochenüberschriften, Monate, Jahreszeiten,
  Sondertage, Sonnenphasen, Einträge und Kategorien. Drei Theme-Vorlagen und sechs
  globale Designfarben sind verfügbar.
- **Eintragsfarben**: freie Auswahl, Palette, Kategorie oder eine feste Farbe. Verbindliche
  Kategoriefarben überschreiben freie Auswahl; die globale feste Farbe hat höchste Priorität.
  Quest ist standardmäßig blau. Bestehende Kategorien und Datumsfelder bleiben erhalten.
- **Rechte**: GM-Vorgabe, nur ansehen, ändern oder verborgen je Bereich. Änderungen der
  freigegebenen Weltkonfiguration gelten für alle, nicht nur für den betreffenden Spieler.
  Rechte und Farbregeln können ausschließlich GMs ändern. Freigegebene Änderungen laufen
  als Foundry-Benutzerdokument-Update; der Haupt-GM prüft Absender, aktuellen Rechtezustand
  und Konflikte. Es gibt keinen Socket-Befehl, der ungeprüft Weltkonfiguration schreibt.

### Beispiel: Montag bis Donnerstag Sonne

Bei 24 Stunden × 60 Minuten und einem siebentägigen Sonnenzyklus:

| Phase | Beginn seit Zyklusstart | Dunkelheit |
|---|---:|---:|
| Licht | 360 (Montag 06:00) | 0 |
| Nacht | 5400 (Donnerstag 18:00) | 1 |

Der Zyklus beginnt am ersten Kalendertag von Jahr 1 um 00:00. Er läuft über alle
Jahreswechsel hinweg weiter. In diesem Beispiel entspricht der erste Tag Montag;
bei einem anderen Wochenanfang kann der Versatz angepasst werden.

### Datenschutz und Datenbestand

Die vollständige Weltkonfiguration liegt nach dem ersten Speichern in einem nur für GMs
lesbaren Journal. Die Welt-Einstellung enthält die Spielerprojektion. Verborgene Sonnenregeln,
Jahreszeitbereiche und verborgene Namen/Beschreibungen werden darin entfernt oder anonymisiert.
Anonyme Kalendergeometrie (Längen, Einfügepositionen) und sichtbare Farben bleiben für die
Berechnung und Darstellung gemeinsamer Ereignisse auf Spielergeräten verfügbar. „Verborgen“
kann diese notwendigen Informationen nicht zugleich geheim halten. Die öffentliche
Kalenderdarstellung anonymisiert entsprechende Namen. Spieler-Notizen in User-Flags haben
weiterhin die bisherige, oberflächenbezogene Sichtbarkeit; echte GM-Geheimnisse gehören ins
geschützte GM-Journal.

Die interne Modul-ID bleibt `illidor-calendar`. Schema 3 wird beim Lesen verlustfrei um
Standardwerte ergänzt. Sondertage verwenden stabile negative Kennungen; die bisherigen
positiven Sondertagskennungen und regulären Datumsfelder bleiben gültig. Ein Sondertag,
auf dem das aktuelle Datum oder eine Ereignisgrenze liegt, kann nicht entfernt werden,
bevor diese Verweise verschoben wurden. Kalenderexporte enthalten auch die neuen Regeln;
ein GM-Export enthält deshalb gegebenenfalls verborgene Weltdetails.

### Prüfen und verpacken

`npm run check`, `npm test` und `npm run package` prüfen den Quelltext und bauen mit Python 3
`dist/axons-calender.zip` sowie das passende `dist/module.json`. Die ZIP enthält das Manifest
direkt im Stamm. Die Download-URL wird auf den zugehörigen Versions-Tag gesetzt. Diese Dateien
sind erst nach Veröffentlichung beider Assets unter diesem Tag online installierbar.
Der Branch veröffentlicht keinen Release und ändert keine laufende Foundry-Welt.

Vor einem stabilen Release steht ein Test in einer echten Foundry-14-Testwelt aus:
GM plus Spieler verbinden, Rechtewechsel/GM-Wechsel testen, Timer und optionale Szenenhelligkeit
prüfen sowie einen bestehenden Kalender mit Ereignissen importieren. Die automatisierten Tests
ersetzen diesen Integrationstest nicht.
