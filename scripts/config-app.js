import { createBlankPreset, ILLIDOR_PRESET, normalizeCalendarConfig, validateCalendarConfig } from "./calendar-config.js";
import { MODULE_ID, SETTINGS } from "./constants.js";
import { formatTime, isSpecialDate, normalizeDate } from "./calendar-engine.js";
import { getCalendarConfig, getFeatureSettings, setCalendarConfig, setFeatureSettings } from "./settings.js";
import { CalendarStore } from "./store.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FEATURE_ROWS = [
  [SETTINGS.FEATURE_CALENDAR, "Kalenderfenster", "Monats-, Jahres- und Agendaansicht"],
  [SETTINGS.FEATURE_HUD, "Kristall-Uhr", "Verschiebbares HUD neben der Hotbar"],
  [SETTINGS.FEATURE_TIME_CONTROLS, "GM-Zeitsteuerung", "Uhrzeit und Spieltag über das HUD verändern"],
  [SETTINGS.FEATURE_PUBLIC_EVENTS, "Öffentliche Einträge", "GM-Ereignisse und geteilte Spielernotizen"],
  [SETTINGS.FEATURE_GM_PLANNER, "Geheime GM-Planung", "Nicht sichtbare Vorbereitung mit späterer Veröffentlichung"],
  [SETTINGS.FEATURE_PERSONAL_NOTES, "Private Spielernotizen", "Eigene Notizen je Foundry-Benutzer"],
  [SETTINGS.FEATURE_MOON, "Mondsystem", "Mondphasen im HUD und Kalender"],
  [SETTINGS.FEATURE_SCENE_LIGHTING, "Szenenhelligkeit", "Aktive Szene an die Tagesphase anpassen"],
  [SETTINGS.SYNC_FOUNDRY_TIME, "Foundry-Weltzeit", "Änderungen an der Axon-Uhr an Foundry weitergeben"]
];

