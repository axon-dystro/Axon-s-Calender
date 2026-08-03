import { AUTHOR_LINKS, MODULE_ID, SETTINGS, VISIBILITY } from "./constants.js";
import {
  dateKey,
  dateToOrdinal,
  eventOccursOn,
  formatDate,
  formatTime,
  isSpecialDate,
  moonStates,
  normalizeDate,
  parseDateKey,
  periodLabel,
  phaseForMinute,
  sameDate,
  shiftPeriod,
  weekdayIndex,
  weekdayName
} from "./calendar-engine.js";
import { CalendarConfigApp } from "./config-app.js";
import { EventEditor } from "./event-editor.js";
import { getCalendarConfig, isFeatureEnabled } from "./settings.js";
import { CalendarStore, canUserEditEvent } from "./store.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CalendarApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-calendar-app`,
    classes: [MODULE_ID, "axon-calendar-app"],
    tag: "section",
    window: { title: "Axon´s Calender", icon: "fa-solid fa-gem", resizable: true },
    position: { width: 1160, height: 790 }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/calendar.hbs` }
  };

  constructor(options = {}) {
    super(options);
    const current = CalendarStore.getState();
    this.viewDate = normalizeDate(current, getCalendarConfig());
    this.selectedDate = normalizeDate(current, getCalendarConfig());
    this.viewMode = "player";
    this.displayMode = "month";
  }

  static open() {
    if (!isFeatureEnabled(SETTINGS.FEATURE_CALENDAR)) {
      ui.notifications.warn("Das Kalenderfenster ist in den Moduleinstellungen deaktiviert.");
      return null;
    }
    if (!CalendarApp.instance) CalendarApp.instance = new CalendarApp();
    CalendarApp.instance.render({ force: true });
    return CalendarApp.instance;
  }

  async close(options = {}) {
    CalendarApp.instance = null;
    return super.close(options);
  }

  async refresh() {
    if (this.rendered) await this.render({ force: true });
  }

  async _prepareContext() {
    const config = getCalendarConfig();
    const current = CalendarStore.getState();
    this.viewDate = normalizeDate(this.viewDate, config);
    this.selectedDate = normalizeDate(this.selectedDate, config);
    const events = await CalendarStore.getVisibleEvents(this.viewMode);
    const selected = this.selectedDate;
    const phase = phaseForMinute(current.minuteOfDay, config);
    const moonEnabled = isFeatureEnabled(SETTINGS.FEATURE_MOON)
      && game.settings.get(MODULE_ID, SETTINGS.SHOW_MOON_VISUALS);
    const selectedMoons = moonEnabled ? moonStates(selected, config).map((moon) => ({
      ...moon,
      illuminationLabel: `${Math.round(moon.illumination * 100)} % beleuchtet`
    })) : [];
    const backgroundMoon = selectedMoons[0] ?? null;
    const viewingSpecial = isSpecialDate(this.viewDate);

    const context = {
      calendarName: config.name,
      calendarDescription: config.description,
      isGM: game.user.isGM,
      viewMode: this.viewMode,
      playerViewActive: this.viewMode === "player",
      gmViewActive: this.viewMode === "gm",
      monthView: this.displayMode === "month",
      yearView: this.displayMode === "year",
      agendaView: this.displayMode === "agenda",
      currentLabel: formatDate(current, config),
      currentTime: formatTime(current.minuteOfDay, config),
      currentPhase: phase,
      viewingSpecial,
      selectedMoons,
      backgroundMoon,
      showMoonBackground: Boolean(backgroundMoon && game.settings.get(MODULE_ID, SETTINGS.SHOW_MOON_BACKGROUND)),
      canAdd: this.#canAdd(),
      canSetCurrent: game.user.isGM,
      header: periodLabel(this.viewDate, config),
      yearHeader: `${this.viewDate.year}${config.eraLabel ? ` ${config.eraLabel}` : ""}`,
      selectedLabel: formatDate(selected, config),
      specialDescription: viewingSpecial ? specialDescription(this.viewDate, config) : null,
      selectedEvents: events.filter((event) => eventOccursOn(event, selected, config)).map((event) => eventContext(event, config)),
      authorLinks: AUTHOR_LINKS,
      config
    };

    if (this.displayMode === "month" && !viewingSpecial) {
      context.weekdays = config.weekdays;
      context.cells = buildMonthCells(this.viewDate, current, selected, events, moonEnabled, config);
      context.seasonColor = config.seasons[this.viewDate.season - 1].color;
    }
    if (this.displayMode === "year") context.year = buildYear(this.viewDate.year, current, events, config);
    if (this.displayMode === "agenda") context.agenda = buildAgenda(events, config);
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    root.querySelector("[data-action='previous-period']")?.addEventListener("click", () => this.#changePeriod(-1));
    root.querySelector("[data-action='next-period']")?.addEventListener("click", () => this.#changePeriod(1));
    root.querySelector("[data-action='today']")?.addEventListener("click", () => this.#goToday());
    root.querySelector("[data-action='player-view']")?.addEventListener("click", () => this.#switchDataView("player"));
    root.querySelector("[data-action='gm-view']")?.addEventListener("click", () => this.#switchDataView("gm"));
    root.querySelector("[data-action='add-event']")?.addEventListener("click", () => this.#addEvent());
    root.querySelector("[data-action='set-current']")?.addEventListener("click", () => this.#setCurrentDate());
    root.querySelector("[data-action='configure']")?.addEventListener("click", () => new CalendarConfigApp().render({ force: true }));
    root.querySelectorAll("[data-display-mode]").forEach((button) => button.addEventListener("click", () => {
      this.displayMode = button.dataset.displayMode;
      this.render({ force: true });
    }));
    root.querySelectorAll("[data-date-key]").forEach((cell) => cell.addEventListener("click", () => {
      const config = getCalendarConfig();
      const date = parseDateKey(cell.dataset.dateKey, config);
      this.selectedDate = date;
      if (cell.dataset.openMonth === "true") {
        this.viewDate = date;
        this.displayMode = "month";
      }
      this.render({ force: true });
    }));
    root.querySelectorAll("[data-agenda-date]").forEach((button) => button.addEventListener("click", (event) => {
      event.stopPropagation();
      const config = getCalendarConfig();
      const date = parseDateKey(button.dataset.agendaDate, config);
      this.viewDate = date;
      this.selectedDate = date;
      this.displayMode = "month";
      this.render({ force: true });
    }));
    root.querySelectorAll("[data-event-id]").forEach((element) => element.addEventListener("click", (event) => {
      event.stopPropagation();
      this.#editEvent(element.dataset.eventId, element.dataset.visibility);
    }));
    root.querySelectorAll("[data-publish-id]").forEach((button) => button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await CalendarStore.publishEvent(button.dataset.publishId);
      await this.refresh();
    }));
  }

  #changePeriod(direction) {
    const config = getCalendarConfig();
    if (this.displayMode === "year") {
      this.viewDate = normalizeDate({ ...this.viewDate, year: this.viewDate.year + (direction >= 0 ? 1 : -1) }, config);
    } else if (this.displayMode === "agenda") {
      this.viewDate = normalizeDate({ ...this.viewDate, year: this.viewDate.year + (direction >= 0 ? 1 : -1) }, config);
    } else {
      this.viewDate = shiftPeriod(this.viewDate, direction, config);
    }
    this.selectedDate = isSpecialDate(this.viewDate)
      ? normalizeDate(this.viewDate, config)
      : normalizeDate({ ...this.viewDate, day: 1 }, config);
    this.render({ force: true });
  }

  #goToday() {
    const config = getCalendarConfig();
    const current = CalendarStore.getState();
    this.viewDate = normalizeDate(current, config);
    this.selectedDate = normalizeDate(current, config);
    this.displayMode = "month";
    this.render({ force: true });
  }

  #switchDataView(mode) {
    if (!game.user.isGM) return;
    this.viewMode = mode === "gm" ? "gm" : "player";
    this.render({ force: true });
  }

  #canAdd() {
    if (game.user.isGM) {
      return this.viewMode === "gm"
        ? isFeatureEnabled(SETTINGS.FEATURE_GM_PLANNER)
        : isFeatureEnabled(SETTINGS.FEATURE_PUBLIC_EVENTS);
    }
    return isFeatureEnabled(SETTINGS.FEATURE_PERSONAL_NOTES)
      || isFeatureEnabled(SETTINGS.FEATURE_PUBLIC_EVENTS);
  }

  #addEvent() {
    if (!this.#canAdd()) return;
    const defaultVisibility = game.user.isGM
      ? (this.viewMode === "gm" ? VISIBILITY.GM : VISIBILITY.PUBLIC)
      : VISIBILITY.PRIVATE;
    EventEditor.open({ defaultDate: this.selectedDate, defaultVisibility, onSaved: () => this.refresh() });
  }

  async #editEvent(id, visibility) {
    const events = await CalendarStore.getVisibleEvents(this.viewMode);
    const event = events.find((candidate) => candidate.id === id && candidate.visibility === visibility);
    if (!event) return;
    if (!canUserEditEvent(event)) return ui.notifications.info("Dieser Eintrag kann nur von seinem Besitzer oder dem GM bearbeitet werden.");
    EventEditor.open({ event, defaultDate: event.start, defaultVisibility: event.visibility, onSaved: () => this.refresh() });
  }

  async #setCurrentDate() {
    if (!game.user.isGM) return;
    const config = getCalendarConfig();
    const label = formatDate(this.selectedDate, config);
    if (!window.confirm(`Aktuelles Kampagnendatum wirklich auf „${label}“ setzen? Die Uhrzeit bleibt erhalten.`)) return;
    await CalendarStore.setState({ ...this.selectedDate, minuteOfDay: CalendarStore.getState().minuteOfDay }, "date-corrected", { syncFoundryTime: false });
    ui.notifications.info("Aktuelles Kampagnendatum geändert.");
    await this.refresh();
  }
}

function buildMonthCells(viewDate, current, selected, events, moonEnabled, config) {
  const season = config.seasons[viewDate.season - 1];
  const month = season.months[viewDate.month - 1];
  const firstDate = normalizeDate({ year: viewDate.year, season: viewDate.season, month: viewDate.month, day: 1 }, config);
  const offset = weekdayIndex(firstDate, config) ?? 0;
  const cells = Array.from({ length: offset }, () => ({ blank: true }));
  for (let day = 1; day <= month.days; day += 1) {
    const date = normalizeDate({ year: viewDate.year, season: viewDate.season, month: viewDate.month, day }, config);
    const dayEvents = events.filter((event) => eventOccursOn(event, date, config));
    const moons = moonEnabled ? moonStates(date, config) : [];
    cells.push({
      blank: false,
      dateKey: dateKey(date, config),
      day,
      weekday: weekdayName(date, config),
      isCurrent: sameDate(date, current, config),
      isSelected: sameDate(date, selected, config),
      isMoonTurn: moons.some((moon) => moon.turning),
      moons: moons.slice(0, 3),
      events: dayEvents.slice(0, 3).map((event) => eventContext(event, config)),
      overflow: Math.max(0, dayEvents.length - 3)
    });
  }
  while (cells.length % config.weekdays.length !== 0) cells.push({ blank: true });
  return cells;
}

function buildYear(year, current, events, config) {
  return config.seasons.map((season, seasonIndex) => ({
    ...season,
    number: seasonIndex + 1,
    months: season.months.map((month, monthIndex) => {
      const date = { year, season: seasonIndex + 1, month: monthIndex + 1, day: 1, specialDay: null };
      const end = { ...date, day: month.days };
      return {
        ...month,
        number: monthIndex + 1,
        dateKey: dateKey(date, config),
        current: current.year === year && current.season === seasonIndex + 1 && current.month === monthIndex + 1,
        eventCount: events.filter((event) => dateToOrdinal(event.end ?? event.start, config) >= dateToOrdinal(date, config)
          && dateToOrdinal(event.start, config) <= dateToOrdinal(end, config)).length
      };
    }),
    special: season.specialDay.enabled ? {
      ...season.specialDay,
      dateKey: dateKey({ year, season: seasonIndex + 1, month: null, day: null, specialDay: seasonIndex + 1 }, config),
      current: current.year === year && current.specialDay === seasonIndex + 1
    } : null
  }));
}

function buildAgenda(events, config) {
  return [...events]
    .sort((left, right) => dateToOrdinal(left.start, config) - dateToOrdinal(right.start, config))
    .map((event) => ({
      ...eventContext(event, config),
      startLabel: formatDate(event.start, config, { compact: true }),
      endLabel: sameDate(event.start, event.end, config) ? null : formatDate(event.end, config, { compact: true }),
      dateKey: dateKey(event.start, config)
    }));
}

function eventContext(event, config) {
  const visibilityLabel = {
    [VISIBILITY.PUBLIC]: event.storage === "user" ? "Geteilt" : "Öffentlich",
    [VISIBILITY.GM]: "Nur GM",
    [VISIBILITY.PRIVATE]: "Privat"
  }[event.visibility] ?? event.visibility;
  return {
    ...event,
    visibilityLabel,
    ownerName: game.users.get(event.ownerId)?.name ?? "Unbekannt",
    canPublish: game.user.isGM && event.visibility === VISIBILITY.GM,
    cssClass: `visibility-${event.visibility} category-${event.category}`,
    startLabel: formatDate(event.start, config, { compact: true })
  };
}

function specialDescription(date, config) {
  const value = normalizeDate(date, config);
  const special = config.seasons[value.season - 1].specialDay;
  if (special.description) return special.description;
  return special.outsideYear
    ? "Dieser Sondertag liegt zwischen den Jahren."
    : "Dieser Sondertag liegt außerhalb der normalen Monatsfolge.";
}
