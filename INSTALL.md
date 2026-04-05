# Installation Guide

> **This document is written for a Claude agent to execute.**
> Each step includes the exact command to run, a verification check, and inline failure modes.
> Operators: open a Claude Code session in this repository and say "Follow INSTALL.md".

---

## Before You Begin

### Prerequisites — check these first

```bash
# Verify git is available
git --version
```
✓ Expected: `git version 2.x` or higher.

```bash
# Verify Docker is running
docker info --format '{{.ServerVersion}}'
```
✓ Expected: a version string like `26.1.4`.
⚠ If this fails: Docker Desktop is not running. Start it before continuing.

```bash
# Verify Docker Compose is available
docker compose version
```
✓ Expected: `Docker Compose version v2.x`.
⚠ If only `docker-compose` (v1) is available: upgrade to Docker Desktop or install the Compose v2 plugin.

```bash
# Verify Node.js 20 or higher
node --version
```
✓ Expected: `v20.x.x` or higher.
⚠ If Node.js is missing or older: install via https://nodejs.org or use `nvm install 20`.

---

## Choose Your Deployment Tier

| Tier | Best for | Effort |
|---|---|---|
| **1 — Railway** | Small editorial offices, lowest friction | ~20 min |
| **2 — Azure** | Institutions needing HA + automated backups | ~45 min |
| **3 — AWS** | Teams already in the AWS ecosystem | ~45 min |
| **4 — Self-hosted** | Technical teams, full control, lowest cost | ~30 min |

