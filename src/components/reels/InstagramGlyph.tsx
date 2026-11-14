/**
 * Generic Instagram-style glyph (rounded square, lens, flash dot), used only to
 * label the Instagram section. `mono` renders it in currentColor.
 */
export function InstagramGlyph({ className, mono = false }: { className?: string; mono?: boolean }) {
  // Fixed id: every instance defines the same gradient, so duplicates are harmless.
  const gradientId = "luftansa-instagram-gradient";
  const stroke = mono ? "currentColor" : `url(#${gradientId})`;
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {mono ? null : (
        <defs>
          <linearGradient id={gradientId} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f9a634" />
            <stop offset="0.45" stopColor="#e1306c" />
            <stop offset="1" stopColor="#833ab4" />
          </linearGradient>
        </defs>
      )}
      <rect x="3" y="3" width="18" height="18" rx="5.2" stroke={stroke} strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4.1" stroke={stroke} strokeWidth="1.9" />
      <circle cx="17.2" cy="6.8" r="1.15" fill={stroke} />
    </svg>
  );
}
