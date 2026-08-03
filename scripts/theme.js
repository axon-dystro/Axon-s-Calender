export const DEFAULT_THEME = Object.freeze({
  primary: "#f06bc7",
  secondary: "#a765ff"
});

export function normalizeTheme(source = {}) {
  return {
    primary: safeColor(source?.primary, DEFAULT_THEME.primary),
    secondary: safeColor(source?.secondary, DEFAULT_THEME.secondary)
  };
}

export function applyTheme(source = DEFAULT_THEME) {
  if (!globalThis.document?.documentElement) return;
  const theme = normalizeTheme(source?.theme ?? source);
  document.documentElement.style.setProperty("--ac-primary", theme.primary);
  document.documentElement.style.setProperty("--ac-secondary", theme.secondary);
}

function safeColor(value, fallback) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}
