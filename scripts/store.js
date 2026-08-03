import { DEFAULT_STATE, MODULE_ID, SETTINGS, VISIBILITY } from "./constants.js";
import { minutesPerDay } from "./calendar-config.js";
import {
  absoluteMinute,
  dateToOrdinal,
  eventOccursOn,
  normalizeDate,
  normalizeMinute,
  phaseById,
  phaseForMinute,
  sameDate,
  stateFromAbsoluteMinute
} from "./calendar-engine.js";
import { getCalendarConfig } from "./settings.js";

const GM_STORE_FLAG = "gmPlannerStore";
const GM_EVENTS_FLAG = "gmEvents";
const PERSONAL_NOTES_FLAG = "personalNotes";
const GM_JOURNAL_NAME = "[Axon´s Calender] Private GM-Planung";
const PREVIOUS_GM_JOURNAL_NAME = "[Axons Kalender] Private GM-Planung";
const LEGACY_GM_JOURNAL_NAME = "[Illidor Calendar] Private GM-Planung";
const EVENT_STORAGE = Object.freeze({ WORLD: "world", USER: "user", GM: "gm" });

export class CalendarStore {
  static getState() {
    const config = getCalendarConfig();
    const stored = game.settings.get(MODULE_ID, SETTINGS.CALENDAR_STATE) ?? DEFAULT_STATE;
    const date = normalizeDate(stored, config);
    const legacyPhase = config.phases.find((phase) => phase.id === stored.phase);
    const minuteOfDay = Number.isFinite(Number(stored.minuteOfDay))
      ? normalizeMinute(stored.minuteOfDay, config)
      : (legacyPhase?.startMinute ?? config.phases[0].startMinute);
    const phase = phaseForMinute(minuteOfDay, config);
    return {
      ...date,
      minuteOfDay,
      phase: phase.id,
      revision: Number(stored.revision ?? 1)
    };
  }

  static async setState(nextState, reason = "state-updated", { syncFoundryTime = false } = {}) {
    if (!game.user.isGM) throw new Error("Nur ein GM darf Kalender und Uhr verändern.");
    const config = getCalendarConfig();
    const previous = this.getState();
    const date = normalizeDate(nextState, config);
    const minuteOfDay = normalizeMinute(nextState.minuteOfDay ?? previous.minuteOfDay, config);
    const phase = phaseForMinute(minuteOfDay, config);
    const normalized = {
      ...date,
      minuteOfDay,
      phase: phase.id,
      revision: Number(previous.revision ?? 0) + 1
    };
    await game.settings.set(MODULE_ID, SETTINGS.CALENDAR_STATE, normalized);

    if (syncFoundryTime && game.settings.get(MODULE_ID, SETTINGS.SYNC_FOUNDRY_TIME)) {
      const delta = absoluteMinute(normalized, config) - absoluteMinute(previous, config);
      await this.#advanceFoundryTime(delta);
    }
    await this.#applySceneLighting(phase);
    this.broadcast({ type: "refresh", reason, state: normalized });
    Hooks.callAll(`${MODULE_ID}.dataChanged`, normalized, previous);
    return normalized;
  }

  static async setTime(minuteOfDay) {
    return this.setState({ ...this.getState(), minuteOfDay }, "time-set", { syncFoundryTime: true });
  }

  static async setPhase(phaseId) {
    const config = getCalendarConfig();
    const phase = phaseById(phaseId, config);
    return this.setState({ ...this.getState(), minuteOfDay: phase.startMinute }, "phase-changed", { syncFoundryTime: true });
  }

  static async advanceMinutes(deltaMinutes, reason = "time-advanced") {
    if (!game.user.isGM) throw new Error("Nur ein GM darf die Zeit verändern.");
    const config = getCalendarConfig();
    const current = this.getState();
    const target = stateFromAbsoluteMinute(absoluteMinute(current, config) + Math.trunc(Number(deltaMinutes) || 0), config);
    return this.setState(target, reason, { syncFoundryTime: true });
  }

  static async nextDay() {
    const config = getCalendarConfig();
    const current = this.getState();
    const nextPhase = phaseById(config.day.nextDayPhaseId, config);
    const delta = minutesPerDay(config) - current.minuteOfDay + nextPhase.startMinute;
    const next = await this.advanceMinutes(delta, "next-day");
    const startingEvents = [...this.getPublicEvents(), ...this.getSharedPlayerNotes()]
      .filter((event) => sameDate(event.start, next, config));
    this.broadcast({
      type: "day-advanced",
      state: next,
      startingEvents: startingEvents.map((event) => ({ id: event.id, title: event.title }))
    });
    return next;
  }

