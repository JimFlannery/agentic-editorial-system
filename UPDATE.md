# Update Guide

> **This document is written for a Claude agent to execute.**
> Each step includes the exact command to run, a verification check, and inline failure modes.
> Operators: open a Claude Code session in this repository and say "Follow UPDATE.md".

Before starting, check the [release notes](https://github.com/YOUR_ORG/oss-editorial-management-system/releases) for the target version. If the release notes include a **Breaking changes** section, read it before proceeding.

---

## Before You Begin

```bash
# Confirm current running version (Docker deployments)
docker inspect ems-app --format '{{index .Config.Labels "org.opencontainers.image.version"}}' 2>/dev/null || echo "(not a container deployment)"
```

```bash
# Confirm DATABASE_URL is in the environment or .env.local
echo "${DATABASE_URL:-not set}"
```

⚠ If `DATABASE_URL` is not set: `export DATABASE_URL="..."` before continuing.

---

## Choose Your Deployment Tier

| Tier | Steps |
|---|---|
| **1 — Railway** | [Jump to Tier 1](#tier-1--railway) |
| **2 — Azure** | [Jump to Tier 2](#tier-2--azure) |
| **3 — AWS Elastic Beanstalk** | [Jump to Tier 3](#tier-3--aws) |
| **4 — Self-Hosted Docker Compose** | [Jump to Tier 4](#tier-4--self-hosted) |

---

## Tier 1 — Railway

Railway deployments use continuous deployment from GitHub. When a new release tag is pushed to the repository, the app service rebuilds automatically.

### Step 1 — Confirm the new image is deployed

In the Railway dashboard, open the app service and check the **Deployments** tab. Wait for the latest build to show status **Success**.

✓ Verification:
```bash
curl -s -o /dev/null -w "%{http_code}" https://YOUR_RAILWAY_APP_URL/
```
✓ Expected: `200`.

### Step 2 — Run database migrations

Migrations run automatically when the container starts (via `docker-entrypoint.sh`). If you need to verify:

```bash
psql "$DATABASE_URL" -c "SELECT version, applied_at FROM manuscript.schema_migrations ORDER BY applied_at DESC LIMIT 5;"
```

✓ Expected: the latest migration filenames are present with recent `applied_at` timestamps.

---

## Tier 2 — Azure

### Step 1 — Pull the new image and redeploy

**Azure Container Apps:**
```bash
# Update the container image to the new version tag
az containerapp update \
  --name YOUR_CONTAINER_APP_NAME \
  --resource-group YOUR_RESOURCE_GROUP \
  --image ghcr.io/YOUR_ORG/oss-editorial-management-system:TARGET_VERSION
```

**Azure App Service (GitHub-connected):**
Merge or push the new version tag. App Service continuous deployment triggers a rebuild automatically. Monitor in the Azure portal under **Deployment Center**.

✓ Verification:
```bash
curl -s -o /dev/null -w "%{http_code}" https://YOUR_AZURE_APP_URL/
```
✓ Expected: `200`.

### Step 2 — Verify migrations ran

```bash
psql "$DATABASE_URL" -c "SELECT version, applied_at FROM manuscript.schema_migrations ORDER BY applied_at DESC LIMIT 5;"
```

✓ Expected: latest migrations present.

---

## Tier 3 — AWS

### Step 1 — Build and push the new image to ECR

```bash
# Pull the latest source
git fetch --tags
git checkout TARGET_VERSION

# Build
docker build -t ems-app .

# Tag and push
docker tag ems-app:latest YOUR_ECR_URI:TARGET_VERSION
docker tag ems-app:latest YOUR_ECR_URI:latest
docker push YOUR_ECR_URI:TARGET_VERSION
docker push YOUR_ECR_URI:latest
```

### Step 2 — Deploy to Elastic Beanstalk

```bash
# Deploy the new version
eb deploy YOUR_EB_ENVIRONMENT_NAME
```

✓ Verification:
```bash
curl -s -o /dev/null -w "%{http_code}" http://YOUR_EB_URL/
```
✓ Expected: `200`.

### Step 3 — Verify migrations ran

```bash
psql "$DATABASE_URL" -c "SELECT version, applied_at FROM manuscript.schema_migrations ORDER BY applied_at DESC LIMIT 5;"
```

---

## Tier 4 — Self-Hosted

### Step 1 — Pull the new image

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/YOUR_ORG/oss-editorial-management-system:latest

# Or pull a specific version
docker pull ghcr.io/YOUR_ORG/oss-editorial-management-system:TARGET_VERSION
```

If you are building locally instead:
```bash
git fetch --tags
git checkout TARGET_VERSION
docker compose build app
```

### Step 2 — Restart the app container

The entrypoint applies all pending migrations before the server starts. No manual migration step needed.

```bash
docker compose up -d app
```

✓ Verification:
```bash
docker compose ps
```
✓ Expected: `ems-app` shows status `healthy` (may take up to 40 seconds on first start).

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
```
✓ Expected: `200`.

### Step 3 — Verify migrations ran

```bash
docker compose exec app sh -c \
  'psql "$DATABASE_URL" -c "SELECT version, applied_at FROM manuscript.schema_migrations ORDER BY applied_at DESC LIMIT 5;"'
```

✓ Expected: all new migration filenames from the release are present.

---

## If Something Goes Wrong

### Roll back to the previous version (Tier 4)

```bash
# Stop the new container
docker compose stop app

# Start the previous image version
# Edit docker-compose.yml to pin the previous tag, then:
docker compose up -d app
```

Database migrations are append-only and backward-compatible by convention. Rolling back the application code is safe; you do not need to reverse migrations.

### Migrations failed mid-run

The migration runner records each migration only after it completes successfully. A failed migration leaves the database in a consistent state — the failed migration is not marked as applied. Fix the underlying issue (check logs with `docker compose logs app`) and restart the container to retry.

```bash
docker compose logs app --tail 50
docker compose restart app
```

### Container fails to start

```bash
docker compose logs app --tail 50
```

Common causes:
- `DATABASE_URL is not set` — add to your `.env.local` or `docker-compose.yml` environment section
- Database not ready — ensure `ems-postgres` is healthy before starting `ems-app` (`docker compose ps`)
- Migration SQL error — check logs for the failing migration filename, fix the issue, restart

---

## Environment Variable Changes Between Releases

Check the release notes for each version. If new required environment variables were added, add them to your deployment before restarting. New optional variables will be documented in `.env.example`.

```bash
# Compare your current env against the updated example
diff .env.local .env.example
```
