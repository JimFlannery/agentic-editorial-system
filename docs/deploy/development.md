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

Open `.env.local` and fill in the required values. The defaults below match `docker-compose.yml`, so you only need to set `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, and (optionally) `INITIAL_ADMIN_EMAIL`:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://ems:ems_password@localhost:5432/ems_db

# Object storage — MinIO local instance (matches docker-compose.yml defaults)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=ems_minio
S3_SECRET_ACCESS_KEY=ems_minio_password
S3_BUCKET=ems-manuscripts

# Auth
BETTER_AUTH_SECRET=<output of: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional — bootstrap the first system admin (one-shot, see Step 6)
INITIAL_ADMIN_EMAIL=admin@yourjournal.org
```

See [env-reference.md](env-reference.md) for the full variable list.

**Verify:** `.env.local` exists and contains your `ANTHROPIC_API_KEY`.

---

## Step 3 — Start the Docker infrastructure services

For local development, only the database and object store run in Docker — the Next.js app runs natively via `npm run dev` so hot reload works. Start just those two services:

```bash
docker compose up -d postgres-age minio
```

This starts:
- `postgres-age` (container: `ems-postgres`) — PostgreSQL with Apache AGE extension on port 5432
- `minio` (container: `ems-minio`) — S3-compatible object storage on ports 9000 (API) and 9001 (console)

**Verify:**
```bash
docker compose ps
```
Both services should show `healthy`. If `postgres-age` shows `starting`, wait 10–15 seconds and check again.

> ℹ The `app` service in `docker-compose.yml` is for full-stack deployment testing. Don't start it for development — it would conflict with `npm run dev` on port 3000.

---

## Step 4 — Run database migrations

```bash
npm run setup
```

This runs `bash db/migrate.sh` (which applies `init.sql` plus every numbered migration in `db/`) and the Better Auth migrations. The migration script tracks applied versions in `manuscript.schema_migrations`, so it's safe to re-run.

**Verify:**
```bash
docker exec -it ems-postgres psql -U ems -d ems_db -c "\dn"
```
Should list `ag_catalog`, `ems_graph`, `history`, `manuscript`, and `public` schemas.

```bash
docker exec -it ems-postgres psql -U ems -d ems_db -c "\dt manuscript.*"
```
Should list all manuscript schema tables including `journals`, `manuscripts`, `people`, `manuscript_types`, `form_fields`, and `schema_migrations`.

---

## Step 5 — (Optional) Load seed data

Choose one:

```bash
bash db/seed.sh           # Minimal — one journal, team, manuscript
bash db/seed_full.sh      # Full UI development dataset
bash db/seed_test.sh      # TEST journal used by the E2E test suite
```

**Verify:**
```bash
docker exec -it ems-postgres psql -U ems -d ems_db -c "SELECT name, acronym FROM manuscript.journals"
```
Should return at least one journal row.

---

## Step 6 — Start the development server and create the first admin

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The platform landing page should load showing any seeded journals.

**Create the first system admin** (one-shot via the `INITIAL_ADMIN_EMAIL` env var you set in Step 2):

1. Visit `/login`, switch to the **Sign up** tab, and register using **exactly** the email address from `INITIAL_ADMIN_EMAIL`.
2. The dev server log will print: `[bootstrap] Promoted <email> to system admin (matched INITIAL_ADMIN_EMAIL, no prior admins).`
3. You can now access `/admin`.

If you forgot to set `INITIAL_ADMIN_EMAIL` before signing up, use the CLI fallback:

```bash
npm run admin:promote -- --email=admin@yourjournal.org
```

The user must already exist (registered via the **Sign up** tab on `/login`). See [docs/admin-guide/system-admin.md](../admin-guide/system-admin.md#1-granting-system-admin-access) for full details.

---

## MinIO console

The MinIO web console is available at [http://localhost:9001](http://localhost:9001). Default credentials (from `docker-compose.yml`): `ems_minio` / `ems_minio_password`.

The `ems-manuscripts` bucket is created automatically on first upload. You can also create it manually in the console if you want to inspect it before any files are uploaded.

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `postgres-age` container exits immediately | Port 5432 already in use | Stop any local Postgres instance: `brew services stop postgresql` or equivalent |
| `LOAD 'age'` error in app logs | AGE extension not installed in the container | Ensure you're using the `apache/age` image, not a plain `postgres` image |
| `connect ECONNREFUSED 127.0.0.1:5432` | Docker services not running | `docker compose up -d postgres-age minio` |
| Cypher queries return no results | Migrations haven't run | Re-run Step 4 (`npm run setup`) |
| MinIO `NoSuchBucket` error | `ems-manuscripts` bucket not created | Create it in the MinIO console at http://localhost:9001 |
| `ANTHROPIC_API_KEY` not found | `.env.local` missing or key not set | Check `.env.local` exists and contains the key |
| `Error response from daemon: No such container: postgres-age` | Used the service name instead of the container name | Container name is `ems-postgres` (set in `docker-compose.yml`); service name is `postgres-age` |
| Port 3000 already in use when running `npm run dev` | The Docker `app` service is also running | `docker compose stop app` — only `postgres-age` and `minio` should be up for dev |

---

## Stopping the environment

```bash
docker compose down          # stop containers, preserve volumes
docker compose down -v       # stop containers AND delete all data (full reset)
```
