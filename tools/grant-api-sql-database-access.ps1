<#
.SYNOPSIS
Grants the API App Service managed identity runtime access to the Azure SQL database.

.DESCRIPTION
Creates an idempotent contained database user for the API's system-assigned managed identity and
grants only db_datareader and db_datawriter. The invoking user must be an Azure SQL Microsoft Entra
administrator or database owner. This script never accepts, generates, or stores SQL credentials.

NOTE: tools/run-vnet-migration.ps1 now grants this same access automatically on every migration run
(using the migration identity's db_owner privileges). This script is kept only as a manual fallback
for environments where the automated migration job hasn't run yet or isn't in use.

.NOTES
Azure SQL is reachable only through a private endpoint in this deployment (publicNetworkAccess is
Disabled). Run this script from a host with network access to the deployed virtual network
(vnet-enb-*) - for example a corporate network already peered/routed to the VNet, or the disposable
container shell in tools/bootstrap-vnet-shell.ps1. See docs/azd-deployment.md for details.

This script must be run interactively by a human, not from an unattended/headless session. Pass
-AdminUpn <your-upn> to force Microsoft Entra interactive (browser/MFA) authentication; without it,
sqlcmd defaults to ActiveDirectoryIntegrated (Windows/Kerberos SSO), which fails unless the current
session is already signed in to the same Microsoft Entra tenant as the SQL server.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ResourceGroup,

    [Parameter(Mandatory)]
    [string]$ApiAppName,

    [Parameter(Mandatory)]
    [string]$SqlServerName,

    [Parameter(Mandatory)]
    [string]$DatabaseName,

    [Parameter()]
    [string]$AdminUpn
)

$ErrorActionPreference = 'Stop'

function Get-SqlIdentifier {
    param([Parameter(Mandatory)][string]$Value)

    if ($Value -match '[\x00-\x1F]') {
        throw "SQL identifier contains a control character."
    }

    return "[$($Value.Replace(']', ']]'))]"
}

foreach ($command in 'az', 'sqlcmd') {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Required command '$command' was not found. Install it and try again."
    }
}

$principalId = az webapp identity show `
    --resource-group $ResourceGroup `
    --name $ApiAppName `
    --query principalId `
    --output tsv

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($principalId)) {
    throw "Could not resolve the system-assigned managed identity for App Service '$ApiAppName'. Provision the API App Service before running this script."
}

$identityName = Get-SqlIdentifier -Value $ApiAppName
$query = @"
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$($ApiAppName.Replace("'", "''"))')
BEGIN
    CREATE USER $identityName FROM EXTERNAL PROVIDER;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members role_members
    INNER JOIN sys.database_principals roles ON roles.principal_id = role_members.role_principal_id
    INNER JOIN sys.database_principals members ON members.principal_id = role_members.member_principal_id
    WHERE roles.name = N'db_datareader' AND members.name = N'$($ApiAppName.Replace("'", "''"))'
)
BEGIN
    ALTER ROLE db_datareader ADD MEMBER $identityName;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members role_members
    INNER JOIN sys.database_principals roles ON roles.principal_id = role_members.role_principal_id
    INNER JOIN sys.database_principals members ON members.principal_id = role_members.member_principal_id
    WHERE roles.name = N'db_datawriter' AND members.name = N'$($ApiAppName.Replace("'", "''"))'
)
BEGIN
    ALTER ROLE db_datawriter ADD MEMBER $identityName;
END;
"@

Write-Host "Granting Azure SQL runtime access to managed identity '$ApiAppName' ($principalId)..." -ForegroundColor Cyan

# Without -U, sqlcmd's ODBC driver defaults -G to ActiveDirectoryIntegrated (Windows/Kerberos SSO),
# which fails outside an AD-joined session matching the Azure AD tenant. Passing -U with no -P
# switches to ActiveDirectoryInteractive, which opens a browser for a normal Microsoft Entra
# sign-in (including MFA). Run this script interactively - it cannot complete unattended.
$sqlcmdArgs = @(
    '-S', "$SqlServerName.database.windows.net",
    '-d', $DatabaseName,
    '-G',
    '-b',
    '-l', '30'
)
if ($AdminUpn) {
    $sqlcmdArgs += @('-U', $AdminUpn)
}
$sqlcmdArgs += @('-Q', $query)

sqlcmd @sqlcmdArgs

if ($LASTEXITCODE -ne 0) {
    throw "Azure SQL permissions were not granted. Confirm your account is the Azure SQL Microsoft Entra administrator or database owner, and that the SQL server can resolve the App Service managed identity in Microsoft Entra ID."
}

Write-Host "Granted db_datareader and db_datawriter to '$ApiAppName'." -ForegroundColor Green
