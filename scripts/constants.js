export const MODULE_ID = "illidor-calendar";
export const MODULE_TITLE = "Axons Kalender";
export const DATA_VERSION = 2;

export const SETTINGS = Object.freeze({
  WORLD_ENABLED: "worldEnabled",
  CLIENT_ENABLED: "clientEnabled",
  FEATURE_CALENDAR: "featureCalendar",
  FEATURE_HUD: "featureHud",
  FEATURE_TIME_CONTROLS: "featureTimeControls",
  FEATURE_PUBLIC_EVENTS: "featurePublicEvents",
  FEATURE_GM_PLANNER: "featureGmPlanner",
  FEATURE_PERSONAL_NOTES: "featurePersonalNotes",
  FEATURE_MOON: "featureMoon",
  FEATURE_SCENE_LIGHTING: "featureSceneLighting",
  SYNC_FOUNDRY_TIME: "syncFoundryTime",
  SHOW_HUD: "showHud",
  HUD_COLLAPSED: "hudCollapsed",
  SHOW_MOON_VISUALS: "showMoonVisuals",
  SHOW_MOON_BACKGROUND: "showMoonBackground",
  EVENT_NOTIFICATIONS: "eventNotifications",
  REDUCE_MOTION: "reduceMotion",
  LOCK_HUD: "lockHud",
  HUD_POSITION: "hudPosition",
  CALENDAR_CONFIG: "calendarConfig",
  CALENDAR_STATE: "calendarState",
  PUBLIC_EVENTS: "publicEvents",
  DATA_VERSION: "dataVersion",

  // Version 0.1 used these individual settings. They stay registered so an
  // existing Illidor world can be migrated without losing names or state.
  LEGACY_WEEKDAY_NAMES: "weekdayNames",
  LEGACY_SEASON_NAMES: "seasonNames",
  LEGACY_SPECIAL_DAY_NAMES: "specialDayNames",
  LEGACY_ERA_LABEL: "eraLabel",
  LEGACY_NEXT_DAY_PHASE: "nextDayPhase"
});

export const PHASES = Object.freeze({
  MORNING: "morning",
  DAY: "day",
  EVENING: "evening",
  NIGHT: "night"
});

export const VISIBILITY = Object.freeze({
  PUBLIC: "public",
  GM: "gm",
  PRIVATE: "private"
});

export const EVENT_CATEGORIES = Object.freeze([
  { value: "event", label: "Ereignis", icon: "fa-star" },
  { value: "celebration", label: "Feier & Fest", icon: "fa-champagne-glasses" },
  { value: "quest", label: "Quest", icon: "fa-scroll" },
  { value: "travel", label: "Reise", icon: "fa-route" },
  { value: "session", label: "Session", icon: "fa-dice-d20" },
  { value: "note", label: "Notiz", icon: "fa-note-sticky" }
]);

export const DEFAULT_STATE = Object.freeze({
  year: 278,
  season: 5,
  month: 2,
  day: 10,
  specialDay: null,
  minuteOfDay: 21 * 60,
  phase: PHASES.EVENING,
  revision: 1
});
