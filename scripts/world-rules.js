// Pure, versioned configuration shared by the designer, engine and permission checks.
export const RULE_SECTIONS = {
  specialDays: "Sondertage", seasonRanges: "Freie Jahreszeiten", sun: "Sonnenzyklus",
  timer: "Zeitablauf", theme: "Theme", colors: "Farben", categories: "Ereigniskategorien",
  structure: "Kalenderstruktur", phases: "Tagesphasen", eventColors: "Eintragsfarben"
};
export const ACCESS_MODES = { fixed: "GM-Vorgabe", view: "Nur ansehen", edit: "Spieler dürfen ändern", hidden: "Verborgen" };
export const color = (value, fallback = "#a765ff") => /^#[0-9a-f]{6}$/i.test(String(value)) ? value : fallback;
const number = (v, min, max, fallback) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback;
const integer = (v, min, max, fallback) => Math.trunc(number(v, min, max, fallback));
const text = (v, fallback = "", max = 100) => String(v ?? fallback).trim().slice(0, max);
const rows = (v, max = 200) => Array.isArray(v) ? v.slice(0, max) : [];
const id = (v, fallback) => text(v, fallback).replace(/[^a-zA-Z0-9_-]/g, "-") || fallback;
const unique = (items) => { const seen = new Set(); return items.map((item, i) => { let key = item.id; while (seen.has(key)) key += `-${i}`; seen.add(key); return { ...item, id: key }; }); };
export const DEFAULT_CATEGORIES = [
  { id: "event", name: "Ereignis", color: "#a765ff", locked: false },
  { id: "quest", name: "Quest", color: "#408cff", locked: true },
  { id: "note", name: "Notiz", color: "#f06bc7", locked: false },
  { id: "celebration", name: "Feier & Fest", color: "#e8b45d", locked: false },
  { id: "travel", name: "Reise", color: "#7fffd4", locked: false },
  { id: "session", name: "Session", color: "#c879ff", locked: false }
];
export function normalizeExtensions(source, seasons, dayLength) {
  const permissions = Object.fromEntries(Object.keys(RULE_SECTIONS).map(key => [key,
    Object.hasOwn(ACCESS_MODES, source.permissions?.[key]) ? source.permissions[key] : (key === "eventColors" ? "edit" : "view")]));
  const usedSlots = new Set();
  const specialDays = unique(rows(source.specialDays).map((s, i) => {
    let slot = integer(s.slot, 1, 1000000, i+1);
    while (usedSlots.has(slot)) slot++;
    usedSlots.add(slot);
    const season = integer(s.season, 1, seasons.length, 1);
    const month = integer(s.month, 1, seasons[season - 1].months.length, 1);
    return { slot, id: id(s.id, `extra-${i+1}`), name: text(s.name, "Sondertag"), season, month,
      afterDay: integer(s.afterDay, 0, seasons[season-1].months[month-1].days, 0),
      color: color(s.color), description: text(s.description, "", 1000), outsideYear: !!s.outsideYear };
  }));
  const cycleDays = integer(source.sun?.cycleDays, 1, 10000, 7);
  return {
    permissions, specialDays,
    seasonRanges: unique(rows(source.seasonRanges).map((s,i) => ({ id: id(s.id, `range-${i+1}`), name: text(s.name, "Jahreszeit"),
      startDay: integer(s.startDay, 1, 1000000, 1), endDay: integer(s.endDay, 1, 1000000, 30), color: color(s.color) }))),
    colors: { day: color(source.colors?.day, "#f4eaff"), week: color(source.colors?.week, "#b8a9d1"), special: color(source.colors?.special, "#e8b45d"),
      weekdays: rows(source.colors?.weekdays, 60).map(c => color(c, "#f4eaff")) },
    categories: unique((Array.isArray(source.categories) && source.categories.length ? rows(source.categories) : DEFAULT_CATEGORIES).map((c,i) => ({
      id: id(c.id, `category-${i+1}`), name: text(c.name, "Kategorie"), color: color(c.color), locked: !!c.locked
    }))),
    eventColors: { mode: ["free", "palette", "category", "fixed"].includes(source.eventColors?.mode) ? source.eventColors.mode : "category",
      fixed: color(source.eventColors?.fixed), palette: (rows(source.eventColors?.palette, 32).length ? source.eventColors.palette.slice(0,32) : ["#408cff", "#f06bc7", "#e8b45d"]).map(c => color(c)) },
    sun: { mode: ["daily", "rules", "cycle"].includes(source.sun?.mode) ? source.sun.mode : "daily",
      cycleDays, offsetMinutes: integer(source.sun?.offsetMinutes, -100000000, 100000000, 0),
      phases: unique(rows(source.sun?.phases).map((s,i) => ({ id: id(s.id, `sun-${i+1}`), name: text(s.name, "Sonnenphase"),
        startMinute: integer(s.startMinute, 0, cycleDays*dayLength-1, 0), color: color(s.color, "#ffd36b"),
        icon: text(s.icon, "☀️", 12), darkness: number(s.darkness,0,1,0) }))).sort((a,b)=>a.startMinute-b.startMinute),
      rules: unique(rows(source.sun?.rules).map((s,i) => ({ id: id(s.id, `rule-${i+1}`),
        kind: ["weekday", "month", "season", "date"].includes(s.kind) ? s.kind : "weekday", match: text(s.match, "1"),
        sunrise: integer(s.sunrise,0,dayLength-1,Math.min(360,dayLength-1)), sunset: integer(s.sunset,0,dayLength-1,Math.min(1080,dayLength-1)),
        color: color(s.color, "#ffd36b") }))) },
    timer: { rate: number(source.timer?.rate, 0.01, 10000, 1),
      startMinute: integer(source.timer?.startMinute,0,dayLength-1,0), endMinute: integer(source.timer?.endMinute,0,dayLength-1,dayLength-1),
      stopAtEnd: source.timer?.stopAtEnd !== false, pauseWithGame: source.timer?.pauseWithGame !== false }
  };
}
export function canChange(config, section, user) { return !!user?.isGM || config.permissions[section] === "edit"; }
export function canView(config, section, user) { return !!user?.isGM || config.permissions[section] !== "hidden"; }
export function eventColor(event, config) {
  const category = config.categories.find(c => c.id === event.category);
  if (config.eventColors.mode === "fixed") return config.eventColors.fixed;
  if (category?.locked || config.eventColors.mode === "category") return category?.color ?? config.eventColors.fixed;
  if (config.eventColors.mode === "palette") return config.eventColors.palette.includes(event.color) ? event.color : config.eventColors.palette[0];
  return color(event.color, category?.color ?? config.eventColors.fixed);
}
export function validateExtensions(config) {
  const issues = [];
  const length = config.seasons.reduce((n,s)=>n+s.months.reduce((a,m)=>a+m.days,0)+(s.specialDay.enabled?1:0),0)+config.specialDays.length;
  if (config.sun.mode === "cycle" && !config.sun.phases.length) issues.push("Der Sonnenzyklus braucht mindestens eine Sonnenphase.");
  if (new Set(config.sun.phases.map(p=>p.startMinute)).size !== config.sun.phases.length) issues.push("Sonnenphasen dürfen nicht gleichzeitig beginnen.");
  for (const range of config.seasonRanges) if (range.startDay>length || range.endDay>length) issues.push(`„${range.name}“ liegt außerhalb des Jahres (${length} Tage).`);
  for (const rule of config.sun.rules) {
    const valid = rule.kind === "weekday" ? Number(rule.match)>=1 && Number(rule.match)<=config.weekdays.length && Number.isInteger(Number(rule.match))
      : rule.kind === "season" ? config.seasons.some(s=>s.id===rule.match) || config.seasonRanges.some(s=>s.id===rule.match)
      : rule.kind === "month" ? config.seasons.some(s=>s.months.some(m=>m.id===rule.match))
      : /^-?\d+:\d+:\d+:\d+:-?\d+$/.test(rule.match);
    if (!valid) issues.push(`Ungültiges Ziel für Sonnenregel „${rule.id}“.`);
  }
  return issues;
}
