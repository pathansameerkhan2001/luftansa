# Phase 3B Checkpoint B: Vercel Preview test plan

Status: **proposal, not started.** Nothing here is pushed or deployed without explicit approval of step 2.

Goal: confirm on Vercel's real infrastructure what was proven locally:

1. CMS changes (publish, deactivate, visibility) reach the storefront without redeploying, including changes made 1-2 seconds apart.
2. The stale-content fix works on Vercel's cache. The fix is a follow-up revalidation run with `after()` after a second tag; Vercel runs `after()` through `waitUntil`.
3. No hydration errors on the storefront, the admin editor or the preview.

---

## 1. Read-only checks before anything is pushed (no approval needed beyond reading)

| # | Check | Where | Go if |
|---|---|---|---|
| 1.1 | Preview environment variables: `DYNAMODB_TABLE`, `S3_*`, `ASSET_CDN_URL`, `COGNITO_*`, `AUTH_REDIRECT_URI`, `ADMIN_EMAILS` | Vercel → Project → Settings → Environment Variables, **Preview** column (read only) | The Preview table and bucket are **not** the production ones |
| 1.2 | Whether Git pushes create Preview deployments automatically | Vercel → Project → Settings → Git | Known either way (affects step 2) |
| 1.3 | Deployment Protection on Preview URLs | Vercel → Settings → Deployment Protection | Known: the test scripts need a protection-bypass token or a signed-in browser |
| 1.4 | Cognito app client allowed callback URLs | AWS Console → Cognito (read only) | The Preview URL can sign in. If not, admin tests on Preview are blocked; Cognito is **not** changed. |

**Why 1.1 is a hard gate:** the app treats any Vercel deployment (`VERCEL=1`, production build) as production (`src/lib/runtime/mode.ts`). A Preview therefore reads and writes whatever table its environment variables name. If that is the production table, a publish or deactivate test on the Preview would change the live website's content. It would reach the live site at its next refresh, at most 5 minutes later.

**Decision points:**
- **1.1 passes** (separate Preview table and bucket): run the full plan.
- **1.1 fails** (Preview uses production resources): run only the **read-only** tests (§4.1, §4.4). Publishing tests need a separate Preview table, which is an AWS change and needs your separate approval. Content would come from `npm run local:setup`'s sanitized fixtures, never copied from production.
- **1.4 fails:** no admin sign-in on Preview, so only read-only storefront tests can run.

## 2. Actions needing explicit approval

1. Push `feature/homepage-cms` to GitHub. The commit(s) are approved separately; nothing is merged.
2. Create the Preview deployment, either automatically from the push or with `vercel deploy` (no `--prod`).
3. Optionally, if 1.1 failed: create a separate Preview DynamoDB table and point the **Preview-only** env vars at it.

Never: `vercel --prod`, a merge to `main`, or changes to production env vars, S3 CORS or Cognito.

## 3. Test data and clean-up

- Use only the module records the tests create (`announcement-bar`, `hero`) on the **Preview** table, with the sanitized local fixtures and the approved Option A message.
- Before the tests, note each module's state (status, version, visibility) and restore it afterwards. The stress scripts already restore the state they found.
- Afterwards, delete the Preview deployment if you want, and remove the test entries from the Preview table. Production is untouched.

## 4. Tests

Scripts: the local test scripts, run against the Preview URL with `BASE=<preview-url>` (plus the bypass token from 1.3). No code changes for Preview.

### 4.1 Read-only storefront checks (always safe)
- Homepage at 1280, 768 and 390 px: the announcement bar renders (approved default or the Preview table's content). No "20,000+ Verified Reviews" text and no `/reviews` link.
- Reduced motion: no ticker animation and no pause button.
- Response headers on `/`: `x-vercel-cache` goes `MISS` then `HIT`, and back to `STALE`/`MISS` after a change. This records how Vercel caches the page.

### 4.2 Publishing reaches the storefront (gate 1.1)
For each module (Announcement Bar and Hero), 10 rounds of: publish → check; deactivate → check; hide on phones → check; show everywhere → check. Pass criteria:
- normal case: the storefront shows the change on the first or second request after the save (under about 3 s);
- worst case (a regeneration was in flight): correct within **15 s** (the follow-up runs at 10 s);
- never stuck: zero rounds still wrong after 30 s.

### 4.3 Changes 1-2 seconds apart (the race)
- `stress.mjs`: 3 simulated visitors on `/` plus bursts of 2-4 changes 1-2 s apart, 20 bursts per module. Pass: every burst converges to the database state within 15 s; zero stuck.
- `window.mjs`: a homepage regeneration started 0-250 ms before a deactivation or visibility change, 20 trials per module and change. Pass: zero stale after 16 s. On Vercel, renders are slower than locally, so this test hits the race naturally, without the local fault injection.
- Evidence to collect: per-burst time to converge, `x-vercel-cache` sequence, and Vercel function logs for the CMS route (the follow-up revalidation runs about 10 s after each save).

### 4.4 Hydration
- Storefront, admin editor and preview iframe: 30 loads each at 1280/768/390 with a per-frame error listener (`[frame-error]` init script). Screenshots use `caret: "initial"` so Playwright doesn't change input styles before hydration.
- Pass: zero React #418/#423/#425 errors.

### 4.5 Regression
- Hero: publish/deactivate/visibility reach the storefront (same criteria as 4.2).
- Full Checkpoint B browser suite (`checkpoint-b.mjs`, 72 checks) against the Preview URL: all pass, no unexpected errors.

## 5. Report back
A results table per section (pass/fail, timings, cache headers), screenshots at 1280/768/390, the Vercel log excerpt showing the follow-up revalidation, and confirmation that production content and settings were not touched.
