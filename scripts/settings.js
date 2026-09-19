import { publicConfig } from "./public-config.js";
import { validateExtensions } from "./world-rules.js";
import { ILLIDOR_PRESET, NEUTRAL_PRESET, normalizeCalendarConfig } from "./calendar-config.js";
import { DATA_VERSION, DEFAULT_STATE, ILLIDOR_DEFAULT_STATE, MODULE_ID, PHASES, SETTINGS } from "./constants.js";

export const WORLD_FEATURE_SETTINGS = Object.freeze([
  SETTINGS.FEATURE_CALENDAR,
  SETTINGS.FEATURE_HUD,
  SETTINGS.FEATURE_TIME_CONTROLS,
  SETTINGS.FEATURE_PUBLIC_EVENTS,
  SETTINGS.FEATURE_GM_PLANNER,
  SETTINGS.FEATURE_PERSONAL_NOTES,
  SETTINGS.FEATURE_MOON,
  SETTINGS.FEATURE_SCENE_LIGHTING,
  SETTINGS.SYNC_FOUNDRY_TIME
]);

export function registerSettings(CalendarConfigApp) {
  const refresh = () => Hooks.callAll(`${MODULE_ID}.settingsChanged`);

  game.settings.registerMenu(MODULE_ID, "calendarDesigner", {
    name: "Kalender-Designer",
    label: "Axon´s Calender konfigurieren",
    hint: "Wochentage, Jahreszeiten, Monate, Sondertage, Monde, Tagesphasen und den aktuellen Zeitpunkt ohne Code bearbeiten.",
    icon: "fa-solid fa-wand-magic-sparkles",
    type: CalendarConfigApp,
    restricted: true
  });

  registerBoolean(SETTINGS.WORLD_ENABLED, "Modul weltweit aktiv", "Schaltet Axon´s Calender für die gesamte Welt an oder aus.", true, true, refresh);
  registerBoolean(SETTINGS.CLIENT_ENABLED, "Modul auf diesem Gerät aktiv", "Persönlicher Notfall- und Performance-Schalter für diesen Browser.", true, false, refresh, "client");
  registerBoolean(SETTINGS.FEATURE_CALENDAR, "Kalenderfenster", "Aktiviert Monats-, Jahres- und Agendaansicht.", true, true, refresh);
  registerBoolean(SETTINGS.FEATURE_HUD, "Kristall-Uhr", "Zeigt die verschiebbare Datums- und Tageszeituhr an.", true, true, refresh);
  registerBoolean(SETTINGS.FEATURE_TIME_CONTROLS, "Zeitsteuerung für GMs", "Erlaubt GMs, Uhrzeit und Spieltag direkt über das HUD zu ändern.", true, true, refresh);
  registerBoolean(SETTINGS.FEATURE_PUBLIC_EVENTS, "Öffentliche Ereignisse & geteilte Notizen", "GMs verwalten Welt-Ereignisse; Spieler können eigene, für alle sichtbare Notizen teilen.", true, true, refresh);
  registerBoolean(SETTINGS.FEATURE_GM_PLANNER, "Private GM-Planung", "Speichert geheime GM-Einträge in einem geschützten Journal.", true, true, refresh);
  registerBoolean(SETTINGS.FEATURE_PERSONAL_NOTES, "Private Spielernotizen", "Jeder Spieler kann eigene, nur für ihn sichtbare Notizen anlegen; beim Erstellen kann alternativ öffentlich geteilt werden.", true, true, refresh);
  registerBoolean(SETTINGS.FEATURE_MOON, "Mondsystem", "Berechnet und visualisiert alle im Kalender-Designer angelegten Monde.", true, true, refresh);
  registerBoolean(SETTINGS.FEATURE_SCENE_LIGHTING, "Szenenhelligkeit mitführen", "Passt beim Wechsel der Tagesphase die Dunkelheit der aktuell aktiven Szene an. Standardmäßig aus.", false, true, refresh);
  registerBoolean(SETTINGS.SYNC_FOUNDRY_TIME, "Foundry-Weltzeit mitführen", "Zeitänderungen über Axon´s Calender bewegen auch Foundrys offizielle Weltzeit. Externe Zeitänderungen überschreiben den Kalender nicht.", true, true, refresh);

  registerBoolean(SETTINGS.SHOW_HUD, "HUD auf diesem Gerät anzeigen", "Persönlicher Schalter für die Kristall-Uhr.", true, false, refresh, "client");
  registerBoolean(SETTINGS.HUD_COLLAPSED, "HUD kompakt starten", "Startet die Uhr auf diesem Gerät in der kleinen Kristallansicht.", false, false, refresh, "client", false);
  registerBoolean(SETTINGS.SHOW_MOON_VISUALS, "Monde auf diesem Gerät anzeigen", "Blendet Mondkugeln und Mondphasen ein oder aus.", true, false, refresh, "client");
  registerBoolean(SETTINGS.SHOW_MOON_BACKGROUND, "Mondlicht im Kalenderkopf", "Zeigt die aktuelle Mondphase als gläsernes Hintergrundmotiv.", true, false, refresh, "client");
  registerBoolean(SETTINGS.EVENT_NOTIFICATIONS, "Ereignis-Benachrichtigungen", "Meldet öffentliche Ereignisse, die beim Tageswechsel beginnen.", true, false, null, "client");
  registerBoolean(SETTINGS.REDUCE_MOTION, "Animationen reduzieren", "Reduziert Leuchten, Schweben und Übergänge.", false, false, refresh, "client");
  registerBoolean(SETTINGS.LOCK_HUD, "HUD-Position sperren", "Verhindert versehentliches Verschieben der Kristall-Uhr.", false, false, refresh, "client");

  game.settings.register(MODULE_ID, SETTINGS.CALENDAR_CONFIG, {
    scope: "world",
    config: false,
    restricted: true,
    type: Object,
    default: structuredClone(NEUTRAL_PRESET),
    onChange: refresh
  });
  game.settings.register(MODULE_ID, SETTINGS.CALENDAR_STATE, {
    scope: "world",
    config: false,
    restricted: true,
    type: Object,
    default: structuredClone(DEFAULT_STATE),
    onChange: refresh
  });
  game.settings.register(MODULE_ID, SETTINGS.PUBLIC_EVENTS, {
    scope: "world",
    config: false,
    restricted: true,
    type: Array,
    default: [],
    onChange: refresh
  });
  game.settings.register(MODULE_ID, SETTINGS.HUD_POSITION, {
    scope: "client",
    config: false,
    type: Object,
    default: {},
    onChange: refresh
  });
  game.settings.register(MODULE_ID, SETTINGS.DATA_VERSION, {
    scope: "world",
    config: false,
    restricted: true,
    type: Number,
    default: 1
  });

  registerLegacySettings();
}

