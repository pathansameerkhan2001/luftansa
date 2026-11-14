/**
 * Administrator email handling. The allow-list (ADMIN_EMAILS) and the Cognito
 * `email` claim go through the SAME normalisation, so comparisons are exact
 * after removing formatting noise only, never by loosening the match.
 */

// Zero-width spaces/joiners, word joiner, BOM: invisible characters that
// commonly sneak in when an address is copied from a document or chat.
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/g;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Unicode-normalise, strip invisible characters, whitespace, wrapping quotes/brackets and "mailto:", lower-case. */
export function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .trim()
    .replace(/^["'`<]+|["'`>]+$/g, "")
    .replace(/^mailto:/i, "")
    .trim()
    .toLowerCase();
}

export interface ParsedAdminEmails {
  emails: string[];
  /** Entries that are not valid email addresses after normalisation (values never logged). */
  invalidCount: number;
}

/** Parses a list separated by commas, semicolons, whitespace or newlines. */
export function parseAdminEmails(raw: string): ParsedAdminEmails {
  const entries = raw
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter(Boolean);
  const emails = [...new Set(entries.filter((e) => EMAIL.test(e)))];
  return { emails, invalidCount: entries.length - entries.filter((e) => EMAIL.test(e)).length };
}

/** Masked form for diagnostics, e.g. "ow***@luftansa.test". Never logs the full address. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "(invalid)";
  return `${local.slice(0, 2)}***@${domain}`;
}
