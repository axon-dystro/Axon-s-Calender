import { MODULE_ID, SETTINGS } from "./constants.js";
import { formatDate, formatTime, moonStates, phaseForMinute } from "./calendar-engine.js";
import { CalendarApp } from "./calendar-app.js";
import { getCalendarConfig, isFeatureEnabled, isModuleUsable } from "./settings.js";
import { CalendarStore } from "./store.js";

export class CalendarHud {
  static element = null;
  static dragCleanup = null;
  static suppressMainClick = false;

  static mount() {
    const shouldShow = isModuleUsable()
      && isFeatureEnabled(SETTINGS.FEATURE_HUD)
      && game.settings.get(MODULE_ID, SETTINGS.SHOW_HUD);
    if (!shouldShow) return this.unmount();
    if (!this.element) {
      this.element = document.createElement("aside");
      this.element.id = `${MODULE_ID}-hud`;
      this.element.className = "axon-calendar-hud";
      document.body.append(this.element);
      this.#attachBaseListeners();
    }
    this.render();
    this.#applyPosition();
  }

  static unmount() {
    this.dragCleanup?.();
    this.dragCleanup = null;
    this.element?.remove();
    this.element = null;
  }

  static render() {
    if (!this.element) return;
    const state = CalendarStore.getState();
    const config = getCalendarConfig();
    const phase = phaseForMinute(state.minuteOfDay, config);
    const moonEnabled = isFeatureEnabled(SETTINGS.FEATURE_MOON)
      && game.settings.get(MODULE_ID, SETTINGS.SHOW_MOON_VISUALS);
    const moons = moonEnabled ? moonStates(state, config) : [];
    const canControl = game.user.isGM && isFeatureEnabled(SETTINGS.FEATURE_TIME_CONTROLS);
    const reduceMotion = game.settings.get(MODULE_ID, SETTINGS.REDUCE_MOTION);
    const locked = game.settings.get(MODULE_ID, SETTINGS.LOCK_HUD);
    const collapsed = game.settings.get(MODULE_ID, SETTINGS.HUD_COLLAPSED);

    this.element.classList.toggle("reduce-motion", reduceMotion);
    this.element.classList.toggle("is-locked", locked);
    this.element.classList.toggle("is-collapsed", collapsed);
    this.element.style.setProperty("--phase-color", phase.color);
    this.element.innerHTML = `
      <div class="ac-hud-crystal" aria-hidden="true"><span></span><i>${escapeHtml(phase.icon)}</i></div>
      <button class="ac-hud-drag" type="button" title="Uhr verschieben" aria-label="Uhr verschieben"><i class="fa-solid fa-grip-dots-vertical"></i></button>
      <button class="ac-hud-main" type="button" data-action="hud-main" title="${canControl ? "Zeitsteuerung öffnen" : "Kalender öffnen"}">
        <span class="ac-hud-phase">${escapeHtml(phase.name)}</span>
        <strong>${escapeHtml(formatTime(state.minuteOfDay, config))}</strong>
        <small>${escapeHtml(formatDate(state, config, { compact: true }))}</small>
      </button>
      <div class="ac-hud-moons">${moons.slice(0, 2).map((moon) => `<span title="${escapeAttribute(`${moon.name} · ${moon.label}`)}">${escapeHtml(moon.icon)}</span>`).join("")}</div>
      <button class="ac-hud-collapse" type="button" data-action="collapse" title="Kompaktansicht"><i class="fa-solid fa-chevron-left"></i></button>
      ${canControl ? timeControls(config) : ""}
    `;

    this.element.querySelector("[data-action='hud-main']")?.addEventListener("click", () => {
      if (this.suppressMainClick) {
        this.suppressMainClick = false;
        return;
      }
      if (collapsed) return game.settings.set(MODULE_ID, SETTINGS.HUD_COLLAPSED, false);
      if (canControl) this.element.classList.toggle("controls-open");
      else CalendarApp.open();
    });
    this.element.querySelector("[data-action='collapse']")?.addEventListener("click", async (event) => {
      event.stopPropagation();
      this.element.classList.remove("controls-open");
      await this.#persistCurrentPosition();
      await game.settings.set(MODULE_ID, SETTINGS.HUD_COLLAPSED, !collapsed);
    });
    this.element.querySelectorAll("[data-phase]").forEach((button) => button.addEventListener("click", async () => {
      await CalendarStore.setPhase(button.dataset.phase);
      this.element.classList.remove("controls-open");
    }));
    this.element.querySelectorAll("[data-minutes]").forEach((button) => button.addEventListener("click", async () => {
      await CalendarStore.advanceMinutes(Number(button.dataset.minutes), "hud-time-step");
    }));
    this.element.querySelector("[data-action='next-day']")?.addEventListener("click", async () => {
      await CalendarStore.nextDay();
      this.element.classList.remove("controls-open");
    });
    this.element.querySelector("[data-action='previous-day']")?.addEventListener("click", async () => CalendarStore.previousDay());
    this.element.querySelector("[data-action='open-calendar']")?.addEventListener("click", () => CalendarApp.open());
  }

