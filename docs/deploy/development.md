# Development Setup

Local development environment using Docker Compose for PostgreSQL + AGE and MinIO. The Next.js app runs natively via `npm run dev`.

**Prerequisites:** Node.js 20+, Docker Desktop, an Anthropic API key.

---

## Step 1 — Clone and install dependencies

```bash
git clone https://github.com/your-org/oss-editorial-management-system.git
cd oss-editorial-management-system
npm install
```

**Verify:** `node_modules/` directory exists and `npm install` completed without errors.

---

## Step 2 — Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the required values:

```env
# Required
DATABASE_URL=postgresql://ems:ems@localhost:5432/ems
ANTHROPIC_API_KEY=sk-ant-...

# Object storage — MinIO local instance (matches docker-compose.yml defaults)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=ems-files
S3_FORCE_PATH_STYLE=true

# Auth
BETTER_AUTH_SECRET=<output of: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

See [env-reference.md](env-reference.md) for the full variable list.

**Verify:** `.env.local` exists and contains your `ANTHROPIC_API_KEY`.

---

## Step 3 — Start the Docker services

```bash
docker compose up -d
```

This starts:
- `postgres-age` — PostgreSQL 16 with Apache AGE extension on port 5432
- `minio` — S3-compatible object storage on ports 9000 (API) and 9001 (console)

**Verify:**
```bash
docker compose ps
```
Both services should show `healthy`. If `postgres-age` shows `starting`, wait 10–15 seconds and check again.

---

## Step 4 — Run database migrations

```bash
bash db/migrate.sh
```

This runs `db/init.sql` against the running container, creating:
- The `manuscript`, `workflow`, and `history` schemas
- The Apache AGE graph (`ems_graph`)
- All base tables

**Verify:**
```bash
docker exec -it postgres-age psql -U ems -d ems -c "\dn"
```
Should list `ag_catalog`, `history`, `manuscript`, and `public` schemas.

---

## Step 5 — Run numbered migrations

```bash
bash db/002_manuscript_types.sh
bash db/003_journal_acronym.sh
bash db/004_credit.sh
```

**Verify:**
```bash
docker exec -it postgres-age psql -U ems -d ems -c "\dt manuscript.*"
```
Should list all manuscript schema tables including `form_fields`, `journal_settings`, and `manuscript_types`.

---

## Step 6 — (Optional) Load seed data

Minimal seed — one test journal, team, and manuscript:
```bash
bash db/seed.sh
```

Full seed — complete dataset for UI development:
```bash
bash db/seed_full.sh
```

**Verify:**
```bash
docker exec -it postgres-age psql -U ems -d ems -c "SELECT name, acronym FROM manuscript.journals"
```
Should return at least one journal row.

---

## Step 7 — Start the development server

```bash
npm run dev
```

**Verify:** Open [http://localhost:3000](http://localhost:3000). The platform landing page should load showing any seeded journals.

---

## MinIO console

The MinIO web console is available at [http://localhost:9001](http://localhost:9001). Default credentials: `minioadmin` / `minioadmin`.

Create the `ems-files` bucket on first use if it does not already exist.

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `postgres-age` container exits immediately | Port 5432 already in use | Stop any local Postgres instance: `brew services stop postgresql` or equivalent |
| `LOAD 'age'` error in app logs | AGE extension not installed in the container | Ensure you're using the `apache/age` image, not a plain `postgres` image |
| `connect ECONNREFUSED 127.0.0.1:5432` | Docker services not running | `docker compose up -d` |
| Cypher queries return no results | Migrations haven't run | Re-run steps 4 and 5 |
| MinIO `NoSuchBucket` error | `ems-files` bucket not created | Create it in the MinIO console at http://localhost:9001 |
| `ANTHROPIC_API_KEY` not found | `.env.local` missing or key not set | Check `.env.local` exists and contains the key |

---

## Stopping the environment

```bash
docker compose down          # stop containers, preserve volumes
docker compose down -v       # stop containers AND delete all data (full reset)
```
