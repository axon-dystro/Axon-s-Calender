export const DEFAULT_THEME = Object.freeze({
  primary: "#f06bc7",
  secondary: "#a765ff",
  background: "#171326",
  surface: "#241d38",
  text: "#f4eaff",
  border: "#65517e"
});

export function normalizeTheme(source = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_THEME).map(([key,value])=>[key,safeColor(source?.[key],value)]));
}

export function applyTheme(source = DEFAULT_THEME) {
  if (!globalThis.document?.documentElement) return;
  const theme = normalizeTheme(source?.theme ?? source);
  for (const [key,value] of Object.entries(theme)) document.documentElement.style.setProperty(`--ac-${key}`, value);
}

function safeColor(value, fallback) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

export const THEME_PRESETS = {
  crystal: { name: "Kristall", ...DEFAULT_THEME },
  parchment: { name: "Pergament", primary: "#8c4b20", secondary: "#7a6225", background: "#ede0c4", surface: "#f8eddb", text: "#302619", border: "#9a825d" },
  midnight: { name: "Mitternacht", primary: "#6abbea", secondary: "#8c9fff", background: "#0a1420", surface: "#15273a", text: "#edf6ff", border: "#476983" }
};
