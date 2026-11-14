# AWS access via Vercel OIDC: setup guide (pending approval)

**Status:** prepared in code, **not applied**. No AWS or Vercel settings have been changed.
The application keeps using the existing credentials until every step below is approved and completed.

## Why

The site currently signs AWS requests with long-lived IAM access keys stored in Vercel.
With Vercel OIDC, each serverless function receives a short-lived OIDC token, which AWS exchanges for
temporary credentials (`AssumeRoleWithWebIdentity`) limited to one IAM role. There are no permanent keys to leak or rotate.

The code is ready: `src/lib/aws/credentials.ts` uses `awsCredentialsProvider` from `@vercel/functions/oidc`
whenever `AWS_ROLE_ARN` is set, and otherwise falls back to the AWS SDK default chain (the current keys).

## Steps (each requires approval)

### 1. Enable OIDC in Vercel
Project → Settings → **Security → Secure Backend Access → OIDC Federation** → enable, issuer mode **Team**.
Note the **team slug** (`https://oidc.vercel.com/<TEAM_SLUG>`).

### 2. Create the IAM OIDC identity provider (once per AWS account)
- Provider URL: `https://oidc.vercel.com/<TEAM_SLUG>`
- Audience: `https://vercel.com/<TEAM_SLUG>`

### 3. Create the IAM role `luftansa-vercel-app`

**Trust policy** (only this Vercel project, production environment):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/oidc.vercel.com/<TEAM_SLUG>" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.vercel.com/<TEAM_SLUG>:aud": "https://vercel.com/<TEAM_SLUG>",
          "oidc.vercel.com/<TEAM_SLUG>:sub": "owner:<TEAM_SLUG>:project:<PROJECT_NAME>:environment:production"
        }
      }
    }
  ]
}
```

(Add a second `sub` value, e.g. `...:environment:preview`, only if preview deployments need AWS access.)

**Permission policy** (least privilege, `ap-south-2`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "StoreTable",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:BatchGetItem",
        "dynamodb:TransactWriteItems",
        "dynamodb:ConditionCheckItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-south-2:<ACCOUNT_ID>:table/luftansa-store",
        "arn:aws:dynamodb:ap-south-2:<ACCOUNT_ID>:table/luftansa-store/index/*"
      ]
    },
    {
      "Sid": "MediaRead",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::luftansa-store-assets/logo/*",
        "arn:aws:s3:::luftansa-store-assets/hero/*",
        "arn:aws:s3:::luftansa-store-assets/products/*",
        "arn:aws:s3:::luftansa-store-assets/categories/*",
        "arn:aws:s3:::luftansa-store-assets/banners/*",
        "arn:aws:s3:::luftansa-store-assets/about/*",
        "arn:aws:s3:::luftansa-store-assets/general/*",
        "arn:aws:s3:::luftansa-store-assets/reels/*"
      ]
    },
    {
      "Sid": "MediaWrite",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::luftansa-store-assets/hero/*",
        "arn:aws:s3:::luftansa-store-assets/products/*",
        "arn:aws:s3:::luftansa-store-assets/categories/*",
        "arn:aws:s3:::luftansa-store-assets/banners/*",
        "arn:aws:s3:::luftansa-store-assets/about/*",
        "arn:aws:s3:::luftansa-store-assets/general/*",
        "arn:aws:s3:::luftansa-store-assets/reels/*"
      ]
    }
  ]
}
```

No `dynamodb:Scan`, `DescribeTable`, `DeleteTable`, `s3:ListAllMyBuckets` or IAM permissions are granted.
`logo/*` is read-only so the brand logo cannot be overwritten by the app.

### 4. Configure Vercel
Add `AWS_ROLE_ARN=arn:aws:iam::<ACCOUNT_ID>:role/luftansa-vercel-app` (Production), then redeploy.
Vercel injects `VERCEL_OIDC_TOKEN` automatically.

### 5. Verify, then retire the long-lived keys
1. Open **Admin → Dashboard → System status**: "AWS credentials" should read *Short-lived credentials via Vercel OIDC role*.
2. Confirm storefront media still loads.
3. The S3 media route still uses the default chain today. Switching it to `awsCredentials()` is a one-line change to make in the media phase, after this role is live.
4. Only then remove `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` from Vercel and deactivate the IAM user's access key.

## Related approvals still pending (from the plan)
- Enable point-in-time recovery on `luftansa-store` (currently **disabled**).
- Add `GSI1` / `GSI2` to `luftansa-store` (needed for listings in Phase 2+).
- Create `luftansa-store-dev` for automated tests.
- S3 CORS rule for presigned uploads (Phase 3).