  static async resetPosition() {
    await game.settings.set(MODULE_ID, SETTINGS.HUD_POSITION, {});
    requestAnimationFrame(() => this.#applyPosition(true));
  }

  static #attachBaseListeners() {
    this.element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (window.confirm("Kristall-Uhr auf die Standardposition neben der Hotbar zurücksetzen?")) this.resetPosition();
    });
    this.element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const collapsed = this.element.classList.contains("is-collapsed");
      const handle = event.target.closest(".ac-hud-drag")
        || (collapsed && !event.target.closest(".ac-hud-collapse"));
      if (!handle || game.settings.get(MODULE_ID, SETTINGS.LOCK_HUD)) return;
      this.#startDrag(event);
    });
  }

  static #startDrag(event) {
    const rect = this.element.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = rect.left;
    const originY = rect.top;
    let moved = false;
    this.element.classList.remove("controls-open");
    const move = (pointerEvent) => {
      if (!moved && Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY) < 4) return;
      if (!moved) {
        moved = true;
        this.element.classList.add("is-dragging");
      }
      if (pointerEvent.cancelable) pointerEvent.preventDefault();
      const currentRect = this.element.getBoundingClientRect();
      const left = clamp(originX + pointerEvent.clientX - startX, 8, window.innerWidth - currentRect.width - 8);
      const top = clamp(originY + pointerEvent.clientY - startY, 8, window.innerHeight - currentRect.height - 8);
      Object.assign(this.element.style, { left: `${left}px`, top: `${top}px`, right: "auto", bottom: "auto" });
      this.#applyDockClass();
    };
    const end = async () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      this.element.classList.remove("is-dragging");
      this.dragCleanup = null;
      if (moved) {
        this.suppressMainClick = true;
        await this.#persistCurrentPosition();
        window.setTimeout(() => { this.suppressMainClick = false; }, 100);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
    this.dragCleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }

  static async #persistCurrentPosition() {
    if (!this.element) return;
    const position = positionFromRect(this.element.getBoundingClientRect());
    await game.settings.set(MODULE_ID, SETTINGS.HUD_POSITION, position);
    this.#applyDockClass();
  }

  static #applyPosition(forceDefault = false) {
    if (!this.element) return;
    const stored = forceDefault ? {} : game.settings.get(MODULE_ID, SETTINGS.HUD_POSITION);
    if ((Number.isFinite(stored?.centerX) && Number.isFinite(stored?.centerY))
        || (Number.isFinite(stored?.left) && Number.isFinite(stored?.top))) {
      const rect = this.element.getBoundingClientRect();
      const desiredLeft = Number.isFinite(stored.centerX)
        ? stored.centerX * window.innerWidth - rect.width / 2
        : stored.left;
      const desiredTop = Number.isFinite(stored.centerY)
        ? stored.centerY * window.innerHeight - rect.height / 2
        : stored.top;
      const left = clamp(desiredLeft, 8, Math.max(8, window.innerWidth - rect.width - 8));
      const top = clamp(desiredTop, 8, Math.max(8, window.innerHeight - rect.height - 8));
      Object.assign(this.element.style, { left: `${left}px`, top: `${top}px`, right: "auto", bottom: "auto" });
      this.#applyDockClass();
      return;
    }
    requestAnimationFrame(() => {
      if (!this.element) return;
      const hotbar = document.querySelector("#hotbar");
      const rect = this.element.getBoundingClientRect();
      if (hotbar) {
        const hotbarRect = hotbar.getBoundingClientRect();
        Object.assign(this.element.style, {
          left: `${Math.max(8, hotbarRect.left - rect.width - 14)}px`,
          top: `${Math.min(window.innerHeight - rect.height - 8, hotbarRect.bottom - rect.height)}px`,
          right: "auto",
          bottom: "auto"
        });
      } else {
        Object.assign(this.element.style, { left: "20px", top: `${window.innerHeight - rect.height - 20}px`, right: "auto", bottom: "auto" });
      }
      this.#applyDockClass();
    });
  }

  static #applyDockClass() {
    if (!this.element) return;
    const rect = this.element.getBoundingClientRect();
    const vertical = rect.top + rect.height / 2 < window.innerHeight / 2 ? "top" : "bottom";
    const horizontal = rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right";
    this.element.dataset.vertical = vertical;
    this.element.dataset.horizontal = horizontal;
  }
}

function timeControls(config) {
  const hour = config.day.minutesPerHour;
  const step = config.day.stepMinutes;
  const phaseButtons = config.phases.map((phase, index) => {
    const angle = Math.round(index * 360 / config.phases.length);
    return `<button type="button" class="ac-orbit-phase" data-phase="${escapeAttribute(phase.id)}" style="--angle:${angle}deg;--item-color:${phase.color}" title="${escapeAttribute(phase.name)}"><span>${escapeHtml(phase.icon)}</span><small>${escapeHtml(phase.name)}</small></button>`;
  }).join("");
  return `
    <div class="ac-time-popover" role="menu" aria-label="Zeitsteuerung">
      <div class="ac-orbit-ring">${phaseButtons}<div class="ac-orbit-core"><i class="fa-solid fa-clock"></i><small>TAGESZEIT</small></div></div>
      <div class="ac-time-steps">
        <button type="button" data-action="previous-day" title="Vorheriger Tag"><i class="fa-solid fa-backward-step"></i></button>
        <button type="button" data-minutes="${-hour}">−1h</button>
        <button type="button" data-minutes="${-step}">−${step}m</button>
        <button type="button" data-action="open-calendar" title="Kalender"><i class="fa-regular fa-calendar"></i></button>
        <button type="button" data-minutes="${step}">+${step}m</button>
        <button type="button" data-minutes="${hour}">+1h</button>
        <button type="button" data-action="next-day" title="Nächster Tag"><i class="fa-solid fa-forward-step"></i></button>
      </div>
    </div>`;
}

function positionFromRect(rect) {
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    centerX: (rect.left + rect.width / 2) / window.innerWidth,
    centerY: (rect.top + rect.height / 2) / window.innerHeight
  };
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
