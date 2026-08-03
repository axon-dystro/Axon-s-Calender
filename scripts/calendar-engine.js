import { NEUTRAL_PRESET, minutesPerDay, normalizeCalendarConfig } from "./calendar-config.js";

export function cloneDate(date) {
  return {
    year: Number(date?.year),
    season: Number(date?.season),
    month: date?.month == null ? null : Number(date.month),
    day: date?.day == null ? null : Number(date.day),
    specialDay: date?.specialDay == null ? null : Number(date.specialDay)
  };
}

export function normalizeDate(date, calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  const value = cloneDate(date ?? {});
  value.year = Number.isFinite(value.year) ? Math.trunc(value.year) : 1;
  value.season = clampInt(value.season, 1, config.seasons.length);
  const season = config.seasons[value.season - 1];

  if (value.specialDay != null && season.specialDay.enabled) {
    value.specialDay = value.season;
    value.month = null;
    value.day = null;
    return value;
  }

  value.specialDay = null;
  value.month = clampInt(value.month, 1, season.months.length);
  value.day = clampInt(value.day, 1, season.months[value.month - 1].days);
  return value;
}

export function isSpecialDate(date) {
  return Number.isInteger(Number(date?.specialDay)) && Number(date.specialDay) >= 1;
}

export function daysInYear(calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  return config.seasons.reduce((total, season) => total + daysInSeason(season), 0);
}

export function regularDaysInYear(calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  return config.seasons.reduce((total, season) => total + regularDaysInSeason(season), 0);
}

export function regularDaysInSeason(season) {
  return season.months.reduce((total, month) => total + month.days, 0);
}

export function daysInSeason(season) {
  return regularDaysInSeason(season) + (season.specialDay.enabled ? 1 : 0);
}

export function weekdayIndex(date, calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  const value = normalizeDate(date, config);
  if (isSpecialDate(value)) return null;

  const withinSeason = regularDaysBeforeMonth(config.seasons[value.season - 1], value.month) + value.day - 1;
  let index = config.week.firstWeekday + withinSeason;

  if (config.week.reset === "year" || config.week.reset === "never") {
    for (let seasonIndex = 0; seasonIndex < value.season - 1; seasonIndex += 1) {
      index += regularDaysInSeason(config.seasons[seasonIndex]);
      if (config.week.specialDaysAdvance && config.seasons[seasonIndex].specialDay.enabled) index += 1;
    }
  }
  if (config.week.reset === "never") {
    const weekdayDaysPerYear = regularDaysInYear(config)
      + (config.week.specialDaysAdvance ? config.seasons.filter((season) => season.specialDay.enabled).length : 0);
    index += value.year * weekdayDaysPerYear;
  }
  return positiveMod(index, config.weekdays.length);
}

export function weekdayName(date, calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  const index = weekdayIndex(date, config);
  return index == null ? null : config.weekdays[index];
}

export function dateToOrdinal(date, calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  const value = normalizeDate(date, config);
  let ordinal = value.year * daysInYear(config);
  for (let seasonIndex = 0; seasonIndex < value.season - 1; seasonIndex += 1) {
    ordinal += daysInSeason(config.seasons[seasonIndex]);
  }
  const season = config.seasons[value.season - 1];
  if (isSpecialDate(value)) return ordinal + regularDaysInSeason(season);
  return ordinal + regularDaysBeforeMonth(season, value.month) + value.day - 1;
}

export function ordinalToDate(ordinal, calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  const yearLength = daysInYear(config);
  let year = Math.floor(Number(ordinal) / yearLength);
  let remaining = positiveMod(Math.trunc(Number(ordinal)), yearLength);

  for (let seasonIndex = 0; seasonIndex < config.seasons.length; seasonIndex += 1) {
    const season = config.seasons[seasonIndex];
    const seasonLength = daysInSeason(season);
    if (remaining >= seasonLength) {
      remaining -= seasonLength;
      continue;
    }

    const regularLength = regularDaysInSeason(season);
    if (season.specialDay.enabled && remaining === regularLength) {
      return { year, season: seasonIndex + 1, month: null, day: null, specialDay: seasonIndex + 1 };
    }

    for (let monthIndex = 0; monthIndex < season.months.length; monthIndex += 1) {
      const month = season.months[monthIndex];
      if (remaining >= month.days) {
        remaining -= month.days;
        continue;
      }
      return {
        year,
        season: seasonIndex + 1,
        month: monthIndex + 1,
        day: remaining + 1,
        specialDay: null
      };
    }
  }

  // normalizeCalendarConfig guarantees a non-empty calendar. This fallback is
  // only defensive for corrupted imported data.
  year += 1;
  return { year, season: 1, month: 1, day: 1, specialDay: null };
}