  static async previousDay() {
    const config = getCalendarConfig();
    return this.advanceMinutes(-minutesPerDay(config), "previous-day");
  }

  static getPublicEvents() {
    return structuredClone(game.settings.get(MODULE_ID, SETTINGS.PUBLIC_EVENTS) ?? []);
  }

  static async setPublicEvents(events) {
    if (!game.user.isGM) throw new Error("Nur ein GM darf öffentliche Ereignisse verändern.");
    await game.settings.set(MODULE_ID, SETTINGS.PUBLIC_EVENTS, structuredClone(events));
    this.broadcast({ type: "refresh", reason: "public-events" });
    Hooks.callAll(`${MODULE_ID}.dataChanged`);
  }

  static getPersonalNotes(user = game.user) {
    return structuredClone(user?.getFlag(MODULE_ID, PERSONAL_NOTES_FLAG) ?? []);
  }

  static getSharedPlayerNotes() {
    return getUsers().flatMap((user) => this.getPersonalNotes(user)
      .filter((event) => event.visibility === VISIBILITY.PUBLIC)
      .map((event) => ({ ...event, ownerId: user.id, storage: EVENT_STORAGE.USER })));
  }

  static async setPersonalNotes(events, user = game.user) {
    if (user.id !== game.user.id && !game.user.isGM) throw new Error("Diese privaten Notizen gehören einem anderen Benutzer.");
    await user.setFlag(MODULE_ID, PERSONAL_NOTES_FLAG, structuredClone(events));
    Hooks.callAll(`${MODULE_ID}.dataChanged`);
  }

  static async getGmEvents() {
    if (!game.user.isGM) return [];
    const journal = await this.ensureGmJournal();
    return structuredClone(journal?.getFlag(MODULE_ID, GM_EVENTS_FLAG) ?? []);
  }

  static async setGmEvents(events) {
    if (!game.user.isGM) throw new Error("Nur ein GM darf geheime GM-Einträge verändern.");
    const journal = await this.ensureGmJournal();
    await journal.setFlag(MODULE_ID, GM_EVENTS_FLAG, structuredClone(events));
    this.broadcast({ type: "refresh", reason: "gm-events" });
  }

  static async getVisibleEvents(viewMode = "player") {
    const publicEvents = game.settings.get(MODULE_ID, SETTINGS.FEATURE_PUBLIC_EVENTS)
      ? [...this.getPublicEvents(), ...this.getSharedPlayerNotes()]
      : [];
    if (game.user.isGM) {
      if (viewMode === "gm" && game.settings.get(MODULE_ID, SETTINGS.FEATURE_GM_PLANNER)) {
        return [...publicEvents, ...(await this.getGmEvents())];
      }
      return publicEvents;
    }
    const personal = game.settings.get(MODULE_ID, SETTINGS.FEATURE_PERSONAL_NOTES)
      ? this.getPersonalNotes().filter((event) => event.visibility === VISIBILITY.PRIVATE)
      : [];
    return [...publicEvents, ...personal];
  }

  static async saveEvent(event, originalVisibility = null) {
    const sanitized = sanitizeEvent(event);
    const originalStorage = storageForEvent(event, originalVisibility ?? sanitized.visibility);
    if (!game.user.isGM) {
      sanitized.ownerId = game.user.id;
      const publicAllowed = game.settings.get(MODULE_ID, SETTINGS.FEATURE_PUBLIC_EVENTS);
      const privateAllowed = game.settings.get(MODULE_ID, SETTINGS.FEATURE_PERSONAL_NOTES);
      if (sanitized.visibility === VISIBILITY.PUBLIC && !publicAllowed) sanitized.visibility = VISIBILITY.PRIVATE;
      if (sanitized.visibility === VISIBILITY.PRIVATE && !privateAllowed && publicAllowed) sanitized.visibility = VISIBILITY.PUBLIC;
      if (![VISIBILITY.PUBLIC, VISIBILITY.PRIVATE].includes(sanitized.visibility)) sanitized.visibility = VISIBILITY.PRIVATE;
    }
    sanitized.storage = targetStorage(sanitized, originalVisibility, originalStorage);
    await this.#upsertIntoVisibility(sanitized);
    if (originalVisibility && originalStorage !== sanitized.storage) {
      await this.removeEvent(sanitized.id, originalVisibility, {
        silent: true,
        ownerId: String(event.ownerId || game.user.id),
        storage: originalStorage
      });
    }
    return sanitized;
  }

