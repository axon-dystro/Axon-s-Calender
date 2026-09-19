import test from "node:test";
import assert from "node:assert/strict";

import { createBlankPreset, ILLIDOR_PRESET, NEUTRAL_PRESET, normalizeCalendarConfig } from "../scripts/calendar-config.js";
import {
  absoluteMinute,
  advanceDay,
  dateToOrdinal,
  formatTime,
  moonState,
  normalizeDate,
  ordinalToDate,
  phaseForMinute,
  retreatDay,
  sameDate,
  stateFromAbsoluteMinute,
  weekdayName
} from "../scripts/calendar-engine.js";

const illidor = normalizeCalendarConfig(ILLIDOR_PRESET);

test("Illidors gespeicherter Starttag bleibt Silda", () => {
  const date = { year: 278, season: 5, month: 2, day: 10 };
  assert.equal(weekdayName(date, illidor), "Silda");
});

test("am Monatsende folgt der nächste Monat", () => {
  assert.deepEqual(advanceDay({ year: 278, season: 1, month: 1, day: 28 }, illidor), {
    year: 278, season: 1, month: 2, day: 1, specialDay: null
  });
});

test("nach dem dritten Illidor-Monat folgt der Sondertag", () => {
  assert.deepEqual(advanceDay({ year: 278, season: 1, month: 3, day: 28 }, illidor), {
    year: 278, season: 1, month: null, day: null, specialDay: 1
  });
});

test("nach dem sechsten Sondertag beginnt das neue Jahr", () => {
  assert.deepEqual(advanceDay({ year: 278, season: 6, specialDay: 6 }, illidor), {
    year: 279, season: 1, month: 1, day: 1, specialDay: null
  });
});

test("vor dem ersten Jahrestag liegt der Sondertag des Vorjahres", () => {
  assert.deepEqual(retreatDay({ year: 278, season: 1, month: 1, day: 1 }, illidor), {
    year: 277, season: 6, month: null, day: null, specialDay: 6
  });
});

test("Ordinal-Konvertierung ist über alle Illidor-Tage verlustfrei", () => {
  const first = dateToOrdinal({ year: 277, season: 6, month: 3, day: 25 }, illidor);
  for (let ordinal = first; ordinal < first + 540; ordinal += 1) {
    assert.equal(dateToOrdinal(ordinalToDate(ordinal, illidor), illidor), ordinal);
  }
});

test("Mondwende liegt im Illidor-Preset auf Monat 2, Tag 14", () => {
  const moon = moonState({ year: 278, season: 3, month: 2, day: 14 }, illidor);
  assert.equal(moon.turning, true);
  assert.equal(moon.label, "Mondwende");
  assert.ok(moon.illumination < 0.01);
});

test("Sondertage erzwingen im Illidor-Preset Vollmond", () => {
  const moon = moonState({ year: 278, season: 4, specialDay: 4 }, illidor);
  assert.equal(moon.illumination, 1);
  assert.equal(moon.icon, "🌕");
});

test("Zeit kann über Tagesgrenzen vor und zurück gerechnet werden", () => {
  const state = { year: 278, season: 1, month: 1, day: 1, minuteOfDay: 23 * 60 + 55 };
  const later = stateFromAbsoluteMinute(absoluteMinute(state, illidor) + 10, illidor);
  assert.equal(later.minuteOfDay, 5);
  assert.equal(later.day, 2);
  const earlier = stateFromAbsoluteMinute(absoluteMinute(later, illidor) - 10, illidor);
  assert.ok(sameDate(earlier, state, illidor));
  assert.equal(earlier.minuteOfDay, state.minuteOfDay);
});

test("konfigurierbare Tagesphasen und Uhrformat werden verwendet", () => {
  assert.equal(phaseForMinute(21 * 60, illidor).id, "evening");
  assert.equal(formatTime(21 * 60 + 7, illidor), "21:07");
});

test("neutrales Preset und variable Monatslängen funktionieren", () => {
  const custom = createBlankPreset();
  custom.seasons[0].months = [
    { id: "short", name: "Kurzmond", days: 3 },
    { id: "long", name: "Langmond", days: 5 }
  ];
  custom.seasons[0].specialDay.enabled = true;
  const config = normalizeCalendarConfig(custom);
  assert.deepEqual(advanceDay({ year: 1, season: 1, month: 1, day: 3 }, config), {
    year: 1, season: 1, month: 2, day: 1, specialDay: null
  });
  assert.deepEqual(advanceDay({ year: 1, season: 1, month: 2, day: 5 }, config), {
    year: 1, season: 1, month: null, day: null, specialDay: 1
  });
});

test("neue Installationen starten neutral statt mit Illidor", () => {
  const config = normalizeCalendarConfig(NEUTRAL_PRESET);
  assert.equal(config.id, "custom-calendar");
  assert.equal(config.name, "Mein Kalender");
  assert.equal(config.seasons.length, 1);
  assert.equal(config.seasons[0].months.length, 1);
  assert.equal(config.moons.length, 0);
  assert.equal(config.weekdays.includes("Osda"), false);
});

test("Designfarben werden übernommen und ungültige Farben abgefangen", () => {
  const custom = normalizeCalendarConfig({
    ...structuredClone(NEUTRAL_PRESET),
    theme: { primary: "#12abef", secondary: "#fedcba" }
  });
  assert.equal(custom.theme.primary,"#12abef");
  assert.equal(custom.theme.secondary,"#fedcba");
  assert.equal(custom.theme.background,"#171326");
  const safe = normalizeCalendarConfig({ ...structuredClone(NEUTRAL_PRESET), theme: { primary: "red", secondary: "" } });
  assert.equal(safe.theme.primary,"#f06bc7");
  assert.equal(safe.theme.secondary,"#a765ff");
});

test("beschädigte Importwerte werden auf sichere Grenzen normalisiert", () => {
  const config = normalizeCalendarConfig({
    name: "Test",
    weekdays: [],
    seasons: [{ name: "X", months: [{ name: "M", days: -40 }] }],
    phases: [{ id: "x", name: "X", startMinute: 999999 }]
  });
  assert.ok(config.weekdays.length >= 1);
  assert.equal(config.seasons[0].months[0].days, 1);
  assert.ok(config.phases[0].startMinute < config.day.hours * config.day.minutesPerHour);
  assert.deepEqual(normalizeDate({ year: 2, season: 500, month: 500, day: 500 }, config), {
    year: 2, season: 1, month: 1, day: 1, specialDay: null
  });
});