export function getCalendarConfig() {
  const privateConfig = game.user?.isGM ? game.journal?.find?.(entry=>entry.getFlag(MODULE_ID,"gmPlannerStore")===true)?.getFlag(MODULE_ID,"worldRules") : null;
  return normalizeCalendarConfig(privateConfig ?? game.settings.get(MODULE_ID, SETTINGS.CALENDAR_CONFIG));
}

export async function setCalendarConfig(config) {
  if (!game.user.isGM) throw new Error("Nur ein GM darf den Kalender verändern.");
  const normalized = normalizeCalendarConfig(config);
  const errors=validateExtensions(normalized);
  if(errors.length)throw new Error(errors.join(" "));
  const previous=getCalendarConfig();
  // Retiring an insertion must not silently move stored events to a regular date.
  const removed=previous.specialDays.filter(s=>!normalized.specialDays.some(n=>n.slot===s.slot));
  const { CalendarStore } = await import("./store.js");
  if(removed.length) {
    const events=[...CalendarStore.getPublicEvents(),...Array.from(game.users??[]).flatMap(u=>CalendarStore.getPersonalNotes(u)),...await CalendarStore.getGmEvents()];
    const state=CalendarStore.getState();
    if(removed.some(s=>state.specialDay===-s.slot || events.some(e=>e.start?.specialDay===-s.slot || e.end?.specialDay===-s.slot)))
      throw new Error("Ein verwendeter Sondertag kann erst entfernt werden, wenn Datum und betroffene Ereignisse verschoben wurden.");
  }
  const journal=await CalendarStore.ensureGmJournal();
  const before=journal.getFlag(MODULE_ID,"worldRules");
  const projection=publicConfig(normalized);
  // Redact client data first; a failed private save can safely restore the previous projection.
  await game.settings.set(MODULE_ID, SETTINGS.CALENDAR_CONFIG, projection);
  try { await journal.setFlag(MODULE_ID,"worldRules",normalized); }
  catch(error) { await game.settings.set(MODULE_ID, SETTINGS.CALENDAR_CONFIG,publicConfig(before??previous)); throw error; }
  Hooks.callAll(`${MODULE_ID}.configChanged`, normalized);
  return normalized;
}

