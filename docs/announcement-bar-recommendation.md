# Announcement bar: recommended replacement

Status: **draft, wording approved by Luftansa**. Not applied: the live announcement bar is unchanged.

Approved text, as it will read on the bar:

> ✦ Signature Perfumes from ₹400 — Explore the Collection →

## The problem

The bar at the top of every storefront page currently reads:

> ★ 20,000+ Verified Reviews — See All Reviews →

- **The claim can't be checked.** The store has no review system and no review data, so "20,000+ Verified Reviews" can't be backed up. Under Indian consumer protection rules on misleading advertising, an unsupported claim like this is a risk.
- **The link is broken.** It points to `/reviews`, a page that doesn't exist, so shoppers who click it get a 404.
- **The icon implies a rating.** The gold star suggests a customer rating that doesn't exist.

Source: `src/components/header/nav-config.ts` (`ANNOUNCEMENT`), rendered by `src/components/header/AnnouncementBar.tsx`.

## Recommended options

Each option uses only information that is already confirmed in the codebase: prices, bottle sizes, the WhatsApp number and the product range. Luftansa approved Option A.

| Option | Message | Link text | Link target | Based on |
|---|---|---|---|---|
| **A (approved)** | Signature Perfumes from ₹400 | Explore the Collection | `/#personality-collection` | Confirmed prices: 30 ml at ₹400 |
| B | Order on WhatsApp: +91 80747 90546 | Chat with us | `https://wa.me/918074790546` | Confirmed contact details; ordering is done on WhatsApp |
| C | Available in 30 ml, 50 ml and 100 ml | Find your fragrance | `/#personality-collection` | Confirmed bottle sizes |

Option A was approved because it gives shoppers a useful fact and links to products that exist. Avoid claims such as "free delivery", delivery timelines, "bestselling" figures, ratings or review counts until there is confirmed data for them.

## Proposed code change (not applied)

`src/components/header/nav-config.ts`:

```ts
export const ANNOUNCEMENT = {
  highlight: "Signature Perfumes from ₹400",
  cta: "Explore the Collection",
  href: "/#personality-collection",
} as const;
```

`src/components/header/AnnouncementBar.tsx`: replace the `Star` icon (both places) with a neutral `Sparkles` icon so the bar no longer suggests a rating:

```tsx
import { ArrowRight, Sparkles } from "lucide-react";
// …
<Sparkles aria-hidden="true" className="size-3 shrink-0 text-brand-gold" strokeWidth={1.5} />
```

Ideally the price would come from the catalogue rather than being typed in, so it can't go stale. That can be done when the homepage CMS work starts; until then, update the text whenever the 30 ml price changes.

## To apply

1. Get the go-ahead to apply this change to the site. The wording is already approved.
2. Make the two edits above, then run `npm run lint` and `npm run build`.
3. Check the bar at 390px, 768px and 1280px, including with reduced motion turned on.

## Notes

- `AnnouncementBar.tsx` already puts the " — " separator between `highlight` and `cta`, so the two fields above produce the approved line exactly.
- `/#personality-collection` is the existing anchor on the homepage's Personality Collection panel, so the link lands on the live product cards.
