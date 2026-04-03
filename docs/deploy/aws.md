# Deployment — AWS (Tier 3)

For teams already in the AWS ecosystem. Uses Elastic Beanstalk multi-container to run both the application and PostgreSQL + AGE in the same environment.

**Important:** AWS RDS does not support the Apache AGE extension and cannot be used. Postgres must run in a container.

**Estimated cost:** $50–100/month depending on instance size.

---

## Prerequisites

- AWS account
- AWS CLI installed and authenticated
- Elastic Beanstalk CLI (`eb`) installed
- AWS S3 bucket for file storage
- Anthropic API key
- Domain name

---

## Architecture

```
Elastic Beanstalk environment (multi-container)
├── app container     — Next.js application
└── postgres-age      — apache/age Docker image with persistent EBS volume
```

The two containers share a Docker network within the EB environment. The app connects to Postgres via `localhost:5432`.

---

## Step 1 — Create an S3 bucket for file storage

```bash
aws s3api create-bucket \
  --bucket ems-files \
  --region us-east-1
```

Block public access:
```bash
aws s3api put-public-access-block \
  --bucket ems-files \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

**Verify:**
```bash
aws s3api head-bucket --bucket ems-files
```

---

## Step 2 — Create an IAM role for the application

<!--
TODO: Document IAM role creation with S3 read/write permissions scoped to the ems-files bucket.
The EB instance profile should assume this role.
-->

---

## Step 3 — Configure the Elastic Beanstalk environment

<!--
TODO: Document Dockerrun.aws.json (v2) multi-container configuration for the app + postgres-age containers.
Key considerations:
- EBS volume mount for Postgres data persistence
- Container links / networking
- Health check path
- Instance type recommendation (t3.small minimum for AGE workloads)
-->

---

## Step 4 — Set environment variables

<!--
TODO: Document setting environment variables via EB console or `eb setenv`.
Use AWS Secrets Manager or Parameter Store for sensitive values in production.
-->

---

## Step 5 — Run database migrations

<!--
TODO: Document running migrations against the EB-hosted Postgres instance.
Options:
- SSH into the EB instance and run migrate.sh
- One-shot ECS task or Lambda for migration
- EB deployment hook (container command)
-->

---

## Step 6 — Configure a custom domain

<!--
TODO: Document Route 53 + EB CNAME / ALB setup for custom domain.
TLS via AWS Certificate Manager.
-->

---

## Backups

<!--
TODO: Document EBS snapshot schedule for the Postgres data volume.
Also document pg_dump to S3 as a logical backup complement.
AWS does not provide automatic Postgres backups when running in a container — this must be configured manually.
-->

---

## Upgrades

<!--
TODO: Document EB rolling deployment for application upgrades.
Database migration procedure for schema changes.
-->

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Cannot use RDS | AGE not supported | Use the container-based Postgres approach described above |
| Postgres data lost after redeploy | EBS volume not mounted | Ensure persistent EBS volume is configured in Dockerrun.aws.json |

<!--
TODO: Expand with AWS-specific failure modes as they are encountered during testing.
-->
