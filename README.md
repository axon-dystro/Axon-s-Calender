# Axons Kalender

Ein eigenständiges, vollständig in Foundry VTT 14 konfigurierbares Fantasy-Kalender-Modul. Jeder GM kann einen persönlichen Weltkalender bauen, ohne JavaScript, CSS oder JSON bearbeiten zu müssen. Der ursprüngliche Illidor-Kalender ist als fertiges Preset enthalten.

> **Technischer Hinweis:** Die interne Modul-ID bleibt `illidor-calendar`. Dadurch werden beim Update von Version 0.1 bestehender Kalenderstand, Ereignisse, Spielernotizen und die private GM-Planung weitergefunden.

## Das ist enthalten

- visueller GM-Kalender-Designer direkt in den Moduleinstellungen
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

1. Aktiviere **Axons Kalender** in der Welt.
2. Öffne **Spieleinstellungen → Moduleinstellungen → Axons Kalender konfigurieren**.
3. Passe Struktur, Monde, Tagesphasen und Modulschalter an.
4. Speichere. Verbundene Spieler erhalten den neuen Kalender sofort.

Der Kalender öffnet standardmäßig mit **K**. Die Tastenkombination kann in Foundrys Tastenbelegung geändert werden. Die ausgeklappte Uhr wird am Griff, die kompakte Kristallansicht direkt am Kristall frei über den Bildschirm gezogen. Ihre Bildschirmmitte bleibt beim Ein- und Ausklappen erhalten. Ein Rechtsklick setzt die Position zurück.

Beim Erstellen einer Spielernotiz kann unter **Sichtbarkeit** zwischen **Privat · nur für mich** und **Geteilt · für alle Spieler** gewählt werden. Der Ersteller kann seine geteilte Notiz weiter bearbeiten oder löschen; der GM darf sie moderieren. Andere Spieler können sie lesen, aber nicht verändern.

## Datenspeicherung und Privatsphäre

- Kalenderdefinition, aktueller Zeitpunkt und öffentliche Ereignisse: Foundry World Settings
- private und geteilte Spielernotizen: Flag des jeweiligen Foundry-Benutzers; private Einträge werden nur dem Besitzer angezeigt
- geheime GM-Planung: versteckter JournalEntry mit GM-only-Berechtigung
- Exportdateien enthalten Struktur, aktuellen Zeitpunkt und Modulschalter, aber **keine** Ereignisse oder privaten Notizen
- keine Cloud, kein Tracking und kein externer Account

## Zeit und Szenen

Mit **Foundry-Weltzeit mitführen** bewegt die Kristall-Uhr Foundrys `game.time` mit. Änderungen anderer Zeitmodule überschreiben Axons Kalender absichtlich nicht automatisch. So entstehen keine Rückkopplungsschleifen zwischen mehreren Zeitmodulen.

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
