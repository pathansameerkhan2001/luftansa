# Luftansa CMS + Storefront + Cart: implementation plan (Phases 3A–3F)

Branch: `feature/cms`, created from `befe80e` (the approved, deployed storefront).
Status: **plan for approval**. No code has been changed yet.

---

## 1. What exists today

| Area | Current state | Consequence for the plan |
|---|---|---|
| Data | Single DynamoDB table `luftansa-store`, Zod-validated repository with conditional writes, versions and an audit log. `CONTENT#…`, `MEDIA#…`, `SETTINGS`, `PROMO#…` key prefixes are already reserved but unused. | The CMS builds on the existing repository and key design. No new database and no new indexes. |
| Product types | Live: `perfume-spray`, `roll-on`, `attar`, `air-freshener` (all active). `roll-on`: unit ml, notes on. | Roll-On reuses the existing `roll-on` type; no duplicate is created. |
| Products | 9 active (8 real plus `test-product`). Variants already have capacity, unit, price and optional stock and SKU. | Variants are already generic enough for Roll-On. |
| Media | Private bucket. Uploads go through `/api/admin/media/upload` (images only, 4 MB after in-browser compression, because Vercel rejects bodies over 4.5 MB). Direct presigned uploads are unused because **the bucket has no CORS rule**. Delivery is through `/media/<key>` (or `ASSET_CDN_URL`). | **Videos over ~4 MB can't be uploaded with today's setup** (decision D3). `/media` has **no HTTP Range support**, so iPhone Safari won't play videos reliably; this is fixed in code (no AWS change). |
| Website content | Hero, reels, brand story, FAQs, benefits, footer and the announcement bar are hardcoded in `src/data/*` and component files. | These become the **fallback defaults**: the storefront looks exactly as it does now until CMS content is published. |
| Admin | Products and dashboard are real. Inventory, Orders, Customers, Media Library, Website Content, Promotions and Settings are **placeholders**. | Placeholders are replaced by real modules or removed from the menu (no non-working entries). |
| Admin login | Cognito Hosted UI; the callback URL is the production domain. `COGNITO_ISSUER` can already be overridden for a local mock identity provider. | Local admin testing uses a **local mock identity provider** (D2). Cognito isn't touched. |
| Customer accounts | `/account` pages exist as placeholders; there is no customer login. | Removed in 3E. Admin authentication (`/api/auth/*`) is untouched. |
| Wishlist | **Not functional**: the heart only toggles on screen and `/wishlist` returns 404. | It has to be built to be "kept" (D6). |
| Header links | `/shop`, `/collections`, `/our-story`, `/contact` and `/search` all return **404** today. | The pages are built in 3E and 3F (D7). |
| Animation | Framer Motion is **not installed**; the site uses CSS transitions. | Keep CSS transitions (D8). |
| Local development | `.env.local` points at the **production** table and bucket. Saving anything in a local admin would write to production. | **A safe local data environment comes first in 3A** (D1). |

---

## 2. Production safety during development

Nothing in this project writes to production until you approve a release.

1. **Local data**: DynamoDB Local (Java is installed) on `localhost`, seeded from a **read-only** snapshot of today's products and types. It's selected by `DYNAMODB_ENDPOINT`, which only exists in a local env file.
2. **Local media**: uploads go to a local folder (`.local-media/`, git-ignored) behind the same `/media/<key>` URLs. It's selected by `LOCAL_MEDIA_DIR`.
3. **Hard guard**: when running outside Vercel, any write to the production table or bucket throws unless the local endpoints are configured. A unit test covers the guard.
4. **Local admin login**: a small mock identity provider signs test tokens for an allow-listed test email, using the existing `COGNITO_ISSUER` override. It isn't included in production builds, and the production Cognito setup is never used locally.
5. Unit tests keep using the existing in-memory DynamoDB fake.

---

## 3. Data architecture

### 3.1 Content entries (single table, existing prefixes)

