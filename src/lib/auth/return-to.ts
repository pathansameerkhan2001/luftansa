/**
 * Post-login redirect target. Only same-site /admin paths are allowed, which
 * prevents open redirects (e.g. "//evil.com", "/\\evil.com", absolute URLs).
 */
export const DEFAULT_RETURN_TO = "/admin";

export function safeReturnTo(value: string | null | undefined): string {
  if (!value || value.length > 512) return DEFAULT_RETURN_TO;
  if (!value.startsWith("/admin") || value.startsWith("//") || value.includes("\\")) return DEFAULT_RETURN_TO;
  if (value.startsWith("/admin/login")) return DEFAULT_RETURN_TO;
  // Must stay on this origin after URL parsing.
  try {
    const parsed = new URL(value, "https://placeholder.invalid");
    if (parsed.origin !== "https://placeholder.invalid") return DEFAULT_RETURN_TO;
    return parsed.pathname + parsed.search;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}
