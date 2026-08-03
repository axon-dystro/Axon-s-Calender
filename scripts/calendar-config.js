import { PHASES } from "./constants.js";
import { DEFAULT_THEME, normalizeTheme } from "./theme.js";

const ILLIDOR_WEEKDAYS = ["Osda", "Desda", "Troda", "Alda", "Miéda", "Silda", "Tokda", "Suda"];

export const ILLIDOR_PRESET = deepFreeze({
  schemaVersion: 3,
  id: "illidor",
  name: "Illidor",
  description: "Axons ursprünglicher Kalender: sechs Jahreszeiten, acht Wochentage und ein Sondertag nach jeder Jahreszeit.",
  eraLabel: "e.e.",
  theme: structuredClone(DEFAULT_THEME),
  weekdays: ILLIDOR_WEEKDAYS,
  week: {
    firstWeekday: 0,
    reset: "season",
    specialDaysAdvance: false
  },
  seasons: Array.from({ length: 6 }, (_, seasonIndex) => ({
    id: `season-${seasonIndex + 1}`,
    name: `Jahreszeit ${seasonIndex + 1}`,
    color: ["#c879ff", "#ed78ce", "#8f8cff", "#67b8ff", "#aa75ff", "#f296d8"][seasonIndex],
    months: Array.from({ length: 3 }, (_, monthIndex) => ({
      id: `season-${seasonIndex + 1}-month-${monthIndex + 1}`,
      name: `Monat ${monthIndex + 1}`,
      days: 28
    })),
    specialDay: {
      enabled: true,
      id: `special-${seasonIndex + 1}`,
      name: `${seasonIndex + 1}. Sondertag`,
      outsideYear: seasonIndex === 5,
      description: seasonIndex === 5
        ? "Dieser Tag liegt zwischen den Jahren. Der Mond ist Tag und Nacht sichtbar."
        : "Dieser Tag liegt außerhalb von Woche und Monat. Danach beginnt die neue Jahreszeit mit Osda."
    }
  })),
  day: {
    hours: 24,
    minutesPerHour: 60,
    stepMinutes: 10,
    nextDayPhaseId: PHASES.MORNING
  },
  phases: [
    { id: PHASES.MORNING, name: "Morgen", startMinute: 6 * 60, icon: "🌅", color: "#ff9acb", darkness: 0.3 },
    { id: PHASES.DAY, name: "Tag", startMinute: 9 * 60, icon: "☀️", color: "#ffd3ef", darkness: 0 },
    { id: PHASES.EVENING, name: "Später Abend", startMinute: 18 * 60, icon: "🌇", color: "#d783ff", darkness: 0.55 },
    { id: PHASES.NIGHT, name: "Nacht", startMinute: 22 * 60, icon: "🌙", color: "#8f72ff", darkness: 0.85 }
  ],
  moons: [
    {
      id: "illidor-moon",
      name: "Illidors Mond",
      cycleDays: 85,
      offsetDays: 1,
      color: "#eadcff",
      fullOnSpecialDays: true,
      alwaysVisibleOnOutsideYear: true,
      turningLabel: "Mondwende"
    }
  ],
  extensions: {
    climate: null
  }
});

