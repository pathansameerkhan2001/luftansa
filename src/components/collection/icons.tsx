import type { SVGProps } from "react";

/** Line-art roll-on bottle (slim body, ball fitment, tall cap), Lucide-style. */
export function RollOnBottleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="9.25" y="1.75" width="5.5" height="7" rx="1.25" />
      <path d="M10 8.75v1.25h4V8.75" />
      <rect x="8.5" y="10" width="7" height="12.25" rx="1.75" />
      <path d="M10.5 16h3" />
    </svg>
  );
}

/** Eight-petal flourish used as the collection panel crest. */
export function FlourishIcon(props: SVGProps<SVGSVGElement>) {
  const petals = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="currentColor" {...props}>
      {petals.map((deg) => (
        <ellipse key={deg} cx="20" cy="9.5" rx="3.6" ry="8" transform={`rotate(${deg} 20 20)`} opacity={deg % 90 === 0 ? 1 : 0.75} />
      ))}
      <circle cx="20" cy="20" r="3.4" fill="var(--brand-cream)" />
      <circle cx="20" cy="20" r="1.8" />
    </svg>
  );
}
