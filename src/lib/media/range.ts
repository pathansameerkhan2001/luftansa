/**
 * HTTP Range parsing for /media (RFC 9110 §14). Pure.
 *
 * Safari (macOS and iOS) only plays <video> when the server answers byte-range
 * requests with 206 Partial Content, so /media must support:
 *   bytes=0-1        first bytes (Safari's probe)
 *   bytes=500-       from an offset to the end
 *   bytes=-500       the last 500 bytes
 * Multiple ranges ("bytes=0-1,5-9") are uncommon for media and are served as a
 * full 200 response, which the RFC permits.
 */
export interface ByteRange {
  start: number;
  /** Inclusive. */
  end: number;
}

export type RangeResult =
  | { kind: "none" } // no/ignored Range header: send the whole object (200)
  | { kind: "range"; range: ByteRange } // satisfiable: 206
  | { kind: "unsatisfiable" }; // 416

const SINGLE = /^bytes=(\d*)-(\d*)$/;

export function parseRange(header: string | null | undefined, size: number): RangeResult {
  if (!header) return { kind: "none" };
  const value = header.trim();
  if (!value.startsWith("bytes=") || value.includes(",")) return { kind: "none" };
  const m = SINGLE.exec(value);
  if (!m) return { kind: "none" };
  const [, a, b] = m;
  if (a === "" && b === "") return { kind: "none" };

  if (a === "") {
    // Suffix range: last N bytes.
    const n = Number(b);
    if (!Number.isSafeInteger(n) || n <= 0 || size === 0) return { kind: "unsatisfiable" };
    return { kind: "range", range: { start: Math.max(0, size - n), end: size - 1 } };
  }

  const start = Number(a);
  if (!Number.isSafeInteger(start)) return { kind: "none" };
  if (start >= size) return { kind: "unsatisfiable" };
  let end = b === "" ? size - 1 : Number(b);
  if (!Number.isSafeInteger(end)) return { kind: "none" };
  if (end < start) return { kind: "none" }; // invalid syntax: ignore the header
  end = Math.min(end, size - 1);
  return { kind: "range", range: { start, end } };
}

export function contentRangeHeader(range: ByteRange, size: number): string {
  return `bytes ${range.start}-${range.end}/${size}`;
}