export function compareDates(a, b, calendar = NEUTRAL_PRESET) {
  return Math.sign(dateToOrdinal(a, calendar) - dateToOrdinal(b, calendar));
}

export function sameDate(a, b, calendar = NEUTRAL_PRESET) {
  if (!a || !b) return false;
  return dateToOrdinal(a, calendar) === dateToOrdinal(b, calendar);
}

export function advanceDay(date, calendar = NEUTRAL_PRESET) {
  return ordinalToDate(dateToOrdinal(date, calendar) + 1, calendar);
}

export function retreatDay(date, calendar = NEUTRAL_PRESET) {
  return ordinalToDate(dateToOrdinal(date, calendar) - 1, calendar);
}

export function shiftPeriod(date, direction, calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  const value = normalizeDate(date, config);
  const step = direction >= 0 ? 1 : -1;
  if (isSpecialDate(value)) return step > 0 ? advanceDay(value, config) : retreatDay(value, config);

  const season = config.seasons[value.season - 1];
  if (step > 0) {
    if (value.month < season.months.length) return { ...value, month: value.month + 1, day: 1 };
    if (season.specialDay.enabled) return { year: value.year, season: value.season, month: null, day: null, specialDay: value.season };
    return firstDateOfNextSeason(value, config);
  }

  if (value.month > 1) return { ...value, month: value.month - 1, day: 1 };
  const previous = retreatDay(value, config);
  if (isSpecialDate(previous)) return previous;
  return { ...previous, day: 1 };
}

export function phaseForMinute(minute, calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  const inDay = positiveMod(Math.trunc(Number(minute) || 0), minutesPerDay(config));
  let active = config.phases[config.phases.length - 1];
  for (const phase of config.phases) {
    if (inDay >= phase.startMinute) active = phase;
    else break;
  }
  return active;
}

export function phaseById(id, calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  return config.phases.find((phase) => phase.id === id) ?? config.phases[0];
}

export function normalizeMinute(minute, calendar = NEUTRAL_PRESET) {
  return positiveMod(Math.trunc(Number(minute) || 0), minutesPerDay(calendar));
}

export function formatTime(minute, calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  const normalized = normalizeMinute(minute, config);
  const hour = Math.floor(normalized / config.day.minutesPerHour);
  const minutePart = normalized % config.day.minutesPerHour;
  const width = Math.max(2, String(config.day.minutesPerHour - 1).length);
  return `${String(hour).padStart(2, "0")}:${String(minutePart).padStart(width, "0")}`;
}

export function moonState(date, calendar = NEUTRAL_PRESET, moonDefinition = null) {
  const config = normalizeCalendarConfig(calendar);
  const moon = moonDefinition ?? config.moons[0];
  if (!moon) return null;
  const value = normalizeDate(date, config);
  const season = config.seasons[value.season - 1];

  if (isSpecialDate(value) && moon.fullOnSpecialDays) {
    const alwaysVisible = Boolean(season.specialDay.outsideYear && moon.alwaysVisibleOnOutsideYear);
    return {
      id: moon.id,
      name: moon.name,
      key: alwaysVisible ? "eternal-full" : "full",
      label: alwaysVisible ? "Vollmond · Tag und Nacht sichtbar" : "Vollmond",
      icon: "🌕",
      illumination: 1,
      fraction: 0,
      waxing: false,
      turning: false,
      color: moon.color
    };
  }

  const fraction = positiveMod(dateToOrdinal(value, config) + moon.offsetDays, moon.cycleDays) / moon.cycleDays;
  const illumination = (Math.cos(fraction * Math.PI * 2) + 1) / 2;
  const turning = Math.abs(fraction - 0.5) <= Math.max(0.012, 0.5 / moon.cycleDays);
  return {
    id: moon.id,
    name: moon.name,
    key: turning ? "turning" : moonKey(fraction, illumination),
    label: turning ? moon.turningLabel : moonLabel(fraction, illumination),
    icon: moonIcon(fraction),
    illumination,
    fraction,
    waxing: fraction >= 0.5,
    turning,
    color: moon.color
  };
}

export function moonStates(date, calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  return config.moons.map((moon) => moonState(date, config, moon));
}

