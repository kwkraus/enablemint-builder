# Deploying with Azure Developer CLI

This project deploys the hybrid Next.js frontend and .NET API to Linux Azure App Service using Azure Developer CLI (azd). The infrastructure in `infra/` is composed from pinned Azure Verified Modules (AVM) for Log Analytics, Application Insights, App Service, and Azure SQL.

## Prerequisites

- Azure Developer CLI, Azure CLI, and Bicep installed.
- An Azure subscription with permissions to create resource groups and the resources in `infra/main.bicep`.
- A Microsoft Entra user who can be configured as the Azure SQL server administrator.
- An existing single-tenant Entra application registration with the delegated permissions in [setup-entra-permissions.md](setup-entra-permissions.md).
- Network access to the deployed virtual network for the one-time database grant step (see [Grant the API database access](#grant-the-api-database-access)).

The SQL server uses Microsoft Entra-only authentication. No SQL administrator or application connection-string credentials are provisioned.

## Configure an environment

Create an azd environment, then set the required values. Do not commit the resulting `.azure/` directory.

```powershell
azd env new dev
azd env set AZURE_LOCATION eastus
azd env set AZURE_AD_TENANT_ID "<tenant-id>"
azd env set AZURE_AD_CLIENT_ID "<application-client-id>"
azd env set AZURE_AD_CLIENT_SECRET "<application-client-secret>"
azd env set NEXTAUTH_SECRET "<random-secret>"
azd env set SQL_ADMINISTRATOR_LOGIN "<administrator-upn>"
azd env set SQL_ADMINISTRATOR_OBJECT_ID "<administrator-object-id>"
```

The CD workflow also requires the migration identity's resource ID, which is a Bicep-managed output (`MIGRATION_IDENTITY_RESOURCE_ID`) rather than a manually created identity or GitHub secret - see [Apply EF Core migrations](#apply-ef-core-migrations).

`infra/main.parameters.json` maps these azd environment variables to the required Bicep parameters. The secret inputs are Bicep secure parameters, but `azd env set` writes values into the local `.azure/<environment>/.env` file. Use a protected local environment or `azd env set-secret` with Azure Key Vault rather than sharing that file.

The default development deployment provisions a private network for Azure SQL: a virtual network (`vnet-enb-*`) with a private endpoint for the SQL server (`publicNetworkAccess: 'Disabled'`) and a `snet-appservice` subnet used for regional VNet integration on the API App Service. **This subscription enforces `publicNetworkAccess: Disabled` on Azure SQL logical servers at the platform level** — an explicit `Enabled` value in Bicep is silently reverted, so public firewall rules are not usable here. If your subscription does not have this restriction, you can simplify by removing the VNet/private-endpoint modules and re-adding public firewall rules instead.

## Provision and deploy

```powershell
azd provision
azd deploy
```

`azd provision` outputs the frontend and API endpoints along with Azure SQL resource names. Those outputs also make `BACKEND_API_BASE_URL` and `NEXT_PUBLIC_BACKEND_API_BASE_URL` available to the Next.js build, so no azd prepackage or postdeploy hooks are required.

Before users sign in, add the frontend endpoint as an Entra application redirect URI:

```text
https://<frontend-app>.azurewebsites.net/api/auth/callback/azure-ad
```

The Bicep deployment configures the API CORS allow-list for the generated frontend endpoint. Update the App Service settings and Entra redirect URI together if a custom domain is later introduced.

## Grant the API database access

`tools/run-vnet-migration.ps1` now grants the API App Service's system-assigned managed identity `db_datareader`/`db_datawriter` automatically on every run (using the migration identity's `db_owner` privileges — see [Apply EF Core migrations](#apply-ef-core-migrations)). The manual steps below are only needed as a fallback, e.g. before the migration job has run for a new environment.

Because Azure SQL only accepts connections through the private endpoint, `sqlcmd` must run from a host with network line-of-sight to the virtual network (`vnet-enb-*`) — for example:

- A workstation already routed to the VNet through your organization's ExpressRoute/VPN peering (common on corporate networks; ask your network team if the VNet needs an explicit peering or route).
- The disposable container shell in [`tools/bootstrap-vnet-shell.ps1`](#bootstrap-vnet-access-without-a-bastion-host), which injects an interactive Azure Container Instance into the existing `snet-container` subnet and deletes it when you're done — no Bastion host or jump box required.

After provisioning, grant the API's system-assigned managed identity its runtime database permissions (using dynamic environment variables exported from `azd provision`):

```powershell
# Sourced dynamically from azd environment variables
.\tools\grant-api-sql-database-access.ps1 `
  -ResourceGroup $env:AZURE_RESOURCE_GROUP `
  -ApiAppName $env:API_APP_NAME `
  -SqlServerName $env:AZURE_SQL_SERVER_NAME `
  -DatabaseName $env:AZURE_SQL_DATABASE_NAME
```

The script uses Microsoft Entra authentication (`sqlcmd -G`) and grants only `db_datareader` and `db_datawriter`. It intentionally does not grant DDL permissions to the running API.

The account running the script must be the Azure SQL Microsoft Entra administrator or a database owner. Azure SQL must also be able to resolve the API App Service managed identity in Microsoft Entra ID; assign the SQL server identity the required directory-read permissions before running the script when your tenant requires it.

## Grant migration identity access (one-time bootstrap per environment)

`infra/resources.bicep` creates the migration identity (a user-assigned managed identity) as part of `azd provision` — its resource ID and name are available as azd outputs (`MIGRATION_IDENTITY_RESOURCE_ID`, `MIGRATION_IDENTITY_NAME`). Bicep does not, and cannot, grant it database permissions: Azure SQL's contained-user/role grants can only be issued by a principal that is already the server's Microsoft Entra Administrator (your human `sqlAdministratorObjectId`), and that grant can't run unattended inside a deployment.

So, once per environment, after the first `azd provision` has created both the database and the migration identity, grant it `db_owner` (using the [disposable shell](#bootstrap-vnet-access-without-a-bastion-host) if you don't have VNet line-of-sight another way):

```powershell
.\tools\grant-migration-identity-access.ps1 `
  -IdentityDisplayName $env:MIGRATION_IDENTITY_NAME `
  -SqlServerName $env:AZURE_SQL_SERVER_NAME `
  -DatabaseName $env:AZURE_SQL_DATABASE_NAME
```

`db_owner` (rather than narrower roles) is what lets the migration job also grant the API identity's own permissions on every run — see below. This grant is stored in the database itself, so it survives every subsequent `azd provision`/CD run; you only need to do this again if the database is recreated.

## Apply EF Core migrations

Because Azure SQL enforces `publicNetworkAccess: Disabled` and GitHub-hosted runners cannot reach private endpoints directly, database migrations can be executed inside the virtual network using an ephemeral Azure Container Instance (injected into `snet-container` subnet).

The container group runs under the **Bicep-managed migration identity** (`infra/resources.bicep`, output as `MIGRATION_IDENTITY_RESOURCE_ID`/`MIGRATION_IDENTITY_NAME`), which must have been granted `db_owner` once per environment - see [Grant migration identity access](#grant-migration-identity-access-one-time-bootstrap-per-environment). On every run, after applying pending EF Core migrations, the job also grants the API App Service's system-assigned identity `db_datareader`/`db_datawriter` (idempotent), so [Grant the API database access](#grant-the-api-database-access) no longer needs to be run manually in the normal flow.

In PowerShell or GitHub Actions, you can pass the dynamic variables exported directly from `azd`:

```powershell
.\tools\run-vnet-migration.ps1 `
  -ResourceGroup $env:AZURE_RESOURCE_GROUP `
  -SqlServerName $env:AZURE_SQL_SERVER_NAME `
  -DatabaseName $env:AZURE_SQL_DATABASE_NAME `
  -VnetName $env:AZURE_VNET_NAME `
  -MigrationIdentityResourceId $env:MIGRATION_IDENTITY_RESOURCE_ID `
  -ApiAppName $env:API_APP_NAME
```

The script spins up a temporary container in `snet-container`, connects to Azure SQL over the private endpoint, executes pending EF Core migrations, grants the API identity's runtime database access, streams container logs, verifies the zero exit code, and cleans up the container instance.

## Bootstrap VNet access without a Bastion host

`tools/bootstrap-vnet-shell.ps1` gives you a disposable, interactive shell inside the deployed VNet for one-time manual steps that need network line-of-sight to the private Azure SQL endpoint — for example [Grant migration identity access](#grant-migration-identity-access-one-time-bootstrap-per-environment) or the [Grant the API database access](#grant-the-api-database-access) fallback. It reuses the same `snet-container` subnet as the migration job, so no Bastion host or jump box is required, and Azure SQL's `publicNetworkAccess` setting is never touched.

```powershell
.\tools\bootstrap-vnet-shell.ps1 `
  -ResourceGroup $env:AZURE_RESOURCE_GROUP `
  -VnetName $env:AZURE_VNET_NAME
```

This creates a short-lived Azure Container Instance and attaches an interactive shell (`az container exec`). Once attached:

1. Authenticate as yourself: `az login --use-device-code`, then open the printed URL/code in a browser and sign in as the Azure SQL Microsoft Entra administrator (`sqlAdministratorLogin`).
2. Install `sqlcmd` inside the container:

   ```bash
   curl -sSL -O https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb
   dpkg -i packages-microsoft-prod.deb
   apt-get update
   ACCEPT_EULA=Y apt-get install -y mssql-tools18 unixodbc-dev
   export PATH="$PATH:/opt/mssql-tools18/bin"
   ```

3. Run the grant script's `sqlcmd` logic directly (interactive AAD auth), or copy a script into the container with `az container exec` and run it from there. For example, to run the same query as `tools/grant-migration-identity-access.ps1` by hand:

   ```bash
   sqlcmd -S <sql-server-name>.database.windows.net -d <database-name> -G -Q "CREATE USER [<migration-identity-name>] FROM EXTERNAL PROVIDER; ALTER ROLE db_owner ADD MEMBER [<migration-identity-name>];"
   ```

4. Exit the shell (`exit`). The script deletes the container automatically once you disconnect (including on error, via a `finally` block) — nothing is left running.

## Continuous Delivery Pipeline (.github/workflows/cd.yml)

Automated deployments to Azure are handled by `.github/workflows/cd.yml`.

- **CI (`.github/workflows/ci.yml`)**: Runs on pull requests and pushes to `master`. Performs linting, compilation, unit testing, and verifies migration bundle generation. Does **not** alter Azure resources or databases.
- **CD (`.github/workflows/cd.yml`)**: Triggers automatically via the `workflow_run` event **only after CI successfully completes on `master`** (or via manual `workflow_dispatch`). If CI fails, CD is skipped. It authenticates with Azure via OIDC, runs `azd provision`, executes `tools/run-vnet-migration.ps1` inside `snet-container`, and deploys application code via `azd deploy`.

Alternatively, schema changes can be applied manually by an authorized developer identity connected to the virtual network:

```powershell
dotnet ef database update --project src/backend/EnableFront.Builder.Api.csproj
```

The API uses the `DefaultConnection` connection string. In Azure, `Authentication=Active Directory Default` in the connection string makes `Microsoft.Data.SqlClient` acquire an Azure SQL token from the API App Service system-assigned managed identity. Local development uses integrated Windows authentication (`Integrated Security=True`) in `src/backend/appsettings.json`.
