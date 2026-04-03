# Deployment — Railway (Tier 1, Recommended)

Recommended for small editorial offices and learned societies with limited technical staff. Railway hosts both the database and the application on one platform — no servers to manage.

**Estimated cost:** $20–40/month for a small journal.

**Caveat:** Railway does not provide automatic database backups or point-in-time recovery. You must configure a scheduled `pg_dump` job (Step 6).

---

## Prerequisites

- Railway account (railway.app)
- Cloudflare R2 or AWS S3 bucket for file storage
- Anthropic API key
- Domain name (optional, for custom journal domains)

---

## Step 1 — Deploy the Apache AGE database

1. Go to [railway.app/deploy/apache-age](https://railway.app/deploy/apache-age)
2. Click **Deploy Now**
3. Railway provisions the `apache/age` Docker image with a persistent volume pre-configured
4. Once deployed, open the service and copy the `DATABASE_URL` from the **Variables** tab

**Verify:** In the Railway service logs, confirm Postgres started and AGE loaded successfully.

---

## Step 2 — Run database migrations

<!--
TODO: Document the Railway CLI approach for running migrations against the deployed database.
Options:
- Railway CLI: `railway run bash db/migrate.sh`
- Connect via psql using the DATABASE_URL and run init.sql manually
- Add a one-shot migration service to the Railway project
-->

---

## Step 3 — Deploy the application

1. In your Railway project, click **New Service → GitHub Repo**
2. Connect your fork of this repository
3. Railway detects the Next.js app and builds automatically
4. Set environment variables in the service **Variables** tab (see below)

**Required variables:**

```
DATABASE_URL=<from Step 1>
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=https://<your-railway-app>.up.railway.app
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=https://<your-railway-app>.up.railway.app

# Cloudflare R2
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=<R2 access key>
S3_SECRET_ACCESS_KEY=<R2 secret key>
S3_BUCKET=ems-files
S3_FORCE_PATH_STYLE=false

# Email
EMAIL_FROM=editorial@yourdomain.org
SMTP_HOST=smtp.youremailprovider.com
SMTP_PORT=587
SMTP_USER=<smtp username>
SMTP_PASSWORD=<smtp password>
```

See [env-reference.md](env-reference.md) for the full variable list.

**Verify:** The deployment build log completes without errors. Open the Railway-assigned URL — the platform landing page should load.

---

## Step 4 — Configure a custom domain (optional)

<!--
TODO: Document Railway custom domain setup and the required proxy.ts / X-Journal-Acronym header configuration for per-journal custom domains.
-->

---

## Step 5 — Configure object storage bucket

Create the `ems-files` bucket in your Cloudflare R2 or AWS S3 account if it does not already exist. Set the bucket CORS policy to allow uploads from `NEXT_PUBLIC_APP_URL`.

<!--
TODO: Add CORS policy template for R2 and S3.
-->

---

## Step 6 — Configure database backups

Railway does not provide automatic backups. Set up a scheduled `pg_dump` cron job to export the database regularly.

<!--
TODO: Document pg_dump cron job setup — options include:
- Railway cron service running pg_dump and uploading to R2/S3
- External backup service (e.g. Pitr.cloud, Doppler Backup)
- GitHub Actions scheduled workflow
Recommended frequency: daily, retained for 30 days.
-->

---

## Upgrades

<!--
TODO: Document the Railway redeploy workflow for application upgrades and the database migration procedure for schema changes.
-->

---

## Common failure modes

<!--
TODO: Document Railway-specific failure modes as they are encountered during testing.
-->
