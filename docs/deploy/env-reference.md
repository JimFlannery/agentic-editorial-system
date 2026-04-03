# Environment Variable Reference

All environment variables used across deployment targets. Every target requires the Core group. Additional groups apply depending on the deployment.

---

## Core (required by all targets)

| Variable | Type | Description |
|---|---|---|
| `DATABASE_URL` | string | PostgreSQL connection string — must point to a Postgres instance with the Apache AGE extension installed. Format: `postgresql://user:password@host:5432/dbname` |
| `ANTHROPIC_API_KEY` | string | Anthropic API key for all Claude agent features. Get one at https://console.anthropic.com |
| `NEXT_PUBLIC_APP_URL` | string | The public base URL of the application, e.g. `https://myjournal.example.com`. Used for absolute URL generation in emails and callbacks. |

---

## Object Storage (required by all targets)

The app uses an S3-compatible API for all binary file storage. Set either the MinIO variables (self-hosted Tier 4) or the S3 variables (all other tiers). The `S3_*` variables take precedence if both are set.

| Variable | Type | Default | Description |
|---|---|---|---|
| `S3_ENDPOINT` | string | — | S3-compatible endpoint URL. Omit for AWS S3 (uses the SDK default). Set for R2, Backblaze B2, or MinIO: e.g. `https://your-account.r2.cloudflarestorage.com` |
| `S3_REGION` | string | `us-east-1` | AWS region, or the region string required by your provider. |
| `S3_ACCESS_KEY_ID` | string | — | Access key ID. |
| `S3_SECRET_ACCESS_KEY` | string | — | Secret access key. |
| `S3_BUCKET` | string | `ems-files` | Bucket name for manuscript files, figures, and attachments. |
| `S3_FORCE_PATH_STYLE` | boolean | `false` | Set to `true` for MinIO and some S3-compatible providers that use path-style URLs instead of virtual-hosted-style. |

---

## Authentication (Better Auth)

| Variable | Type | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | string | Random secret used to sign session tokens. Generate with: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | string | Same value as `NEXT_PUBLIC_APP_URL`. Better Auth uses this for callback URL validation. |

---

## Email (outbound)

| Variable | Type | Default | Description |
|---|---|---|---|
| `EMAIL_FROM` | string | — | The `From` address for all outbound email, e.g. `editorial@myjournal.org` |
| `SMTP_HOST` | string | — | SMTP server hostname. |
| `SMTP_PORT` | number | `587` | SMTP port. Use `587` for STARTTLS, `465` for SSL. |
| `SMTP_USER` | string | — | SMTP authentication username. |
| `SMTP_PASSWORD` | string | — | SMTP authentication password. |
| `SMTP_SECURE` | boolean | `false` | Set to `true` when using port 465 (SSL). Leave `false` for port 587 (STARTTLS). |

---

## Custom Domain Routing (optional)

| Variable | Type | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_DOMAIN` | string | The platform's own domain, e.g. `editorialsystem.example.com`. Used by `proxy.ts` to distinguish platform traffic from journal custom-domain traffic. Only required if journals are served from their own domains. |

---

## Development Only

| Variable | Type | Default | Description |
|---|---|---|---|
| `MINIO_ROOT_USER` | string | `minioadmin` | MinIO root username. Only used in the local Docker Compose stack. |
| `MINIO_ROOT_PASSWORD` | string | `minioadmin` | MinIO root password. Only used in the local Docker Compose stack. Change before any internet-accessible deployment. |

---

## Notes

- Never commit `.env.local` or any file containing real credentials to version control. `.env.local` is in `.gitignore`.
- Use `.env.example` as the template — it contains all variable names with placeholder values and comments.
- In production, set variables via your platform's secret management (Railway environment variables, Azure Key Vault references, AWS Secrets Manager, or a `.env` file on a self-hosted VPS that is not world-readable).
