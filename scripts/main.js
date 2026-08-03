import { MODULE_ID, MODULE_TITLE, SETTINGS } from "./constants.js";
import { CalendarApp } from "./calendar-app.js";
import { CalendarConfigApp } from "./config-app.js";
import { CalendarHud } from "./hud.js";
import { getCalendarConfig, isModuleUsable, migrateLegacySettings, registerSettings } from "./settings.js";
import { CalendarStore } from "./store.js";
import { applyTheme } from "./theme.js";

Hooks.once("init", () => {
  registerSettings(CalendarConfigApp);
  game.keybindings.register(MODULE_ID, "openCalendar", {
    name: "Axon´s Calender öffnen",
    hint: "Öffnet oder fokussiert den Kampagnenkalender.",
    editable: [{ key: "KeyK" }],
    restricted: false,
    onDown: () => {
      if (!isModuleUsable() || !game.settings.get(MODULE_ID, SETTINGS.FEATURE_CALENDAR)) return false;
      CalendarApp.open();
      return true;
    }
  });

  game.modules.get(MODULE_ID).api = {
    openCalendar: () => CalendarApp.open(),
    openDesigner: () => game.user.isGM && new CalendarConfigApp().render({ force: true }),
    getConfig: () => getCalendarConfig(),
    getState: () => CalendarStore.getState(),
    setState: (state) => CalendarStore.setState(state),
    setTime: (minute) => CalendarStore.setTime(minute),
    advanceMinutes: (minutes) => CalendarStore.advanceMinutes(minutes),
    nextDay: () => CalendarStore.nextDay(),
    previousDay: () => CalendarStore.previousDay(),
    setPhase: (phase) => CalendarStore.setPhase(phase),
    resetHudPosition: () => CalendarHud.resetPosition()
  };
  console.info(`${MODULE_ID} | ${MODULE_TITLE} für Foundry VTT 14 initialisiert`);
});

Hooks.once("ready", async () => {
  try {
    await migrateLegacySettings();
    if (game.user.isGM && isModuleUsable() && game.settings.get(MODULE_ID, SETTINGS.FEATURE_GM_PLANNER)) {
      await CalendarStore.ensureGmJournal();
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Vorbereitung der Welt ist fehlgeschlagen`, error);
    ui.notifications.error("Axon´s Calender konnte seine Welt-Daten nicht vollständig vorbereiten. Bitte prüfe die Konsole.");
  }
  game.socket?.on(`module.${MODULE_ID}`, handleSocketMessage);
  applyTheme(getCalendarConfig());
  CalendarHud.mount();
  window.addEventListener("resize", debounce(() => CalendarHud.mount(), 150));
});

Hooks.on("renderHotbar", () => CalendarHud.mount());
Hooks.on(`${MODULE_ID}.settingsChanged`, () => refreshAll());
Hooks.on(`${MODULE_ID}.configChanged`, () => refreshAll());
Hooks.on(`${MODULE_ID}.dataChanged`, () => refreshAll());
Hooks.on("updateWorldTime", () => CalendarHud.render());
Hooks.on("updateJournalEntry", (document) => {
  if (document.getFlag(MODULE_ID, "gmPlannerStore")) refreshAll();
});
Hooks.on("updateUser", () => refreshAll());

async function refreshAll() {
  applyTheme(getCalendarConfig());
  CalendarHud.mount();
  const calendarEnabled = isModuleUsable() && game.settings.get(MODULE_ID, SETTINGS.FEATURE_CALENDAR);
  if (!calendarEnabled && CalendarApp.instance) return CalendarApp.instance.close();
  await CalendarApp.instance?.refresh();
}

async function handleSocketMessage(payload) {
  if (!payload || typeof payload !== "object") return;
  await refreshAll();
  if (payload.type === "day-advanced"
      && game.settings.get(MODULE_ID, SETTINGS.EVENT_NOTIFICATIONS)
      && Array.isArray(payload.startingEvents)
      && payload.startingEvents.length) {
    ui.notifications.info(`Heute beginnt: ${payload.startingEvents.map((event) => event.title).join(", ")}`);
  }
}

function debounce(callback, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), wait);
  };
}