| Item | pk | sk | Notes |
|---|---|---|---|
| List module entry (announcements, reels, lab blocks, claims, videos, FAQs, testimonials, promotions, homepage sections, footer links) | `CONTENT#<module>` | `ENTRY#<id>` | One small item per entry (a few KB), far below DynamoDB's 400 KB item limit. |
| Single-record module (hero, about, footer settings, SEO defaults, Roll-On collection copy) | `CONTENT#<module>` | `SINGLETON` | |
| Store settings | `SETTINGS` | `STORE` / `SOCIAL` / `CONTACT` | Already reserved. |
| Media asset | `MEDIA#<id>` | `META` | Already reserved. |
| Audit | `AUDIT#<yyyy-mm>` | existing | One entry per publish or delete. |

Every entry stores:
- `id`
- `displayOrder`
- `visibility {desktop, mobile}`
- optional `schedule {startAt, endAt}`
- `draft` (the editable payload)
- `published` (the last published payload, or absent)
- `status` (`draft` / `published` / `unpublished`)
- `version`, `updatedAt`, `updatedBy`, `publishedAt`

**Publish behaviour:**
- Publishing copies `draft` into `published` in one conditional write that checks the version, so two editors can't overwrite each other.
- It also writes an audit entry and refreshes only the affected storefront pages.

Payloads are validated with a Zod schema for each module.

### 3.2 Storefront reading and fallbacks

- `getPublished(module)` reads one partition, cached with per-module cache tags, so a publish appears **without a deployment**.
- **If a module has nothing published, or DynamoDB is unreachable, the storefront renders today's content from `src/cms/defaults/*`.** The live site cannot break or go blank.
- Scheduled content (announcements, promotions) is filtered by date when the page renders, with a short refresh interval so start and end times take effect on time.

### 3.3 Product data additions (all optional, backward-compatible)

**New fields:**
- `subtitle`
- `gallery: {key, alt}[]`
- `video {key, posterKey}`
- `details`
- `howToUse`
- `care`
- `faqIds`
- `benefits`
- `seo {title, description, ogImageKey}`

**Existing fields kept as they are:** `mainImageKey`, `galleryImageKeys`, notes, variants and collections. Existing records aren't rewritten, and reads accept either form.

Removing an image only removes its **reference**. S3 objects are deleted only through the Media Library's explicit two-step workflow (§3.4).

### 3.4 Media library

- **Asset records:** each `MEDIA#<id>` stores the key, kind (image or video), MIME type, size, dimensions or duration, alt text, description, uploader and upload time.
- **Usage:** "where used" is worked out on demand from content and product references.
- **Deletion:**
  - It's refused while the asset is in use.
  - Otherwise it's two-step: mark for deletion, then confirm, which deletes the S3 object.
  - Nothing is ever deleted automatically.
- **New allow-listed S3 folders:** `videos/`, `lab/`, `manufacturing/`, `cms/`.
- **Limits:**
  - Images: JPEG, PNG and WebP, compressed in the browser to 4 MB or less, as today.
  - Videos: MP4 and WebM, with a size limit set once D3 is decided.
- **Video delivery:** Range support is added to `/media` (needed for Safari), with lazy loading and posters.

### 3.5 Claims (Inside the Lab)

- Each claim is its own entry: text, `approved` flag, `verified` flag, evidence reference (text and an optional document or image), approver and date.
- **The storefront renders a claim only when it is both approved and verified.**
- The reference claims in your screenshots ("Lab-tested on 12 Fabrics", "1200+ People Surveyed", "Made in India", "100% Vegan", "Cruelty-free", "IFRA Safe", "4X Premium Oil", "35–40% Base Note Ratio", longevity) are **not** pre-loaded. You enter your own claims with evidence.

---

## 4. Admin navigation (only entries that work)

| Group | Entries |
|---|---|
| Store Management | Dashboard · Products · Product Types · Inventory (stock per variant, already in the data) |
| Website Management | Website Overview · Announcement Bar · Hero · Homepage Sections · Collections · Inside the Lab · Instagram Reels · Manufacturing Videos · About Us · FAQs · Benefits & Features · Promotions · Testimonials · Footer · Navigation & Header |
| Media | Media Library (tabs: All / Images / Videos) |
| Settings | Store Settings · SEO Settings |

These are removed from the menu until they can work (D5):
- **Orders and Customers:** there are no online orders or customer accounts.
- **Admin Settings:** the admin allow-list lives in environment variables.

Separate "Image Manager" and "Video Manager" entries would duplicate the Media Library, so they're tabs inside it.

