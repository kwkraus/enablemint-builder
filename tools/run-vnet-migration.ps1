<#
.SYNOPSIS
Executes EF Core database migrations inside a virtual network subnet via an ephemeral Azure Container Instance (ACI).

.DESCRIPTION
Spins up a temporary Azure Container Instance inside the specified VNet subnet (snet-container),
connects to Azure SQL over the private endpoint (pep-sql-enb-*), applies pending EF Core migrations,
streams container logs, verifies exit status, and cleans up the container group.

.EXAMPLE
.\tools\run-vnet-migration.ps1 `
  -ResourceGroup "rg-dev" `
  -SqlServerName "sql-enb-dev" `
  -DatabaseName "sqldb-enb-dev" `
  -VnetName "vnet-enb-dev" `
  -ImageName "mcr.microsoft.com/dotnet/sdk:10.0"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ResourceGroup,

    [Parameter(Mandatory)]
    [string]$SqlServerName,

    [Parameter(Mandatory)]
    [string]$DatabaseName,

    [Parameter(Mandatory)]
    [string]$VnetName,

    [Parameter()]
    [string]$SubnetName = 'snet-container',

    [Parameter()]
    [string]$ImageName = 'mcr.microsoft.com/dotnet/sdk:10.0-preview',

    [Parameter()]
    [string]$ContainerGroupName = 'aci-ef-migration-runner'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command 'az' -ErrorAction SilentlyContinue)) {
    throw "Required command 'az' was not found. Install Azure CLI and try again."
}

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

$connectionString = "Server=tcp:$SqlServerName.database.windows.net,1433;Initial Catalog=$DatabaseName;Authentication=Active Directory Default;Encrypt=True;TrustServerCertificate=False;"

Write-Host "Creating ephemeral migration runner container '$ContainerGroupName' in subnet '$SubnetName'..." -ForegroundColor Cyan

$rawScript = "echo Starting EF Core Migration... && git clone https://github.com/kwkraus/enablemint-builder.git repo && cd repo/src/backend && dotnet restore && dotnet tool install --global dotnet-ef && export PATH=`$PATH:`$HOME/.dotnet/tools && dotnet ef database update"

$aciSpec = @{
    location = $location
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