export class CalendarConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-config-app`,
    classes: [MODULE_ID, "axon-calendar-config"],
    tag: "section",
    window: {
      title: "Axons Kalender · Designer",
      icon: "fa-solid fa-wand-magic-sparkles",
      resizable: true
    },
    position: { width: 980, height: 820 }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/config.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this.draft = getCalendarConfig();
    this.stateDraft = CalendarStore.getState();
    this.featureDraft = getFeatureSettings();
    this.activeTab = "general";
    this.message = null;
  }

  async _prepareContext() {
    const config = normalizeCalendarConfig(this.draft);
    const state = normalizeDate(this.stateDraft, config);
    const selectedSeason = config.seasons[state.season - 1];
    const selectedMonth = selectedSeason.months[(state.month ?? 1) - 1] ?? selectedSeason.months[0];
    const tabs = [
      ["general", "Grundlagen", "fa-sliders"],
      ["structure", "Kalenderbau", "fa-calendar-days"],
      ["moons", "Monde", "fa-moon"],
      ["phases", "Tageszeit", "fa-clock"],
      ["features", "Module", "fa-toggle-on"]
    ].map(([id, label, icon]) => ({ id, label, icon, active: this.activeTab === id }));

    return {
      config,
      tabs,
      message: this.message,
      weekdaysText: config.weekdays.join("\n"),
      weekResetOptions: [
        { value: "season", label: "Zu Beginn jeder Jahreszeit", selected: config.week.reset === "season" },
        { value: "year", label: "Zu Beginn jedes Jahres", selected: config.week.reset === "year" },
        { value: "never", label: "Fortlaufend über alle Jahre", selected: config.week.reset === "never" }
      ],
      seasons: config.seasons.map((season, seasonIndex) => ({
        ...season,
        index: seasonIndex,
        number: seasonIndex + 1,
        months: season.months.map((month, monthIndex) => ({ ...month, index: monthIndex, number: monthIndex + 1 }))
      })),
      moons: config.moons.map((moon, index) => ({ ...moon, index, number: index + 1 })),
      phases: config.phases.map((phase, index) => ({
        ...phase,
        index,
        number: index + 1,
        startTime: formatTime(phase.startMinute, config)
      })),
      state: {
        ...state,
        kind: isSpecialDate(state) ? "special" : "regular",
        isRegular: !isSpecialDate(state),
        isSpecial: isSpecialDate(state),
        minuteOfDay: Number(this.stateDraft.minuteOfDay ?? 0),
        time: formatTime(this.stateDraft.minuteOfDay ?? 0, config),
        seasons: config.seasons.map((season, index) => ({ value: index + 1, name: season.name, selected: state.season === index + 1 })),
        months: selectedSeason.months.map((month, index) => ({ value: index + 1, name: month.name, selected: (state.month ?? 1) === index + 1 })),
        days: Array.from({ length: selectedMonth.days }, (_, index) => ({ value: index + 1, selected: (state.day ?? 1) === index + 1 }))
      },
      phaseChoices: config.phases.map((phase) => ({ ...phase, selected: phase.id === config.day.nextDayPhaseId })),
      features: FEATURE_ROWS.map(([key, label, hint]) => ({ key, label, hint, checked: Boolean(this.featureDraft[key]) }))
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    const form = root.querySelector("form");
    if (!form) return;

    form.addEventListener("submit", (event) => this.#save(event));
    root.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
      this.#capture(root);
      this.activeTab = button.dataset.tab;
      this.message = null;
      this.render({ force: true });
    }));
    root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", (event) => this.#action(event, root)));
    root.querySelector("[name='currentSeason']")?.addEventListener("change", () => this.#refreshCurrentDateOptions(root));
    root.querySelector("[name='currentMonth']")?.addEventListener("change", () => this.#refreshCurrentDayOptions(root));
    root.querySelector("[name='currentKind']")?.addEventListener("change", (event) => {
      root.querySelector("[data-current-regular]")?.classList.toggle("is-hidden", event.currentTarget.value === "special");
    });
    root.querySelector("[data-action='import-file']")?.addEventListener("change", (event) => this.#importFile(event));
  }

  async #action(event, root) {
    const button = event.currentTarget;
    const action = button.dataset.action;
    if (action === "import-file") return;
    event.preventDefault();
    this.#capture(root);

    if (action === "add-season") {
      const number = this.draft.seasons.length + 1;
      this.draft.seasons.push({
        id: `season-${number}`,
        name: `Jahreszeit ${number}`,
        color: "#c879ff",
        months: [{ id: `season-${number}-month-1`, name: "Monat 1", days: 28 }],
        specialDay: { enabled: false, id: `season-${number}-special`, name: "Sondertag", outsideYear: false, description: "" }
      });
    } else if (action === "remove-season") {
      if (this.draft.seasons.length <= 1) return ui.notifications.warn("Mindestens eine Jahreszeit muss bleiben.");
      this.draft.seasons.splice(Number(button.dataset.season), 1);
    } else if (action === "add-month") {
      const season = this.draft.seasons[Number(button.dataset.season)];
      const number = season.months.length + 1;
      season.months.push({ id: `${season.id}-month-${number}`, name: `Monat ${number}`, days: 28 });
    } else if (action === "remove-month") {
      const season = this.draft.seasons[Number(button.dataset.season)];
      if (season.months.length <= 1) return ui.notifications.warn("Jede Jahreszeit braucht mindestens einen Monat.");
      season.months.splice(Number(button.dataset.month), 1);
    } else if (action === "add-moon") {
      const number = this.draft.moons.length + 1;
      this.draft.moons.push({ id: `moon-${number}`, name: `Mond ${number}`, cycleDays: 28, offsetDays: 0, color: "#eadcff", fullOnSpecialDays: false, alwaysVisibleOnOutsideYear: false, turningLabel: "Neumond" });
    } else if (action === "remove-moon") {
      this.draft.moons.splice(Number(button.dataset.moon), 1);
    } else if (action === "add-phase") {
      const number = this.draft.phases.length + 1;
      const startMinute = Math.floor(number * this.draft.day.hours * this.draft.day.minutesPerHour / (number + 1));
      this.draft.phases.push({ id: `phase-${number}`, name: `Phase ${number}`, startMinute, icon: "◉", color: "#c879ff", darkness: 0 });
    } else if (action === "remove-phase") {
      if (this.draft.phases.length <= 1) return ui.notifications.warn("Mindestens eine Tagesphase muss bleiben.");
      this.draft.phases.splice(Number(button.dataset.phase), 1);
    } else if (action === "preset-illidor") {
      if (!window.confirm("Die aktuelle Kalenderstruktur wirklich durch das Illidor-Preset ersetzen? Ereignisse bleiben gespeichert, können danach aber auf andere Daten zeigen.")) return;
      this.draft = structuredClone(ILLIDOR_PRESET);
      this.stateDraft = { year: 278, season: 5, month: 2, day: 10, specialDay: null, minuteOfDay: 21 * 60 };
    } else if (action === "preset-blank") {
      if (!window.confirm("Mit einer neutralen Kalenderstruktur beginnen? Ereignisse bleiben gespeichert.")) return;
      this.draft = createBlankPreset();
      this.stateDraft = { year: 1, season: 1, month: 1, day: 1, specialDay: null, minuteOfDay: 8 * 60 };
    } else if (action === "export") {
      return this.#export();
    } else if (action === "open-import") {
      root.querySelector("[data-action='import-file']")?.click();
      return;
    }
    this.message = null;
    this.render({ force: true });
  }

  #capture(root) {
    const form = root.querySelector("form");
    if (!form) return;
    const data = new FormData(form);
    const draft = structuredClone(this.draft);
    draft.name = String(data.get("calendarName") ?? draft.name);
    draft.description = String(data.get("calendarDescription") ?? draft.description);
    draft.eraLabel = String(data.get("eraLabel") ?? draft.eraLabel);
    draft.weekdays = String(data.get("weekdays") ?? "").split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
    draft.week = {
      firstWeekday: Number(data.get("firstWeekday") ?? 0),
      reset: String(data.get("weekReset") ?? "year"),
      specialDaysAdvance: data.has("specialDaysAdvance")
    };
    draft.day = {
      hours: Number(data.get("hours") ?? 24),
      minutesPerHour: Number(data.get("minutesPerHour") ?? 60),
      stepMinutes: Number(data.get("stepMinutes") ?? 10),
      nextDayPhaseId: String(data.get("nextDayPhaseId") ?? draft.day.nextDayPhaseId)
    };

    draft.seasons = Array.from(root.querySelectorAll("[data-season-row]")).map((row, seasonIndex) => {
      const previous = draft.seasons[seasonIndex] ?? {};
      const months = Array.from(row.querySelectorAll("[data-month-row]")).map((monthRow, monthIndex) => ({
        id: previous.months?.[monthIndex]?.id ?? `season-${seasonIndex + 1}-month-${monthIndex + 1}`,
        name: monthRow.querySelector("[data-month-name]")?.value ?? `Monat ${monthIndex + 1}`,
        days: Number(monthRow.querySelector("[data-month-days]")?.value ?? 28)
      }));
      return {
        id: previous.id ?? `season-${seasonIndex + 1}`,
        name: row.querySelector("[data-season-name]")?.value ?? `Jahreszeit ${seasonIndex + 1}`,
        color: row.querySelector("[data-season-color]")?.value ?? "#c879ff",
        months,
        specialDay: {
          enabled: Boolean(row.querySelector("[data-special-enabled]")?.checked),
          id: previous.specialDay?.id ?? `season-${seasonIndex + 1}-special`,
          name: row.querySelector("[data-special-name]")?.value ?? "Sondertag",
          outsideYear: Boolean(row.querySelector("[data-special-outside]")?.checked),
          description: row.querySelector("[data-special-description]")?.value ?? ""
        }
      };
    });

    draft.moons = Array.from(root.querySelectorAll("[data-moon-row]")).map((row, index) => ({
      id: draft.moons[index]?.id ?? `moon-${index + 1}`,
      name: row.querySelector("[data-moon-name]")?.value ?? `Mond ${index + 1}`,
      cycleDays: Number(row.querySelector("[data-moon-cycle]")?.value ?? 28),
      offsetDays: Number(row.querySelector("[data-moon-offset]")?.value ?? 0),
      color: row.querySelector("[data-moon-color]")?.value ?? "#eadcff",
      fullOnSpecialDays: Boolean(row.querySelector("[data-moon-special]")?.checked),
      alwaysVisibleOnOutsideYear: Boolean(row.querySelector("[data-moon-always]")?.checked),
      turningLabel: row.querySelector("[data-moon-turning]")?.value ?? "Neumond"
    }));

    draft.phases = Array.from(root.querySelectorAll("[data-phase-row]")).map((row, index) => ({
      id: row.querySelector("[data-phase-id]")?.value ?? `phase-${index + 1}`,
      name: row.querySelector("[data-phase-name]")?.value ?? `Phase ${index + 1}`,
      startMinute: parseTime(row.querySelector("[data-phase-time]")?.value, draft.day.minutesPerHour),
      icon: row.querySelector("[data-phase-icon]")?.value ?? "◉",
      color: row.querySelector("[data-phase-color]")?.value ?? "#c879ff",
      darkness: Number(row.querySelector("[data-phase-darkness]")?.value ?? 0)
    }));

    this.draft = normalizeCalendarConfig(draft);
    const kind = String(data.get("currentKind") ?? "regular");
    const season = Number(data.get("currentSeason") ?? 1);
    this.stateDraft = {
      ...this.stateDraft,
      year: Number(data.get("currentYear") ?? 1),
      season,
      month: kind === "special" ? null : Number(data.get("currentMonth") ?? 1),
      day: kind === "special" ? null : Number(data.get("currentDay") ?? 1),
      specialDay: kind === "special" ? season : null,
      minuteOfDay: parseTime(String(data.get("currentTime") ?? "00:00"), this.draft.day.minutesPerHour)
    };
    this.featureDraft = Object.fromEntries(FEATURE_ROWS.map(([key]) => [key, data.has(`feature.${key}`)]));
  }

  async #save(event) {
    event.preventDefault();
    this.#capture(this.element);
    const issues = validateCalendarConfig(this.draft);
    if (issues.length) {
      this.message = { error: true, text: issues.join(" ") };
      return this.render({ force: true });
    }
    try {
      const config = await setCalendarConfig(this.draft);
      await setFeatureSettings(this.featureDraft);
      await CalendarStore.setState({ ...normalizeDate(this.stateDraft, config), minuteOfDay: this.stateDraft.minuteOfDay }, "designer-save", { syncFoundryTime: false });
      this.draft = config;
      this.stateDraft = CalendarStore.getState();
      this.message = { success: true, text: "Kalender gespeichert. Alle verbundenen Spieler sehen die Änderungen sofort." };
      ui.notifications.info("Axons Kalender wurde gespeichert.");
      await this.render({ force: true });
    } catch (error) {
      console.error(`${MODULE_ID} | Kalender konnte nicht gespeichert werden`, error);
      this.message = { error: true, text: error.message || "Der Kalender konnte nicht gespeichert werden." };
      await this.render({ force: true });
    }
  }

  #export() {
    const payload = {
      format: "axons-calendar",
      version: 2,
      exportedAt: new Date().toISOString(),
      calendar: this.draft,
      state: this.stateDraft,
      features: this.featureDraft
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${this.draft.id || "axons-kalender"}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async #importFile(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const calendar = payload.calendar ?? payload;
      this.draft = normalizeCalendarConfig(calendar);
      if (payload.state) this.stateDraft = payload.state;
      if (payload.features) this.featureDraft = { ...this.featureDraft, ...payload.features };
      this.message = { success: true, text: "Import geladen. Prüfe die Vorschau und klicke anschließend auf Speichern." };
      await this.render({ force: true });
    } catch (error) {
      this.message = { error: true, text: `Import fehlgeschlagen: ${error.message}` };
      await this.render({ force: true });
    } finally {
      event.currentTarget.value = "";
    }
  }

  #refreshCurrentDateOptions(root) {
    this.#capture(root);
    this.render({ force: true });
  }

  #refreshCurrentDayOptions(root) {
    this.#capture(root);
    this.render({ force: true });
  }
}

function parseTime(value, minutesPerHour) {
  const [hour, minute] = String(value ?? "0:0").split(":").map(Number);
  return Math.max(0, (Number.isFinite(hour) ? hour : 0) * minutesPerHour + (Number.isFinite(minute) ? minute : 0));
}