export const NEUTRAL_PRESET = deepFreeze({
  schemaVersion: 3,
  id: "custom-calendar",
  name: "Mein Kalender",
  description: "Ein eigener, frei konfigurierbarer Kampagnenkalender.",
  eraLabel: "",
  theme: structuredClone(DEFAULT_THEME),
  weekdays: ["Tag 1", "Tag 2", "Tag 3", "Tag 4", "Tag 5", "Tag 6", "Tag 7"],
  week: {
    firstWeekday: 0,
    reset: "year",
    specialDaysAdvance: false
  },
  seasons: [{
    id: "season-1",
    name: "Jahreskreis",
    color: DEFAULT_THEME.secondary,
    months: [{ id: "month-1", name: "Monat 1", days: 30 }],
    specialDay: {
      enabled: false,
      id: "special-1",
      name: "Sondertag",
      outsideYear: false,
      description: ""
    }
  }],
  day: {
    hours: 24,
    minutesPerHour: 60,
    stepMinutes: 10,
    nextDayPhaseId: PHASES.MORNING
  },
  phases: [
    { id: PHASES.MORNING, name: "Morgen", startMinute: 6 * 60, icon: "🌅", color: "#ff9acb", darkness: 0.3 },
    { id: PHASES.DAY, name: "Tag", startMinute: 9 * 60, icon: "☀️", color: "#ffd3ef", darkness: 0 },
    { id: PHASES.EVENING, name: "Abend", startMinute: 18 * 60, icon: "🌇", color: DEFAULT_THEME.secondary, darkness: 0.55 },
    { id: PHASES.NIGHT, name: "Nacht", startMinute: 22 * 60, icon: "🌙", color: "#7185ff", darkness: 0.85 }
  ],
  moons: [],
  extensions: { climate: null }
});

export function createBlankPreset() {
  return normalizeCalendarConfig(structuredClone(NEUTRAL_PRESET));
}

export function normalizeCalendarConfig(input = NEUTRAL_PRESET) {
  const source = input && typeof input === "object" ? input : {};
  const weekdays = normalizeNames(source.weekdays, NEUTRAL_PRESET.weekdays, 1, 14);
  const seasonsSource = Array.isArray(source.seasons) && source.seasons.length ? source.seasons.slice(0, 24) : NEUTRAL_PRESET.seasons;
  const seasons = seasonsSource.map((season, seasonIndex) => normalizeSeason(season, seasonIndex));
  const hours = clampInt(source.day?.hours, 1, 100, 24);
  const minutesPerHour = clampInt(source.day?.minutesPerHour, 1, 100, 60);
  const minutesPerDay = hours * minutesPerHour;
  const phases = normalizePhases(source.phases, minutesPerDay);
  const moons = normalizeMoons(source.moons);
  const requestedNextPhase = safeId(source.day?.nextDayPhaseId, phases[0].id);

  return {
    schemaVersion: 3,
    id: safeId(source.id, "custom"),
    name: safeText(source.name, "Meine Welt", 80),
    description: safeText(source.description, "", 500),
    eraLabel: safeText(source.eraLabel, "", 24),
    theme: normalizeTheme(source.theme),
    weekdays,
    week: {
      firstWeekday: clampInt(source.week?.firstWeekday, 0, weekdays.length - 1, 0),
      reset: ["season", "year", "never"].includes(source.week?.reset) ? source.week.reset : "year",
      specialDaysAdvance: Boolean(source.week?.specialDaysAdvance)
    },
    seasons,
    day: {
      hours,
      minutesPerHour,
      stepMinutes: clampInt(source.day?.stepMinutes, 1, Math.max(1, minutesPerDay), 10),
      nextDayPhaseId: phases.some((phase) => phase.id === requestedNextPhase) ? requestedNextPhase : phases[0].id
    },
    phases,
    moons,
    extensions: {
      ...(source.extensions && typeof source.extensions === "object" ? structuredClone(source.extensions) : {}),
      climate: source.extensions?.climate ?? null
    }
  };
}

export function validateCalendarConfig(config) {
  const issues = [];
  if (!config.name.trim()) issues.push("Der Kalender braucht einen Namen.");
  if (!config.weekdays.length) issues.push("Mindestens ein Wochentag ist erforderlich.");
  if (!config.seasons.length) issues.push("Mindestens eine Jahreszeit ist erforderlich.");
  for (const season of config.seasons) {
    if (!season.months.length) issues.push(`„${season.name}“ braucht mindestens einen Monat.`);
    for (const month of season.months) {
      if (month.days < 1) issues.push(`„${month.name}“ braucht mindestens einen Tag.`);
    }
  }
  if (!config.phases.length) issues.push("Mindestens eine Tagesphase ist erforderlich.");
  return issues;
}