**Every module uses the same building blocks:**
- searchable list with status badges
- create and edit form with validation
- preview (desktop and mobile frames)
- Save draft, Publish and Unpublish
- display order (drag and drop)
- desktop and mobile visibility, plus scheduling where relevant
- delete confirmation
- success and error messages
- loading states

The admin keeps its black sidebar, ivory workspace and gold accents.

---

## 5. Sub-phases

Each sub-phase ends with the same checks:
- tests, TypeScript, ESLint and the production build
- browser checks at 1280, 768 and 390px
- screenshots and the list of changed files

**I stop for your approval after each one.**

### 3A — CMS foundation and data architecture
- **Safe local environment (§2):** DynamoDB Local, local media store, production-write guard, mock admin login, seed script (read-only from production).
- **Content data layer:** content keys, the entry schema, `cms-service` (list, get, save draft, publish, unpublish, reorder, delete), audit entries, cache-tag revalidation, and `getPublished` with fallback defaults.
- **Media library foundation:** `MEDIA#` records, upload API for images (and videos once D3 is decided), Range support in `/media`, safe deletion workflow, and a media picker component used by all later modules.
- **Reusable admin CMS components** (list table, editor shell, preview frame, publish bar, confirm dialog, drag-to-reorder) and the grouped navigation.
- **Tests:** guard, CMS service (draft and publish, version conflicts, ordering, scheduling), fallbacks, media validation, deletion rules.

### 3B — Announcement bar, hero and homepage sections
- **Announcement bar:**
  - Settings: multiple messages, link, colours, font size, ticker or static display, speed, desktop and mobile visibility, schedule, order and preview.
  - The default draft is the approved "Signature Perfumes from ₹400 — Explore the Collection". **It isn't published until you publish it.**
- **Hero:**
  - Content: title, subtitle, description, two buttons.
  - Desktop media: separate image and video.
  - Mobile media: separate image and video.
  - Display settings: focal point, poster, overlay, alignment, text colour, height, autoplay, mute, loop.
- **How the hero plays:**
  - Mobile never downloads the desktop video: the video is chosen by screen size, and images use `<picture>` sources.
  - The poster shows while the video loads, and the image is used if the video fails.
  - Video is off when the visitor has reduced motion turned on.
  - The layout is fixed in size, so nothing shifts.
- **Homepage section builder:** an ordered list of section entries (types 1–17 from your brief).
  - The default order reproduces today's homepage exactly.
  - Add, edit, hide, reorder and delete sections, with preview.
  - Newsletter is left out, because there's no subscription system.

### 3C — Roll-On and product media
- **Roll-On collection:**
  - It shows active products of type `roll-on`, not the hardcoded empty list.
  - Its title and description are editable.
  - It keeps a designed empty state.
  - **No sizes or prices are invented**; the admin enters the real ones.
- **Product editor upgrades:**
  - Multiple uploads, drag-to-reorder gallery, set the main image, alt text for each image.
  - Product video with poster.
  - Subtitle, details, how to use, care, FAQs, benefits and SEO fields.
  - Gallery preview.
- **Product page:** shows the new fields only when they're filled in (as today), plus the product video in the gallery.
- **Admin filters and search** include product type (Roll-On, Attar and so on).
- **Compatibility:** checks against the existing 9 products.

### 3D — Inside the Lab, manufacturing videos, Instagram Reels
- **Inside the Lab:** content blocks with layouts A–G from your brief:
  - full-width hero
  - four-column grid
  - image left / image right
  - video showcase
  - step timeline
  - problem-versus-solution
  - claims gated by approval and verification (§3.5)
- **Manufacturing Videos:** MP4 and WebM with posters, categories and order. Videos load lazily and always start muted, and are hidden from search engines unless published.
- **Instagram Reels:**
  - Each Reel has a link to the original post, an uploaded thumbnail (always shown), caption, linked product, featured flag and order.
  - **No Instagram scraping or API.** The card opens the original Reel; no embed is needed, which avoids blocked or unavailable embeds.

### 3E — Header, customer account removal, cart, wishlist
- **Remove customer accounts:** delete the `/account` pages and the account icon, and redirect old `/account` links to the homepage. Admin login is unchanged.
- **Real cart:**
  - Header icon: a custom shopping bag with a subtle bottle outline, plus an item count.
  - Opens as a drawer on mobile and desktop, with a `/cart` page as well.
  - Supports: add, change size, change quantity (1–10 and stock rules), remove; shows image, size, unit price and subtotal; stays in the browser across refreshes; has an empty-cart design.
