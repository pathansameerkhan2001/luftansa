# Phase 3B: Homepage CMS, brand content and shopping experience

Branch: `feature/homepage-cms`, created from `main` at `15d76a2` (Phase 3A merged).
Status: **approved** (all recommendations accepted). Built one checkpoint at a time; each checkpoint stops for review.

---

## 1. Approved decisions

| # | Decision |
|---|---|
| 1 | **Announcement bar.** The fallback becomes the approved Option A: "Signature Perfumes from ₹400 — Explore the Collection". The unverified "20,000+ Verified Reviews" claim and the broken `/reviews` link are removed. |
| 2 | **Our Brand and The Luftansa Story.** Two separate storefront sections, each with its own admin page and publishing controls. |
| 3 | **Public header.** The admin icon and the customer account (person) icon are removed. Administrators still sign in at `/admin`. |
| 4 | **Storefront pages.** Shop All, Collection, Our Story and Contact Us are built from existing confirmed product and store information only. |
| 5 | **Video size.** Production video uploads stay limited to 4 MB per file. The S3 CORS rule (`docs/s3-cors-proposal.md`) is **not** applied without separate approval. |
| 6 | **Branch.** `feature/homepage-cms` from the latest `main`. Nothing is committed, pushed, merged or deployed without explicit approval. |

**Hard constraints:**
- No changes to production AWS, S3 CORS, Cognito or Vercel settings.
- Local mock sign-in stays local-only.
- No invented product information, prices, claims or brand content.
- All Phase 3A functionality and all product types are kept.

---

## 2. Findings from the audit

| Finding | How it's handled |
|---|---|
| The Phase 3A CMS service, APIs and fallbacks work, but no modules are registered. | Every 3B page is a registered module on the existing foundation: no new database, keys, APIs or publishing logic. |
| **Fallback gap:** a module stopped showing today's content as soon as any entry existed, even an unpublished draft. Saving a first Hero draft would have blanked the live hero. | Fixed first in Checkpoint A. A module shows today's content until something is actually published. Tests cover it. |
| There was no media picker, publish bar, preview or shared module hook. | Built once in Checkpoint A and reused by every later page. |
| "Where used" in the Media Library already scans CMS drafts and published content for object keys. | CMS content stores **object keys**, so assets in use are automatically protected from deletion. |
| Production uploads are limited to 4 MB (Vercel body limit; no direct S3 upload without CORS). | Accepted (decision 5). |

---

## 3. Architecture

### 3.1 Admin pages

All pages are protected and use the existing `/api/admin/cms/:module` APIs.

| Route | Module | Kind |
|---|---|---|
| `/admin/hero` | `hero` | Single record |
| `/admin/announcement-bar` | `announcement-bar` | List (messages, order, schedule) |
| `/admin/homepage-sections` | `homepage-layout` | Single record: ordered section list, published as one unit |
| `/admin/reels` | `instagram-reels` | List, reorderable |
| `/admin/our-brand` | `our-brand` | Single record |
| `/admin/story-video` | `story-video` | Single record |
| `/admin/wishlist-settings` | `wishlist-settings` | Single record |
| `/admin/cart-settings` | `cart-settings` | Single record |

**Sidebar groups:** Store (Dashboard, Products) · Website · Shopping · Media (Media Library). Only working pages are listed; each one is added as it is built.

### 3.2 Shared admin components (Checkpoint A)

- **Module client and hook.** Load, create, save draft, publish, unpublish and visibility. Every write is version-checked; a conflict shows "This item was changed elsewhere. Reload and try again" instead of overwriting.
- **Publish Bar.**
  - Status: Not live yet, Live, Live (unsaved or unpublished changes), Inactive.
  - Actions: Save draft, Publish, Deactivate (with confirmation).
  - Warns before leaving the page with unsaved changes.
- **Visibility Controls.** Desktop and mobile toggles. They apply to the live site immediately, as designed in Phase 3A.
- **Media Picker and Media Field.**
  - Choose a catalogued asset from the Media Library, filtered by image or video, or upload one in place (the same upload path as the Media Library).
  - Replace or remove. Removing only drops the reference; files are deleted only through the Media Library's two-step deletion.
