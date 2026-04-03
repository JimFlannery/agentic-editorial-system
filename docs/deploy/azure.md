# Deployment — Azure (Tier 2, Enterprise)

For institutions that need fully managed PostgreSQL with automated backups, point-in-time recovery, and high availability. Azure is the only major cloud provider with a fully managed Postgres service that officially supports the Apache AGE extension (GA May 2025).

**Estimated cost:** $40–80/month depending on container size and storage.

**Caveat:** Apache AGE is not supported during major Postgres version upgrades — the extension must be dropped before upgrading and re-installed after.

---

## Prerequisites

- Azure subscription
- Azure CLI installed and authenticated (`az login`)
- Docker image of the application built and pushed to Azure Container Registry (or GitHub Container Registry)
- Anthropic API key
- Domain name

---

## Step 1 — Create a resource group

```bash
az group create \
  --name ems-rg \
  --location eastus
```

**Verify:**
```bash
az group show --name ems-rg --query properties.provisioningState
```
Should return `"Succeeded"`.

---

## Step 2 — Create Azure Database for PostgreSQL Flexible Server

```bash
az postgres flexible-server create \
  --resource-group ems-rg \
  --name ems-db \
  --location eastus \
  --tier Burstable \
  --sku-name Standard_B1ms \
  --storage-size 32 \
  --version 16 \
  --admin-user emsadmin \
  --admin-password <strong-password> \
  --public-access 0.0.0.0
```

**Enable the Apache AGE extension:**
```bash
az postgres flexible-server parameter set \
  --resource-group ems-rg \
  --server-name ems-db \
  --name azure.extensions \
  --value AGE
```

**Verify:**
```bash
az postgres flexible-server show \
  --resource-group ems-rg \
  --name ems-db \
  --query state
```
Should return `"Ready"`.

---

## Step 3 — Run database migrations

<!--
TODO: Document connecting to the Azure Flexible Server and running migrations.
Options:
- psql via Azure Cloud Shell
- psql from local machine with firewall rule
- Azure Container Instance one-shot migration job
-->

---

## Step 4 — Create Azure Container Registry (optional)

<!--
TODO: Document building and pushing the Next.js Docker image to ACR, or using GitHub Container Registry as an alternative.
-->

---

## Step 5 — Deploy the application to Azure Container Apps

<!--
TODO: Document Container Apps deployment with environment variable configuration, scaling rules, and health checks.
Alternative: Azure App Service (Web App for Containers) for simpler deployments.
-->

---

## Step 6 — Configure Azure Blob Storage (optional)

<!--
TODO: Document Azure Blob Storage setup as an alternative to AWS S3/R2.
The app uses S3-compatible API — document the Azure Blob Storage S3 compatibility endpoint configuration.
-->

---

## Step 7 — Configure a custom domain and TLS

<!--
TODO: Document Azure Container Apps custom domain setup with managed TLS certificate.
-->

---

## Backups and recovery

Azure Database for PostgreSQL Flexible Server provides automated backups and point-in-time recovery out of the box. Default retention: 7 days.

<!--
TODO: Document backup retention configuration and PITR restore procedure.
-->

---

## Upgrades

<!--
TODO: Document the application upgrade workflow and database migration procedure.
Note: AGE must be dropped before major Postgres version upgrades and re-installed after.
-->

---

## Common failure modes

<!--
TODO: Document Azure-specific failure modes as they are encountered during testing.
-->
