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

The CD workflow also requires `AZURE_MIGRATION_IDENTITY_RESOURCE_ID`, set to the resource ID of a user-assigned managed identity. Create or reuse that identity, grant it access with `tools/grant-migration-identity-access.ps1`, and store its resource ID as a GitHub Actions secret before running CD.

The deployment service principal in `AZURE_CLIENT_ID` must have a Microsoft Entra federated identity credential for GitHub Actions. Use the immutable subject issued for this repository:

```text
Issuer:   https://token.actions.githubusercontent.com
Subject:  repo:kwkraus@20584716/enablemint-builder@1160024462:ref:refs/heads/master
Audience: api://AzureADTokenExchange
```

Create this credential on the deployment service principal (not the runtime application configured by `AZURE_AD_CLIENT_ID`) before running CD. The subject includes the immutable GitHub owner and repository IDs; using the legacy `repo:kwkraus/enablemint-builder:ref:refs/heads/master` subject causes `azure/login` to fail with `AADSTS70025`.

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

Because Azure SQL only accepts connections through the private endpoint, `sqlcmd` must run from a host with network line-of-sight to the virtual network (`vnet-enb-*`) — for example:

- A workstation already routed to the VNet through your organization's ExpressRoute/VPN peering (common on corporate networks; ask your network team if the VNet needs an explicit peering or route).
- A temporary jump box or Azure Bastion host deployed into the `snet-privateendpoints` (or a new) subnet of the same VNet, used only for this one-time step and then removed.

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

## Grant migration identity access

If using a dedicated migration identity (such as a Service Principal or User-Assigned Managed Identity for CI/CD), grant it `db_ddladmin`, `db_datareader`, and `db_datawriter` permissions using:

```powershell
.\tools\grant-migration-identity-access.ps1 `
  -IdentityDisplayName "<MIGRATION_IDENTITY_NAME>" `
  -SqlServerName $env:AZURE_SQL_SERVER_NAME `
  -DatabaseName $env:AZURE_SQL_DATABASE_NAME
```

## Apply EF Core migrations

Because Azure SQL enforces `publicNetworkAccess: Disabled` and GitHub-hosted runners cannot reach private endpoints directly, database migrations can be executed inside the virtual network using an ephemeral Azure Container Instance (injected into `snet-container` subnet).

The container group must run under a **dedicated migration identity** (for example, a user-assigned managed identity) that has been granted `db_ddladmin`/`db_datareader`/`db_datawriter`, and its resource ID must be provided to the migration runner (e.g., via `AZURE_MIGRATION_IDENTITY_RESOURCE_ID` in CI/CD).

In PowerShell or GitHub Actions, you can pass the dynamic variables exported directly from `azd`:

```powershell
.\tools\run-vnet-migration.ps1 `
  -ResourceGroup $env:AZURE_RESOURCE_GROUP `
  -SqlServerName $env:AZURE_SQL_SERVER_NAME `
  -DatabaseName $env:AZURE_SQL_DATABASE_NAME `
  -VnetName $env:AZURE_VNET_NAME `
  -MigrationIdentityResourceId "<user-assigned-identity-resource-id>"
```

The script spins up a temporary container in `snet-container`, connects to Azure SQL over the private endpoint, executes pending EF Core migrations, streams container logs, verifies the zero exit code, and cleans up the container instance.

## Continuous Delivery Pipeline (.github/workflows/cd.yml)

Automated deployments to Azure are handled by `.github/workflows/cd.yml`.

- **CI (`.github/workflows/ci.yml`)**: Runs on pull requests and pushes to `master`. Performs linting, compilation, unit testing, and verifies migration bundle generation. Does **not** alter Azure resources or databases.
- **CD (`.github/workflows/cd.yml`)**: Triggers automatically via the `workflow_run` event **only after CI successfully completes on `master`** (or via manual `workflow_dispatch`). If CI fails, CD is skipped. It authenticates with Azure via OIDC, runs `azd provision`, executes `tools/run-vnet-migration.ps1` inside `snet-container`, and deploys application code via `azd deploy`.

Alternatively, schema changes can be applied manually by an authorized developer identity connected to the virtual network:

```powershell
dotnet ef database update --project src/backend/EnableFront.Builder.Api.csproj
```

The API uses the `DefaultConnection` connection string. In Azure, `Authentication=Active Directory Default` in the connection string makes `Microsoft.Data.SqlClient` acquire an Azure SQL token from the API App Service system-assigned managed identity. Local development uses integrated Windows authentication (`Integrated Security=True`) in `src/backend/appsettings.json`.