Jump to the section for your tier, then return to [Post-Install: First-Time Setup](#post-install-first-time-setup).

---

## Tier 1 — Railway (Recommended)

Railway hosts both the database and the app on one platform. No servers to manage.

### Step 1 — Deploy the Apache AGE database

1. Open https://railway.com/deploy/apache-age in your browser.
2. Click **Deploy Now**. Railway will provision a PostgreSQL + AGE container with a persistent volume.
3. Once deployed, open the service and go to **Variables**. Copy the value of `DATABASE_URL`.

✓ Verification:
```bash
# Paste your DATABASE_URL in place of the placeholder
psql "YOUR_DATABASE_URL" -c "SELECT version();"
```
✓ Expected: a PostgreSQL version string containing `Apache AGE`.
⚠ If connection is refused: the service may still be starting. Wait 30 seconds and retry.

### Step 2 — Clone the repository

```bash
git clone https://github.com/YOUR_ORG/oss-editorial-management-system.git
cd oss-editorial-management-system
```

### Step 3 — Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and set the following. All other values can stay as defaults for now.

| Variable | Where to find it |
|---|---|
| `DATABASE_URL` | Railway service → Variables → `DATABASE_URL` |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |
| `BETTER_AUTH_SECRET` | Run: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Your Railway app URL (set after Step 5) |
| `NEXT_PUBLIC_APP_URL` | Same as above |
| `NEXT_PUBLIC_BASE_URL` | Same as above |

Leave `S3_*` variables at their defaults for now — you will configure object storage in Step 4.

### Step 4 — Configure object storage

Choose one of the following. Cloudflare R2 is recommended for Railway deployments (no egress fees).

**Cloudflare R2:**
1. In the Cloudflare dashboard, create an R2 bucket named `ems-manuscripts`.
2. Create an API token with Object Read & Write permissions.
3. In `.env.local`:
```
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<R2 access key id>
S3_SECRET_ACCESS_KEY=<R2 secret access key>
S3_BUCKET=ems-manuscripts
S3_REGION=auto
```

**AWS S3:**
1. Create an S3 bucket named `ems-manuscripts` in your preferred region.
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` permissions on that bucket.
3. In `.env.local`:
```
# Remove or leave blank S3_ENDPOINT (not needed for AWS S3)
S3_ACCESS_KEY_ID=<IAM access key>
S3_SECRET_ACCESS_KEY=<IAM secret>
S3_BUCKET=ems-manuscripts
S3_REGION=us-east-1
```

### Step 5 — Deploy the app to Railway

1. In the Railway dashboard, create a new service in the same project.
2. Connect it to your GitHub repository.
3. Railway will auto-detect Next.js and build the app.
4. In the service's **Variables** tab, add all variables from your `.env.local`.
5. Once deployed, copy the public URL Railway assigns (e.g. `https://ems-xxxx.railway.app`).
6. Update `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_BASE_URL` in the Railway service variables to this URL.

✓ Verification:
```bash
curl -s -o /dev/null -w "%{http_code}" https://YOUR_RAILWAY_APP_URL/
```
✓ Expected: `200`.

### Step 6 — Run database migrations

```bash
# Set DATABASE_URL for the migration runner
export DATABASE_URL="YOUR_DATABASE_URL"
bash db/migrate.sh
```

✓ Expected output ends with: `=== Migrations complete ===`
⚠ If `psql` is not found: install it with `brew install libpq` (macOS) or `apt install postgresql-client` (Linux).
⚠ If `migrate.sh` fails on a specific migration: check the error, fix the underlying issue, and re-run — already-applied migrations are skipped automatically.

Skip to [Post-Install: First-Time Setup](#post-install-first-time-setup).

---

## Tier 2 — Azure

### Step 1 — Create Azure Database for PostgreSQL Flexible Server

1. In the Azure portal, create a **PostgreSQL Flexible Server** resource.
   - Tier: Burstable B1ms (sufficient for most small journals)
   - PostgreSQL version: 16
   - Authentication: PostgreSQL authentication
2. Once created, go to **Server parameters** and enable `azure.extensions` → add `AGE`.
3. Under **Databases**, create a database named `ems_db`.
4. Note the server hostname, admin username, and password.

✓ Verification:
```bash
psql "postgresql://ADMIN_USER:PASSWORD@SERVER_HOST/ems_db?sslmode=require" \
  -c "CREATE EXTENSION IF NOT EXISTS age; SELECT extversion FROM pg_extension WHERE extname = 'age';"
```
✓ Expected: a version string for the AGE extension.
⚠ If AGE is not available: confirm AGE is enabled in Server parameters and the server has finished restarting.

### Step 2 — Clone the repository and configure environment variables

```bash
git clone https://github.com/YOUR_ORG/oss-editorial-management-system.git
cd oss-editorial-management-system
cp .env.example .env.local
```

Set in `.env.local`:
```
DATABASE_URL=postgresql://ADMIN_USER:PASSWORD@SERVER_HOST/ems_db?sslmode=require
ANTHROPIC_API_KEY=sk-ant-...
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=https://YOUR_AZURE_APP_URL
NEXT_PUBLIC_APP_URL=https://YOUR_AZURE_APP_URL
NEXT_PUBLIC_BASE_URL=https://YOUR_AZURE_APP_URL
```

For object storage with Azure Blob Storage, use Azurite or configure an S3-compatible endpoint via Azure Blob Storage's S3 compatibility layer. Alternatively, use AWS S3 or Cloudflare R2 — they work identically from the app's perspective.

### Step 3 — Run database migrations

```bash
export DATABASE_URL="YOUR_DATABASE_URL"
bash db/migrate.sh
```

✓ Expected: `=== Migrations complete ===`

### Step 4 — Deploy the app

**Azure Container Apps (recommended):**
1. Build and push the Docker image to Azure Container Registry (see Dockerfile in repo root).
2. Create a Container App, point it at the image.
3. Set all `.env.local` values as Container App environment variables.

**Azure App Service:**
1. Create an App Service (Linux, Node 20).
2. Connect to the GitHub repository and enable continuous deployment.
3. Set all `.env.local` values in Configuration → Application settings.

✓ Verification: `curl -s -o /dev/null -w "%{http_code}" https://YOUR_AZURE_APP_URL/` → `200`

Skip to [Post-Install: First-Time Setup](#post-install-first-time-setup).

---

## Tier 3 — AWS

> AWS RDS does not support Apache AGE. PostgreSQL must run in a container even on AWS.

### Step 1 — Clone the repository and configure environment variables

```bash
git clone https://github.com/YOUR_ORG/oss-editorial-management-system.git
cd oss-editorial-management-system
cp .env.example .env.local
```

### Step 2 — Configure S3 for object storage

1. Create an S3 bucket named `ems-manuscripts`.
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on that bucket.
3. In `.env.local`:
```
# S3_ENDPOINT — leave blank or omit (AWS S3 does not need an endpoint override)
S3_ACCESS_KEY_ID=<IAM access key>
S3_SECRET_ACCESS_KEY=<IAM secret>
S3_BUCKET=ems-manuscripts
S3_REGION=us-east-1
```

### Step 3 — Deploy to Elastic Beanstalk (multi-container)

1. Create an Elastic Beanstalk environment using the **Multi-container Docker** platform.
2. The `Dockerrun.aws.json` in the repo root defines two containers:
   - `postgres-age` (apache/age image)
   - `app` (your built image from ECR)
3. Build and push the app image to ECR:
```bash
aws ecr create-repository --repository-name ems-app
docker build -t ems-app .
docker tag ems-app:latest YOUR_ECR_URI:latest
docker push YOUR_ECR_URI:latest
```
4. Set all `.env.local` values as Elastic Beanstalk environment properties.
5. Deploy.

### Step 4 — Run database migrations

```bash
# SSH into the EB instance or run via eb ssh
export DATABASE_URL="postgresql://ems:ems_password@localhost:5432/ems_db"
bash db/migrate.sh
```

✓ Expected: `=== Migrations complete ===`

Skip to [Post-Install: First-Time Setup](#post-install-first-time-setup).

---

## Tier 4 — Self-Hosted (Docker Compose)

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_ORG/oss-editorial-management-system.git
cd oss-editorial-management-system
```

### Step 2 — Configure environment variables

```bash
cp .env.example .env.local
```

For a self-hosted install the defaults work out of the box. You only need to set:

| Variable | Action |
|---|---|
| `ANTHROPIC_API_KEY` | Get from https://console.anthropic.com |
| `BETTER_AUTH_SECRET` | Run `openssl rand -base64 32` and paste the output |
| `POSTGRES_PASSWORD` | Change from the default to a strong password |
| `MINIO_ROOT_PASSWORD` | Change from the default to a strong password |
| `BETTER_AUTH_URL` | Set to `http://YOUR_SERVER_IP:3000` (or your domain) |
| `NEXT_PUBLIC_APP_URL` | Same as above |
| `NEXT_PUBLIC_BASE_URL` | Same as above |

Also update `S3_SECRET_ACCESS_KEY` to match `MINIO_ROOT_PASSWORD`.

### Step 3 — Start the database and object storage

```bash
docker compose up -d
```

✓ Verification:
```bash
docker compose ps
```
✓ Expected: both `ems-postgres` and `ems-minio` show status `healthy`.
⚠ If `ems-postgres` is unhealthy after 60 seconds: `docker compose logs postgres-age` to diagnose.

### Step 4 — Run database migrations

```bash
bash db/migrate.sh
```

✓ Expected output ends with: `=== Migrations complete ===`
⚠ If `Cannot connect to database`: confirm `ems-postgres` is healthy (Step 3).

### Step 5 — Install dependencies and start the app

```bash
npm install
npm run build
npm run start
```

✓ Verification:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
```
✓ Expected: `200`.
⚠ If build fails with a TypeScript error: run `npm run build 2>&1 | tail -20` and report the error.

> **For production self-hosted:** use a process manager (`pm2 start npm -- start`) and an nginx reverse proxy in front of port 3000. Add SSL via Let's Encrypt / Certbot.

---

## Post-Install: First-Time Setup

These steps are the same for all tiers.

### Step 1 — Run all database migrations

`npm run setup` runs the app schema migrations and the Better Auth migrations in one step.
The app schema migrations are idempotent — safe to run again if you already ran them during your tier setup.

```bash
npm run setup
```

✓ Expected output ends with: `=== Migrations complete ===` followed by the Better Auth migration confirmation.
✓ Verification:
```bash
psql "$DATABASE_URL" -c "\dt public.*" 2>/dev/null | grep -E "user|session|account|verification"
```
✓ Expected: rows for `user`, `session`, `account`, `verification` tables.
⚠ If `DATABASE_URL` is not in your shell environment: `export DATABASE_URL="..."` first, then re-run.

### Step 2 — Create the system administrator account

1. Open your app in a browser (`http://localhost:3000` or your deployed URL).
2. Click **Sign up** and create an account with your admin email address.
3. Promote that account to system administrator:

```bash
psql "$DATABASE_URL" -c \
  "UPDATE \"user\" SET system_admin = true WHERE email = 'YOUR_ADMIN_EMAIL';"
```

✓ Verification:
```bash
psql "$DATABASE_URL" -c \
  "SELECT email, system_admin FROM \"user\" WHERE email = 'YOUR_ADMIN_EMAIL';"
```
✓ Expected: `system_admin = t`.

### Step 3 — Create the first journal

1. Sign in with your admin account.
2. Navigate to `/admin` — you should see the System Admin dashboard.
3. Go to **Journals → Add journal**.
4. Fill in:
   - **Name** — full journal name (e.g. "Journal of Cardiothoracic Surgery")
   - **Acronym** — short slug used in URLs (e.g. `JCS`) — globally unique, uppercase
   - **ISSN** — optional
5. Click **Create**.

✓ Verification: navigate to `/journal/JCS` — you should see the journal landing page.

### Step 4 — Configure the journal

Navigate to `/journal/JCS/admin` (replace `JCS` with your acronym):

1. **Manuscript Types** — add the submission types your journal accepts (e.g. Original Research, Case Report, Review Article).
2. **Users** — add your editorial team. For each person, set their name, email, and role (Assistant Editor, Editor, etc.). They can then register at `/login` and will be linked to their editorial identity on first sign-in.
3. **Sections** (optional) — if your journal is divided by subject area, add sections here and assign staff to them.
4. **Email Templates** — customise outbound email templates (reviewer invitation, decision letters). The system sends reasonable defaults if you skip this.
5. **Workflow Config** — use the AI chat to describe your editorial workflow. The system will configure the review gates and routing automatically.

### Step 5 — Configure email (if not already done)

Add SMTP credentials to your environment variables (see `.env.example` for provider-specific instructions). Restart the app after adding them.

✓ Verification — send a test email from the Node.js REPL:
```bash
node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
t.sendMail({
  from: process.env.SMTP_FROM,
  to: 'YOUR_EMAIL',
  subject: 'EMS email test',
  text: 'If you receive this, email is configured correctly.'
}).then(() => console.log('Sent.')).catch(console.error);
"
```
✓ Expected: `Sent.` and an email arrives in your inbox within a few minutes.

---

## Environment Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key for all AI features |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (must include Apache AGE) |
| `BETTER_AUTH_SECRET` | Yes | — | Random secret for session signing. Min 32 chars. |
| `BETTER_AUTH_URL` | Yes | — | Public base URL of the app (used for auth redirects) |
| `NEXT_PUBLIC_APP_URL` | Yes | — | Same as `BETTER_AUTH_URL` |
| `NEXT_PUBLIC_BASE_URL` | Yes | — | Same as `BETTER_AUTH_URL` (used in email links) |
| `S3_ENDPOINT` | No | — | S3-compatible endpoint URL. Omit for AWS S3. |
| `S3_ACCESS_KEY_ID` | Yes | — | S3 / MinIO access key |
| `S3_SECRET_ACCESS_KEY` | Yes | — | S3 / MinIO secret key |
| `S3_BUCKET` | No | `ems-manuscripts` | Bucket name for manuscript files |
| `S3_REGION` | No | `us-east-1` | S3 region. Use `auto` for Cloudflare R2. |
| `SMTP_HOST` | No | — | SMTP server hostname. Omit to disable email. |
| `SMTP_PORT` | No | `465` | SMTP port. 465 = SSL, 587 = STARTTLS. |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | — | From address for outbound email |
| `POSTGRES_USER` | No | `ems` | PostgreSQL username (self-hosted / docker-compose only) |
| `POSTGRES_PASSWORD` | No | `ems_password` | PostgreSQL password (self-hosted / docker-compose only) |
| `POSTGRES_DB` | No | `ems_db` | PostgreSQL database name (self-hosted / docker-compose only) |
| `MINIO_ROOT_USER` | No | `ems_minio` | MinIO root username (self-hosted only) |
| `MINIO_ROOT_PASSWORD` | No | `ems_minio_password` | MinIO root password (self-hosted only) |

---

## Troubleshooting

**"Cannot load Apache AGE extension"**
The `CREATE EXTENSION age` call in `init.sql` failed. The database must be running the `apache/age` Docker image (self-hosted) or have AGE enabled in server parameters (Azure). AWS RDS and standard Supabase/Aiven instances do not support AGE.

**"Better Auth session tables not found"**
Run `npm run setup` — the auth schema has not been initialised.

**"system_admin is not a column"**
Better Auth migrations have not run, or ran against the wrong database. Confirm `DATABASE_URL` is correct and re-run the Better Auth migration.

**"Manuscript file upload fails"**
Check `S3_*` environment variables. For MinIO (self-hosted), confirm the `ems-minio` container is healthy: `docker compose ps`. The bucket is created automatically on first upload via `ensureBucket()` in `lib/storage.ts`.

**"Email not sending"**
The system silently skips email if SMTP is not configured — check the server logs for `[email] SMTP not configured`. If credentials are set but email fails, run the verification command in Step 5 of First-Time Setup to isolate the issue.

**AI features return errors**
Confirm `ANTHROPIC_API_KEY` is set and valid. Test with:
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```
✓ Expected: a JSON response with a `content` array.
