# Deploying with Azure Developer CLI

This project deploys the hybrid Next.js frontend and .NET API to Linux Azure App Service using Azure Developer CLI (azd). The infrastructure in `infra/` is composed from pinned Azure Verified Modules (AVM) for Log Analytics, Application Insights, App Service, and Azure SQL.

## Prerequisites

- Azure Developer CLI, Azure CLI, and Bicep installed.
- An Azure subscription with permissions to create resource groups and the resources in `infra/main.bicep`.
- A Microsoft Entra user who can be configured as the Azure SQL server administrator.
- An existing single-tenant Entra application registration with the delegated permissions in [setup-entra-permissions.md](setup-entra-permissions.md).
- Network access permitted by the Azure SQL firewall for the database grant and migration steps (see [Grant the API database access](#grant-the-api-database-access)).

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

`infra/main.parameters.json` maps these azd environment variables to the required Bicep parameters. The secret inputs are Bicep secure parameters, but `azd env set` writes values into the local `.azure/<environment>/.env` file. Use a protected local environment or `azd env set-secret` with Azure Key Vault rather than sharing that file.

The Azure SQL server uses public network access with the Azure-services firewall rule. The API connects with its system-assigned managed identity using Microsoft Entra authentication; no SQL administrator or application connection-string credentials are provisioned. The Azure-services rule does not grant access from a local workstation; add a firewall rule for your current public IP before running database administration commands locally.

## Provision and deploy

```powershell
azd provision
azd deploy
```

If this environment was previously deployed with the private-network configuration, `azd provision` does not delete the former VNet, private endpoint, private DNS zone, or migration identity. Delete those retired resources manually after confirming the API can connect through the public SQL endpoint.

`azd provision` outputs the frontend and API endpoints along with Azure SQL resource names. Those outputs also make `BACKEND_API_BASE_URL` and `NEXT_PUBLIC_BACKEND_API_BASE_URL` available to the Next.js build, so no azd prepackage or postdeploy hooks are required.

Before users sign in, add the frontend endpoint as an Entra application redirect URI:

```text
https://<frontend-app>.azurewebsites.net/api/auth/callback/azure-ad
```

The Bicep deployment configures the API CORS allow-list for the generated frontend endpoint. Update the App Service settings and Entra redirect URI together if a custom domain is later introduced.

## Grant the API database access

Run this once after the API App Service is created or recreated. The invoking account must be the Azure SQL Microsoft Entra administrator or a database owner.

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

## Apply EF Core migrations

The CD workflow does not apply database migrations. Before deploying application code that requires a schema change, an authorized developer must apply the pending migrations:

```powershell
dotnet ef database update --project src/backend/EnableFront.Builder.Api.csproj
```

## Continuous Delivery Pipeline (.github/workflows/cd.yml)

Automated deployments to Azure are handled by `.github/workflows/cd.yml`.

- **CI (`.github/workflows/ci.yml`)**: Runs on pull requests and pushes to `master`. Performs linting, compilation, unit testing, and verifies migration bundle generation. Does **not** alter Azure resources or databases.
- **CD (`.github/workflows/cd.yml`)**: Triggers automatically via the `workflow_run` event **only after CI successfully completes on `master`** (or via manual `workflow_dispatch`). If CI fails, CD is skipped. It authenticates with Azure via OIDC and configures `azd` to reuse the Azure CLI credential, runs `azd provision`, and deploys application code via `azd deploy`.

The API uses the `DefaultConnection` connection string. In Azure, `Authentication=Active Directory Default` in the connection string makes `Microsoft.Data.SqlClient` acquire an Azure SQL token from the API App Service system-assigned managed identity. Local development uses integrated Windows authentication (`Integrated Security=True`) in `src/backend/appsettings.json`.