  static async #upsertIntoVisibility(event) {
    if (event.visibility === VISIBILITY.PUBLIC) {
      if (event.storage === EVENT_STORAGE.USER) return this.#upsertUserEvent(event);
      if (!game.user.isGM) throw new Error("Dieser öffentliche Eintrag darf nicht im Welt-Speicher angelegt werden.");
      return this.setPublicEvents(upsert(this.getPublicEvents(), event));
    }
    if (event.visibility === VISIBILITY.GM) {
      if (!game.user.isGM) throw new Error("Nur ein GM darf geheime GM-Einträge anlegen.");
      return this.setGmEvents(upsert(await this.getGmEvents(), event));
    }
    return this.#upsertUserEvent(event);
  }

  static async #upsertUserEvent(event) {
    const owner = game.users.get(event.ownerId) ?? game.user;
    if (owner.id !== game.user.id && !game.user.isGM) throw new Error("Dieser Eintrag gehört einem anderen Benutzer.");
    return this.setPersonalNotes(upsert(this.getPersonalNotes(owner), { ...event, storage: EVENT_STORAGE.USER }), owner);
  }

  static async removeEvent(id, visibility, { silent = false, ownerId = game.user.id, storage = null } = {}) {
    const resolvedStorage = storage ?? storageForEvent({ id, ownerId }, visibility);
    if (visibility === VISIBILITY.PUBLIC) {
      if (resolvedStorage === EVENT_STORAGE.USER) {
        const owner = game.users.get(ownerId) ?? game.user;
        if (owner.id !== game.user.id && !game.user.isGM) throw new Error("Diese geteilte Notiz gehört einem anderen Benutzer.");
        await this.setPersonalNotes(this.getPersonalNotes(owner).filter((event) => event.id !== id), owner);
      } else {
        if (!game.user.isGM) throw new Error("Nur ein GM darf öffentliche Welt-Ereignisse löschen.");
        await this.setPublicEvents(this.getPublicEvents().filter((event) => event.id !== id));
      }
    } else if (visibility === VISIBILITY.GM) {
      if (!game.user.isGM) throw new Error("Nur ein GM darf geheime GM-Einträge löschen.");
      await this.setGmEvents((await this.getGmEvents()).filter((event) => event.id !== id));
    } else {
      const owner = game.users.get(ownerId) ?? game.user;
      if (owner.id !== game.user.id && !game.user.isGM) throw new Error("Diese private Notiz gehört einem anderen Benutzer.");
      await this.setPersonalNotes(this.getPersonalNotes(owner).filter((event) => event.id !== id), owner);
    }
    if (!silent) ui.notifications.info("Kalendereintrag gelöscht.");
  }

  static async publishEvent(id) {
    if (!game.user.isGM) return;
    const gmEvents = await this.getGmEvents();
    const event = gmEvents.find((candidate) => candidate.id === id);
    if (!event) return;
    await this.setPublicEvents(upsert(this.getPublicEvents(), {
      ...event,
      visibility: VISIBILITY.PUBLIC,
      storage: EVENT_STORAGE.WORLD,
      updatedAt: Date.now()
    }));
    await this.setGmEvents(gmEvents.filter((candidate) => candidate.id !== id));
    ui.notifications.info(`„${event.title}“ wurde für alle Spieler veröffentlicht.`);
  }

  static async ensureGmJournal() {
    if (!game.user.isGM) return null;
    let journal = game.journal.find((entry) => entry.getFlag(MODULE_ID, GM_STORE_FLAG) === true);
    const ownership = Object.fromEntries(game.users.filter((user) => user.isGM)
      .map((user) => [user.id, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER]));
    ownership.default = CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
    if (!journal) {
      journal = await JournalEntry.create({
        name: GM_JOURNAL_NAME,
        ownership,
        flags: { [MODULE_ID]: { [GM_STORE_FLAG]: true, [GM_EVENTS_FLAG]: [] } }
      }, { renderSheet: false });
    } else {
      const changes = {};
      if ([LEGACY_GM_JOURNAL_NAME, PREVIOUS_GM_JOURNAL_NAME].includes(journal.name)) changes.name = GM_JOURNAL_NAME;
      if (game.users.some((user) => user.isGM && journal.ownership[user.id] !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) changes.ownership = ownership;
      if (Object.keys(changes).length) await journal.update(changes);
    }
    return journal;
  }

  static eventsOn(date, events) {
    const config = getCalendarConfig();
    return events.filter((event) => eventOccursOn(event, date, config));
  }

  static broadcast(payload) {
    game.socket?.emit(`module.${MODULE_ID}`, payload);
  }

  static async #advanceFoundryTime(deltaMinutes) {
    if (!deltaMinutes || !game.time?.advance) return;
    try {
      await game.time.advance(deltaMinutes * 60, { axonsCalendar: true });
    } catch (error) {
      console.warn(`${MODULE_ID} | Foundry-Weltzeit konnte nicht mitgeführt werden`, error);
      ui.notifications.warn("Die Axon-Uhr wurde geändert, aber Foundrys Weltzeit konnte nicht mitgeführt werden.");
    }
  }

  static async #applySceneLighting(phase) {
    if (!game.settings.get(MODULE_ID, SETTINGS.FEATURE_SCENE_LIGHTING) || !globalThis.canvas?.scene) return;
    try {
      await globalThis.canvas.scene.update({ darkness: phase.darkness });
    } catch (error) {
      console.warn(`${MODULE_ID} | Szenenhelligkeit konnte nicht gesetzt werden`, error);
    }
  }
}

