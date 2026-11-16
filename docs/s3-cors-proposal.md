# Proposed S3 CORS rule for large video uploads (decision D3)

Status: **for review only. Not applied.** No production CORS, IAM or bucket setting has been changed.
Applying it needs your separate, explicit approval.

## Why it's needed

- Uploads currently pass through a Vercel Function (`/api/admin/media/upload`). Vercel rejects request bodies above about 4.5 MB, so images are compressed in the browser and **videos are limited to 4 MB**.
- Real hero, lab and manufacturing videos are usually 10–200 MB. Those have to go straight from the admin's browser to S3, using a short-lived signed upload that the server creates after checking the admin login.
- Browsers only allow that cross-site upload if the bucket has a CORS rule for the site's domain. `luftansa-store-assets` currently has **no** CORS rule, which is why the presigned upload path was never used.

## The rule (exact configuration)

```json
{
  "CORSRules": [
    {
      "ID": "luftansa-admin-direct-upload",
      "AllowedOrigins": ["https://luftansa.vercel.app"],
      "AllowedMethods": ["POST"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

- **One origin only:** the production site. A custom domain is added only once it's confirmed. No wildcard origins, and no `localhost`, because local development never uploads to this bucket.
- **POST only.** No GET, PUT or DELETE. Uploads use **presigned POST policies**, which, unlike presigned PUT URLs, let the server set limits that S3 enforces itself:
  - `content-length-range` (for example, at most 200 MB for videos)
  - an exact `key` under an allow-listed folder (`videos/`, `hero/`, `lab/`, `manufacturing/`, …)
  - the exact `Content-Type`
  - an expiry of 10 minutes
- **What doesn't change:**
  - The bucket stays private and Block Public Access stays on; CORS never grants anyone access.
  - Every upload still needs a policy signed by the server after the admin login is checked.
  - Media keeps being served through `/media/`.

## How it would be applied (after approval)

```bash
aws s3api put-bucket-cors --bucket luftansa-store-assets --cors-configuration file://s3-cors.json
aws s3api get-bucket-cors --bucket luftansa-store-assets        # verify
```

To roll back: `aws s3api delete-bucket-cors --bucket luftansa-store-assets`

## Code that goes with it (Phase 3B, only after approval)

- An admin-only `POST /api/admin/media/presign-post` endpoint that returns a presigned POST with the limits above.
- The Media Library uploads videos directly to S3, then registers the file.
- The server confirms the uploaded object's size and type before cataloguing it.
- The video limit in `src/lib/media/upload-rules.ts` is raised to the approved size.
