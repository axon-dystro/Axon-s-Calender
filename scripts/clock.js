import { MODULE_ID, SETTINGS } from "./constants.js";
import { absoluteMinute } from "./calendar-engine.js";
import { minutesPerDay } from "./calendar-config.js";
import { getCalendarConfig, isModuleUsable } from "./settings.js";
import { CalendarStore } from "./store.js";

export function primaryGM() {
  return game.users?.activeGM ?? Array.from(game.users ?? []).filter(u=>u.isGM && u.active).sort((a,b)=>a.id.localeCompare(b.id))[0];
}
export function timerStep(elapsedSeconds, rate, remainder, remaining = Infinity) {
  const amount = Math.max(0,elapsedSeconds)*rate+remainder;
  const minutes = Math.min(Math.floor(amount),Math.max(0,remaining));
  return { minutes, remainder: amount-Math.floor(amount), complete: minutes >= remaining };
}
export class CalendarClock {
  static interval = null;
  static busy = false;
  static remainder = 0;
  static target = Infinity;
  static last = 0;
  static running = false;
  static async start() {
    if (!game.user.isGM || primaryGM()?.id !== game.user.id) throw new Error("Der aktive Haupt-GM steuert den Timer.");
    if (!isModuleUsable() || !game.settings.get(MODULE_ID, SETTINGS.FEATURE_TIME_CONTROLS)) throw new Error("Zeitsteuerung ist deaktiviert.");
    this.stop();
    const config = getCalendarConfig();
    await CalendarStore.setTime(config.timer.startMinute);
    const state = CalendarStore.getState();
    let duration = config.timer.endMinute-config.timer.startMinute;
    if (duration<=0) duration+=minutesPerDay(config);
    this.target = config.timer.stopAtEnd ? absoluteMinute(state,config)+duration : Infinity;
    this.last = performance.now();
    this.remainder = 0;
    this.running = true;
    this.interval = setInterval(()=>this.tick(),1000);
    Hooks.callAll(`${MODULE_ID}.dataChanged`);
  }
  static stop() {
    clearInterval(this.interval);
    this.interval = null;
    this.running = false;
    Hooks.callAll(`${MODULE_ID}.dataChanged`);
  }
  static async tick() {
    if (this.busy || !this.running) return;
    if (!game.user.isGM || primaryGM()?.id !== game.user.id || !isModuleUsable()
      || !game.settings.get(MODULE_ID, SETTINGS.FEATURE_TIME_CONTROLS)) return this.stop();
    const now = performance.now();
    const elapsed = (now-this.last)/1000;
    this.last=now;
    const config=getCalendarConfig();
    if (config.timer.pauseWithGame && game.paused) return;
    const step = timerStep(elapsed,config.timer.rate,this.remainder,this.target-absoluteMinute(CalendarStore.getState(),config));
    this.remainder=step.remainder;
    this.busy=true;
    try {
      if (step.minutes) await CalendarStore.advanceMinutes(step.minutes,"timer");
      if (step.complete) this.stop();
    } catch(error) {
      this.stop();
      ui.notifications.error(`Timer angehalten: ${error.message}`);
    } finally { this.busy=false; }
  }
}