function sanitizeEvent(event) {
  const now = Date.now();
  const config = getCalendarConfig();
  const start = normalizeDate(event.start, config);
  let end = normalizeDate(event.end ?? event.start, config);
  if (dateToOrdinal(end, config) < dateToOrdinal(start, config)) end = start;
  return {
    id: String(event.id || foundry.utils.randomID()),
    title: String(event.title || "Unbenannter Eintrag").trim().slice(0, 160),
    description: String(event.description || "").trim().slice(0, 10000),
    category: String(event.category || "event"),
    visibility: Object.values(VISIBILITY).includes(event.visibility) ? event.visibility : VISIBILITY.PRIVATE,
    ownerId: String(event.ownerId || game.user.id),
    storage: Object.values(EVENT_STORAGE).includes(event.storage) ? event.storage : null,
    start,
    end,
    createdAt: Number(event.createdAt || now),
    updatedAt: now
  };
}

export function canUserEditEvent(event, user = game.user) {
  if (!event || !user) return false;
  if (user.isGM) return event.visibility !== VISIBILITY.PRIVATE || event.ownerId === user.id;
  return [VISIBILITY.PUBLIC, VISIBILITY.PRIVATE].includes(event.visibility) && event.ownerId === user.id;
}

function targetStorage(event, originalVisibility, originalStorage) {
  if (event.visibility === VISIBILITY.PRIVATE) return EVENT_STORAGE.USER;
  if (event.visibility === VISIBILITY.GM) return EVENT_STORAGE.GM;
  if (!game.user.isGM) return EVENT_STORAGE.USER;
  if (originalVisibility === VISIBILITY.PUBLIC && originalStorage === EVENT_STORAGE.USER) return EVENT_STORAGE.USER;
  return EVENT_STORAGE.WORLD;
}

function storageForEvent(event, visibility) {
  if (Object.values(EVENT_STORAGE).includes(event?.storage)) return event.storage;
  if (visibility === VISIBILITY.PRIVATE) return EVENT_STORAGE.USER;
  if (visibility === VISIBILITY.GM) return EVENT_STORAGE.GM;
  const owner = game.users?.get?.(event?.ownerId);
  if (owner && (owner.getFlag(MODULE_ID, PERSONAL_NOTES_FLAG) ?? []).some((entry) => entry.id === event?.id)) return EVENT_STORAGE.USER;
  return EVENT_STORAGE.WORLD;
}

function getUsers() {
  if (Array.isArray(game.users?.contents)) return game.users.contents;
  return game.users ? Array.from(game.users) : [];
}

function upsert(events, event) {
  const index = events.findIndex((candidate) => candidate.id === event.id);
  if (index === -1) return [...events, event];
  const clone = [...events];
  clone[index] = event;
  return clone;
}
