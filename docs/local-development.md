# Local development (production-safe)

Since Phase 3A, the app **cannot reach production AWS from a laptop**, even with production keys in `.env.local`:

| Resource | Production (Vercel) | Local (everything else) |
|---|---|---|
| DynamoDB | `luftansa-store` with the real credentials | Only DynamoDB Local on `127.0.0.1` with dummy credentials; without it, the database is off and the storefront uses its built-in catalogue |
| S3 | Private bucket | The S3 client refuses to start; media is stored in `.local/media` |
| `ASSET_CDN_URL` | Used if set | Ignored |
| Admin login | Cognito | Local mock sign-in on `localhost:4010`, which is rejected in production |

"Production" means Vercel (`VERCEL=1`) running a production build. Anything else counts as local. See `src/lib/runtime/mode.ts`.

## First run

Use four terminals. Java 17 or newer is required for DynamoDB Local.

```bash
npm run local:db      # 1. DynamoDB Local on :8000 (downloads the official AWS build into .local/ the first time)
npm run local:idp     # 2. mock admin sign-in on :4010
npm run local:setup   # 3. once: creates the local table and seeds sanitized fixtures
npm run local:dev     # 4. the app on http://localhost:3000
```

To sign in, open `http://localhost:3000/admin` and choose **Sign in as local admin** (`admin@luftansa.local`).

## What's in the local data

- The standard product types, plus the 8 fragrances already defined in the code (`src/data/products.ts`), at their confirmed prices.
- **No production records, secrets or customer data are read or copied.**
- Files you upload locally stay in `.local/media`.

## Resetting

Stop DynamoDB Local, then delete `.local/dynamodb-data` and `.local/media`.
