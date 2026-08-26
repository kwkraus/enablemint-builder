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

After provisioning, grant the API's system-assigned managed identity its runtime database permissions:

```powershell
.\tools\grant-api-sql-database-access.ps1 `
  -ResourceGroup "<AZURE_RESOURCE_GROUP>" `
  -ApiAppName "<API_APP_NAME>" `
  -SqlServerName "<AZURE_SQL_SERVER_NAME>" `
  -DatabaseName "<AZURE_SQL_DATABASE_NAME>"
```

The script uses Microsoft Entra authentication (`sqlcmd -G`) and grants only `db_datareader` and `db_datawriter`. It intentionally does not grant DDL permissions to the running API.

The account running the script must be the Azure SQL Microsoft Entra administrator or a database owner. Azure SQL must also be able to resolve the API App Service managed identity in Microsoft Entra ID; assign the SQL server identity the required directory-read permissions before running the script when your tenant requires it.

## Apply EF Core migrations

Database schema changes are not run as an azd hook. Use an authorized developer or CI/CD identity with the required database DDL permissions, run from the same network-connected host described above:

```powershell
dotnet ef database update --project src/backend/EnableFront.Builder.Api.csproj
```

The API uses `SqlDatabase` settings rather than a configured connection string. In Azure, its `ActiveDirectoryDefault` setting makes `Microsoft.Data.SqlClient` acquire an Azure SQL token from the API App Service system-assigned managed identity. Local development preserves the integrated SQL Express configuration in `src/backend/appsettings.json`.