- **Preview.** A protected, `noindex` preview route renders the real storefront component from the saved draft (or the live version). It's shown in an iframe at 1280, 768 and 390 px, so the storefront's breakpoints behave exactly as on a real device.

**Active and inactive** mean published and unpublished. Deactivating removes the section from the live site and keeps the draft. A section deliberately deactivated stays hidden; it does not fall back to today's content.

---

## 4. Checkpoints

### A. Shared groundwork and the Hero Section page
- Fix the fallback gap; add tests.
- Shared components (§3.2) and sidebar groups.
- **Hero fields:**
  - Desktop and mobile images (alt text, focal point).
  - Optional desktop and mobile videos.
  - Optional heading and subtitle.
  - Optional CTA label and destination: internal paths or `https://` only.
- **Storefront hero:**
  - Art-directed `<picture>`: phones download only the mobile image.
  - The video is chosen by screen width, so a phone never downloads the desktop video.
  - The image is the poster and stays if the video fails.
  - No video when the visitor prefers reduced motion.
  - Fixed height, so nothing shifts while loading.
  - Text and CTA render only when filled in.
  - Fallback: today's image hero, unchanged.

### B. Announcement Bar page
- Messages: highlight, optional CTA text and link.
- Ticker or static display, optional schedule, order, desktop and mobile visibility, preview.
- Fallback: decision 1.

### C. Homepage Sections page
- One ordered list of the existing homepage sections.
- Each section has show/hide plus desktop and mobile visibility.
- Drag to reorder, full-homepage preview, publish as one unit.
- Fallback: today's exact order.

### D. Instagram Reels
- Add, edit, delete and reorder reels.
- Each reel has:
  - an Instagram link (`https://www.instagram.com/reel/…` or `/p/…`) **or** an uploaded video;
  - a required thumbnail;
  - a title;
  - an optional link to a real active product;
  - active/inactive.
- Storefront: existing carousel design. Instagram reels open the original post (no embed or scraping). Uploaded videos play muted in an accessible lightbox. The placeholder cards stay until the first reel is published.

### E. Our Brand
- Heading, description, up to 4 images with alt text, layout (image left, image right, stacked) and visibility.
- No default text: the section stays hidden until published.

### F. The Luftansa Story video
- Video selection or upload, poster, heading, description, preview and visibility.
- Uses the existing framed design: muted, looping, plays inline, lazy-loaded, poster first.
- Fallback: today's section.

### G. Wishlist, cart and storefront pages
- **Header:**
  - Remove the admin and account icons.
  - Links: Home, Shop All, Collection, Our Story, Contact Us.
  - Wishlist heart with count; custom perfume-bottle cart icon with count.
  - `/account` redirects to `/`.
- **Cart:**
  - Drawer plus `/cart` page.
  - Add and remove, change size, quantity from 1 up to the Cart Settings maximum (and stock when it is set), subtotal.
  - Saved in the browser as product, size and quantity only, **never prices**; synced across tabs.
- **Server price check:** `POST /api/cart/quote` (public, read-only, at most 20 lines).
  - It re-reads current prices and availability.
  - **The server builds the WhatsApp message.**
  - Two-step checkout: "Review order" shows any changes, then "Send on WhatsApp".
- **Wishlist:** hearts on product cards, Best Sellers and the product page; a `/wishlist` page; add to cart with a size choice.
- **Product page:** Add to Cart beside the existing Order on WhatsApp.
- **Wishlist Settings:** on/off, heading, intro, empty-state text.
- **Cart Settings:** on/off, maximum quantity, cart note, WhatsApp message opening and closing lines (defaults are today's text). No shipping fees or discounts.
- **Pages:**
  - Shop All: live catalogue, filterable by product type.
  - Collection: goes to Shop All, filtered.
  - Our Story: Our Brand plus the Story video.
  - Contact Us: confirmed store details.

---

## 5. Every checkpoint delivers

- Unit tests for the new logic.
- TypeScript, ESLint and a production build.
- Playwright screenshots at 1280, 768 and 390 px, using the local stack and mock sign-in.
- A list of changed files and remaining limitations.
- **A stop for review.** No commits, pushes, merges or deploys without explicit approval.