- **Price check before checkout:** a public, read-only endpoint (`/api/catalogue/prices`) returns current prices, so a stale price saved in the browser never reaches checkout.
- **WhatsApp checkout:** the message lists every item's name, size, quantity, unit price and product code, plus the total. **No payment processing.**
- **Product page:** Add to Cart is added alongside the existing Order on WhatsApp, which stays.
- **Wishlist:** stored in the browser, with a `/wishlist` page (D6).
- **Header pages:** Shop All (all products, filter by type, including Roll-On), Search (product search) and Collections (goes to Shop All, filtered) (D7).

### 3F — About Us, FAQs, footer, promotions, SEO
- **About Us** (`/our-story`): story, introduction, images, videos, vision and mission, ordered blocks.
- **Contact** page from Store Settings.
- **FAQs:** add, edit, reorder, enable or disable; general or linked to products. The product page uses linked FAQs and falls back to today's.
- **Footer:** description, links, contact, social links and policies. No newsletter.
- **Promotions:** banner, discount text, schedule, CTA, desktop and mobile visibility, status. **No invented codes or offers.**
- **SEO:** homepage and About pages, defaults for product pages, Open Graph images, social descriptions. Canonical URLs are added once the production domain is confirmed.
  - Today's product SEO behaviour stays as it is.
  - Each page gets exactly one metadata source, with no duplicates.

---

## 6. Testing

- **Unit tests for each service:** CMS publishing, ordering, scheduling, fallbacks, media validation and deletion, claims gating, Roll-On selection, cart maths and limits, multi-item WhatsApp message, price check, SEO.
- **Integration tests** against DynamoDB Local.
- **Browser checks** at 1280, 768 and 390px for the storefront and admin (through the mock login):
  - every module's create, edit, preview, publish, unpublish and delete
  - hero media switching between desktop and mobile
  - video fallback
  - Roll-On appearing on the storefront
  - cart and WhatsApp checkout
  - `/account` removed while admin login still works
- **Regression checks:** all 9 existing product pages, prices, variant IDs, image keys and collection order (the existing checks plus 123 browser checks).

---

## 7. Decisions needed before or during 3A

| # | Decision | Recommendation |
|---|---|---|
| D1 | Local data environment | DynamoDB Local (Java) plus a local media folder, seeded read-only from production, with a production-write guard. |
| D2 | Local admin login | Local mock identity provider using the existing `COGNITO_ISSUER` override. No Cognito changes. |
| D3 | **Video uploads in production** (bucket has no CORS rule; Vercel limits uploads to 4.5 MB) | **Approve, at release time, one S3 CORS rule** that allows `PUT` from the site's own domain, used only with short-lived presigned URLs created after admin login. The bucket stays private. Alternatives: limit videos to 4 MB (impractical), or a complex chunked workaround through the server. Local development is unaffected either way. |
| D4 | Production `ASSET_CDN_URL` | Tell me whether production uses CloudFront. Range support is added to `/media` regardless. |
| D5 | Orders and Customers menu entries | Hide them until online orders or accounts exist. |
| D6 | Wishlist | Build a working wishlist stored in the browser, with a `/wishlist` page. |
| D7 | Header links that return 404 today | Build Shop All, Search, Our Story and Contact; Collections goes to Shop All. |
| D8 | Framer Motion | Don't add it; keep CSS transitions (smaller and already consistent). |
| D9 | Local commits | Commit on `feature/cms` at each approved checkpoint, with no pushes. |

---

## 8. Risks and notes

- **Scope:** this is a large project. Each sub-phase is a substantial piece of work, done and reviewed one at a time.
- **`test-product`** stays as it is; you're deactivating it.
- **Testimonials:** the module only shows entries you enter; no sample reviews are shipped.
- **Existing claims:** the hero ("41 signature scents") and the benefits strip ("Long Lasting — All-day performance") contain claims. They become editable in 3B, but stay as they are until you publish replacements.
- **Release:** a separate, explicit step after 3F, with its own approval. It includes D3's CORS rule (if chosen) and the production content seeding plan.
