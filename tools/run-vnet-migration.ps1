<#
.SYNOPSIS
Executes EF Core database migrations inside a virtual network subnet via an ephemeral Azure Container Instance (ACI).

.DESCRIPTION
Spins up a temporary Azure Container Instance inside the specified VNet subnet (snet-container),
connects to Azure SQL over the private endpoint (pep-sql-enb-*), applies pending EF Core migrations,
then grants the API App Service's system-assigned managed identity db_datareader/db_datawriter
(idempotent), streams container logs, verifies exit status, and cleans up the container group.

The migration identity must already have been granted db_owner on the target database via
tools/grant-migration-identity-access.ps1 (one-time manual bootstrap per environment) - db_owner is
what allows this job to also grant the API identity's permissions in the same run.

.EXAMPLE
.\tools\run-vnet-migration.ps1 `
  -ResourceGroup "rg-dev" `
  -SqlServerName "sql-enb-dev" `
  -DatabaseName "sqldb-enb-dev" `
  -VnetName "vnet-enb-dev" `
  -ApiAppName "api-enb-dev" `
  -ImageName "mcr.microsoft.com/dotnet/sdk:10.0"
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$ResourceGroup = '',

    [Parameter(Mandatory)]
    [string]$SqlServerName,

    [Parameter(Mandatory)]
    [string]$DatabaseName,

    [Parameter(Mandatory)]
    [string]$VnetName,

    [Parameter(Mandatory)]
    [string]$MigrationIdentityResourceId,

    [Parameter(Mandatory)]
    [string]$ApiAppName,

    [Parameter()]
    [string]$SubnetName = 'snet-container',

    [Parameter()]
    [string]$ImageName = 'mcr.microsoft.com/dotnet/sdk:10.0',

    [Parameter()]
    [string]$ContainerGroupName
)

$ErrorActionPreference = 'Stop'

function Resolve-ResourceGroupForVnet {
    param(
        [Parameter(Mandatory)]
        [string]$VnetName,

        [Parameter()]
        [string]$RequestedResourceGroup = ''
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedResourceGroup)) {
        $resourceGroupExists = az group exists --name $RequestedResourceGroup --output tsv 2>$null
        if ($LASTEXITCODE -eq 0 -and $resourceGroupExists -eq 'true') {
            return $RequestedResourceGroup
        }
    }

    $candidateResourceGroups = @(az group list --query "[].name" --output tsv 2>$null)
    foreach ($candidate in $candidateResourceGroups) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        $vnetId = az network vnet show --resource-group $candidate --name $VnetName --query id --output tsv 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($vnetId)) {
            return $candidate
        }
    }

    return $null
}

if ([string]::IsNullOrWhiteSpace($ContainerGroupName)) {
    $ContainerGroupName = "aci-ef-migration-runner-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
}

if (-not (Get-Command 'az' -ErrorAction SilentlyContinue)) {
    throw "Required command 'az' was not found. Install Azure CLI and try again."
}

$resolvedResourceGroup = Resolve-ResourceGroupForVnet -VnetName $VnetName -RequestedResourceGroup $ResourceGroup
if ([string]::IsNullOrWhiteSpace($resolvedResourceGroup)) {
    throw "Could not locate a resource group containing VNet '$VnetName'. Ensure the azd environment is current and the provision step created the networking resources."
}

if (-not [string]::IsNullOrWhiteSpace($ResourceGroup) -and $ResourceGroup -ne $resolvedResourceGroup) {
    Write-Host "Requested resource group '$ResourceGroup' was not found; falling back to '$resolvedResourceGroup' discovered via VNet lookup." -ForegroundColor Yellow
}

$ResourceGroup = $resolvedResourceGroup

Write-Host "Resolving VNet subnet '$SubnetName' in VNet '$VnetName'..." -ForegroundColor Cyan