export function eventOccursOn(event, date, calendar = NEUTRAL_PRESET) {
  if (!event?.start) return false;
  const targetOrdinal = dateToOrdinal(date, calendar);
  return targetOrdinal >= dateToOrdinal(event.start, calendar)
    && targetOrdinal <= dateToOrdinal(event.end ?? event.start, calendar);
}

export function formatDate(date, calendar = NEUTRAL_PRESET, { compact = false } = {}) {
  const config = normalizeCalendarConfig(calendar);
  const value = normalizeDate(date, config);
  const season = config.seasons[value.season - 1];
  const era = config.eraLabel ? ` ${config.eraLabel}` : "";

  if (isSpecialDate(value)) {
    const yearPart = season.specialDay.outsideYear ? "zwischen den Jahren" : `${value.year}${era}`;
    return compact ? `${season.specialDay.name} · ${yearPart}` : `${season.specialDay.name} · ${season.name} · ${yearPart}`;
  }

  const month = season.months[value.month - 1];
  if (compact) return `${value.day}. ${month.name} · ${value.year}${era}`;
  return `${weekdayName(value, config)}, ${value.day}. Tag · ${month.name} · ${season.name} · ${value.year}${era}`;
}

export function periodLabel(date, calendar = NEUTRAL_PRESET) {
  const config = normalizeCalendarConfig(calendar);
  const value = normalizeDate(date, config);
  const season = config.seasons[value.season - 1];
  const era = config.eraLabel ? ` ${config.eraLabel}` : "";
  if (isSpecialDate(value)) {
    return season.specialDay.outsideYear
      ? `${season.specialDay.name} · zwischen den Jahren`
      : `${season.specialDay.name} · nach ${season.name} · ${value.year}${era}`;
  }
  return `${season.name} · ${season.months[value.month - 1].name} · ${value.year}${era}`;
}

export function dateKey(date, calendar = NEUTRAL_PRESET) {
  const value = normalizeDate(date, calendar);
  return [value.year, value.season, value.month ?? 0, value.day ?? 0, value.specialDay ?? 0].join(":");
}

export function parseDateKey(key, calendar = NEUTRAL_PRESET) {
  const [year, season, month, day, specialDay] = String(key).split(":").map(Number);
  return normalizeDate({ year, season, month: month || null, day: day || null, specialDay: specialDay || null }, calendar);
}

export function absoluteMinute(state, calendar = NEUTRAL_PRESET) {
  return dateToOrdinal(state, calendar) * minutesPerDay(calendar) + normalizeMinute(state.minuteOfDay, calendar);
}

export function stateFromAbsoluteMinute(value, calendar = NEUTRAL_PRESET) {
  const perDay = minutesPerDay(calendar);
  const ordinal = Math.floor(Number(value) / perDay);
  const minuteOfDay = positiveMod(Math.trunc(Number(value)), perDay);
  return { ...ordinalToDate(ordinal, calendar), minuteOfDay };
}

function firstDateOfNextSeason(value, config) {
  if (value.season < config.seasons.length) {
    return { year: value.year, season: value.season + 1, month: 1, day: 1, specialDay: null };
  }
  return { year: value.year + 1, season: 1, month: 1, day: 1, specialDay: null };
}

function regularDaysBeforeMonth(season, monthNumber) {
  return season.months.slice(0, Math.max(0, monthNumber - 1)).reduce((total, month) => total + month.days, 0);
}

function moonKey(fraction, illumination) {
  if (illumination > 0.94) return "full";
  if (illumination < 0.06) return "new";
  return fraction < 0.5 ? "waning" : "waxing";
}

function moonLabel(fraction, illumination) {
  if (illumination > 0.94) return "Vollmond";
  if (illumination < 0.06) return "Neumond";
  return fraction < 0.5 ? "Abnehmender Mond" : "Zunehmender Mond";
}

function moonIcon(fraction) {
  if (fraction < 0.0625 || fraction >= 0.9375) return "🌕";
  if (fraction < 0.1875) return "🌖";
  if (fraction < 0.3125) return "🌗";
  if (fraction < 0.4375) return "🌘";
  if (fraction < 0.5625) return "🌑";
  if (fraction < 0.6875) return "🌒";
  if (fraction < 0.8125) return "🌓";
  return "🌔";
}

function positiveMod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function clampInt(value, minimum, maximum) {
  const number = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : minimum;
  return Math.min(maximum, Math.max(minimum, number));
}
