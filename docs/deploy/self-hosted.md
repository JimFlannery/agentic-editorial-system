# Deployment — Self-Hosted VPS (Tier 4)

For technical teams, institutions with existing infrastructure, or anyone wanting full control. Runs three Docker containers on any VPS.

**Estimated cost:** $5–15/month (Hetzner CX22 or equivalent). Cheapest option — you are responsible for uptime and backups.

**Recommended providers:** Hetzner Cloud, DigitalOcean, Linode/Akamai, OVHcloud.

---

## Prerequisites

- VPS running Ubuntu 22.04 or Debian 12 (other Linux distributions work; commands may differ)
- Docker Engine and Docker Compose plugin installed
- Domain name pointed at the VPS IP
- Anthropic API key

---

## Architecture

```
┌─────────────────────────────────┐
│  app         (Next.js)  :3000   │
├─────────────────────────────────┤
│  postgres-age           :5432   │  ← apache/age Docker image
├─────────────────────────────────┤
│  minio                  :9000   │  ← swap for any S3-compatible service
└─────────────────────────────────┘
         nginx (reverse proxy)
         :80 / :443
```

---

## Step 1 — Provision the VPS

<!--
TODO: Document initial VPS setup — create non-root user, SSH key auth, disable password auth, UFW firewall rules.
Minimum spec: 2 vCPU, 4GB RAM, 40GB disk.
-->

---

## Step 2 — Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in, then verify:
```bash
docker --version
docker compose version
```

---

## Step 3 — Clone the repository

```bash
git clone https://github.com/your-org/oss-editorial-management-system.git
cd oss-editorial-management-system
```

---

## Step 4 — Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with production values. Key differences from development:

```env
DATABASE_URL=postgresql://ems:<strong-password>@postgres-age:5432/ems
NEXT_PUBLIC_APP_URL=https://yourdomain.org
BETTER_AUTH_URL=https://yourdomain.org
MINIO_ROOT_USER=<change-from-default>
MINIO_ROOT_PASSWORD=<strong-password>

# Point S3 variables at the local MinIO instance
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=<MINIO_ROOT_USER value>
S3_SECRET_ACCESS_KEY=<MINIO_ROOT_PASSWORD value>
S3_FORCE_PATH_STYLE=true
```

See [env-reference.md](env-reference.md) for the full variable list.

---

## Step 5 — Start the Docker services

```bash
docker compose up -d
```

**Verify:**
```bash
docker compose ps
```
All three services (`app`, `postgres-age`, `minio`) should show `healthy`.

---

## Step 6 — Run database migrations

```bash
bash db/migrate.sh
bash db/002_manuscript_types.sh
bash db/003_journal_acronym.sh
bash db/004_credit.sh
```

**Verify:**
```bash
docker exec -it postgres-age psql -U ems -d ems -c "\dt manuscript.*"
```

---

## Step 7 — Configure nginx reverse proxy

<!--
TODO: Document nginx config for:
- Proxying :443 → app:3000
- SSL/TLS via Let's Encrypt (Certbot)
- Per-journal custom domain handling with X-Journal-Acronym header injection
- WebSocket proxying for streaming AI responses
-->

---

## Step 8 — Configure TLS with Let's Encrypt

<!--
TODO: Document Certbot installation and certificate issuance.
Auto-renewal via systemd timer or cron.
-->

---

## Step 9 — Create the MinIO bucket

Open the MinIO console at `https://yourdomain.org:9001` (or configure nginx to proxy it). Create the `ems-files` bucket.

Alternatively, swap MinIO for any S3-compatible service — set the `S3_*` environment variables to point at Cloudflare R2, Backblaze B2, or AWS S3, and remove MinIO from `docker-compose.yml`.

---

## Step 10 — Configure database backups

<!--
TODO: Document pg_dump cron job:
- Daily pg_dump piped to gzip, uploaded to MinIO or external S3
- Retention policy (e.g. 30 daily, 12 monthly)
- Restore procedure
Example cron entry and script.
-->

---

## Upgrades

```bash
git pull
docker compose build app
docker compose up -d app
bash db/<new-migration>.sh   # if a new migration exists
```

**Verify:** Check the app logs after restart — `docker compose logs -f app`.

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| App cannot reach Postgres | Services on different Docker networks | Ensure all services are in the same `docker-compose.yml` and share a network |
| MinIO `InvalidAccessKeyId` | Default credentials not updated in env | Update `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, and the corresponding `S3_*` variables |
| nginx 502 | App container not yet healthy | Wait 10–15s after `docker compose up` for the app to compile |
| AGE extension errors | Wrong Postgres image | Must use `apache/age` image, not plain `postgres` |

<!--
TODO: Expand with failure modes encountered during testing.
-->
