<#
.SYNOPSIS
Grants db_owner on Azure SQL Database to a migration identity.

.DESCRIPTION
Creates an idempotent contained database user for the designated migration identity (e.g., user-assigned managed identity or service principal)
and grants db_owner. The invoking user must be an Azure SQL Microsoft Entra administrator or database owner.
This script never accepts, generates, or stores SQL credentials.

This is a one-time bootstrap per environment: run it once after the migration identity and database first exist (created together by
`azd provision`), then tools/run-vnet-migration.ps1 can run unattended in CI/CD from then on - db_owner is enough for that job to also grant
the API app's own identity access on every run, without any further manual steps.

.NOTES
Azure SQL is reachable only through a private endpoint in this deployment (publicNetworkAccess is Disabled).
Run this script from a host with network access to the deployed virtual network (vnet-enb-*) or via a VNet-connected migration task,
such as the disposable container shell in tools/bootstrap-vnet-shell.ps1.
Pass -AdminUpn <your-upn> to force Microsoft Entra interactive authentication if running interactively.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$IdentityDisplayName,

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

if (-not (Get-Command 'sqlcmd' -ErrorAction SilentlyContinue)) {
    throw "Required command 'sqlcmd' was not found. Install it and try again."
}

$escapedIdentity = $IdentityDisplayName.Replace("'", "''")
$sqlIdentity = Get-SqlIdentifier -Value $IdentityDisplayName

$query = @"
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$escapedIdentity')
BEGIN
    CREATE USER $sqlIdentity FROM EXTERNAL PROVIDER;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_role_members role_members
    INNER JOIN sys.database_principals roles ON roles.principal_id = role_members.role_principal_id
    INNER JOIN sys.database_principals members ON members.principal_id = role_members.member_principal_id
    WHERE roles.name = N'db_owner' AND members.name = N'$escapedIdentity'
)
BEGIN
    ALTER ROLE db_owner ADD MEMBER $sqlIdentity;
END;
"@

Write-Host "Granting db_owner to '$IdentityDisplayName' (required so the migration job can also grant the API identity's permissions)..." -ForegroundColor Cyan

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
    throw "Azure SQL permissions were not granted to '$IdentityDisplayName'."
}

Write-Host "Granted db_owner to '$IdentityDisplayName'." -ForegroundColor Green