export function getFeatureSettings() {
  return Object.fromEntries(WORLD_FEATURE_SETTINGS.map((key) => [key, Boolean(game.settings.get(MODULE_ID, key))]));
}

export async function setFeatureSettings(features) {
  if (!game.user.isGM) return;
  for (const key of WORLD_FEATURE_SETTINGS) {
    if (Object.hasOwn(features, key)) await game.settings.set(MODULE_ID, key, Boolean(features[key]));
  }
}

export function isModuleUsable() {
  return Boolean(game.settings.get(MODULE_ID, SETTINGS.WORLD_ENABLED)
    && game.settings.get(MODULE_ID, SETTINGS.CLIENT_ENABLED));
}

export function isFeatureEnabled(settingKey) {
  return isModuleUsable() && Boolean(game.settings.get(MODULE_ID, settingKey));
}

export async function migrateLegacySettings() {
  if (!game.user.isGM) return false;
  const worldStorage = game.settings.storage?.get?.("world");
  const canInspectStorage = Boolean(worldStorage?.has);
  const currentVersion = Number(game.settings.get(MODULE_ID, SETTINGS.DATA_VERSION) ?? 1);
  if (currentVersion >= DATA_VERSION) {
    const hadPreviousModuleVersion = worldStorage?.has?.(`${MODULE_ID}.${SETTINGS.DATA_VERSION}`);
    const hasStoredCalendar = worldStorage?.has?.(`${MODULE_ID}.${SETTINGS.CALENDAR_CONFIG}`);
    if (canInspectStorage && hadPreviousModuleVersion && !hasStoredCalendar) {
      await game.settings.set(MODULE_ID, SETTINGS.CALENDAR_CONFIG, structuredClone(ILLIDOR_PRESET));
      await game.settings.set(MODULE_ID, SETTINGS.CALENDAR_STATE, structuredClone(ILLIDOR_DEFAULT_STATE));
      ui.notifications.info("Axon´s Calender: Das bisherige Illidor-Standardpreset wurde für diese bestehende Welt dauerhaft gesichert.");
      return true;
    }
    return false;
  }

  const legacyKeys = [
    SETTINGS.CALENDAR_STATE,
    SETTINGS.PUBLIC_EVENTS,
    SETTINGS.LEGACY_WEEKDAY_NAMES,
    SETTINGS.LEGACY_SEASON_NAMES,
    SETTINGS.LEGACY_SPECIAL_DAY_NAMES,
    SETTINGS.LEGACY_ERA_LABEL
  ];
  const hasLegacyWorldData = legacyKeys.some((key) => worldStorage?.has?.(`${MODULE_ID}.${key}`));
  if (canInspectStorage && !hasLegacyWorldData) {
    await game.settings.set(MODULE_ID, SETTINGS.DATA_VERSION, DATA_VERSION);
    return false;
  }

  const config = structuredClone(ILLIDOR_PRESET);
  config.weekdays = parseLegacyList(game.settings.get(MODULE_ID, SETTINGS.LEGACY_WEEKDAY_NAMES), config.weekdays);
  const seasons = parseLegacyList(game.settings.get(MODULE_ID, SETTINGS.LEGACY_SEASON_NAMES), config.seasons.map((season) => season.name));
  const specials = parseLegacyList(game.settings.get(MODULE_ID, SETTINGS.LEGACY_SPECIAL_DAY_NAMES), config.seasons.map((season) => season.specialDay.name));
  config.seasons.forEach((season, index) => {
    season.name = seasons[index] ?? season.name;
    season.specialDay.name = specials[index] ?? season.specialDay.name;
  });
  config.eraLabel = String(game.settings.get(MODULE_ID, SETTINGS.LEGACY_ERA_LABEL) || config.eraLabel).trim();
  const legacyNextPhase = String(game.settings.get(MODULE_ID, SETTINGS.LEGACY_NEXT_DAY_PHASE) || PHASES.MORNING);
  config.day.nextDayPhaseId = config.phases.some((phase) => phase.id === legacyNextPhase) ? legacyNextPhase : PHASES.MORNING;

  const state = { ...structuredClone(ILLIDOR_DEFAULT_STATE), ...(game.settings.get(MODULE_ID, SETTINGS.CALENDAR_STATE) ?? {}) };
  if (!Number.isFinite(Number(state.minuteOfDay))) {
    const phase = config.phases.find((candidate) => candidate.id === state.phase) ?? config.phases[0];
    state.minuteOfDay = phase.startMinute;
  }

  await game.settings.set(MODULE_ID, SETTINGS.CALENDAR_CONFIG, normalizeCalendarConfig(config));
  await game.settings.set(MODULE_ID, SETTINGS.CALENDAR_STATE, state);
  await game.settings.set(MODULE_ID, SETTINGS.DATA_VERSION, DATA_VERSION);
  ui.notifications.info("Axon´s Calender: Der bisherige Illidor-Kalender wurde sicher auf das neue, frei konfigurierbare Format migriert.");
  return true;
}

