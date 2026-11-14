# Admin dashboard architecture (Phase 1 foundation)

## Separation from the storefront

- The storefront is untouched: its pages, components, URLs and 404 behaviour are byte-for-byte the same,
  verified by before/after pixel comparison. The only addition is one header icon linking to `/admin`.
- `src/components/layout/StorefrontChrome.tsx` renders the existing `SiteHeader` / `SiteFooter` on every
  route except `/admin/*`. It adds no DOM element.
- The admin area (`src/app/admin`) has its own layout: a dark sidebar, top bar and ivory workspace.

### Known trade-off (accepted)
Next.js serialises server components passed as children into the page's React payload even when the client
wrapper does not render them. Admin pages therefore carry about 34 KB of unused, public storefront header/footer
data. Nothing is displayed or exposed beyond the public site, and only administrators load these pages.

**Rejected alternative:** a `(store)` route group. It keeps admin payloads clean, but unmatched URLs (e.g. `/shop`)
then lose their server-rendered header, footer and 404 title. They render only after JavaScript loads, which changes
the storefront for search engines and no-JS clients. Restoring that requires either a root `not-found`
(whose header/footer would then be serialised into every storefront page) or Next.js's experimental
`globalNotFound` with two root layouts. Both conflict with "storefront must not change". Revisit only with approval.

## Authorization

| Layer | Pages (`/admin/*`) | APIs (`/api/admin/*`) |
|---|---|---|
| Middleware (`src/middleware.ts`) | verify / refresh session, else redirect to `/admin/login` | verify / refresh session, else JSON `401` |
| Handler | `requireAdminPage()` in the protected layout **and** every page | `withAdmin()` / `requireAdminApi()` in every route |
| Writes | n/a | same-origin check (`Origin` must match, or `Sec-Fetch-Site: same-origin`), else `403` |

- Admin identity = Cognito ID token + verified email on `ADMIN_EMAILS` (see `src/lib/auth`).
- Customer accounts (`src/lib/customer`) never read admin cookies or admin configuration.
- Unknown `/admin/*` URLs require authentication, then show the admin 404.

## Data layer (server-only)

- `src/lib/db/keys.ts`: single-table key design for `luftansa-store`; identifiers are validated so input
  cannot inject `#` separators or reach another partition.
- `src/lib/db/schemas.ts`: Zod schemas; every item is validated before writes and after reads.
- `src/lib/db/repository.ts`: conditional create (no overwrite), optimistic concurrency on `version`,
  partition-bound pagination cursors.
- `src/lib/db/audit.ts`: one immutable audit entry per admin write, partitioned by month.
- `src/lib/db/client.ts`: DynamoDB document client; credentials via `src/lib/aws/credentials.ts`
  (Vercel OIDC when `AWS_ROLE_ARN` is set, otherwise the existing default chain).

Phase 1 performs **no** DynamoDB reads or writes; the layer is unit-tested against an in-memory fake.
See `docs/aws-oidc-setup.md` for the pending AWS configuration.
