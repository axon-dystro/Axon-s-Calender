import { canChange, eventColor } from "./world-rules.js";
import { EVENT_CATEGORIES, MODULE_ID, SETTINGS, VISIBILITY } from "./constants.js";
import { compareDates, formatDate, isSpecialDate, normalizeDate } from "./calendar-engine.js";
import { getCalendarConfig } from "./settings.js";
import { CalendarStore, canUserEditEvent } from "./store.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class EventEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-event-editor`,
    classes: [MODULE_ID, "axon-event-editor"],
    tag: "section",
    window: { title: "Kalendereintrag", icon: "fa-solid fa-calendar-plus", resizable: true },
    position: { width: 660, height: 720 }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/event-editor.hbs` }
  };

  constructor(options = {}) {
    const { event, defaultDate, defaultVisibility, onSaved, ...applicationOptions } = options;
    super(applicationOptions);
    const config = getCalendarConfig();
    this.eventData = event ? structuredClone(event) : null;
    this.originalVisibility = event?.visibility ?? null;
    this.defaultDate = normalizeDate(defaultDate ?? CalendarStore.getState(), config);
    this.defaultVisibility = defaultVisibility ?? (game.user.isGM ? VISIBILITY.PUBLIC : VISIBILITY.PRIVATE);
    this.onSaved = onSaved ?? null;
  }

  static open(options = {}) {
    const app = new EventEditor(options);
    app.render({ force: true });
    return app;
  }

  async _prepareContext() {
    const config = getCalendarConfig();
    const event = this.eventData ?? buildDefaultEvent(this.defaultDate, this.defaultVisibility);
    const visibilityOptions = [];
    if (game.user.isGM && game.settings.get(MODULE_ID, SETTINGS.FEATURE_PUBLIC_EVENTS)) {
      visibilityOptions.push({ value: VISIBILITY.PUBLIC, label: "Öffentlich · alle Spieler", selected: event.visibility === VISIBILITY.PUBLIC });
    }
    if (game.user.isGM && game.settings.get(MODULE_ID, SETTINGS.FEATURE_GM_PLANNER)) {
      visibilityOptions.push({ value: VISIBILITY.GM, label: "Geheim · nur GMs", selected: event.visibility === VISIBILITY.GM });
    }
    if (!game.user.isGM && game.settings.get(MODULE_ID, SETTINGS.FEATURE_PERSONAL_NOTES)) {
      visibilityOptions.push({ value: VISIBILITY.PRIVATE, label: "Privat · nur für mich", selected: event.visibility === VISIBILITY.PRIVATE });
    }
    if (!game.user.isGM && game.settings.get(MODULE_ID, SETTINGS.FEATURE_PUBLIC_EVENTS)) {
      visibilityOptions.push({ value: VISIBILITY.PUBLIC, label: "Geteilt · für alle Spieler", selected: event.visibility === VISIBILITY.PUBLIC });
    }
    const selectedVisibility = visibilityOptions.find((option) => option.selected) ?? visibilityOptions[0];
    return {
      event,
      isEditing: Boolean(this.eventData),
      canDelete: Boolean(this.eventData) && canUserEditEvent(event),
      canPublish: Boolean(this.eventData) && game.user.isGM && event.visibility === VISIBILITY.GM,
      canChooseVisibility: visibilityOptions.length > 1,
      fixedVisibility: selectedVisibility ?? { value: event.visibility, label: event.visibility },
      visibilityOptions,
      categories: config.categories.map((category) => ({ value:category.id,label:category.name,selected:category.id===event.category })),
      eventColor: eventColor(event,config),
      canChooseColor: canChange(config,"eventColors",game.user) && ["free","palette"].includes(config.eventColors.mode),
      paletteMode: config.eventColors.mode === "palette",
      palette: config.eventColors.palette.map(c=>({value:c,selected:c===eventColor(event,config)})),
      start: dateFormContext(event.start, config),
      end: dateFormContext(event.end, config),
      startLabel: formatDate(event.start, config),
      endLabel: formatDate(event.end, config)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    const form = root.querySelector("form");
    if (!form) return;
    form.addEventListener("submit", (event) => this.#onSubmit(event));
    for (const prefix of ["start", "end"]) {
      root.querySelector(`[name='${prefix}Kind']`)?.addEventListener("change", () => this.#toggleDateFields(root));
      root.querySelector(`[name='${prefix}Season']`)?.addEventListener("change", () => this.#populateDateOptions(root, prefix));
      root.querySelector(`[name='${prefix}Month']`)?.addEventListener("change", () => this.#populateDays(root, prefix));
    }
    root.querySelector("[data-action='cancel']")?.addEventListener("click", () => this.close());
    root.querySelector("[data-action='delete']")?.addEventListener("click", () => this.#delete());
    root.querySelector("[data-action='publish']")?.addEventListener("click", () => this.#publish());
    this.#toggleDateFields(root);
  }

  async #onSubmit(domEvent) {
    domEvent.preventDefault();
    const formData = new FormData(domEvent.currentTarget);
    const event = this.#readForm(formData);
    const config = getCalendarConfig();
    if (!event.title.trim()) return ui.notifications.warn("Bitte einen Titel eingeben.");
    if (compareDates(event.end, event.start, config) < 0) return ui.notifications.error("Das Enddatum darf nicht vor dem Startdatum liegen.");
    try {
      const saved = await CalendarStore.saveEvent(event, this.originalVisibility);
      ui.notifications.info(this.eventData ? "Kalendereintrag aktualisiert." : "Kalendereintrag erstellt.");
      await this.onSaved?.(saved);
      await this.close();
    } catch (error) {
      console.error(`${MODULE_ID} | Event konnte nicht gespeichert werden`, error);
      ui.notifications.error(error.message || "Der Kalendereintrag konnte nicht gespeichert werden.");
    }
  }

  #readForm(formData) {
    const requestedVisibility = String(formData.get("visibility") || this.defaultVisibility);
    const visibility = game.user.isGM
      ? requestedVisibility
      : [VISIBILITY.PUBLIC, VISIBILITY.PRIVATE].includes(requestedVisibility) ? requestedVisibility : VISIBILITY.PRIVATE;
    return {
      ...(this.eventData ?? {}),
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || ""),
      category: String(formData.get("category") || "event"),
      color: String(formData.get("color") || this.eventData?.color || ""),
      visibility,
      ownerId: this.eventData?.ownerId ?? game.user.id,
      start: readDate(formData, "start"),
      end: readDate(formData, "end")
    };
  }

  async #delete() {
    if (!this.eventData || !canUserEditEvent(this.eventData)) return;
    if (!window.confirm(`„${this.eventData.title}“ wirklich löschen?`)) return;
    await CalendarStore.removeEvent(this.eventData.id, this.eventData.visibility, {
      ownerId: this.eventData.ownerId,
      storage: this.eventData.storage
    });
    await this.onSaved?.(null);
    await this.close();
  }

  async #publish() {
    if (!this.eventData || !game.user.isGM) return;
    await CalendarStore.publishEvent(this.eventData.id);
    await this.onSaved?.(null);
    await this.close();
  }

  #toggleDateFields(root) {
    const config = getCalendarConfig();
    for (const prefix of ["start", "end"]) {
      const kind = root.querySelector(`[name='${prefix}Kind']`)?.value;
      const seasonIndex = Number(root.querySelector(`[name='${prefix}Season']`)?.value ?? 1) - 1;
      const specialEnabled = config.seasons[seasonIndex]?.specialDay.enabled || config.specialDays.length>0;
      const specialOption = root.querySelector(`[name='${prefix}Kind'] option[value='special']`);
      if (specialOption) specialOption.disabled = !specialEnabled;
      if (kind === "special" && !specialEnabled) root.querySelector(`[name='${prefix}Kind']`).value = "regular";
      const special = root.querySelector(`[name='${prefix}Kind']`)?.value === "special";
      root.querySelector(`[data-regular-fields='${prefix}']`)?.classList.toggle("is-hidden", special);
      root.querySelector(`[data-special-help='${prefix}']`)?.classList.toggle("is-hidden", !special);
    }
  }

  #populateDateOptions(root, prefix) {
    const config = getCalendarConfig();
    const seasonIndex = Number(root.querySelector(`[name='${prefix}Season']`)?.value ?? 1) - 1;
    const season = config.seasons[seasonIndex];
    const select = root.querySelector(`[name='${prefix}Month']`);
    const previous = Number(select?.value ?? 1);
    if (select) {
      select.innerHTML = season.months.map((month, index) => `<option value="${index + 1}">${escapeHtml(month.name)}</option>`).join("");
      select.value = String(Math.min(previous, season.months.length));
    }
    this.#populateDays(root, prefix);
    this.#toggleDateFields(root);
  }

  #populateDays(root, prefix) {
    const config = getCalendarConfig();
    const seasonIndex = Number(root.querySelector(`[name='${prefix}Season']`)?.value ?? 1) - 1;
    const monthIndex = Number(root.querySelector(`[name='${prefix}Month']`)?.value ?? 1) - 1;
    const days = config.seasons[seasonIndex]?.months[monthIndex]?.days ?? 1;
    const select = root.querySelector(`[name='${prefix}Day']`);
    const previous = Number(select?.value ?? 1);
    if (select) {
      select.innerHTML = Array.from({ length: days }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join("");
      select.value = String(Math.min(previous, days));
    }
  }
}

function buildDefaultEvent(date, visibility) {
  return { id: null, title: "", description: "", category: game.user.isGM && visibility !== VISIBILITY.PRIVATE ? "event" : "note", visibility, ownerId: game.user.id, start: date, end: date };
}

function dateFormContext(date, config) {
  const value = normalizeDate(date, config);
  const season = config.seasons[value.season - 1];
  const special = isSpecialDate(value);
  const month = season.months[(value.month ?? 1) - 1] ?? season.months[0];
  return {
    isRegular: !special,
    isSpecial: special,
    specialAllowed: season.specialDay.enabled || config.specialDays.length>0,
    specials: [ ...config.seasons.flatMap((s,i)=>s.specialDay.enabled?[{value:i+1,name:s.specialDay.name}]:[]),
      ...config.specialDays.map(s=>({value:-s.slot,name:s.name})) ].map(s=>({...s,selected:s.value===value.specialDay})),
    year: value.year,
    season: value.season,
    month: value.month ?? 1,
    day: value.day ?? 1,
    specialName: season.specialDay.name,
    seasons: config.seasons.map((entry, index) => ({ value: index + 1, name: entry.name, selected: value.season === index + 1 })),
    months: season.months.map((entry, index) => ({ value: index + 1, name: entry.name, selected: (value.month ?? 1) === index + 1 })),
    days: Array.from({ length: month.days }, (_, index) => ({ value: index + 1, selected: (value.day ?? 1) === index + 1 }))
  };
}

function readDate(formData, prefix) {
  const config = getCalendarConfig();
  const kind = String(formData.get(`${prefix}Kind`) || "regular");
  const year = Number(formData.get(`${prefix}Year`));
  const season = Number(formData.get(`${prefix}Season`));
  if (kind === "special") {
    const specialDay=Number(formData.get(`${prefix}Special`) || season);
    return normalizeDate({ year, season: specialDay>0?specialDay:season, specialDay }, config);
  }
  return normalizeDate({ year, season, month: Number(formData.get(`${prefix}Month`)), day: Number(formData.get(`${prefix}Day`)) }, config);
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}