$subnetId = az network vnet subnet show `
    --resource-group $ResourceGroup `
    --vnet-name $VnetName `
    --name $SubnetName `
    --query id `
    --output tsv

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($subnetId)) {
    throw "Could not resolve subnet '$SubnetName' in VNet '$VnetName'. Ensure infrastructure with delegated container subnet is provisioned."
}

Write-Host "Resolving resource group location..." -ForegroundColor Cyan

$location = az group show --name $ResourceGroup --query location --output tsv

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($location)) {
    throw "Could not resolve location for resource group '$ResourceGroup'."
}

$identityId = $MigrationIdentityResourceId.Trim()
if ($identityId -notmatch '^/subscriptions/[^/]+/resourceGroups/[^/]+/providers/Microsoft.ManagedIdentity/userAssignedIdentities/[^/]+$') {
    throw "Migration identity resource ID must reference a user-assigned managed identity."
}

if ($ApiAppName -notmatch '^[a-zA-Z0-9-]+$') {
    throw "API app name must contain only letters, numbers, and hyphens."
}

Write-Host "Resolving migration identity client ID..." -ForegroundColor Cyan

$identityClientId = az identity show --ids $identityId --query clientId --output tsv

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($identityClientId)) {
    throw "Could not resolve client ID for migration identity '$identityId'."
}


# User Id must be pinned to the migration identity's client ID: the container only has this
# user-assigned identity attached (no system-assigned identity), so leaving it unspecified makes
# the token request ambiguous and can surface as "Login failed ... server not configured to accept
# this token" instead of a clean identity error.
$connectionString = "Server=tcp:$SqlServerName.database.windows.net,1433;Initial Catalog=$DatabaseName;Authentication=Active Directory Managed Identity;User Id=$identityClientId;Encrypt=True;TrustServerCertificate=False;"

Write-Host "Creating ephemeral migration runner container '$ContainerGroupName' in subnet '$SubnetName'..." -ForegroundColor Cyan

# Requires the migration identity to already hold db_owner (tools/grant-migration-identity-access.ps1);
# db_owner is sufficient to create/alter the API identity's contained user without a separate admin identity.
$grantApiAccessSql = "IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$ApiAppName') CREATE USER [$ApiAppName] FROM EXTERNAL PROVIDER; IF NOT EXISTS (SELECT 1 FROM sys.database_role_members rm JOIN sys.database_principals r ON r.principal_id = rm.role_principal_id JOIN sys.database_principals m ON m.principal_id = rm.member_principal_id WHERE r.name = N'db_datareader' AND m.name = N'$ApiAppName') ALTER ROLE db_datareader ADD MEMBER [$ApiAppName]; IF NOT EXISTS (SELECT 1 FROM sys.database_role_members rm JOIN sys.database_principals r ON r.principal_id = rm.role_principal_id JOIN sys.database_principals m ON m.principal_id = rm.member_principal_id WHERE r.name = N'db_datawriter' AND m.name = N'$ApiAppName') ALTER ROLE db_datawriter ADD MEMBER [$ApiAppName];"

# mssql-tools18's sqlcmd has no --authentication-method flag (that's only in the newer go-sqlcmd); instead,
# fetch the container's own managed-identity token from the ACI metadata endpoint and pass it via -G -P <tokenfile>.
$rawScript = "echo Starting EF Core Migration... && git clone https://github.com/kwkraus/enablemint-builder.git repo && cd repo/src/backend && dotnet restore && dotnet tool install --global dotnet-ef && export PATH=`$PATH:`$HOME/.dotnet/tools && for attempt in `{1..20`}; do dotnet ef database update && break; if [ `"`$attempt`" -eq 20 ]; then exit 1; fi; echo `"Database token authentication is not ready; retrying in 15 seconds...`"; sleep 15; done && echo Installing sqlcmd... && curl -sSL -O https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb && dpkg -i packages-microsoft-prod.deb && apt-get update && ACCEPT_EULA=Y apt-get install -y mssql-tools18 unixodbc-dev jq && export PATH=`"`$PATH:/opt/mssql-tools18/bin`" && echo Granting API identity database access... && curl -s -H `"Metadata:true`" `"http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fdatabase.windows.net%2F&client_id=$identityClientId`" | jq -r '.access_token' | tr -d '\n' | iconv -f ascii -t UTF-16LE > /tmp/tokenFile && sqlcmd -S $SqlServerName.database.windows.net -d $DatabaseName -G -P /tmp/tokenFile -C -Q `"$grantApiAccessSql`""

$aciSpec = @{
    location = $location
    identity = @{
        type = 'UserAssigned'
        userAssignedIdentities = @{
            $identityId = @{}
        }
    }
    properties = @{
        osType = 'Linux'
        restartPolicy = 'Never'
        containers = @(
            @{
                name = $ContainerGroupName
                properties = @{
                    image = $ImageName
                    command = @(
                        '/bin/bash',
                        '-c',
                        $rawScript
                    )
                    environmentVariables = @(
                        @{
                            name = 'ConnectionStrings__DefaultConnection'
                            secureValue = $connectionString
                        }
                    )
                    resources = @{
                        requests = @{
                            cpu = 1.0
                            memoryInGb = 2.0
                        }
                    }
                }
            }
        )
        subnetIds = @(
            @{
                id = $subnetId
            }
        )
    }
}

$tempJsonPath = Join-Path ([System.IO.Path]::GetTempPath()) "aci-migration-$([Guid]::NewGuid().ToString('N')).json"
$aciSpec | ConvertTo-Json -Depth 10 | Set-Content -Path $tempJsonPath -Encoding UTF8

try {
    az container create `
        --resource-group $ResourceGroup `
        --name $ContainerGroupName `
        --file $tempJsonPath
}
finally {
    Remove-Item $tempJsonPath -Force -ErrorAction SilentlyContinue
}

if ($LASTEXITCODE -ne 0) {
    throw "Failed to create ephemeral container instance '$ContainerGroupName'."
}

try {
    Write-Host "Streaming migration logs from container '$ContainerGroupName'..." -ForegroundColor Cyan
    az container logs --resource-group $ResourceGroup --name $ContainerGroupName --follow

    $exitCode = az container show `
        --resource-group $ResourceGroup `
        --name $ContainerGroupName `
        --query "containers[0].instanceView.currentState.exitCode" `
        --output tsv

    if ($exitCode -ne '0') {
        throw "EF Core migration failed inside container with exit code $exitCode."
    }

    Write-Host "EF Core database migrations completed successfully!" -ForegroundColor Green
}
finally {
    Write-Host "Cleaning up ephemeral container group '$ContainerGroupName'..." -ForegroundColor Cyan
    az container delete --resource-group $ResourceGroup --name $ContainerGroupName --yes --output none
    Write-Host "Cleanup complete." -ForegroundColor Green
}