export function minutesPerDay(config) {
  const normalized = normalizeCalendarConfig(config);
  return normalized.day.hours * normalized.day.minutesPerHour;
}

function normalizeSeason(source, seasonIndex) {
  const fallback = NEUTRAL_PRESET.seasons[seasonIndex % NEUTRAL_PRESET.seasons.length];
  const monthsSource = Array.isArray(source?.months) && source.months.length ? source.months.slice(0, 24) : fallback.months;
  const seasonId = safeId(source?.id, `season-${seasonIndex + 1}`);
  return {
    id: seasonId,
    name: safeText(source?.name, `Jahreszeit ${seasonIndex + 1}`, 80),
    color: safeColor(source?.color, fallback.color),
    months: monthsSource.map((month, monthIndex) => ({
      id: safeId(month?.id, `${seasonId}-month-${monthIndex + 1}`),
      name: safeText(month?.name, `Monat ${monthIndex + 1}`, 80),
      days: clampInt(month?.days, 1, 999, 28)
    })),
    specialDay: {
      enabled: Boolean(source?.specialDay?.enabled),
      id: safeId(source?.specialDay?.id, `${seasonId}-special`),
      name: safeText(source?.specialDay?.name, "Sondertag", 80),
      outsideYear: Boolean(source?.specialDay?.outsideYear),
      description: safeText(source?.specialDay?.description, "", 1000)
    }
  };
}

function normalizePhases(source, minutesInDay) {
  const phasesSource = Array.isArray(source) && source.length ? source.slice(0, 16) : NEUTRAL_PRESET.phases;
  const used = new Set();
  return phasesSource.map((phase, index) => {
    let id = safeId(phase?.id, `phase-${index + 1}`);
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return {
      id,
      name: safeText(phase?.name, `Phase ${index + 1}`, 60),
      startMinute: clampInt(phase?.startMinute, 0, Math.max(0, minutesInDay - 1), Math.floor(index * minutesInDay / phasesSource.length)),
      icon: safeText(phase?.icon, "◉", 12),
      color: safeColor(phase?.color, "#c879ff"),
      darkness: clampNumber(phase?.darkness, 0, 1, 0)
    };
  }).sort((left, right) => left.startMinute - right.startMinute);
}

function normalizeMoons(source) {
  if (!Array.isArray(source)) return structuredClone(NEUTRAL_PRESET.moons);
  return source.slice(0, 8).map((moon, index) => ({
    id: safeId(moon?.id, `moon-${index + 1}`),
    name: safeText(moon?.name, `Mond ${index + 1}`, 60),
    cycleDays: clampNumber(moon?.cycleDays, 1, 10000, 28),
    offsetDays: clampNumber(moon?.offsetDays, -10000, 10000, 0),
    color: safeColor(moon?.color, "#eadcff"),
    fullOnSpecialDays: Boolean(moon?.fullOnSpecialDays),
    alwaysVisibleOnOutsideYear: Boolean(moon?.alwaysVisibleOnOutsideYear),
    turningLabel: safeText(moon?.turningLabel, "Neumond", 60)
  }));
}

function normalizeNames(value, fallback, minimum, maximum) {
  const names = Array.isArray(value)
    ? value.map((entry) => safeText(entry, "", 60)).filter(Boolean).slice(0, maximum)
    : [];
  if (names.length >= minimum) return names;
  return fallback.slice(0, maximum);
}

function safeId(value, fallback) {
  const id = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return id || fallback;
}

function safeText(value, fallback, maximum) {
  const text = String(value ?? "").trim().slice(0, maximum);
  return text || fallback;
}

function safeColor(value, fallback) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function clampInt(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(numeric) ? Math.trunc(numeric) : fallback));
}

function clampNumber(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(numeric) ? numeric : fallback));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