function registerBoolean(key, name, hint, defaultValue, restricted, onChange, scope = "world", config = true) {
  game.settings.register(MODULE_ID, key, {
    name,
    hint,
    scope,
    config,
    restricted,
    type: Boolean,
    default: defaultValue,
    onChange
  });
}

function registerLegacySettings() {
  const definitions = [
    [SETTINGS.LEGACY_WEEKDAY_NAMES, "Osda|Desda|Troda|Alda|Miéda|Silda|Tokda|Suda"],
    [SETTINGS.LEGACY_SEASON_NAMES, "Jahreszeit 1|Jahreszeit 2|Jahreszeit 3|Jahreszeit 4|Jahreszeit 5|Jahreszeit 6"],
    [SETTINGS.LEGACY_SPECIAL_DAY_NAMES, "1. Sondertag|2. Sondertag|3. Sondertag|4. Sondertag|5. Sondertag|6. Sondertag"],
    [SETTINGS.LEGACY_ERA_LABEL, "e.e."],
    [SETTINGS.LEGACY_NEXT_DAY_PHASE, PHASES.MORNING]
  ];
  for (const [key, defaultValue] of definitions) {
    game.settings.register(MODULE_ID, key, {
      scope: "world",
      config: false,
      restricted: true,
      type: String,
      default: defaultValue
    });
  }
}

function parseLegacyList(value, fallback) {
  const values = String(value ?? "").split("|").map((entry) => entry.trim()).filter(Boolean);
  return fallback.map((entry, index) => values[index] ?? entry);
}
